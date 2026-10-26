import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import { getSetting } from "@pluton/db";
import { ProviderError } from "./runtime.ts";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/providers.ts";

const t = localized(messages);

/** SMTP from Settings → API keys: outreach leaves from your own mailbox, nothing hosted. */
export const mailerConfigured = () => Boolean(getSetting("smtp_host") && getSetting("smtp_user") && getSetting("smtp_password"));

/**
 * The hosted app sends its own emails (the digest) through Resend, from EMAIL_FROM on its domain.
 * Outreach never goes through it: that stays on the founder's own SMTP.
 */
const resend = { apiKey: process.env.RESEND_API_KEY ?? "", from: process.env.EMAIL_FROM ?? "" };
const resendConfigured = () => Boolean(resend.apiKey && resend.from);

/** Whether the app can email the founder: through Resend when hosted, else through their SMTP. */
export const appMailConfigured = () => resendConfigured() || mailerConfigured();

/** The mailbox outreach emails leave from. */
export const fromAddress = () => getSetting("smtp_from") || getSetting("smtp_user")!;

/**
 * The server's IPv4 address, as the system resolves it (like a browser does), when it has one.
 * A Mac always has IPv6 interfaces, so nodemailer also tries IPv6 addresses, even where no IPv6
 * route leads anywhere: the send then fails with EHOSTUNREACH. Its name stays the TLS server name.
 */
async function reachableHost(host: string) {
  if (net.isIP(host)) return host;
  return lookup(host, { family: 4 }).then(
    (found) => found.address,
    () => host,
  );
}

async function transport() {
  if (!mailerConfigured()) throw new ProviderError("smtp", t("error.smtpMissing"));
  const host = getSetting("smtp_host")!;
  const port = Number(getSetting("smtp_port") ?? 465);
  return nodemailer.createTransport({
    host: await reachableHost(host),
    port,
    secure: port === 465,
    tls: { servername: host },
    auth: { user: getSetting("smtp_user"), pass: getSetting("smtp_password") },
    connectionTimeout: 15_000,
  });
}

async function sendWithResend(mail: { to: string; subject: string; html: string; text: string }) {
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resend.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: resend.from, ...mail }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new ProviderError("resend", (error as Error).message);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ProviderError("resend", body?.message ?? res.statusText, res.status);
  }
}

/** An email from the app to the founder (the digest). */
export async function sendMail(mail: { to: string; subject: string; html: string; text: string }) {
  if (resendConfigured()) return sendWithResend(mail);
  const from = fromAddress();
  try {
    await (await transport()).sendMail({ from: `Pluton <${from}>`, ...mail });
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
    await (await transport()).sendMail({
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
    await (await transport()).verify();
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("smtp", (error as Error).message);
  }
  return t("check.smtp", { host: getSetting("smtp_host") ?? "" });
}
