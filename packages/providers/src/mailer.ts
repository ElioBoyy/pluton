import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { getSetting } from "@pluton/db";
import { ProviderError } from "./runtime.ts";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/providers.ts";

const t = localized(messages);

/** SMTP from Settings → API keys: the digest leaves from your own mailbox, nothing hosted. */
export const mailerConfigured = () => Boolean(getSetting("smtp_host") && getSetting("smtp_user") && getSetting("smtp_password"));

/** The mailbox outreach emails leave from. */
export const fromAddress = () => getSetting("smtp_from") || getSetting("smtp_user")!;

function transport() {
  if (!mailerConfigured()) throw new ProviderError("smtp", t("error.smtpMissing"));
  const port = Number(getSetting("smtp_port") ?? 465);
  return nodemailer.createTransport({
    host: getSetting("smtp_host"),
    port,
    secure: port === 465,
    auth: { user: getSetting("smtp_user"), pass: getSetting("smtp_password") },
    connectionTimeout: 15_000,
  });
}

export async function sendMail(mail: { to: string; subject: string; html: string; text: string }) {
  const from = fromAddress();
  try {
    await transport().sendMail({ from: `Pluton <${from}>`, ...mail });
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("smtp", (error as Error).message);
  }
}

/**
 * One outreach email, plain text, from your own name. Follow-ups pass the earlier Message-IDs so
 * they land in the same thread; returns this email's Message-ID, which replies point back to.
 */
export async function sendOutreachEmail(mail: { to: string; subject: string; text: string; inReplyTo?: string; references?: string[] }) {
  const from = fromAddress();
  const messageId = `<${randomUUID()}@${from.split("@")[1] ?? "pluton.local"}>`;
  try {
    await transport().sendMail({
      from: { name: getSetting("smtp_from_name") || from, address: from },
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      messageId,
      inReplyTo: mail.inReplyTo,
      references: mail.references,
      // One-click "no thanks": it arrives as a reply, which stops the sequence.
      list: { unsubscribe: { url: `mailto:${from}?subject=unsubscribe`, comment: "Unsubscribe" } },
    });
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("smtp", (error as Error).message);
  }
  return { messageId };
}

export async function verifyMailer() {
  try {
    await transport().verify();
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("smtp", (error as Error).message);
  }
  return t("check.smtp", { host: getSetting("smtp_host") ?? "" });
}
