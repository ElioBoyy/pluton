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

/** Jobs left "running" by a worker that crashed go back to the queue. */
export async function recoverStaleJobs(db: Db, staleAfterMs = 10 * 60_000) {
  const cutoff = new Date(Date.now() - staleAfterMs);
  const recovered = await db
    .update(jobs)
    .set({ status: "queued", lockedAt: null, lockedBy: null })
    .where(and(eq(jobs.status, "running"), lt(jobs.lockedAt, cutoff)))
    .returning({ id: jobs.id });
  return recovered.length;
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
