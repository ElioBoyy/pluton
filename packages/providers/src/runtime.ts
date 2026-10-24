import { createHash } from "node:crypto";
import { eq, providerCache, providerCalls, type Db } from "@pluton/db";

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
  constructor(provider: string, readonly envVar: string) {
    super(provider, `not configured (set ${envVar} in .env)`);
  }
}

const lastCall = new Map<string, number>();

/** Spaces calls to one host so free APIs don't rate-limit us (e.g. the registry allows ~7 req/s). */
async function throttle(host: string, minIntervalMs: number) {
  const wait = (lastCall.get(host) ?? 0) + minIntervalMs - Date.now();
  lastCall.set(host, Date.now() + Math.max(wait, 0));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

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
      if (attempt >= retries) throw new ProviderError(provider, `request failed: ${(error as Error).message}`);
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
  const key = createHash("sha256").update(JSON.stringify([provider, operation, input])).digest("hex");
  if (!opts.fresh) {
    const hit = await db.query.providerCache.findFirst({ where: eq(providerCache.key, key) });
    if (hit && hit.expiresAt.getTime() > Date.now()) return hit.value as T;
  }

  const started = Date.now();
  try {
    const { value, items = 0, costMicroUsd = 0, ttlMs } = await fn();
    await db.insert(providerCalls).values({ provider, operation, ok: true, items, costMicroUsd, durationMs: Date.now() - started });
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

export function requireKey(provider: string, envVar: string) {
  const value = process.env[envVar]?.trim();
  if (!value) throw new MissingKeyError(provider, envVar);
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
