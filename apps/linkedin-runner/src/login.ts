import { randomBytes } from "node:crypto";
import { closeSession, ensureConfig, LOGIN_URL, loggedIn, PHONE, session, type Proxy } from "./sessions.ts";

/**
 * Hosted login, made for a phone: the account's browser opens LinkedIn's login page at phone size,
 * its screen streams to the founder's phone as images, and their taps and typing are played back in
 * it. They sign in and pass LinkedIn's own checks (code, app approval, captcha) themselves; the
 * runner never sees their password apart from typing it on their behalf, and stores only the cookies.
 */

export type LoginStatus = "starting" | "login" | "checkpoint" | "connected" | "expired" | "error";
export type LoginEvent = { type: "frame"; jpeg: string } | { type: "status"; status: LoginStatus; message?: string };

type Login = {
  accountId: string;
  status: LoginStatus;
  lastFrame?: string;
  /** The CSS size the last frame shows: taps are placed in it, whatever size the page was asked to be. */
  frameSize?: { width: number; height: number };
  listeners: Set<(e: LoginEvent) => void>;
  expiresAt: number;
  watcher?: NodeJS.Timeout;
  capturing?: boolean;
};

/** One-time links: the token in the URL is the only thing that lets a phone drive the browser. */
const logins = new Map<string, Login>();
const LINK_TTL_MS = 15 * 60_000;

export async function startLogin(accountId: string, opts: { proxy?: Proxy; locale?: string; timezone?: string }) {
  for (const [token, l] of logins) if (l.accountId === accountId) endLogin(token, "expired");
  await ensureConfig(accountId, opts);
  const token = randomBytes(24).toString("base64url");
  const login: Login = { accountId, status: "starting", listeners: new Set(), expiresAt: Date.now() + LINK_TTL_MS };
  logins.set(token, login);
  void open(token, login).catch((e: Error) => setStatus(login, "error", e.message));
  return { token, expiresAt: new Date(login.expiresAt) };
}

async function open(token: string, login: Login) {
  const s = await session(login.accountId);
  await s.page.setViewportSize(PHONE);
  await s.page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  setStatus(login, "login");

  // Watches where the browser is (signed in, held at a check, or still on the form) and sends its
  // screen while a phone looks at it. Plain screenshots: Chrome's screencast sends nothing while a
  // page stands still, which left the phone blank.
  login.watcher = setInterval(() => {
    if (Date.now() > login.expiresAt) return endLogin(token, "expired");
    if (login.listeners.size > 0) void capture(login);
    void (async () => {
      if (await loggedIn(s)) {
        setStatus(login, "connected");
        endLogin(token, "connected");
        return;
      }
      const url = s.page.url();
      setStatus(login, /checkpoint|challenge|two-step/.test(url) ? "checkpoint" : "login");
    })().catch(() => {});
  }, 350);
}

/** Sends the browser's screen when it changed since the last image. One capture at a time. */
async function capture(login: Login) {
  if (login.capturing) return;
  login.capturing = true;
  try {
    const { page } = await session(login.accountId);
    const jpeg = (await page.screenshot({ type: "jpeg", quality: 70, timeout: 3000 })).toString("base64");
    login.frameSize = page.viewportSize() ?? PHONE;
    if (jpeg === login.lastFrame) return;
    login.lastFrame = jpeg;
    if (process.env.RUNNER_DEBUG === "1") console.log(`[runner] frame ${jpeg.length} → ${login.listeners.size} viewer(s)`);
    emit(login, { type: "frame", jpeg });
  } catch (e) {
    // The page is navigating: the next tick captures it.
    if (process.env.RUNNER_DEBUG === "1") console.log(`[runner] capture failed: ${(e as Error).message.split("\n")[0]}`);
  } finally {
    login.capturing = false;
  }
}

function emit(login: Login, e: LoginEvent) {
  for (const l of login.listeners) l(e);
}

function setStatus(login: Login, status: LoginStatus, message?: string) {
  if (login.status === status && !message) return;
  login.status = status;
  emit(login, { type: "status", status, message });
}

function endLogin(token: string, status: LoginStatus) {
  const login = logins.get(token);
  if (!login) return;
  logins.delete(token);
  if (login.watcher) clearInterval(login.watcher);
  setStatus(login, status);
  // The profile on disk keeps the session; the browser itself is closed until an action needs it.
  void closeSession(login.accountId);
}

export function findLogin(accountId: string, token: string | undefined) {
  const login = token ? logins.get(token) : undefined;
  return login && login.accountId === accountId && Date.now() <= login.expiresAt ? login : null;
}

export function watchLogin(login: Login, listener: (e: LoginEvent) => void) {
  login.listeners.add(listener);
  listener({ type: "status", status: login.status });
  if (login.lastFrame) listener({ type: "frame", jpeg: login.lastFrame });
  return () => {
    login.listeners.delete(listener);
  };
}

export type LoginInput =
  | { type: "tap"; x: number; y: number }
  | { type: "text"; text: string }
  | { type: "key"; key: "Enter" | "Backspace" | "Tab" }
  | { type: "scroll"; dy: number };

/** Plays the phone's input in the browser. A tap comes as a fraction of the image, so any screen size works. */
export async function sendInput(login: Login, input: LoginInput) {
  const { page } = await session(login.accountId);
  const size = login.frameSize ?? page.viewportSize() ?? PHONE;
  if (input.type === "tap") {
    const x = clamp(input.x) * size.width;
    const y = clamp(input.y) * size.height;
    if (process.env.RUNNER_DEBUG === "1") {
      const hit = await page.evaluate(([px, py]) => {
        const el = document.elementFromPoint(px!, py!);
        return el ? `${el.tagName} ${el.getAttribute("name") ?? el.textContent?.slice(0, 20) ?? ""}` : "nothing";
      }, [x, y]);
      console.log(`[runner] tap ${Math.round(x)},${Math.round(y)} in ${size.width}x${size.height} → ${hit}`);
    }
    await page.mouse.click(x, y);
  }
  else if (input.type === "text") {
    await page.keyboard.insertText(input.text.slice(0, 500));
    if (process.env.RUNNER_DEBUG === "1") {
      const focus = await page.evaluate(() => {
        const el = document.activeElement as HTMLInputElement | null;
        return `${el?.tagName} ${el?.getAttribute("name")} len=${el?.value?.length ?? "-"}`;
      });
      console.log(`[runner] text → ${focus}`);
    }
  }
  else if (input.type === "key") await page.keyboard.press(input.key);
  else await page.mouse.wheel(0, Math.max(-2000, Math.min(2000, input.dy)));
  // The result of a tap or keystroke shows at once, not at the next tick.
  setTimeout(() => void capture(login), 120);
}

const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
