import { createHash } from "node:crypto";
import { assertPlatformQuota, currentCostScope, eq, getSetting, HOSTED, providerCache, providerCalls, recordCost, settingSource, type Db } from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/providers.ts";

const t = localized(messages);

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
  }
}

export class MissingKeyError extends ProviderError {
  constructor(provider: string, readonly settingKey: string) {
    super(provider, t("error.missingKey"));
  }
}

const lastCall = new Map<string, number>();

/** Spaces calls to one host so free APIs don't rate-limit us (e.g. the registry allows ~7 req/s). */
async function throttle(host: string, minIntervalMs: number) {
  const wait = (lastCall.get(host) ?? 0) + minIntervalMs - Date.now();
  lastCall.set(host, Date.now() + Math.max(wait, 0));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

/** Codes of a connection that didn't happen or broke: the network, not the service, said no. */
const NETWORK_CODES = /\b(EHOSTUNREACH|ENETUNREACH|ENETDOWN|ECONNREFUSED|ECONNRESET|ECONNABORTED|ETIMEDOUT|EPIPE|EAI_AGAIN|ENOTFOUND|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET|UND_ERR_HEADERS_TIMEOUT)\b|fetch failed|socket hang up|timeout/i;

/** fetch only says "fetch failed": the reason (a code such as ENOTFOUND) sits on its cause. */
const networkReason = (error: unknown) => {
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
  const why = cause?.code ?? cause?.message;
  return why ? `${(error as Error).message} (${why})` : (error as Error).message;
};

/**
 * Whether an error is the network failing (offline, Wi-Fi switching, a route missing) rather than
 * the service refusing: worth trying again later, never a reason to give up on someone.
 */
export const isNetworkError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  return NETWORK_CODES.test(`${code ?? ""} ${(error as Error)?.message ?? ""}`);
};

export type HttpOptions = RequestInit & { timeoutMs?: number; minIntervalMs?: number; retries?: number };

/** fetch with a timeout, host throttling and retries on 429/5xx/network errors. */
export async function http(provider: string, url: string, opts: HttpOptions = {}): Promise<Response> {
  const { timeoutMs = 20_000, minIntervalMs = 0, retries = 2, ...init } = opts;
  const host = new URL(url).host;
  for (let attempt = 0; ; attempt++) {
    await throttle(host, minIntervalMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "user-agent": "Pluton/0.1 (local GTM research)", ...init.headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        await new Promise((r) => setTimeout(r, retryAfter || 800 * 2 ** attempt));
        continue;
      }
      return res;
    } catch (error) {
      if (attempt >= retries) throw new ProviderError(provider, `request failed: ${networkReason(error)}`);
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    }
  }
}

export async function httpJson<T>(provider: string, url: string, opts: HttpOptions = {}): Promise<T> {
  const res = await http(provider, url, opts);
  if (!res.ok) throw new ProviderError(provider, `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`, res.status);
  return (await res.json()) as T;
}

export type CallOptions = { ttlMs?: number; fresh?: boolean };

/**
 * Runs a provider operation through the cache and logs real calls with their cost.
 * `fn` returns the value plus optional item count, cost (micro-USD) and a TTL overriding `opts.ttlMs`.
 */
export async function providerCall<T>(
  db: Db,
  provider: string,
  operation: string,
  input: unknown,
  fn: () => Promise<{ value: T; items?: number; costMicroUsd?: number; ttlMs?: number }>,
  opts: CallOptions = {},
): Promise<T> {
  const key = cacheKey(provider, operation, input);
  if (!opts.fresh) {
    const hit = await db.query.providerCache.findFirst({ where: eq(providerCache.key, key) });
    if (hit && hit.expiresAt.getTime() > Date.now()) return hit.value as T;
  }

  const started = Date.now();
  try {
    const { value, items = 0, costMicroUsd = 0, ttlMs } = await fn();
    await db.insert(providerCalls).values({ provider, operation, ok: true, items, costMicroUsd, durationMs: Date.now() - started });
    await recordCost({ source: provider, operation, costMicroUsd, detail: { items } }, db);
    const expiresAt = new Date(Date.now() + (ttlMs ?? opts.ttlMs ?? 24 * 3600_000));
    await db
      .insert(providerCache)
      .values({ key, provider, value: value as unknown, expiresAt })
      .onConflictDoUpdate({ target: providerCache.key, set: { value: value as unknown, expiresAt } });
    return value;
  } catch (error) {
    await db.insert(providerCalls).values({
      provider,
      operation,
      ok: false,
      durationMs: Date.now() - started,
      error: (error as Error).message.slice(0, 500),
    });
    throw error;
  }
}

