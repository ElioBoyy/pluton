import { getSetting, settingSource } from "@pluton/db";
import { http, ProviderError, requireKey } from "./runtime.ts";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/providers.ts";

const t = localized(messages);

/**
 * Unipile acts on connected LinkedIn accounts: profile visits, invitations, messages, reactions,
 * and reading conversations. Accounts connect through Unipile's hosted page (codes and captchas
 * handled there). Docs: developer.unipile.com.
 */
const PROVIDER = "unipile";
export const UNIPILE_KEY = "unipile_api_key";
export const UNIPILE_DSN = "unipile_dsn";

export const unipileConfigured = () => Boolean(getSetting(UNIPILE_KEY)?.trim() && getSetting(UNIPILE_DSN)?.trim());
/**
 * Hosted, on Pluton's own Unipile account (the LinkedIn option): one account serves every
 * workspace, so a workspace only ever sees the LinkedIn accounts it connected itself.
 */
export const unipileOnPlatform = () => settingSource(UNIPILE_KEY) === "platform";

function baseUrl() {
  const dsn = getSetting(UNIPILE_DSN)?.trim();
  if (!dsn) throw new ProviderError(PROVIDER, t("error.unipileDsn"));
  return dsn.startsWith("http") ? dsn.replace(/\/$/, "") : `https://${dsn}`;
}

export class UnipileError extends ProviderError {
  constructor(
    message: string,
    status: number,
    /** Unipile's error type, e.g. errors/already_connected. */
    readonly type?: string,
    readonly retryAfter?: number,
  ) {
    super(PROVIDER, message, status);
  }
}

