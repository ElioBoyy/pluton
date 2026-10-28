import type { InviteResult } from "./invite.ts";

/**
 * The extension's worker. It holds a token of its own, which the founder pastes in Pluton to pair
 * it; from then on it checks in with Pluton every 30 s and does the visits and invitations Pluton
 * hands it, one at a time, each in a tab opened in the background, from the founder's own browser,
 * address and LinkedIn session. Nothing is started from the extension: Pluton decides.
 */

declare const __DEV__: boolean;

export type Message = { type: "status" };

type Action = { id: string; kind: "invite" | "visit_profile"; profileUrl: string; note: string | null };
type Result = InviteResult | { status: "visited" } | { status: "error"; detail: string };

export type HistoryEntry = { at: string; kind: Action["kind"]; profileUrl: string; result: Result };
export type Status = {
  token: string;
  paired: boolean | null;
  name: string | null;
  linkedin: boolean;
  lastCheckIn: string | null;
  error: string | null;
  history: HistoryEntry[];
};

const PROFILE = __DEV__ ? /^(https:\/\/([a-z]+\.)?linkedin\.com\/in\/|http:\/\/localhost(:\d+)?\/in\/)/ : /^https:\/\/([a-z]+\.)?linkedin\.com\/in\//;

/** The token is made once, on this browser, and never leaves it except to Pluton. */
async function token() {
  const { token } = (await chrome.storage.local.get("token")) as { token?: string };
  if (token) return token;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const made = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await chrome.storage.local.set({ token: made });
  return made;
}

/** Whether the browser holds a LinkedIn session: the `li_at` cookie exists. Its value is never read out. */
async function linkedinSignedIn() {
  const cookie = await chrome.cookies.get({ url: "https://www.linkedin.com", name: "li_at" });
  return Boolean(cookie?.value);
}

/** The Pluton this copy talks to: written in config.json by the build, or by the Pluton it was downloaded from. */
let apiOrigin: Promise<string> | undefined;
const origin = () => (apiOrigin ??= fetch(chrome.runtime.getURL("config.json")).then((r) => r.json() as Promise<{ api: string }>).then((c) => c.api));

async function api<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${await origin()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T };
}

function loaded(tabId: number, timeout = 30_000) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("the profile took too long to load"));
    }, timeout);
    const listener = (id: number, info: { status?: string }) => {
      if (id !== tabId || info.status !== "complete") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

const signedOutUrl = (url?: string) => Boolean(url && /linkedin\.com\/(login|authwall|checkpoint|uas\/login)/.test(url));

/**
 * The invitation link LinkedIn's own Connect button points to: it opens the invitation dialog
 * straight away, whatever the profile's layout or the interface's language.
 */
function inviteLink(profileUrl: string) {
  const url = new URL(profileUrl);
  const vanity = url.pathname.match(/^\/in\/([^/]+)/)?.[1];
  return vanity ? `${url.origin}/preload/custom-invite/?vanityName=${vanity}` : null;
}

/** Opens a page of that profile in a background tab, runs `step` in it, and closes it. */
async function inProfileTab<T>(profileUrl: string, step: (tabId: number) => Promise<T>, url = profileUrl): Promise<T | { status: "disconnected" }> {
  if (!PROFILE.test(profileUrl)) throw new Error("not a LinkedIn profile URL");
  // In the background: the founder keeps working in their own tab.
  const tab = await chrome.tabs.create({ url, active: false });
  const tabId = tab.id!;
  try {
    await loaded(tabId);
    if (signedOutUrl((await chrome.tabs.get(tabId)).url)) return { status: "disconnected" };
    return await step(tabId);
  } finally {
    await chrome.tabs.remove(tabId).catch(() => {});
  }
}

const pause = (min: number, max: number) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

async function run(action: Action): Promise<Result> {
  if (action.kind === "visit_profile") {
    return inProfileTab(action.profileUrl, async (tabId) => {
      // A visit is a person reading the page for a few seconds, scrolling a little.
      await pause(3000, 6000);
      await chrome.scripting.executeScript({ target: { tabId }, func: () => window.scrollBy({ top: 300 + Math.random() * 500, behavior: "smooth" }) });
      await pause(2000, 5000);
      return { status: "visited" as const };
    });
  }
  const step = (fn: "__plutonInvite" | "__plutonInviteFromLink") => async (tabId: number) => {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["invite.js"] });
    const [done] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (name: string, n?: string) => (globalThis as unknown as Record<string, (note?: string) => Promise<unknown>>)[name]!(n),
      args: [fn, action.note ?? ""],
    });
    return done?.result as InviteResult;
  };
  // The invitation link first; the profile, where pending and connected show, when it has no dialog.
  const link = inviteLink(action.profileUrl);
  if (link) {
    const direct = await inProfileTab(action.profileUrl, step("__plutonInviteFromLink"), link);
    if (direct.status !== "not_available") return direct;
    await pause(4000, 9000);
  }
  return inProfileTab(action.profileUrl, step("__plutonInvite"));
}

async function remember(entry: HistoryEntry) {
  const { history = [] } = (await chrome.storage.local.get("history")) as { history?: HistoryEntry[] };
  await chrome.storage.local.set({ history: [entry, ...history].slice(0, 20) });
}

/** One check-in, then the action Pluton hands over, if any; again until Pluton has nothing more for now. */
let busy = false;
async function checkIn() {
  if (busy) return;
  busy = true;
  try {
    for (;;) {
      const linkedin = await linkedinSignedIn();
      const { status, data } = await api<{ paired?: boolean; name?: string; action?: Action | null }>("/api/extension/linkedin/check-in", { linkedin });
      const paired = status === 401 ? false : status === 200 ? true : null;
      await chrome.storage.local.set({ paired, name: data.name ?? null, lastCheckIn: new Date().toISOString(), error: paired === null ? `Pluton answered ${status}` : null });
      const action = data.action;
      if (!action) return;
      let result: Result;
      try {
        result = await run(action);
      } catch (e) {
        result = { status: "error", detail: (e as Error).message };
      }
      await remember({ at: new Date().toISOString(), kind: action.kind, profileUrl: action.profileUrl, result });
      await api(`/api/extension/linkedin/actions/${encodeURIComponent(action.id)}`, result);
    }
  } catch (e) {
    await chrome.storage.local.set({ error: `Pluton unreachable: ${(e as Error).message}` });
  } finally {
    busy = false;
  }
}

// Every 30 s, the shortest period Chrome allows an alarm; the worker is woken for it.
chrome.alarms.create("check-in", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "check-in") void checkIn();
});
chrome.runtime.onInstalled.addListener(() => void token().then(checkIn));
chrome.runtime.onStartup.addListener(() => void checkIn());

chrome.runtime.onMessage.addListener((message: Message, _sender, reply) => {
  if (message.type !== "status") return false;
  void (async () => {
    const stored = (await chrome.storage.local.get(["paired", "name", "lastCheckIn", "error", "history"])) as Partial<Status>;
    reply({
      token: await token(),
      paired: stored.paired ?? null,
      name: stored.name ?? null,
      linkedin: await linkedinSignedIn(),
      lastCheckIn: stored.lastCheckIn ?? null,
      error: stored.error ?? null,
      history: stored.history ?? [],
    } satisfies Status);
    // Opening the popup checks in at once: a token just pasted in Pluton shows as paired.
    void checkIn();
  })();
  return true; // The answer comes later.
});
