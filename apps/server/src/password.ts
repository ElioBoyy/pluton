import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { Context, Hono } from "hono";
import { openWorkspaceFor } from "@pluton/core";
import { and, authSessions, authTokens, eq, isNotNull, lt, users, type AuthTokenKind, type Db } from "@pluton/db";
import { isLocale, localized, withLocale } from "@pluton/i18n/server";
import { sendMail } from "@pluton/providers";
import { APP_URL, base64url, HOSTED, providers, sha256, startSession, type User } from "./auth.ts";
import messages from "./messages/auth.ts";

/**
 * Signing in with an email and a password, beside Google and Apple. Nothing is created for an
 * address until a link sent to it is opened: the account then starts, or, when the address
 * already signs in with Google or Apple, the password joins that account. So nobody can claim
 * someone else's address ahead of them. Answers never tell whether an address has an account.
 */

const t = localized(messages);

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 200;
const SIGNUP_HOURS = 24;
const RESET_HOURS = 1;

// scrypt at 2^15: about 32 MB and a few tens of milliseconds per hash.
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;
const scrypt = (password: string, salt: Buffer, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key))));

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${base64url(salt)}$${base64url(key)}`;
}

export async function checkPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(password, Buffer.from(salt, "base64url"), { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Checked against when the address has no password, so a wrong address takes as long as a wrong password. */
const DECOY = hashPassword(base64url(randomBytes(16)));

/** At most `max` times per `windowMs` for one key (an address, an IP); counted in this process. */
function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= max) return false;
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}
const signInByAddress = limiter(10, 15 * 60_000);
const signInByIp = limiter(50, 15 * 60_000);
const mailByAddress = limiter(3, 60 * 60_000);
const mailByIp = limiter(20, 60 * 60_000);

/** The visitor's address as Traefik passes it on. */
const ipOf = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";

const normalize = (email: unknown) => (typeof email === "string" ? email.trim().toLowerCase() : "");
const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = (password: unknown): password is string =>
  typeof password === "string" && password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;

const escape = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** A short email with one link, in the language the app was used in. */
async function sendLink(to: string, subject: string, lines: string[], link: string) {
  const text = [...lines.slice(0, 1), link, "", ...lines.slice(1)].join("\n");
  const html = [
    `<p>${escape(lines[0]!)}</p>`,
    `<p><a href="${escape(link)}">${escape(link)}</a></p>`,
    ...lines.slice(1).map((l) => `<p style="color:#666">${escape(l)}</p>`),
  ].join("");
  await sendMail({ to, subject, html, text });
}

async function issueToken(db: Db, kind: AuthTokenKind, values: { email: string; userId?: string; passwordHash?: string; name?: string | null }) {
  const token = base64url(randomBytes(32));
  const hours = kind === "signup" ? SIGNUP_HOURS : RESET_HOURS;
  await db.delete(authTokens).where(lt(authTokens.expiresAt, new Date()));
  await db.insert(authTokens).values({ id: sha256(token), kind, ...values, expiresAt: new Date(Date.now() + hours * 3_600_000) });
  return token;
}

/** Takes a link's token: valid once, before it expires. */
async function consumeToken(db: Db, kind: AuthTokenKind, token: unknown) {
  if (typeof token !== "string" || !token) return null;
  const [row] = await db.delete(authTokens).where(and(eq(authTokens.id, sha256(token)), eq(authTokens.kind, kind))).returning();
  return row && row.expiresAt > new Date() ? row : null;
}

/** The account an address belongs to, the one whose address is proven first. */
async function accountFor(db: Db, email: string): Promise<User | undefined> {
  const found = await db.query.users.findMany({ where: eq(users.email, email) });
  return found.find((u) => u.emailVerifiedAt || u.googleSub || u.appleSub || u.passwordHash) ?? found[0];
}

async function sendReset(db: Db, user: User, email: string, subject = t("reset.subject"), intro = t("reset.body")) {
  const token = await issueToken(db, "reset", { email, userId: user.id });
  await sendLink(email, subject, [intro, t("expires.hour"), t("ignore")], `${APP_URL}/reset?token=${token}`);
}

type Body = { email?: unknown; password?: unknown; name?: unknown; token?: unknown; locale?: unknown };

/** Routes under /api/auth/password. Hosted only, and only once the app can send email. */
export function mountPassword(app: Hono, db: Db) {
  const enabled = () => HOSTED && providers.password;
  const read = async (c: Context) => (await c.req.json().catch(() => ({}))) as Body;
  const inLocale = <T>(body: Body, fn: () => Promise<T>) => withLocale(isLocale(body.locale) ? body.locale : "en", fn);

  /** Sends the confirmation link; the account exists only once it is opened. Same answer whatever the address. */
  app.post("/api/auth/password/signup", async (c) => {
    if (!enabled()) return c.notFound();
    const body = await read(c);
    const email = normalize(body.email);
    if (!validEmail(email)) return c.json({ error: "invalid_email" }, 400);
    if (!validPassword(body.password)) return c.json({ error: "weak_password" }, 400);
    if (!mailByAddress(email) || !mailByIp(ipOf(c))) return c.json({ error: "too_many" }, 429);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) || null : null;
    try {
      await inLocale(body, async () => {
        const existing = await accountFor(db, email);
        // Already has a password: tell them where to sign in rather than starting a second account.
        if (existing?.passwordHash) return sendReset(db, existing, email, t("exists.subject"), t("exists.body"));
        const token = await issueToken(db, "signup", { email, passwordHash: await hashPassword(body.password as string), name });
        await sendLink(email, t("signup.subject"), [t("signup.body"), t("signup.linked"), t("expires.day"), t("ignore")], `${APP_URL}/api/auth/password/confirm?token=${token}`);
      });
    } catch (error) {
      console.error("[auth] sign-up email failed", error);
      return c.json({ error: "email_failed" }, 502);
    }
    return c.json({ sent: true });
  });

  /** The link in the sign-up email: starts the account, or adds the password to the one on that address. */
  app.get("/api/auth/password/confirm", async (c) => {
    if (!enabled()) return c.notFound();
    const row = await consumeToken(db, "signup", c.req.query("token"));
    if (!row?.passwordHash) return c.redirect(`${APP_URL}/signup?error=link`);
    const existing = await accountFor(db, row.email);
    let userId: string;
    if (existing) {
      await db
        .update(users)
        .set({ passwordHash: row.passwordHash, emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), name: existing.name ?? row.name })
        .where(eq(users.id, existing.id));
      userId = existing.id;
    } else {
      const [created] = await db.insert(users).values({ email: row.email, name: row.name, passwordHash: row.passwordHash, emailVerifiedAt: new Date() }).returning();
      await openWorkspaceFor(db, created!.id);
      userId = created!.id;
    }
    await startSession(db, c, userId);
    return c.redirect(`${APP_URL}/`);
  });

  app.post("/api/auth/password/signin", async (c) => {
    if (!enabled()) return c.notFound();
    const body = await read(c);
    const email = normalize(body.email);
    if (!signInByAddress(email) || !signInByIp(ipOf(c))) return c.json({ error: "too_many" }, 429);
    const user = validEmail(email) ? await db.query.users.findFirst({ where: and(eq(users.email, email), isNotNull(users.passwordHash)) }) : undefined;
    const password = typeof body.password === "string" ? body.password.slice(0, PASSWORD_MAX) : "";
    const ok = await checkPassword(password, user?.passwordHash ?? (await DECOY));
    if (!user || !ok) return c.json({ error: "invalid_credentials" }, 401);
    await startSession(db, c, user.id);
    return c.json({ ok: true });
  });

  /** Sends a link to choose a new password; also how an account that signs in with Google or Apple adds one. */
  app.post("/api/auth/password/forgot", async (c) => {
    if (!enabled()) return c.notFound();
    const body = await read(c);
    const email = normalize(body.email);
    if (!validEmail(email)) return c.json({ error: "invalid_email" }, 400);
    if (!mailByAddress(email) || !mailByIp(ipOf(c))) return c.json({ error: "too_many" }, 429);
    try {
      await inLocale(body, async () => {
        const user = await accountFor(db, email);
        if (user && (user.passwordHash || user.emailVerifiedAt || user.googleSub || user.appleSub)) await sendReset(db, user, email);
      });
    } catch (error) {
      console.error("[auth] reset email failed", error);
      return c.json({ error: "email_failed" }, 502);
    }
    return c.json({ sent: true });
  });

  /** The reset page's form: a new password, every other session signed out, this one signed in. */
  app.post("/api/auth/password/reset", async (c) => {
    if (!enabled()) return c.notFound();
    const body = await read(c);
    if (!validPassword(body.password)) return c.json({ error: "weak_password" }, 400);
    const row = await consumeToken(db, "reset", body.token);
    if (!row?.userId) return c.json({ error: "link_expired" }, 410);
    const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
    if (!user) return c.json({ error: "link_expired" }, 410);
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(body.password), emailVerifiedAt: user.emailVerifiedAt ?? new Date() })
      .where(eq(users.id, user.id));
    await db.delete(authSessions).where(eq(authSessions.userId, user.id));
    await startSession(db, c, user.id);
    return c.json({ ok: true });
  });
}
