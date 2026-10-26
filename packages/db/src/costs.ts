import { AsyncLocalStorage } from "node:async_hooks";
import type { Db } from "./index.ts";
import type { CostPurpose, CreditEntry } from "./schema.ts";
import { paidByPlatform } from "./settings.ts";
import { creditEntries } from "./tables.ts";

/**
 * Who pays for the calls made inside a job or request. The worker opens a scope per job and the
 * server per RPC call, so provider and Claude calls deep in the stack are attributed without
 * threading ids through every function.
 */
export type CostScope = {
  db: Db;
  workspaceId: string | null;
  /** Hosted: the account making the request, whose workspaces are the only ones it may see. */
  userId?: string | null;
  purpose: CostPurpose;
  playId?: string;
  runId?: string;
  jobId?: string;
};

const storage = new AsyncLocalStorage<CostScope>();

export function withCostScope<T>(scope: CostScope, fn: () => T): T {
  return storage.run(scope, fn);
}

/** Narrows the current scope (e.g. a run inside its job): unspecified fields are inherited. */
export function withinCostScope<T>(patch: Partial<CostScope>, fn: () => T): T {
  const current = storage.getStore();
  if (!current && !patch.db) return fn();
  return storage.run({ ...current, ...patch } as CostScope, fn);
}

export const currentCostScope = () => storage.getStore();

export type CostInput = {
  source: string;
  operation: string;
  costMicroUsd: number;
  billed?: boolean;
  detail?: Record<string, unknown>;
};

type CostListener = (entry: CreditEntry, db: Db) => void | Promise<void>;
const listeners = new Set<CostListener>();

/** Called after every ledger write in this process (run spend caps, budget alerts). */
export function onCostRecorded(listener: CostListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Writes one ledger entry attributed to the current scope. `db` is needed when there is no scope
 * (e.g. a provider call from a script); with neither, the cost is dropped.
 */
export async function recordCost(input: CostInput, db?: Db) {
  const scope = storage.getStore();
  const handle = scope?.db ?? db;
  if (!handle || input.costMicroUsd <= 0) return;
  const [entry] = await handle
    .insert(creditEntries)
    .values({
      workspaceId: scope?.workspaceId ?? null,
      purpose: scope?.purpose ?? "other",
      source: input.source,
      operation: input.operation,
      costMicroUsd: Math.round(input.costMicroUsd),
      billed: input.billed ?? true,
      platform: (input.billed ?? true) && paidByPlatform(input.source, scope?.workspaceId),
      playId: scope?.playId,
      runId: scope?.runId,
      jobId: scope?.jobId,
      detail: input.detail,
    })
    .returning();
  for (const listener of listeners) {
    try {
      await listener(entry!, handle);
    } catch (error) {
      console.error("[costs] listener failed", error);
    }
  }
}
