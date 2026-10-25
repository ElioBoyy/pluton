import os from "node:os";
import {
  claimNextJob,
  completeJob,
  duePlays,
  enqueueJob,
  getSingleton,
  localDay,
  getOrCreateDefaultWorkspace,
  startRun,
  emitStreamEvent,
  failJob,
  isCancelRequested,
  jobChannel,
  markJobCancelled,
  recoverStaleJobs,
  type JobHandler,
  type JobType,
} from "@pluton/core";
import { createDb, getSetting, prepareDb, watchSettings } from "@pluton/db";
import { brainReview } from "./handlers/brain-review.ts";
import { onboardingStage } from "./handlers/onboarding-stage.ts";
import { leadsFindEmails } from "./handlers/leads.ts";
import { leadFindingRun, playsPlan } from "./handlers/plays.ts";
import { systemPing } from "./handlers/system-ping.ts";

const handlers: Record<JobType, JobHandler> = {
  "system.ping": systemPing,
  "onboarding.stage": onboardingStage,
  "brain.review": brainReview,
  "plays.plan": playsPlan,
  "lead_finding.run": leadFindingRun,
  "leads.find_emails": leadsFindEmails,
};

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);
const IDLE_POLL_MS = 500;
const workerId = `${os.hostname()}:${process.pid}`;

const db = createDb();
await prepareDb(db);
await watchSettings(db);

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
    // Each job has its own signal: aborted on shutdown or when the UI asks to cancel this job.
    const jobAbort = new AbortController();
    // The reason lets handlers tell a restart (run it again) from a cancel the founder asked for.
    const onShutdown = () => jobAbort.abort("shutdown");
    shutdown.signal.addEventListener("abort", onShutdown);
    const cancelPoll = setInterval(() => {
      void isCancelRequested(db, job.id).then((yes) => yes && jobAbort.abort("cancel")).catch(() => {});
    }, 2000);
    try {
      if (!handler) throw new Error(`No handler for job type "${job.type}"`);
      const result = await handler({ db, job, emit, signal: jobAbort.signal });
      await completeJob(db, job.id, result);
      console.log(`[worker] ${job.type} ${job.id} done in ${Date.now() - started}ms`);
    } catch (error) {
      if (jobAbort.signal.aborted && !shutdown.signal.aborted) {
        await markJobCancelled(db, job.id);
        await emit("cancelled", {});
        console.log(`[worker] ${job.type} ${job.id} cancelled`);
      } else {
        await failJob(db, job, error);
        await emit("error", { message: error instanceof Error ? error.message : String(error) });
        console.error(`[worker] ${job.type} ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts})`, error);
      }
    } finally {
      clearInterval(cancelPoll);
      shutdown.signal.removeEventListener("abort", onShutdown);
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
      // Daily Brain review after 06:00 local; the per-day key makes repeated ticks a no-op.
      const { day, hour } = localDay(new Date(), workspace.timezone);
      if (getSetting("daily_brain_review") === "on" && hour >= 6 && (await getSingleton(db, workspace.id, "company"))) {
        await enqueueJob(db, {
          type: "brain.review",
          workspaceId: workspace.id,
          payload: { workspaceId: workspace.id },
          idempotencyKey: `brain-review:${workspace.id}:${day}`,
          maxAttempts: 1,
        });
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
