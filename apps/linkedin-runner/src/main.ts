import { timingSafeEqual } from "node:crypto";
import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { connectPage } from "./connect-page.ts";
import { invite } from "./invite.ts";
import { findLogin, sendInput, startLogin, watchLogin, type LoginInput } from "./login.ts";
import { closeAll, forgetAccount, isAccountId, type Proxy } from "./sessions.ts";

/**
 * Pluton's own LinkedIn runner, in place of Unipile: it keeps one browser profile per connected
 * account and acts in it. The app calls it with RUNNER_TOKEN; a founder's phone drives a login
 * only through the one-time link the app hands out.
 */

const TOKEN = process.env.RUNNER_TOKEN ?? "";
const PORT = Number(process.env.RUNNER_PORT ?? 8790);
if (!TOKEN) console.warn("[runner] RUNNER_TOKEN is empty: every API call will be refused");

const app = new Hono();

function authorized(c: Context) {
  const sent = Buffer.from((c.req.header("authorization") ?? "").replace(/^Bearer /, ""));
  const want = Buffer.from(TOKEN);
  return TOKEN !== "" && sent.length === want.length && timingSafeEqual(sent, want);
}

app.get("/health", (c) => c.json({ ok: true }));

// ── For the app (RUNNER_TOKEN) ──────────────────────────────────────────────

app.use("/accounts/*", async (c, next) => {
  if (!authorized(c)) return c.json({ error: "unauthorized" }, 401);
  // The route's :id isn't parsed yet in a wildcard middleware: read it from the path.
  if (!isAccountId(c.req.path.split("/")[2] ?? "")) return c.json({ error: "bad account id" }, 400);
  await next();
});

/** Starts a login and returns the link to open on the phone. The proxy is kept for good at the first one. */
app.post("/accounts/:id/login", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { proxy?: Proxy; locale?: string; timezone?: string };
  const { token, expiresAt } = await startLogin(id, body);
  return c.json({ url: `/connect/${id}?t=${token}`, expiresAt });
});

app.post("/accounts/:id/invite", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { profileUrl?: string; note?: string };
  if (!body.profileUrl || !/^https:\/\/([a-z]+\.)?linkedin\.com\/in\//.test(body.profileUrl)) {
    return c.json({ error: "profileUrl must be a https://www.linkedin.com/in/… URL" }, 400);
  }
  try {
    return c.json(await invite(c.req.param("id"), body.profileUrl, body.note));
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

app.delete("/accounts/:id", async (c) => {
  await forgetAccount(c.req.param("id"));
  return c.json({ ok: true });
});

// ── For the founder's phone (one-time link) ─────────────────────────────────

app.get("/connect/:id", (c) => {
  const login = findLogin(c.req.param("id"), c.req.query("t"));
  if (!login) return c.html(connectPage({ expired: true }), 410);
  return c.html(connectPage({ expired: false }));
});

app.get("/connect/:id/stream", (c) => {
  const login = findLogin(c.req.param("id"), c.req.query("t"));
  if (!login) return c.json({ error: "expired" }, 410);
  return streamSSE(c, async (stream) => {
    const stop = watchLogin(login, (e) => {
      void stream.writeSSE({ event: e.type, data: e.type === "frame" ? e.jpeg : JSON.stringify(e) });
    });
    stream.onAbort(stop);
    // Held open until the phone leaves; a comment every 20 s keeps proxies from closing it.
    while (!stream.aborted) {
      await stream.sleep(20_000);
      await stream.write(": ping\n\n");
    }
  });
});

app.post("/connect/:id/input", async (c) => {
  const login = findLogin(c.req.param("id"), c.req.query("t"));
  if (!login) return c.json({ error: "expired" }, 410);
  const input = (await c.req.json().catch(() => null)) as LoginInput | null;
  if (!input || !["tap", "text", "key", "scroll"].includes(input.type)) return c.json({ error: "bad input" }, 400);
  if (input.type === "key" && !["Enter", "Backspace", "Tab"].includes(input.key)) return c.json({ error: "bad key" }, 400);
  await sendInput(login, input);
  return c.json({ ok: true });
});

const server = serve({ fetch: app.fetch, port: PORT }, (info) => console.log(`[runner] listening on :${info.port}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    void closeAll().finally(() => process.exit(0));
  });
}
