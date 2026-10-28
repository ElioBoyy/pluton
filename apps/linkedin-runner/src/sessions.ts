import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type CDPSession, type Page } from "playwright";

/**
 * One LinkedIn account = one Chromium profile on disk (its cookies are the session), always opened
 * through the same proxy, so LinkedIn sees one stable browser and one stable address per account.
 * A profile is opened only while something runs in it: a login, or an action.
 */

export const DATA_DIR = path.resolve(process.env.RUNNER_DATA_DIR ?? "data/linkedin");
export const LOGIN_URL = process.env.RUNNER_LOGIN_URL ?? "https://www.linkedin.com/login";

export type Proxy = { server: string; username?: string; password?: string };
type AccountConfig = { proxy?: Proxy; locale: string; timezone: string };

/** Desktop size for actions: LinkedIn's full site, whose buttons the actions look for. */
const DESKTOP = { width: 1280, height: 900 };
/** Phone size for the login: the login page lays itself out for the phone that drives it. */
export const PHONE = { width: 400, height: 760 };

const profileDir = (accountId: string) => path.join(DATA_DIR, accountId, "profile");
const configFile = (accountId: string) => path.join(DATA_DIR, accountId, "runner.json");

export const isAccountId = (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id);

async function readConfig(accountId: string): Promise<AccountConfig | null> {
  try {
    return JSON.parse(await readFile(configFile(accountId), "utf8")) as AccountConfig;
  } catch {
    return null;
  }
}

/** The proxy is fixed at the first login: changing an account's address later looks like a takeover. */
export async function ensureConfig(accountId: string, wanted: Partial<AccountConfig>): Promise<AccountConfig> {
  const existing = await readConfig(accountId);
  if (existing) return existing;
  const config: AccountConfig = { proxy: wanted.proxy, locale: wanted.locale ?? "fr-FR", timezone: wanted.timezone ?? "Europe/Paris" };
  await mkdir(path.dirname(configFile(accountId)), { recursive: true });
  await writeFile(configFile(accountId), JSON.stringify(config, null, 2), { mode: 0o600 });
  return config;
}

export async function forgetAccount(accountId: string) {
  await closeSession(accountId);
  await rm(path.join(DATA_DIR, accountId), { recursive: true, force: true });
}

// ── Open profiles ───────────────────────────────────────────────────────────

type Session = { context: BrowserContext; page: Page; cdp: CDPSession };
const open = new Map<string, Promise<Session>>();

/**
 * Headless Chromium says "HeadlessChrome" in its user agent; the page is told the plain Chrome one
 * of the same version, so the agent matches the engine underneath.
 */
async function plainUserAgent(cdp: CDPSession, page: Page) {
  const ua = await page.evaluate(() => navigator.userAgent);
  if (ua.includes("HeadlessChrome")) await cdp.send("Emulation.setUserAgentOverride", { userAgent: ua.replace("HeadlessChrome", "Chrome") });
}

async function launch(accountId: string): Promise<Session> {
  const config = await readConfig(accountId);
  if (!config) throw new Error(`Account ${accountId} has never been connected`);
  const context = await chromium.launchPersistentContext(profileDir(accountId), {
    // Full Chromium in its new headless mode, not the stripped headless shell, which looks less like a browser.
    channel: "chromium",
    headless: process.env.RUNNER_HEADFUL !== "1",
    viewport: DESKTOP,
    locale: config.locale,
    timezoneId: config.timezone,
    proxy: config.proxy,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const cdp = await context.newCDPSession(page);
  await plainUserAgent(cdp, page);
  context.on("close", () => open.delete(accountId));
  return { context, page, cdp };
}

/** The account's open profile, opened on first use; one at a time per account. */
export function session(accountId: string): Promise<Session> {
  let s = open.get(accountId);
  if (!s) {
    s = launch(accountId);
    s.catch(() => open.delete(accountId));
    open.set(accountId, s);
  }
  return s;
}

export async function closeSession(accountId: string) {
  const s = open.get(accountId);
  open.delete(accountId);
  if (s) await (await s).context.close().catch(() => {});
}

/** Actions on one account run one after the other: two at once in one profile would collide. */
const queues = new Map<string, Promise<unknown>>();
export function serial<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
  const run = (queues.get(accountId) ?? Promise.resolve()).then(fn, fn);
  queues.set(accountId, run.catch(() => {}));
  return run;
}

/** Whether the profile holds a LinkedIn session: the `li_at` cookie, or a page past the login. */
export async function loggedIn(s: Session) {
  const cookies = await s.context.cookies("https://www.linkedin.com");
  if (cookies.some((c) => c.name === "li_at" && c.value)) return true;
  return new URL(s.page.url()).pathname.startsWith("/feed");
}

/** A pause of a person, not a script: between `min` and `max` milliseconds. */
export const humanPause = (min = 600, max = 1800) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

/** On shutdown: every open browser is closed, so no Chromium outlives the runner. */
export async function closeAll() {
  await Promise.all([...open.keys()].map((id) => closeSession(id)));
}
