/**
 * Runs inside a LinkedIn profile tab: sends a connection invitation the way a person would. Press
 * Connect (or find it under More), add the note if there is one, send. LinkedIn's buttons are found
 * by their accessible names in English and French; a name LinkedIn changes is the first thing to
 * check when it fails.
 */

export type InviteResult =
  | { status: "sent" }
  | { status: "already_pending" | "already_connected" | "email_required" | "not_available" | "disconnected"; detail?: string };

const CONNECT = /(^|\s)(connect|se connecter)$|to connect|rejoindre votre réseau/i;
const PENDING = /^(pending|en attente)|withdraw invitation|retirer l.invitation/i;
const MORE = /^(more|plus)$|more actions|plus d.actions/i;
const ADD_NOTE = /add a note|ajouter une note/i;
const SEND_WITHOUT_NOTE = /send without a note|envoyer sans note/i;
const SEND = /^(send|envoyer)( invitation| l.invitation)?$/i;
const MESSAGE = /^message$/i;

/** LinkedIn caps a note at 300 characters for free accounts. */
const NOTE_MAX = 300;

const pause = (min = 600, max = 1800) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

const nameOf = (el: Element) => (el.getAttribute("aria-label") ?? (el as HTMLElement).innerText ?? "").trim().replace(/\s+/g, " ");
const shown = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

/** The first visible control under `root` whose accessible name matches. */
function control(root: ParentNode, name: RegExp) {
  const all = root.querySelectorAll("button, [role=button], [role=menuitem], a[role=link][aria-label]");
  return [...all].find((el) => shown(el) && name.test(nameOf(el))) as HTMLElement | undefined;
}

async function waitFor<T>(find: () => T | undefined | null, timeout = 4000): Promise<T | undefined> {
  const end = Date.now() + timeout;
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() > end) return undefined;
    await new Promise((r) => setTimeout(r, 200));
  }
}

function press(el: HTMLElement) {
  el.scrollIntoView({ block: "center" });
  const at = el.getBoundingClientRect();
  const point = { bubbles: true, cancelable: true, clientX: at.left + at.width / 2, clientY: at.top + at.height / 2 };
  el.dispatchEvent(new PointerEvent("pointerdown", point));
  el.dispatchEvent(new MouseEvent("mousedown", point));
  el.dispatchEvent(new PointerEvent("pointerup", point));
  el.dispatchEvent(new MouseEvent("mouseup", point));
  el.click();
}

/** Types like a keyboard: one character at a time, through the editor's own input events. */
async function type(field: HTMLTextAreaElement, text: string) {
  field.focus();
  for (const ch of text) {
    document.execCommand("insertText", false, ch);
    await new Promise((r) => setTimeout(r, 25 + Math.random() * 60));
  }
}

async function invite(note?: string): Promise<InviteResult> {
  if (/\/(login|authwall|checkpoint|uas\/login)/.test(location.pathname)) return { status: "disconnected" };
  await pause(1200, 2500);

  // The profile's own card comes first in <main>; suggestions further down have Connect buttons too.
  const main = document.querySelector("main") ?? document.body;
  if (control(main, PENDING)) return { status: "already_pending" };

  let connect = control(main, CONNECT);
  if (!connect) {
    const more = control(main, MORE);
    if (!more) return { status: "not_available", detail: "no Connect or More button" };
    press(more);
    await pause();
    connect = await waitFor(() => control(document, CONNECT), 2500);
    if (!connect) return control(main, MESSAGE) ? { status: "already_connected" } : { status: "not_available", detail: "no Connect under More" };
  }
  press(connect);
  await pause();

  const dialog = await waitFor(() => [...document.querySelectorAll("[role=dialog]")].find(shown), 5000);
  if (!dialog) return { status: "not_available", detail: "no invitation dialog" };
  if (dialog.querySelector("input[type=email]")) return { status: "email_required" };

  const text = note?.trim().slice(0, NOTE_MAX);
  if (text) {
    const add = control(dialog, ADD_NOTE);
    if (!add) return { status: "not_available", detail: "no Add a note button" };
    press(add);
    const field = await waitFor(() => [...dialog.querySelectorAll("textarea")].find(shown) as HTMLTextAreaElement | undefined);
    if (!field) return { status: "not_available", detail: "no note field" };
    await pause(400, 900);
    await type(field, text);
    await pause();
    const send = await waitFor(() => control(dialog, SEND));
    if (!send) return { status: "not_available", detail: "no Send button" };
    press(send);
  } else {
    const send = control(dialog, SEND_WITHOUT_NOTE) ?? control(dialog, SEND);
    if (!send) return { status: "not_available", detail: "no Send button" };
    press(send);
  }

  const closed = await waitFor(() => !shown(dialog) || !dialog.isConnected, 10_000);
  return closed ? { status: "sent" } : { status: "not_available", detail: "the invitation dialog stayed open" };
}

// Called by the background with chrome.scripting.executeScript once this file is in the tab.
(globalThis as unknown as { __plutonInvite: typeof invite }).__plutonInvite = invite;
