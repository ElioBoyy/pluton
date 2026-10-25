import nodemailer from "nodemailer";
import { getSetting } from "@pluton/db";
import { ProviderError } from "./runtime.ts";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/providers.ts";

const t = localized(messages);

/** SMTP from Settings → API keys: the digest leaves from your own mailbox, nothing hosted. */
export const mailerConfigured = () => Boolean(getSetting("smtp_host") && getSetting("smtp_user") && getSetting("smtp_password"));

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
  const from = getSetting("smtp_from") || getSetting("smtp_user")!;
  try {
    await transport().sendMail({ from: `Pluton <${from}>`, ...mail });
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("smtp", (error as Error).message);
  }
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
