import { and, count, eq, inArray, platformQuota, plays, type Db } from "@pluton/db";
import { listManualTasks, repliesNeedingYou } from "./campaigns.ts";
import { budgetStatus } from "./credits.ts";
import { leadCounts } from "./leads.ts";
import { listWorkspaces } from "./workspaces.ts";

/**
 * Every workspace of the account side by side, for Home's "All workspaces" view: what each spent
 * this budget period, what waits on its owner, and how many Plays search. Hosted, the plan's
 * credits are one pot for all of them (`pot`, the same for every workspace); self-hosted there is
 * no pot, only each workspace's real spend.
 */
export async function accountOverview(db: Db) {
  const list = await listWorkspaces(db);
  const ids = list.map((w) => w.id);
  const activePlays = ids.length
    ? await db
        .select({ workspaceId: plays.workspaceId, n: count() })
        .from(plays)
        .where(and(inArray(plays.workspaceId, ids), eq(plays.status, "active")))
        .groupBy(plays.workspaceId)
    : [];
  const playsBy = new Map(activePlays.map((r) => [r.workspaceId, r.n]));

  const workspaces = await Promise.all(
    list.map(async (ws) => {
      const [budget, leads, replies, tasks] = await Promise.all([
        budgetStatus(db, ws),
        leadCounts(db, { workspaceId: ws.id }),
        repliesNeedingYou(db, ws.id),
        listManualTasks(db, ws.id),
      ]);
      return {
        id: ws.id,
        name: ws.name,
        icon: ws.icon,
        website: ws.website,
        current: ws.current,
        onboarded: ws.onboarded,
        spentMicroUsd: budget.spentMicroUsd,
        unbilledMicroUsd: budget.unbilledMicroUsd,
        limitMicroUsd: budget.limitMicroUsd,
        toReview: leads.counts.to_review,
        replies: replies.length,
        linkedinSteps: tasks.tasks.length + tasks.waiting.length,
        activePlays: playsBy.get(ws.id) ?? 0,
      };
    }),
  );

  // One pot per account: any of its workspaces reads the same shared plan.
  const quota = ids[0] ? platformQuota(ids[0]) : null;
  const pot = quota && {
    periodStart: quota.periodStart,
    periodEnd: quota.periodEnd,
    includedMicroUsd: quota.includedMicroUsd,
    topUpMicroUsd: quota.topUpMicroUsd,
    quotaMicroUsd: quota.quotaMicroUsd,
    spentMicroUsd: quota.spentMicroUsd,
    leftMicroUsd: quota.leftMicroUsd,
  };
  return { pot, workspaces };
}
