import os from "node:os";
import {
  claimNextJob,
  completeJob,
  emitStreamEvent,
  failJob,
  jobChannel,
  recoverStaleJobs,
  type JobHandler,
  type JobType,
} from "@pluton/core";
import { createDb, prepareDb } from "@pluton/db";
import { onboardingStage } from "./handlers/onboarding-stage.ts";
import { systemPing } from "./handlers/system-ping.ts";

const handlers: Record<JobType, JobHandler> = {
  "system.ping": systemPing,
  "onboarding.stage": onboardingStage,
};

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);
const IDLE_POLL_MS = 500;
const workerId = `${os.hostname()}:${process.pid}`;

const db = createDb();
await prepareDb(db);

const shutdown = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[worker] ${sig}, finishing in-flight jobs…`);
    shutdown.abort();
  });
}

const recovered = await recoverStaleJobs(db);
if (recovered) console.log(`[worker] requeued ${recovered} stale job(s)`);

async function runLoop(slot: number) {
  while (!shutdown.signal.aborted) {
    const job = await claimNextJob(db, `${workerId}#${slot}`);
    if (!job) {
      await new Promise((r) => setTimeout(r, IDLE_POLL_MS));
      continue;
    }

    const handler = handlers[job.type as JobType];
    const emit = async (type: string, payload?: unknown) => {
      await emitStreamEvent(db, jobChannel(job.id), type, payload);
    };
    const started = Date.now();
    try {
      if (!handler) throw new Error(`No handler for job type "${job.type}"`);
      const result = await handler({ db, job, emit, signal: shutdown.signal });
      await completeJob(db, job.id, result);
      console.log(`[worker] ${job.type} ${job.id} done in ${Date.now() - started}ms`);
    } catch (error) {
      await failJob(db, job, error);
      await emit("error", { message: error instanceof Error ? error.message : String(error) });
      console.error(`[worker] ${job.type} ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts})`, error);
    }
  }
}

console.log(`[worker] ${workerId} running ${CONCURRENCY} slot(s)`);
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => runLoop(i)));
console.log("[worker] stopped");
