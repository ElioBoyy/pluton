import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { and, authSessions, eq, gt, users, type Db } from "@pluton/db";

/**
 * The hosted app (PLUTON_HOSTED=1) signs people in with Google or Apple and asks them to pay before
 * anything else. Self-hosted installs keep no accounts: every route below answers as if signed out
 * and the app never asks.
 */
export const HOSTED = process.env.PLUTON_HOSTED === "1";

/** Where the browser reaches the app; the OAuth and Stripe redirects come back here. */
export const APP_URL = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");

const SESSION_COOKIE = "pluton_session";
const SESSION_DAYS = 30;
const SECURE = APP_URL.startsWith("https://");

const google = {
  clientId: process.env.GOOGLE_CLIENT_ID ?? "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
};
const apple = {
  /** The Services ID, not the app's bundle id. */
  clientId: process.env.APPLE_CLIENT_ID ?? "",
  teamId: process.env.APPLE_TEAM_ID ?? "",
  keyId: process.env.APPLE_KEY_ID ?? "",
  /** The .p8 key's contents; `\n` written literally in .env are turned back into line breaks. */
  privateKey: (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
};

export const providers = {
  google: Boolean(google.clientId && google.clientSecret),
  apple: Boolean(apple.clientId && apple.teamId && apple.keyId && apple.privateKey),
};

export type User = typeof users.$inferSelect;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const base64url = (bytes: Buffer) => bytes.toString("base64url");

/** Paid means Stripe says the subscription runs: active, or in a trial it started. */
export const isPaid = (user: Pick<User, "subscriptionStatus">) => user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";

export async function currentUser(db: Db, c: Context): Promise<User | null> {
  if (!HOSTED) return null;
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.id, sha256(token)), gt(authSessions.expiresAt, new Date())));
  return row?.user ?? null;
}

async function startSession(db: Db, c: Context, userId: string) {
  const token = base64url(randomBytes(32));
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(authSessions).values({ id: sha256(token), userId, expiresAt });
  setCookie(c, SESSION_COOKIE, token, { path: "/", httpOnly: true, secure: SECURE, sameSite: "Lax", expires: expiresAt });
}

/** What a provider told us about the person, read from the ID token it handed over. */
type Identity = { provider: "google" | "apple"; sub: string; email: string | null; emailVerified: boolean; name: string | null };

/**
 * Finds the person by the provider's id, else by a verified email they already signed in with
 * (Google then Apple, same address), else creates them.
 */
async function upsertUser(db: Db, who: Identity): Promise<User> {
  const subColumn = who.provider === "google" ? users.googleSub : users.appleSub;
  const subField = who.provider === "google" ? "googleSub" : "appleSub";
  const bySub = await db.query.users.findFirst({ where: eq(subColumn, who.sub) });
  if (bySub) return bySub;
  const byEmail = who.email && who.emailVerified ? await db.query.users.findFirst({ where: eq(users.email, who.email) }) : undefined;
  if (byEmail && !byEmail[subField]) {
    const [linked] = await db
      .update(users)
      .set({ [subField]: who.sub, name: byEmail.name ?? who.name })
      .where(eq(users.id, byEmail.id))
      .returning();
    return linked!;
  }
  const [created] = await db.insert(users).values({ [subField]: who.sub, email: who.email, name: who.name }).returning();
  return created!;
}

/**
 * The ID token came straight from the provider's token endpoint over TLS, in exchange for our
 * client secret, so its claims are read without checking the signature (OpenID Connect §3.1.3.7).
 */
