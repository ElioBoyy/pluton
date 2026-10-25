import os from "node:os";
import {
  claimNextJob,
  completeJob,
  duePlays,
  getOrCreateDefaultWorkspace,
  startRun,
  emitStreamEvent,
  failJob,
  jobChannel,
  recoverStaleJobs,
  type JobHandler,
  type JobType,
} from "@pluton/core";
import { createDb, prepareDb } from "@pluton/db";
import { brainReview } from "./handlers/brain-review.ts";
import { onboardingStage } from "./handlers/onboarding-stage.ts";
import { leadFindingRun, playsPlan } from "./handlers/plays.ts";
import { systemPing } from "./handlers/system-ping.ts";

const handlers: Record<JobType, JobHandler> = {
  "system.ping": systemPing,
  "onboarding.stage": onboardingStage,
  "brain.review": brainReview,
  "plays.plan": playsPlan,
  "lead_finding.run": leadFindingRun,
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

/** Queues scheduled Plays once per local day; startRun ignores a Play that already has a run in flight. */
async function scheduleLoop() {
  while (!shutdown.signal.aborted) {
    try {
      const workspace = await getOrCreateDefaultWorkspace(db);
      for (const { play } of await duePlays(db, workspace.timezone)) {
        const run = await startRun(db, play.id, "schedule");
        console.log(`[worker] scheduled run ${run.id} for play "${play.name}"`);
      }
    } catch (error) {
      console.error("[worker] scheduler error", error);
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

console.log(`[worker] ${workerId} running ${CONCURRENCY} slot(s)`);
await Promise.all([...Array.from({ length: CONCURRENCY }, (_, i) => runLoop(i)), scheduleLoop()]);
console.log("[worker] stopped");
