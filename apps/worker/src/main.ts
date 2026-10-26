import os from "node:os";
import {
  claimNextJob,
  heartbeatJob,
  completeJob,
  duePlays,
  enqueueJob,
  getSingleton,
  localDay,
  getCurrentWorkspace,
  startRun,
  emitStreamEvent,
  failJob,
  isCancelRequested,
  jobChannel,
  markJobCancelled,
  recoverStaleJobs,
  digestDue,
  settleOrphanHolds,
  watchBudgetThresholds,
  type JobHandler,
  type JobType,
} from "@pluton/core";
import { and, createDb, eq, getSetting, HOSTED, inArray, jobs, leadFindingRuns, lt, prepareDb, settingByWorkspace, watchSettings, withCostScope, workspaces, type CostPurpose, type Workspace } from "@pluton/db";
import { generateWallpaper } from "./handlers/appearance.ts";
import { brainReview } from "./handlers/brain-review.ts";
import { copilotTurn } from "./handlers/copilot.ts";
import { onboardingStage } from "./handlers/onboarding-stage.ts";
import { prepareDrafts, sequenceTick } from "./handlers/campaigns.ts";
import { leadsFindEmails } from "./handlers/leads.ts";
import { sendDigest } from "./handlers/notifications.ts";
import { crmExport, handleSlackAction, slackPostRun } from "./handlers/integrations.ts";
import { runSlackSocket } from "@pluton/providers";
import { withLocale } from "@pluton/i18n/server";
import { leadFindingRun, playsPlan } from "./handlers/plays.ts";
import { systemPing } from "./handlers/system-ping.ts";

const handlers: Record<JobType, JobHandler> = {
  "system.ping": systemPing,
  "appearance.generate_wallpaper": generateWallpaper,
  "onboarding.stage": onboardingStage,
  "brain.review": brainReview,
  "copilot.turn": copilotTurn,
  "plays.plan": playsPlan,
  "lead_finding.run": leadFindingRun,
  "leads.find_emails": leadsFindEmails,
  "campaigns.prepare_drafts": prepareDrafts,
  "campaigns.tick": sequenceTick,
  "notifications.digest": sendDigest,
  "integrations.slack_post": slackPostRun,
  "integrations.crm_export": crmExport,
};

/** What each job's provider and Claude calls are charged to in the ledger. */
const PURPOSE: Record<JobType, CostPurpose> = {
  "system.ping": "other",
  "appearance.generate_wallpaper": "other",
  "onboarding.stage": "onboarding",
  "brain.review": "brain",
  "copilot.turn": "agent",
  "plays.plan": "planning",
  "lead_finding.run": "lead_finding",
  "leads.find_emails": "email_finding",
  "campaigns.prepare_drafts": "outreach",
  "campaigns.tick": "outreach",
  "notifications.digest": "other",
  "integrations.slack_post": "other",
  "integrations.crm_export": "other",
};

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);
const IDLE_POLL_MS = 500;
// Well under the 10 minutes after which a running job without a heartbeat counts as abandoned.
const HEARTBEAT_MS = 60_000;
// No job runs longer (a search's research time is at most an hour): past it the job is asked to
// stop, and failed a minute later if it hasn't, so a hung job can't hold its slot or its Play forever.
const MAX_JOB_MS = 3 * 3600_000;
const STOP_GRACE_MS = 60_000;
const workerId = `${os.hostname()}:${process.pid}`;

