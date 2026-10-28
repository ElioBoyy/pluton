/**
 * Mailboxes Pluton can send from and read replies in with a password, as their providers document
 * them. Pluton signs in with a user and a password only (no OAuth), so Microsoft's mailboxes, which
 * require OAuth for IMAP, are listed apart as not supported yet. Each one carries the pages its
 * values come from, shown under the guide.
 */
export type MailProvider = {
  id: "gmail" | "icloud" | "fastmail" | "ovh";
  name: string;
  smtp: { host: string; port: number };
  imap: { host: string; port: number };
  /** Where the provider makes the password Pluton needs. */
  passwordUrl?: string;
  sources: string[];
};

export const MAIL_PROVIDERS: MailProvider[] = [
  {
    id: "gmail",
    name: "Gmail",
    smtp: { host: "smtp.gmail.com", port: 465 },
    imap: { host: "imap.gmail.com", port: 993 },
    passwordUrl: "https://myaccount.google.com/apppasswords",
    sources: ["https://developers.google.com/workspace/gmail/imap/imap-smtp", "https://support.google.com/accounts/answer/185833"],
  },
  {
    id: "icloud",
    name: "iCloud Mail",
    smtp: { host: "smtp.mail.me.com", port: 587 },
    imap: { host: "imap.mail.me.com", port: 993 },
    sources: ["https://support.apple.com/en-us/102525"],
  },
  {
    id: "fastmail",
    name: "Fastmail",
    smtp: { host: "smtp.fastmail.com", port: 465 },
    imap: { host: "imap.fastmail.com", port: 993 },
    sources: ["https://www.fastmail.help/hc/en-us/articles/1500000278342-Server-names-and-ports"],
  },
  {
    id: "ovh",
    name: "OVHcloud (MX Plan)",
    smtp: { host: "ssl0.ovh.net", port: 465 },
    imap: { host: "ssl0.ovh.net", port: 993 },
    sources: ["https://docs.ovhcloud.com/fr/guides/web-cloud/email-and-collaborative-solutions/mx-plan/how-to-configure-outlook-2016"],
  },
];

/** Why Microsoft's mailboxes don't connect yet: both pages say OAuth is required. */
export const MICROSOFT_SOURCES = [
  "https://support.microsoft.com/office/d088b986-291d-42b8-9564-9c414e2aa040",
  "https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online",
];

/** The provider whose SMTP and IMAP hosts are the ones saved, if any. */
export const providerFor = (smtpHost?: string | null, imapHost?: string | null) =>
  MAIL_PROVIDERS.find((p) => p.smtp.host === smtpHost && p.imap.host === imapHost);
