import { hostname } from "node:os";
import { and, asc, desc, eq, inArray, jobs, lt, lte, sql, type Db, type Job } from "@pluton/db";

export type EnqueueInput = {
  type: string;
  payload?: unknown;
  workspaceId?: string | null;
  runAt?: Date;
  maxAttempts?: number;
  idempotencyKey?: string;
};

/** Enqueues a job. With an idempotency key, a retry returns the job already enqueued. */
export async function enqueueJob(db: Db, input: EnqueueInput): Promise<Job> {
  const [created] = await db
    .insert(jobs)
    .values({
      type: input.type,
      payload: input.payload ?? {},
      workspaceId: input.workspaceId ?? null,
      runAt: input.runAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? 3,
      idempotencyKey: input.idempotencyKey ?? null,
    })
    .onConflictDoNothing({ target: jobs.idempotencyKey })
    .returning();
  if (created) return created;

  const existing = await db.query.jobs.findFirst({
    where: eq(jobs.idempotencyKey, input.idempotencyKey!),
  });
  if (!existing) throw new Error(`Job with key ${input.idempotencyKey} vanished`);
  return existing;
}

/** Atomically takes the oldest due job. A single UPDATE … RETURNING, so two workers never get the same one. */
export async function claimNextJob(db: Db, workerId: string): Promise<Job | undefined> {
  const now = new Date();
  const next = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.status, "queued"), lte(jobs.runAt, now)))
    .orderBy(asc(jobs.runAt))
    .limit(1);

  const [claimed] = await db
    .update(jobs)
    .set({ status: "running", lockedAt: now, lockedBy: workerId, attempts: sql`${jobs.attempts} + 1` })
    .where(and(inArray(jobs.id, next), eq(jobs.status, "queued")))
    .returning();
  return claimed;
}

export async function completeJob(db: Db, jobId: string, result: unknown) {
  await db
    .update(jobs)
    .set({ status: "completed", result: result ?? null, error: null, lockedAt: null, lockedBy: null })
    .where(eq(jobs.id, jobId));
}

/** Requeues with exponential backoff until max attempts, then marks the job failed. */
export async function failJob(db: Db, job: Job, error: unknown) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  const exhausted = job.attempts >= job.maxAttempts;
  await db
    .update(jobs)
    .set({
      status: exhausted ? "failed" : "queued",
      error: message,
      lockedAt: null,
      lockedBy: null,
      runAt: exhausted ? job.runAt : new Date(Date.now() + 1000 * 2 ** job.attempts),
    })
    .where(eq(jobs.id, job.id));
}

/** The worker running a job calls this every minute, so a long job is never mistaken for an abandoned one. */
export async function heartbeatJob(db: Db, jobId: string, workerId: string) {
  await db
    .update(jobs)
    .set({ lockedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "running"), eq(jobs.lockedBy, workerId)));
}

/**
 * Jobs left "running" by a worker that died go back to the queue: immediately when the worker
 * was on this machine and its process is gone (a crash or a dev reload), otherwise once it has
 * missed its heartbeat for `staleAfterMs`. A process never requeues its own jobs: they are live.
 */
export async function recoverStaleJobs(db: Db, staleAfterMs = 10 * 60_000) {
  const cutoff = new Date(Date.now() - staleAfterMs);
  const running = await db.select({ id: jobs.id, lockedBy: jobs.lockedBy, lockedAt: jobs.lockedAt }).from(jobs).where(eq(jobs.status, "running"));
  const orphaned = running.filter((j) => {
    const [host, pidAndSlot] = (j.lockedBy ?? "").split(":");
    const pid = Number(pidAndSlot?.split("#")[0]);
    if (host === hostname() && pid === process.pid) return false;
    if (host === hostname() && pid && !processAlive(pid)) return true;
    return j.lockedAt !== null && j.lockedAt < cutoff;
  });
  if (orphaned.length === 0) return 0;
  await db
    .update(jobs)
    .set({ status: "queued", lockedAt: null, lockedBy: null })
    .where(and(eq(jobs.status, "running"), inArray(jobs.id, orphaned.map((j) => j.id))));
  return orphaned.length;
}

function processAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means it exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export async function getJob(db: Db, jobId: string) {
  return db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
}

export type JobContext = {
  db: Db;
  job: Job;
  /** Emits on the job's own channel (`job:<id>`) so the UI can follow it live. */
  emit: (type: string, payload?: unknown) => Promise<void>;
  signal: AbortSignal;
};

export type JobHandler = (ctx: JobContext) => Promise<unknown>;

/** The workspace's queued or running job of a type, so the UI can reattach to it after a reload. */
export async function findActiveJob(db: Db, workspaceId: string, type: string) {
  return db.query.jobs.findFirst({
    where: and(eq(jobs.workspaceId, workspaceId), eq(jobs.type, type), inArray(jobs.status, ["queued", "running"])),
    orderBy: desc(jobs.createdAt),
  });
}

/** Asks the worker to stop a running job; it aborts the handler's signal within a few seconds. */
export async function requestJobCancel(db: Db, jobId: string) {
  await db.update(jobs).set({ cancelRequested: true }).where(eq(jobs.id, jobId));
  // A job still waiting in the queue is simply cancelled.
  await db.update(jobs).set({ status: "cancelled" }).where(and(eq(jobs.id, jobId), eq(jobs.status, "queued")));
}

export async function isCancelRequested(db: Db, jobId: string) {
  const row = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId), columns: { cancelRequested: true } });
  return row?.cancelRequested ?? false;
}

export async function markJobCancelled(db: Db, jobId: string) {
  await db.update(jobs).set({ status: "cancelled", lockedAt: null, lockedBy: null }).where(eq(jobs.id, jobId));
}