async function call<T>(method: string, path: string, opts: { query?: Record<string, string | number | undefined>; json?: unknown; form?: Record<string, string | string[]> } = {}): Promise<T> {
  const key = requireKey(PROVIDER, UNIPILE_KEY);
  const url = new URL(`${baseUrl()}/api/v1${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  let body: string | FormData | undefined;
  const headers: Record<string, string> = { "X-API-KEY": key, accept: "application/json" };
  if (opts.json !== undefined) {
    body = JSON.stringify(opts.json);
    headers["content-type"] = "application/json";
  } else if (opts.form) {
    const form = new FormData();
    for (const [k, v] of Object.entries(opts.form)) for (const item of Array.isArray(v) ? v : [v]) form.append(k, item);
    body = form;
  }
  // Writes are never retried: a timeout after LinkedIn accepted an invitation must not send it twice.
  const res = await http(PROVIDER, url.toString(), { method, headers, body, retries: method === "GET" ? 2 : 0, timeoutMs: 60_000 });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const detail = [data.title, data.detail].filter(Boolean).join(": ") || text.slice(0, 200);
    throw new UnipileError(`HTTP ${res.status} ${detail}`, res.status, typeof data.type === "string" ? data.type : undefined, Number(data.retry_after) || undefined);
  }
  return data as T;
}

/** A one-time link to Unipile's hosted page where you log in to LinkedIn. */
/** `notifyUrl`: where Unipile says which account was just connected (with `name` echoed back). */
export async function unipileConnectLink(opts: { name: string; reconnectAccountId?: string; notifyUrl?: string }) {
  const expiresOn = new Date(Date.now() + 60 * 60_000).toISOString();
  const body = opts.reconnectAccountId
    ? { type: "reconnect", reconnect_account: opts.reconnectAccountId, api_url: baseUrl(), expiresOn, notify_url: opts.notifyUrl }
    : { type: "create", providers: ["LINKEDIN"], api_url: baseUrl(), expiresOn, name: opts.name, notify_url: opts.notifyUrl };
  const res = await call<{ url: string }>("POST", "/hosted/accounts/link", { json: body });
  return res.url;
}

export type UnipileAccount = { id: string; name: string; status: string; publicIdentifier?: string };

type ApiAccount = { id: string; name: string; type: string; sources?: Array<{ status: string }>; connection_params?: { im?: { publicIdentifier?: string } } };
const toAccount = (a: ApiAccount): UnipileAccount => ({
  id: a.id,
  name: a.name,
  status: a.sources?.[0]?.status ?? "OK",
  publicIdentifier: a.connection_params?.im?.publicIdentifier,
});

export async function unipileAccounts(): Promise<UnipileAccount[]> {
  const res = await call<{ items: ApiAccount[] }>("GET", "/accounts", { query: { limit: 100 } });
  return res.items.filter((a) => a.type === "LINKEDIN").map(toAccount);
}

/** One account, or null when Unipile doesn't know it (deleted, or never connected). */
export async function unipileAccount(id: string): Promise<UnipileAccount | null> {
  try {
    const a = await call<ApiAccount>("GET", `/accounts/${encodeURIComponent(id)}`);
    return a.type === "LINKEDIN" ? toAccount(a) : null;
  } catch (error) {
    if (error instanceof ProviderError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Unlinks an account from Unipile and signs it out of LinkedIn. Unipile bills the month's peak of
 * connected accounts, so this lowers next month's bill, not this one's.
 */
export async function deleteUnipileAccount(id: string) {
  await call("DELETE", `/accounts/${encodeURIComponent(id)}`);
}

/** "https://www.linkedin.com/in/jane-doe-123/?x" → "jane-doe-123". */
export function linkedinPublicId(url: string) {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]!) : null;
}

export type UnipileProfile = { providerId: string; firstName?: string; connected: boolean; invitationPending: boolean };

/** Reads a profile, which is the profile visit. `notify` false: they aren't told who looked. */
export async function unipileProfile(accountId: string, identifier: string, notify = true): Promise<UnipileProfile> {
  const p = await call<{ provider_id: string; first_name?: string; network_distance?: string; is_relationship?: boolean; invitation?: { type?: string; status?: string } }>(
    "GET",
    `/users/${encodeURIComponent(identifier)}`,
    { query: { account_id: accountId, notify: String(notify) } },
  );
  return {
    providerId: p.provider_id,
    firstName: p.first_name,
    connected: p.network_distance === "FIRST_DEGREE" || p.is_relationship === true,
    invitationPending: p.invitation?.type === "SENT" && p.invitation?.status === "PENDING",
  };
}

export async function unipileInvite(accountId: string, providerId: string, message?: string) {
  return call<{ invitation_id: string; usage?: number }>("POST", "/users/invite", {
    json: { account_id: accountId, provider_id: providerId, ...(message ? { message: message.slice(0, 300) } : {}) },
  });
}

export async function unipileLatestPost(accountId: string, providerId: string) {
  const res = await call<{ items: Array<{ social_id: string; text?: string; is_repost?: boolean; parsed_datetime?: string }> }>(
    "GET",
    `/users/${encodeURIComponent(providerId)}/posts`,
    { query: { account_id: accountId, limit: 5 } },
  );
  return res.items.find((p) => !p.is_repost) ?? null;
}

export async function unipileLike(accountId: string, socialId: string) {
  return call("POST", "/posts/reaction", { json: { account_id: accountId, post_id: socialId, reaction_type: "like" } });
}

/** First message to someone opens a chat; later ones go into it. */
export async function unipileSendMessage(accountId: string, opts: { chatId?: string | null; providerId: string; text: string }) {
  if (opts.chatId) {
    const res = await call<{ message_id?: string }>("POST", `/chats/${encodeURIComponent(opts.chatId)}/messages`, { form: { text: opts.text } });
    return { chatId: opts.chatId, messageId: res.message_id ?? null };
  }
  const res = await call<{ chat_id: string | null; message_id: string | null }>("POST", "/chats", {
    form: { account_id: accountId, attendees_ids: [opts.providerId], text: opts.text },
  });
  return { chatId: res.chat_id, messageId: res.message_id };
}

export type UnipileMessage = { id: string; text: string; fromThem: boolean; at: Date };

export async function unipileMessages(chatId: string, after?: Date): Promise<UnipileMessage[]> {
  const res = await call<{ items: Array<{ id: string; text: string | null; is_sender: number | boolean; timestamp: string }> }>(
    "GET",
    `/chats/${encodeURIComponent(chatId)}/messages`,
    { query: { limit: 50, after: after?.toISOString() } },
  );
  return res.items.map((m) => ({ id: m.id, text: m.text ?? "", fromThem: !m.is_sender, at: new Date(m.timestamp) }));
}

/** The chat with a person, when they wrote first or we lost the id. */
export async function unipileFindChat(accountId: string, providerId: string) {
  const res = await call<{ items: Array<{ id: string; attendee_provider_id?: string }> }>("GET", "/chats", { query: { account_id: accountId, limit: 100 } });
  return res.items.find((c) => c.attendee_provider_id === providerId)?.id ?? null;
}

/**
 * Unlinks an account from Pluton's own Unipile account, with the platform key itself: when a
 * subscription has ended, the workspace no longer resolves to it. Unipile bills every account it
 * holds, connected or not, so a customer who left must not stay there. False when no platform
 * Unipile is configured; an account Unipile no longer knows counts as gone.
 */
export async function deletePlatformUnipileAccount(id: string) {
  const key = process.env.PLATFORM_UNIPILE_API_KEY?.trim();
  const dsn = process.env.PLATFORM_UNIPILE_DSN?.trim();
  if (!key || !dsn) return false;
  const base = dsn.startsWith("http") ? dsn.replace(/\/$/, "") : `https://${dsn}`;
  const res = await http(PROVIDER, `${base}/api/v1/accounts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-API-KEY": key, accept: "application/json" },
    retries: 1,
  });
  if (!res.ok && res.status !== 404) throw new UnipileError(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`, res.status);
  return true;
}
