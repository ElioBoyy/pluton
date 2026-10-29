/**
 * Runs inside a LinkedIn tab: sends a connection invitation the way a person would. On the profile,
 * it first reads where things stand (pending, connected, or Connect there or under More) from the
 * icons and the invitation link, which don't change with the interface's language; then, in the
 * dialog LinkedIn opens at the invitation link, it adds the note if there is one and sends, the
 * controls found by their classes. Button names in English and French are the fallback. What
 * LinkedIn changes is the first thing to check when it fails.
 */

export type InviteResult =
  | { status: "sent" }
  | { status: "connectable" }
  | { status: "already_pending" | "already_connected" | "email_required" | "not_available" | "disconnected"; detail?: string };

const CONNECT = /(^|\s)(connect|se connecter)$|to connect|rejoindre votre réseau/i;
const PENDING = /^(pending|en attente)|withdraw invitation|retirer l.invitation/i;
const MORE = /^(more|plus)$|more actions|plus d.actions/i;
const ADD_NOTE = /add a note|ajouter une note/i;
const SEND_WITHOUT_NOTE = /send without a note|envoyer sans note/i;
const SEND = /^(send|envoyer)( invitation| l.invitation)?$/i;
const MESSAGE = /^message$/i;

// The profile and the invitation dialog, as LinkedIn renders them in every language (seen October 2026).
const PENDING_ICON = "clock-outline-small";
const CONNECT_ICON = "person-plus-outline-small";
const MORE_ICON = "ellipses-horizontal-fill-small";
const MESSAGE_ICON = "paper-plane-diagonal-outline-small";
const INVITE_LINK = 'a[href*="/preload/custom-invite/"]';
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

/** The first visible control under `root` that is the invitation link or carries that icon. */
function marked(root: ParentNode, icon: string) {
  const all = root.querySelectorAll("button, a, [role=button], [role=menuitem]");
  return [...all].find((el) => shown(el) && (el.querySelector(`svg[id="${icon}"]`) || (icon === CONNECT_ICON && el.matches(INVITE_LINK)))) as HTMLElement | undefined;
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

/** On the invitation link's page, once the profile said Connect is there: the dialog is already open. */
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

/**
 * On the profile: where things stand, without inviting anyone. The invitation link opens its dialog
 * even for someone pending or connected, so this is read first. More is opened when Connect isn't
 * on the card (profiles that lead with Follow keep it there).
 */
async function inviteState(): Promise<InviteResult> {
  if (/\/(login|authwall|checkpoint|uas\/login)/.test(location.pathname)) return { status: "disconnected" };
  await pause(1200, 2500);

  // Only the profile's own card: "People you may know" further down has Connect buttons too. The card
  // is the section holding the contact info link.
  const main = document.querySelector("main") ?? document.body;
  const card = (await waitFor(() => main.querySelector('a[href*="/overlay/contact-info/"]')?.closest("section"), 8000)) ?? main;
  const pending = marked(card, PENDING_ICON) ?? control(card, PENDING);
  const connect = marked(card, CONNECT_ICON) ?? control(card, CONNECT);
  const first = [pending, connect].filter(Boolean).sort((a, b) => (a!.compareDocumentPosition(b!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0];
  if (first) return first === pending ? { status: "already_pending" } : { status: "connectable" };

  const more = marked(card, MORE_ICON) ?? control(card, MORE);
  if (!more) return { status: "not_available", detail: "no Connect or More button" };
  const menus = () => roots().flatMap((r) => [...r.querySelectorAll("[role=menu]")]).filter(shown);
  const connectIn = () => menus().map((m) => marked(m, CONNECT_ICON) ?? control(m, CONNECT)).find(Boolean);
  // More opens on a plain click; the full pointer sequence can open and close it again on a fresh
  // page, so it is only the second try, once the page has settled.
  let under: HTMLElement | undefined;
  for (let attempt = 0; attempt < 2 && !under; attempt++) {
    if (attempt) await pause(1500, 2500);
    more.scrollIntoView({ block: "center" });
    if (attempt) press(more);
    else more.click();
    if (await waitFor(() => menus()[0], 2500)) under = await waitFor(connectIn, 1500);
  }
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  if (under) return { status: "connectable" };
  return marked(card, MESSAGE_ICON) ?? control(card, MESSAGE) ? { status: "already_connected" } : { status: "not_available", detail: "no Connect under More" };
}

// Called by the background with chrome.scripting.executeScript once this file is in the tab.
(globalThis as unknown as { __plutonInviteState: typeof inviteState }).__plutonInviteState = inviteState;
(globalThis as unknown as { __plutonInviteFromLink: typeof inviteFromLink }).__plutonInviteFromLink = inviteFromLink;
