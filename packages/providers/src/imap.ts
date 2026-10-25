import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getSetting } from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import { fromAddress, sendOutreachEmail } from "./mailer.ts";
import { ProviderError } from "./runtime.ts";
import messages from "./messages/providers.ts";

const t = localized(messages);

// The inbox is usually the same mailbox as SMTP: user and password fall back to it.
const imapUser = () => getSetting("imap_user") || getSetting("smtp_user");
const imapPassword = () => getSetting("imap_password") || getSetting("smtp_password");

/** IMAP from Settings → API keys: Pluton reads replies to outreach emails in your own inbox. */
export const inboxConfigured = () => Boolean(getSetting("imap_host") && imapUser() && imapPassword());

function client() {
  if (!inboxConfigured()) throw new ProviderError("imap", t("error.imapMissing"));
  const port = Number(getSetting("imap_port") ?? 993);
  return new ImapFlow({
    host: getSetting("imap_host")!,
    port,
    secure: port === 993,
    auth: { user: imapUser()!, pass: imapPassword()! },
    logger: false,
    connectionTimeout: 15_000,
  });
}

async function withInbox<T>(fn: (imap: ImapFlow) => Promise<T>) {
  const imap = client();
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock("INBOX");
    try {
      return await fn(imap);
    } finally {
      lock.release();
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const e = error as Error & { responseText?: string };
    throw new ProviderError("imap", e.responseText || e.message);
  } finally {
    await imap.logout().catch(() => {});
  }
}

export async function verifyInbox() {
  const count = await withInbox(async (imap) => (imap.mailbox ? imap.mailbox.exists : 0));
  return t("check.imap", { host: getSetting("imap_host") ?? "", count });
}

/** What the headers say about a message, enough to tell whether it answers one of ours. */
export type InboxHeaders = { uid: number; messageId: string | null; inReplyTo: string | null; references: string[]; from: string | null };

export type InboxMessage = InboxHeaders & {
  date: Date;
  text: string;
  /** Out-of-office and other automatic answers: they don't mean the person replied. */
  automatic: boolean;
  /** A delivery failure from the receiving server. */
  bounce: boolean;
};

const ids = (value: string | undefined) => value?.match(/<[^<>\s]+>/g) ?? [];

function parseHeaders(raw: Buffer | undefined) {
  const map = new Map<string, string>();
  // Folded lines continue the header above them.
  for (const line of (raw?.toString("utf8") ?? "").replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) map.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
  }
  return map;
}

const BOUNCE_FROM = /mailer-daemon|postmaster/i;
/** Delivery failures come from the receiving server's daemon, not from the person. */
export const isBounceSender = (from: string | null) => BOUNCE_FROM.test(from ?? "");

/**
 * Messages received since `since` that `wanted` picks from their headers alone; only those are
 * downloaded and parsed. Delivery failures are always offered to `wanted` (their `from` is the daemon).
 */
export async function readInbox(opts: { since: Date; wanted: (h: InboxHeaders) => boolean }): Promise<InboxMessage[]> {
  return withInbox(async (imap) => {
    const uids = await imap.search({ since: opts.since }, { uid: true });
    if (!uids || uids.length === 0) return [];
    const picked: Array<InboxHeaders & { headers: Map<string, string> }> = [];
    // No other command may run while a fetch streams, so headers are collected first.
    for await (const msg of imap.fetch(uids, { uid: true, envelope: true, headers: ["in-reply-to", "references", "auto-submitted", "x-autoreply", "x-autorespond", "precedence"] }, { uid: true })) {
      const headers = parseHeaders(msg.headers);
      const h: InboxHeaders = {
        uid: msg.uid,
        messageId: msg.envelope?.messageId ?? null,
        inReplyTo: ids(headers.get("in-reply-to") ?? msg.envelope?.inReplyTo)[0] ?? null,
        references: ids(headers.get("references")),
        from: msg.envelope?.from?.[0]?.address?.toLowerCase() ?? null,
      };
      if (opts.wanted(h)) picked.push({ ...h, headers });
    }
    const out: InboxMessage[] = [];
    for (const h of picked) {
      const full = await imap.fetchOne(String(h.uid), { source: true }, { uid: true });
      if (!full || !full.source) continue;
      const parsed = await simpleParser(full.source);
      const auto = h.headers.get("auto-submitted");
      const bounce = isBounceSender(h.from);
      // A bounce carries the failed email's headers as an attachment: that's where our Message-ID is.
      const returned = bounce
        ? parsed.attachments
            .filter((a) => /message\/rfc822|text\/rfc822-headers|message\/delivery-status/i.test(a.contentType))
            .map((a) => a.content.toString("utf8"))
            .join("\n")
        : "";
      const { headers: _headers, ...rest } = h;
      out.push({
        ...rest,
        date: parsed.date ?? new Date(),
        text: [parsed.text ?? "", returned].filter(Boolean).join("\n"),
        automatic: Boolean((auto && auto.toLowerCase() !== "no") || h.headers.has("x-autoreply") || h.headers.has("x-autorespond") || /auto_reply/i.test(h.headers.get("precedence") ?? "")),
        bounce,
      });
    }
    return out;
  });
}

/** Their words only: the quoted thread under "On … wrote:" and lines starting with ">" go. */
export function stripQuoted(text: string) {
  const cut = text.search(/\n[^\n]*(?:\n[^\n]*)?\b(?:wrote|a écrit|escribió|ha scritto|schrieb)\s*:\s*\n|\n-{2,}\s*(?:Original Message|Message d’origine|Message d'origine)|\n(?:From|De|Von|Da)\s*:\s[^\n]+\n(?:Sent|Envoyé|Gesendet|Inviato|Enviado)\s*:/i);
  const kept = cut >= 0 ? text.slice(0, cut) : text;
  return kept
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .trim();
}

/**
 * Settings → "Send me a test email": one email to yourself through the same path as the sequence,
 * then, when IMAP is set, a look for it in the inbox, so both sending and reading replies are proven.
 */
export async function sendTestEmail(opts: { waitMs?: number } = {}) {
  const to = fromAddress();
  const started = Date.now();
  const { messageId } = await sendOutreachEmail({ to, subject: t("test.subject"), text: t("test.body") });
  if (!inboxConfigured()) return { outcome: "sent" as const, message: t("test.sentOnly", { to }) };
  const deadline = started + (opts.waitMs ?? 30_000);
  const since = new Date(started - 24 * 3_600_000);
  while (Date.now() < deadline) {
    const found = await readInbox({ since, wanted: (h) => h.messageId === messageId });
    if (found.length) return { outcome: "received" as const, message: t("test.received", { to, seconds: Math.max(1, Math.round((Date.now() - started) / 1000)) }) };
    await new Promise((r) => setTimeout(r, 3_000));
  }
  return { outcome: "not_found" as const, message: t("test.notFound", { to, seconds: Math.round((opts.waitMs ?? 30_000) / 1000) }) };
}