const db = createDb();
await prepareDb(db);
await watchSettings(db);
watchBudgetThresholds();

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
    // A database still locked after the busy wait must not take the worker down: try again shortly.
    const job = await claimNextJob(db, `${workerId}#${slot}`).catch((error) => {
      console.error(`[worker] slot ${slot} couldn't take a job, retrying`, error instanceof Error ? error.message : error);
      return undefined;
    });
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
    // Proof of life: without it, a search longer than the stale delay would be queued a second time.
    const heartbeat = setInterval(() => void heartbeatJob(db, job.id, `${workerId}#${slot}`).catch(() => {}), HEARTBEAT_MS);
    let giveUp: NodeJS.Timeout | undefined;
    const overtime = new Promise<never>((_, reject) => {
      giveUp = setTimeout(() => {
        jobAbort.abort("timeout");
        clearInterval(heartbeat);
        giveUp = setTimeout(() => reject(new Error(`Stopped after running for more than ${MAX_JOB_MS / 3600_000} hours.`)), STOP_GRACE_MS);
      }, MAX_JOB_MS);
    });
    try {
      if (!handler) throw new Error(`No handler for job type "${job.type}"`);
      // Hosted, a job without a workspace (the sequence tick) runs in none: it scopes each one itself.
      const workspace = job.workspaceId
        ? await db.query.workspaces.findFirst({ where: eq(workspaces.id, job.workspaceId) })
        : HOSTED
          ? undefined
          : await getCurrentWorkspace(db);
      const workspaceId = job.workspaceId ?? workspace?.id ?? null;
      // A job writes what the founder reads (activity, notifications, the agent's replies) in their language.
      const result = await Promise.race([
        withLocale(workspace?.language ?? "en", () =>
          withCostScope({ db, workspaceId, userId: workspace?.userId ?? null, purpose: PURPOSE[job.type as JobType] ?? "other", jobId: job.id }, () =>
            handler({ db, job, emit, signal: jobAbort.signal }),
          ),
        ),
        overtime,
      ]);
      await completeJob(db, job.id, result);
      console.log(`[worker] ${job.type} ${job.id} done in ${Date.now() - started}ms`);
    } catch (error) {
      // Recording the outcome can itself hit a locked database: the job then stays "running" until
      // the next worker start requeues it, and this slot carries on instead of taking the worker down.
      try {
        if (jobAbort.signal.reason === "cancel" && !shutdown.signal.aborted) {
          await markJobCancelled(db, job.id);
          await emit("cancelled", {});
          console.log(`[worker] ${job.type} ${job.id} cancelled`);
        } else if (jobAbort.signal.reason === "timeout") {
          // Never retried: a hung attempt may still be running in the background.
          await failJob(db, { ...job, attempts: job.maxAttempts }, error);
          await releaseRun(job.id, error);
          await emit("error", { message: error instanceof Error ? error.message : String(error) });
          console.error(`[worker] ${job.type} ${job.id} stopped: over ${MAX_JOB_MS / 60_000} min`);
        } else {
          await failJob(db, job, error);
          await emit("error", { message: error instanceof Error ? error.message : String(error) });
          console.error(`[worker] ${job.type} ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts})`, error);
        }
      } catch (recordError) {
        console.error(`[worker] ${job.type} ${job.id}: couldn't record its outcome`, recordError);
      }
    } finally {
      clearInterval(cancelPoll);
      clearInterval(heartbeat);
      clearTimeout(giveUp);
      shutdown.signal.removeEventListener("abort", onShutdown);
    }
  }
}

/** A search whose job was given up on: its run is closed so the Play can search again, and its hold settles. */
async function releaseRun(jobId: string, error: unknown) {
  await db
    .update(leadFindingRuns)
    .set({ status: "failed", stopReason: "error", error: error instanceof Error ? error.message : String(error), finishedAt: new Date() })
    .where(and(eq(leadFindingRuns.jobId, jobId), inArray(leadFindingRuns.status, ["queued", "running"])));
}

