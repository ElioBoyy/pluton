import {
  activityEvents,
  and,
  asc,
  eq,
  gt,
  streamEvents,
  type ActivityContext,
  type Db,
} from "@pluton/db";

export const jobChannel = (jobId: string) => `job:${jobId}`;

export async function emitStreamEvent(db: Db, channel: string, type: string, payload: unknown = {}) {
  const [event] = await db.insert(streamEvents).values({ channel, type, payload }).returning();
  return event!;
}

export async function readStreamEvents(db: Db, channel: string, afterId = 0, limit = 200) {
  return db
    .select()
    .from(streamEvents)
    .where(and(eq(streamEvents.channel, channel), gt(streamEvents.id, afterId)))
    .orderBy(asc(streamEvents.id))
    .limit(limit);
}

/**
 * Tails a channel by polling SQLite. The worker is another process, so there is no shared
 * in-memory bus; a short poll keeps narration feeling live without extra infrastructure.
 */
export async function* tailStreamEvents(
  db: Db,
  channel: string,
  opts: { afterId?: number; signal?: AbortSignal; intervalMs?: number } = {},
) {
  let cursor = opts.afterId ?? 0;
  const interval = opts.intervalMs ?? 250;
  while (!opts.signal?.aborted) {
    const batch = await readStreamEvents(db, channel, cursor);
    for (const event of batch) {
      cursor = event.id;
      yield event;
    }
    if (batch.length === 0) await sleep(interval, opts.signal);
  }
}

export async function recordActivity(
  db: Db,
  workspaceId: string,
  context: ActivityContext,
  kind: string,
  payload: unknown = {},
) {
  await db.insert(activityEvents).values({ workspaceId, context, kind, payload });
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