function claims(idToken: string): Record<string, unknown> {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Malformed ID token");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

/** Apple's client secret is a short-lived JWT signed with the .p8 key. */
function appleClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: "ES256", kid: apple.keyId })));
  const payload = base64url(
    Buffer.from(JSON.stringify({ iss: apple.teamId, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: apple.clientId })),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: createPrivateKey(apple.privateKey), dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${base64url(signature)}`;
}

async function exchange(url: string, params: Record<string, string>) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  const body = (await res.json()) as { id_token?: string; error?: string };
  if (!res.ok || !body.id_token) throw new Error(`Token exchange failed: ${body.error ?? res.status}`);
  return claims(body.id_token);
}

const redirectUri = (provider: "google" | "apple") => `${APP_URL}/api/auth/${provider}/callback`;
const failed = (c: Context, reason: string) => c.redirect(`${APP_URL}/signup?error=${encodeURIComponent(reason)}`);

/** Sign-in routes, under /api/auth. */
export function mountAuth(app: Hono, db: Db) {
  // Apple posts its answer from appleid.apple.com: a Lax cookie wouldn't come along, so the
  // one-time state cookie is SameSite=None (browsers accept Secure on http://localhost).
  const stateCookie = { path: "/api/auth", httpOnly: true, secure: true, sameSite: "None", maxAge: 600 } as const;

  app.get("/api/auth/google", (c) => {
    if (!HOSTED || !providers.google) return c.notFound();
    const state = base64url(randomBytes(16));
    const verifier = base64url(randomBytes(32));
    setCookie(c, "pluton_oauth", `${state}.${verifier}`, { ...stateCookie, sameSite: "Lax" });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: redirectUri("google"),
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: base64url(createHash("sha256").update(verifier).digest()),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return c.redirect(url.toString());
  });

  app.get("/api/auth/google/callback", async (c) => {
    if (!HOSTED || !providers.google) return c.notFound();
    const [state, verifier] = (getCookie(c, "pluton_oauth") ?? "").split(".");
    deleteCookie(c, "pluton_oauth", { path: "/api/auth" });
    const code = c.req.query("code");
    if (c.req.query("error")) return failed(c, "cancelled");
    if (!code || !state || !verifier || c.req.query("state") !== state) return failed(c, "expired");
    try {
      const token = await exchange("https://oauth2.googleapis.com/token", {
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: redirectUri("google"),
        grant_type: "authorization_code",
        code_verifier: verifier,
      });
      const user = await upsertUser(db, {
        provider: "google",
        sub: String(token.sub),
        email: typeof token.email === "string" ? token.email.toLowerCase() : null,
        emailVerified: token.email_verified === true,
        name: typeof token.name === "string" ? token.name : null,
      });
      await startSession(db, c, user.id);
      return c.redirect(`${APP_URL}/`);
    } catch (error) {
      console.error("[auth] Google sign-in failed", error);
      return failed(c, "provider");
    }
  });

  app.get("/api/auth/apple", (c) => {
    if (!HOSTED || !providers.apple) return c.notFound();
    const state = base64url(randomBytes(16));
    setCookie(c, "pluton_oauth", state, stateCookie);
    const url = new URL("https://appleid.apple.com/auth/authorize");
    url.search = new URLSearchParams({
      client_id: apple.clientId,
      redirect_uri: redirectUri("apple"),
      response_type: "code",
      // Asking for the name or email makes Apple post the answer instead of redirecting.
      response_mode: "form_post",
      scope: "name email",
      state,
    }).toString();
    return c.redirect(url.toString());
  });

  app.post("/api/auth/apple/callback", async (c) => {
    if (!HOSTED || !providers.apple) return c.notFound();
    const state = getCookie(c, "pluton_oauth");
    deleteCookie(c, "pluton_oauth", { path: "/api/auth", secure: true, sameSite: "None" });
    const form = await c.req.parseBody();
    if (form.error) return failed(c, "cancelled");
    const code = typeof form.code === "string" ? form.code : null;
    if (!code || !state || form.state !== state) return failed(c, "expired");
    try {
      const token = await exchange("https://appleid.apple.com/auth/token", {
        code,
        client_id: apple.clientId,
        client_secret: appleClientSecret(),
        redirect_uri: redirectUri("apple"),
        grant_type: "authorization_code",
      });
      // Apple sends the name once, on the very first sign-in, beside the code rather than in the token.
      let name: string | null = null;
      if (typeof form.user === "string") {
        const sent = JSON.parse(form.user) as { name?: { firstName?: string; lastName?: string } };
        name = [sent.name?.firstName, sent.name?.lastName].filter(Boolean).join(" ") || null;
      }
      const user = await upsertUser(db, {
        provider: "apple",
        sub: String(token.sub),
        email: typeof token.email === "string" ? token.email.toLowerCase() : null,
        // Apple sends it as a boolean or as the string "true".
        emailVerified: token.email_verified === true || token.email_verified === "true",
        name,
      });
      await startSession(db, c, user.id);
      // A 303 turns the provider's POST into a GET of the app.
      return c.redirect(`${APP_URL}/`, 303);
    } catch (error) {
      console.error("[auth] Apple sign-in failed", error);
      return failed(c, "provider");
    }
  });

  app.post("/api/auth/signout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await db.delete(authSessions).where(eq(authSessions.id, sha256(token)));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  /** What the app needs to decide where to go: sign in, pay, or carry on. */
  app.get("/api/auth/state", async (c) => {
    const user = await currentUser(db, c);
    c.header("Cache-Control", "no-store");
    return c.json({
      hosted: HOSTED,
      providers,
      user: user && { email: user.email, name: user.name, plan: user.plan, paid: isPaid(user), status: user.subscriptionStatus },
    });
  });
}