/** Queues scheduled Plays once per local day; startRun ignores a Play that already has a run in flight. */
async function scheduleLoop() {
  while (!shutdown.signal.aborted) {
    try {
      // Each workspace on its own clock and settings; what a scheduled run spends is charged to it.
      for (const workspace of await db.select().from(workspaces)) {
        await withLocale(workspace.language ?? "en", () =>
          withCostScope({ db, workspaceId: workspace.id, purpose: "lead_finding" }, () => scheduleWorkspace(workspace)),
        );
      }
      const settled = await settleOrphanHolds(db);
      if (settled) console.log(`[worker] settled ${settled} orphaned budget hold(s)`);
    } catch (error) {
      console.error("[worker] scheduler error", error);
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

async function scheduleWorkspace(workspace: Workspace) {
  for (const { play } of await duePlays(db, workspace.id, workspace.timezone)) {
    try {
      const run = await startRun(db, play.id, "schedule");
      console.log(`[worker] scheduled run ${run.id} for play "${play.name}"`);
    } catch (error) {
      // Refused for budget (already in Activity and notifications): the other Plays still get their turn.
      console.warn(`[worker] scheduled run for "${play.name}" not started: ${(error as Error).message}`);
    }
  }
  // Daily Brain review after 06:00 local; the per-day key makes repeated ticks a no-op.
  const { day, hour } = localDay(new Date(), workspace.timezone);
  if (getSetting("daily_brain_review", workspace.id) === "on" && hour >= 6 && (await getSingleton(db, workspace.id, "company"))) {
    await enqueueJob(db, {
      type: "brain.review",
      workspaceId: workspace.id,
      payload: { workspaceId: workspace.id },
      idempotencyKey: `brain-review:${workspace.id}:${day}`,
      maxAttempts: 1,
    });
  }
  // Morning digest at its local time; the per-day key sends it once.
  const digestDay = digestDue(workspace);
  if (digestDay) {
    await enqueueJob(db, {
      type: "notifications.digest",
      workspaceId: workspace.id,
      payload: { workspaceId: workspace.id, manual: false },
      idempotencyKey: `digest:${workspace.id}:${digestDay}`,
      maxAttempts: 1,
    });
  }
}

/**
 * LinkedIn sequences: a `campaigns.tick` job every 30 s. The slot key makes it one pass per slot
 * however many workers run; a worker restarted mid-job gets its jobs requeued here too.
 */
async function sequenceLoop() {
  while (!shutdown.signal.aborted) {
    try {
      const slot = Math.floor(Date.now() / 30_000);
      await enqueueJob(db, { type: "campaigns.tick", payload: {}, idempotencyKey: `campaigns-tick:${slot}`, maxAttempts: 1 });
      const recovered = await recoverStaleJobs(db);
      if (recovered) console.log(`[worker] requeued ${recovered} orphaned job(s)`);
      // Ticks are bookkeeping: keep an hour of them.
      await db.delete(jobs).where(and(eq(jobs.type, "campaigns.tick"), inArray(jobs.status, ["completed", "failed"]), lt(jobs.createdAt, new Date(Date.now() - 3_600_000))));
    } catch (error) {
      console.error("[worker] sequence scheduling error", error);
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

console.log(`[worker] ${workerId} running ${CONCURRENCY} slot(s)`);
/**
 * Slack buttons arrive over Socket Mode: one connection per Slack app, opened with the settings of
 * the first workspace using it (workspaces copied from another share its app). Idle until a
 * workspace has both Slack tokens; a connection closes when no workspace uses its app any more.
 */
async function slackLoop() {
  const sockets = new Map<string, AbortController>();
  const running: Promise<void>[] = [];
  while (!shutdown.signal.aborted) {
    const apps = new Map<string, string>();
    for (const { workspaceId, value } of settingByWorkspace("slack_app_token")) if (!apps.has(value)) apps.set(value, workspaceId);
    const wanted = new Map([...apps].map(([token, workspaceId]) => [`${workspaceId}:${token}`, workspaceId]));
    for (const [key, stop] of sockets) {
      if (!wanted.has(key)) {
        stop.abort();
        sockets.delete(key);
      }
    }
    for (const [key, workspaceId] of wanted) {
      if (sockets.has(key)) continue;
      const stop = new AbortController();
      shutdown.signal.addEventListener("abort", () => stop.abort(), { once: true });
      sockets.set(key, stop);
      running.push(
        withCostScope({ db, workspaceId, purpose: "other" }, () =>
          runSlackSocket((action) => handleSlackAction(db, action), stop.signal, (msg) => console.log(`[worker] slack: ${msg}`)),
        ),
      );
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  await Promise.all(running);
}

await Promise.all([...Array.from({ length: CONCURRENCY }, (_, i) => runLoop(i)), scheduleLoop(), sequenceLoop(), slackLoop()]);
console.log("[worker] stopped");