/** Reads a key saved in Settings → API keys, or Pluton's own while the plan's quota lasts. */
export function requireKey(provider: string, settingKey: string) {
  const value = getSetting(settingKey)?.trim();
  if (!value) throw new MissingKeyError(provider, settingKey);
  assertPlatformQuota(settingKey);
  return value;
}

/** Normalizes "Example.com/", "https://www.example.com/x" → "example.com". */
export function toDomain(input: string) {
  const s = input.trim().toLowerCase();
  try {
    return new URL(s.startsWith("http") ? s : `https://${s}`).hostname.replace(/^www\./, "");
  } catch {
    return s.replace(/^www\./, "").split("/")[0]!;
  }
}

/** Checks a data-source key against its provider's account endpoint. */
export async function checkProviderKey(settingKey: string): Promise<string> {
  if (settingKey.startsWith("imap_")) {
    const { verifyInbox } = await import("./imap.ts");
    return verifyInbox();
  }
  if (settingKey.startsWith("smtp_") || settingKey === "email_daily_limit") {
    const { verifyMailer } = await import("./mailer.ts");
    return verifyMailer();
  }
  if (settingKey === "unipile_api_key" || settingKey === "unipile_dsn") {
    // Loaded lazily: the Unipile adapter itself builds on this module.
    const { unipileAccounts } = await import("./unipile.ts");
    const accounts = await unipileAccounts();
    return t("check.unipile", { count: accounts.length });
  }
  // Pluton's own key: a check would show its account with the provider to the workspace.
  if (settingSource(settingKey) === "platform") return t("check.saved");
  const key = requireKey(settingKey, settingKey);
  switch (settingKey) {
    case "apify_token": {
      const me = await httpJson<{ data: { username: string } }>("apify", "https://api.apify.com/v2/users/me", {
        headers: { authorization: `Bearer ${key}` },
        retries: 0,
      });
      return t("check.apify", { account: me.data.username });
    }
    case "hunter_api_key": {
      const acct = await httpJson<{ data: { requests: { searches: { available: number; used: number } } } }>(
        "hunter",
        `https://api.hunter.io/v2/account?api_key=${encodeURIComponent(key)}`,
        { retries: 0 },
      );
      const s = acct.data.requests.searches;
      return t("check.hunter", { count: s.available - s.used });
    }
    default:
      return t("check.saved");
  }
}

/** Hosted, what one workspace paid for is cached for it alone. */
const cacheKey = (provider: string, operation: string, input: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(HOSTED ? [currentCostScope()?.workspaceId ?? null, provider, operation, input] : [provider, operation, input]))
    .digest("hex");

/** Direct cache access for batch operations that can't go through providerCall one item at a time. */
export async function cacheGet<T>(db: Db, provider: string, operation: string, input: unknown) {
  const hit = await db.query.providerCache.findFirst({ where: eq(providerCache.key, cacheKey(provider, operation, input)) });
  return hit && hit.expiresAt.getTime() > Date.now() ? { hit: true as const, value: hit.value as T } : { hit: false as const };
}

export async function cacheSet(db: Db, provider: string, operation: string, input: unknown, value: unknown, ttlMs: number) {
  const key = cacheKey(provider, operation, input);
  const expiresAt = new Date(Date.now() + ttlMs);
  await db
    .insert(providerCache)
    .values({ key, provider, value, expiresAt })
    .onConflictDoUpdate({ target: providerCache.key, set: { value, expiresAt } });
}

export async function logProviderCall(
  db: Db,
  call: { provider: string; operation: string; ok: boolean; items?: number; durationMs: number; error?: string },
) {
  await db.insert(providerCalls).values({ ...call, items: call.items ?? 0 });
}
