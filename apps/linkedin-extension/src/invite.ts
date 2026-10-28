/**
 * Runs inside a LinkedIn tab: sends a connection invitation the way a person would. First on the
 * invitation dialog LinkedIn opens at /preload/custom-invite/?vanityName=…, found by its classes and
 * ids, which don't change with the interface's language; failing that, on the profile: press Connect
 * (or find it under More), add the note if there is one, send, the buttons found by their names in
 * English and French. What LinkedIn renames is the first thing to check when it fails.
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

// The invitation dialog, as LinkedIn renders it in every language (seen October 2026).
const DIALOG_SEND = ".artdeco-button--primary";
const DIALOG_ADD_NOTE = ".artdeco-button--secondary";
const DIALOG_NOTE = "textarea#custom-message, textarea[name=message]";

/** The document and the open shadow roots under it: LinkedIn renders its dialogs inside #interop-outlet's. */
function roots(): ParentNode[] {
  return [document, ...[...document.querySelectorAll("*")].flatMap((el) => (el.shadowRoot ? [el.shadowRoot] : []))];
}

/** LinkedIn caps a note at 300 characters for free accounts. */
const NOTE_MAX = 300;

const pause = (min = 600, max = 1800) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

const nameOf = (el: Element) => (el.getAttribute("aria-label") ?? (el as HTMLElement).innerText ?? "").trim().replace(/\s+/g, " ");
const shown = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

/** The first visible control under `root` whose accessible name matches. */
function control(root: ParentNode, name: RegExp) {
  const all = root.querySelectorAll("button, a, [role=button], [role=menuitem]");
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

/** The dialog the invitation link opens: Add a note (secondary), Send (primary), the note's field. */
function inviteDialog() {
  return roots()
    .flatMap((r) => [...r.querySelectorAll("[role=dialog]")])
    .find((d) => shown(d) && (d.querySelector(DIALOG_SEND) || d.querySelector(DIALOG_NOTE) || d.querySelector("input[type=email]"))) as HTMLElement | undefined;
}

const enabled = (el: Element | null | undefined) => (el && shown(el) && !(el as HTMLButtonElement).disabled ? (el as HTMLElement) : undefined);

/** On the invitation link's page: the dialog is already open. Not there means try the profile. */
async function inviteFromLink(note?: string): Promise<InviteResult> {
  if (/\/(login|authwall|checkpoint|uas\/login)/.test(location.pathname)) return { status: "disconnected" };
  await pause(1200, 2500);
  const dialog = await waitFor(inviteDialog, 6000);
  if (!dialog) return { status: "not_available", detail: "no invitation dialog at the invitation link" };
  if (dialog.querySelector("input[type=email]")) return { status: "email_required" };

  const text = note?.trim().slice(0, NOTE_MAX);
  if (text) {
    const add = enabled(dialog.querySelector(DIALOG_ADD_NOTE)) ?? control(dialog, ADD_NOTE);
    if (add) press(add);
    const field = await waitFor(() => [...dialog.querySelectorAll(DIALOG_NOTE)].find(shown) as HTMLTextAreaElement | undefined);
    if (!field) return { status: "not_available", detail: "no note field" };
    await pause(400, 900);
    await type(field, text);
    await pause();
  }
  // Send turns active once the note is typed; without a note it is "Send without a note".
  const send = await waitFor(() => enabled(dialog.querySelector(DIALOG_SEND)) ?? control(dialog, text ? SEND : SEND_WITHOUT_NOTE));
  if (!send) return { status: "not_available", detail: "no Send button" };
  press(send);
  const closed = await waitFor(() => !shown(dialog) || !dialog.isConnected, 10_000);
  return closed ? { status: "sent" } : { status: "not_available", detail: "the invitation dialog stayed open" };
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
    connect = await waitFor(() => roots().map((r) => control(r, CONNECT)).find(Boolean), 2500);
    if (!connect) return control(main, MESSAGE) ? { status: "already_connected" } : { status: "not_available", detail: "no Connect under More" };
  }
  press(connect);
  await pause();

  const dialog = await waitFor(() => roots().flatMap((r) => [...r.querySelectorAll("[role=dialog]")]).find((d) => shown(d) && (control(d, ADD_NOTE) || control(d, SEND_WITHOUT_NOTE) || d.querySelector("input[type=email]"))), 5000);
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
(globalThis as unknown as { __plutonInvite: typeof invite; __plutonInviteFromLink: typeof inviteFromLink }).__plutonInvite = invite;
(globalThis as unknown as { __plutonInviteFromLink: typeof inviteFromLink }).__plutonInviteFromLink = inviteFromLink;
