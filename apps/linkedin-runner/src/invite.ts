import path from "node:path";
import type { Locator, Page } from "playwright";
import { DATA_DIR, humanPause, serial, session } from "./sessions.ts";

/**
 * Sends a connection invitation the way a person would: open the profile, press Connect (or find it
 * under More), add the note if there is one, send. LinkedIn's buttons are found by their accessible
 * names, in English and French; a name LinkedIn changes is the first thing to check when it fails.
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
export const NOTE_MAX = 300;

export function invite(accountId: string, profileUrl: string, note?: string): Promise<InviteResult> {
  return serial(accountId, async () => {
    const { page } = await session(accountId);
    try {
      return await run(page, profileUrl, note?.trim().slice(0, NOTE_MAX));
    } catch (e) {
      // What the page looked like when it failed: the quickest way to see which button moved.
      await page.screenshot({ path: path.join(DATA_DIR, accountId, "last-error.png"), fullPage: false }).catch(() => {});
      throw e;
    }
  });
}

async function run(page: Page, profileUrl: string, note: string | undefined): Promise<InviteResult> {
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
  await humanPause(1500, 3000);
  if (/\/(login|authwall|checkpoint|uas\/login)/.test(new URL(page.url()).pathname)) return { status: "disconnected" };

  // The profile's own card comes first in <main>; suggestions further down have Connect buttons too.
  const main = page.locator("main").first();
  if (await visible(main.getByRole("button", { name: PENDING }).first())) return { status: "already_pending" };

  let connect = main.getByRole("button", { name: CONNECT }).first();
  if (!(await visible(connect))) {
    const more = main.getByRole("button", { name: MORE }).first();
    if (!(await visible(more))) return { status: "not_available", detail: "no Connect or More button" };
    await more.click();
    await humanPause();
    connect = page.getByRole("button", { name: CONNECT }).or(page.getByRole("menuitem", { name: CONNECT })).first();
    if (!(await visible(connect))) {
      const connected = await visible(main.getByRole("button", { name: MESSAGE }).first());
      return connected ? { status: "already_connected" } : { status: "not_available", detail: "no Connect under More" };
    }
  }
  await connect.click();
  await humanPause();

  const dialog = page.getByRole("dialog").first();
  if (!(await visible(dialog, 5000))) return { status: "not_available", detail: "no invitation dialog" };
  if (await dialog.locator("input[type=email]").count()) return { status: "email_required" };

  if (note) {
    await dialog.getByRole("button", { name: ADD_NOTE }).first().click();
    await humanPause();
    await dialog.locator("textarea").first().pressSequentially(note, { delay: 25 + Math.random() * 40 });
    await humanPause();
    await dialog.getByRole("button", { name: SEND }).first().click();
  } else {
    const without = dialog.getByRole("button", { name: SEND_WITHOUT_NOTE }).first();
    await ((await visible(without)) ? without : dialog.getByRole("button", { name: SEND }).first()).click();
  }
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  return { status: "sent" };
}

async function visible(locator: Locator, timeout = 2500) {
  return locator.waitFor({ state: "visible", timeout }).then(
    () => true,
    () => false,
  );
}
