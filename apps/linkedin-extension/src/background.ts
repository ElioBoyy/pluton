import type { InviteResult } from "./invite.ts";

/**
 * The extension's worker: runs LinkedIn steps one at a time, each in a tab of its own opened in the
 * background, from the founder's own browser, address and LinkedIn session. Nothing leaves the
 * browser but each step's result.
 */

declare const __DEV__: boolean;

export type Message =
  | { type: "status" }
  | { type: "invite"; profileUrl: string; note?: string };

export type Status = { linkedin: boolean; history: HistoryEntry[] };
export type HistoryEntry = { at: string; profileUrl: string; result: InviteResult | { status: "error"; detail: string } };

const PROFILE = __DEV__ ? /^(https:\/\/([a-z]+\.)?linkedin\.com\/in\/|http:\/\/localhost(:\d+)?\/in\/)/ : /^https:\/\/([a-z]+\.)?linkedin\.com\/in\//;

/** Whether the browser holds a LinkedIn session: the `li_at` cookie exists. Its value is never read out. */
async function linkedinSignedIn() {
  const cookie = await chrome.cookies.get({ url: "https://www.linkedin.com", name: "li_at" });
  return Boolean(cookie?.value);
}

/** Steps run one after the other: two LinkedIn tabs acting at once is not what a person does. */
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

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

async function invite(profileUrl: string, note?: string): Promise<InviteResult> {
  if (!PROFILE.test(profileUrl)) throw new Error("not a LinkedIn profile URL");
  // In the background: the founder keeps working in their own tab.
  const tab = await chrome.tabs.create({ url: profileUrl, active: false });
  const tabId = tab.id!;
  try {
    await loaded(tabId);
    await chrome.scripting.executeScript({ target: { tabId }, files: ["invite.js"] });
    const [run] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (n?: string) => (globalThis as unknown as { __plutonInvite: (note?: string) => Promise<unknown> }).__plutonInvite(n),
      args: [note ?? ""],
    });
    return run?.result as InviteResult;
  } finally {
    await chrome.tabs.remove(tabId).catch(() => {});
  }
}

async function remember(entry: HistoryEntry) {
  const { history = [] } = (await chrome.storage.local.get("history")) as { history?: HistoryEntry[] };
  await chrome.storage.local.set({ history: [entry, ...history].slice(0, 20) });
}

async function handle(message: Message): Promise<unknown> {
  if (message.type === "status") {
    const { history = [] } = (await chrome.storage.local.get("history")) as { history?: HistoryEntry[] };
    return { linkedin: await linkedinSignedIn(), history } satisfies Status;
  }
  return serial(async () => {
    const at = new Date().toISOString();
    try {
      const result = await invite(message.profileUrl, message.note);
      await remember({ at, profileUrl: message.profileUrl, result });
      return result;
    } catch (e) {
      const result = { status: "error" as const, detail: (e as Error).message };
      await remember({ at, profileUrl: message.profileUrl, result });
      return result;
    }
  });
}

chrome.runtime.onMessage.addListener((message: Message, _sender, reply) => {
  handle(message).then(reply, (e: Error) => reply({ status: "error", detail: e.message }));
  return true; // The answer comes later.
});
