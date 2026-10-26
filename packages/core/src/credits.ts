import {
  and,
  type BudgetSettings,
  COST_PURPOSES,
  type CostPurpose,
  creditEntries,
  creditHolds,
  dayOf,
  type Db,
  desc,
  eq,
  gte,
  inArray,
  leadFindingRuns,
  leads,
  lt,
  ne,
  onCostRecorded,
  paidByPlatform,
  platformQuota,
  TOP_UP_PACKS,
  topUpPriceCents,
  type Play,
  plays,
  type RunTrigger,
  sql,
  type Workspace,
  workspaces,
} from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import { recordActivity } from "./events.ts";
import messages from "./messages/credits.ts";
import { budgetRefusal, notifyDescribed } from "./notifications.ts";

export { fmtUsd } from "./money.ts";

const t = localized(messages);

/**
 * Local spend tracking. The unit is the dollar itself, in micro-USD integers, and the "billing"
 * page is a monthly budget you set.
 */
export const MICRO = 1_000_000;
const toMicro = (usd: number) => Math.round(usd * MICRO);

export const DEFAULT_BUDGET: BudgetSettings = { monthlyUsd: 0, periodStartDay: 1, dailyUsd: 0, mode: "enforce", runCapUsd: 2 };

/** Shown when an expense of 0 is added (checked by the router's input schema). */
export const amountNotZeroMessage = () => t("amountNotZero");

/** What each cost is for, as Usage names it, in the current language. */
export const purposeLabels = (): Record<CostPurpose, string> =>
  Object.fromEntries(COST_PURPOSES.map((p) => [p, t(`purpose.${p}`)])) as Record<CostPurpose, string>;

export function budgetSettings(ws: Pick<Workspace, "budget">): BudgetSettings {
  return { ...DEFAULT_BUDGET, ...ws.budget };
}

export async function saveBudget(db: Db, workspaceId: string, patch: Partial<BudgetSettings>) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) throw new Error("Workspace not found");
  const next = { ...budgetSettings(ws), ...patch };
  if (next.periodStartDay < 1 || next.periodStartDay > 28) throw new Error(t("periodStartDay"));
  if (next.monthlyUsd < 0 || next.dailyUsd < 0 || next.runCapUsd <= 0) throw new Error(t("amountsPositive"));
  await db.update(workspaces).set({ budget: next }).where(eq(workspaces.id, workspaceId));
  await recordActivity(db, workspaceId, "credits", "budget.updated", { monthlyUsd: next.monthlyUsd, mode: next.mode });
  return next;
}

// ── Periods ──────────────────────────────────────────────────────────────────

function wallClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: n("year"), month: n("month"), day: n("day"), hour: n("hour"), minute: n("minute"), second: n("second") };
}

/** The instant of local midnight on a calendar date in `timeZone`. */
export function zonedMidnight(year: number, month: number, day: number, timeZone: string) {
  let guess = Date.UTC(year, month - 1, day);
  // Two passes settle DST edges: the offset at the guess may differ from the offset at midnight.
  for (let i = 0; i < 2; i++) {
    const w = wallClock(new Date(guess), timeZone);
    const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
    guess += Date.UTC(year, month - 1, day) - asUtc;
  }
  return new Date(guess);
}

/** Budget period containing `now`: from `startDay` of this (or last) month to the same day next month. */
export function budgetPeriod(now: Date, startDay: number, timeZone: string) {
  const w = wallClock(now, timeZone);
  let year = w.year;
  let month = w.month;
  if (w.day < startDay) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  const start = zonedMidnight(year, month, startDay, timeZone);
  const end = month === 12 ? zonedMidnight(year + 1, 1, startDay, timeZone) : zonedMidnight(year, month + 1, startDay, timeZone);
  return { start, end };
}

export function localDayStart(now: Date, timeZone: string) {
  const w = wallClock(now, timeZone);
  return zonedMidnight(w.year, w.month, w.day, timeZone);
}

// ── Balance ──────────────────────────────────────────────────────────────────

async function spentSince(db: Db, workspaceId: string, since: Date, until?: Date) {
  const where = [eq(creditEntries.workspaceId, workspaceId), gte(creditEntries.createdAt, since)];
  if (until) where.push(lt(creditEntries.createdAt, until));
  const [row] = await db
    .select({
      billed: sql<number>`coalesce(sum(case when ${creditEntries.billed} then ${creditEntries.costMicroUsd} else 0 end), 0)`.mapWith(Number),
      unbilled: sql<number>`coalesce(sum(case when ${creditEntries.billed} then 0 else ${creditEntries.costMicroUsd} end), 0)`.mapWith(Number),
    })
    .from(creditEntries)
    .where(and(...where));
  return { billed: Number(row?.billed ?? 0), unbilled: Number(row?.unbilled ?? 0) };
}

/** Billed spend of one run so far. */
export async function runSpend(db: Db, runId: string) {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${creditEntries.costMicroUsd}), 0)`.mapWith(Number) })
    .from(creditEntries)
    .where(and(eq(creditEntries.runId, runId), eq(creditEntries.billed, true)));
  return Number(row?.n ?? 0);
}

/** What open holds still keep aside: reserved minus what their runs already spent (that spend is in the ledger). */
async function heldRemaining(db: Db, workspaceId: string) {
  const holds = await db.select().from(creditHolds).where(and(eq(creditHolds.workspaceId, workspaceId), eq(creditHolds.status, "held")));
  let total = 0;
  for (const h of holds) total += Math.max(h.reservedMicroUsd - (h.runId ? await runSpend(db, h.runId) : 0), 0);
  return { total, count: holds.length };
}

/** The budget page and every run check read this: spent, held, and what is left now. */
export async function budgetStatus(db: Db, ws: Workspace, now = new Date()) {
  const b = budgetSettings(ws);
  const period = budgetPeriod(now, b.periodStartDay, ws.timezone);
  const [spent, today, held] = await Promise.all([
    spentSince(db, ws.id, period.start, period.end),
    spentSince(db, ws.id, localDayStart(now, ws.timezone)),
    heldRemaining(db, ws.id),
  ]);
  const monthLeft = b.monthlyUsd > 0 ? toMicro(b.monthlyUsd) - spent.billed - held.total : null;
  const dayLeft = b.dailyUsd > 0 ? toMicro(b.dailyUsd) - today.billed - held.total : null;
  const lefts = [monthLeft, dayLeft].filter((v): v is number => v !== null);
  return {
    settings: b,
    period,
    limitMicroUsd: b.monthlyUsd > 0 ? toMicro(b.monthlyUsd) : null,
    dailyLimitMicroUsd: b.dailyUsd > 0 ? toMicro(b.dailyUsd) : null,
    spentMicroUsd: spent.billed,
    /** Claude through the subscription, at API prices: shown for information, not charged. */
    unbilledMicroUsd: spent.unbilled,
    spentTodayMicroUsd: today.billed,
    heldMicroUsd: held.total,
    openHolds: held.count,
    /** Null when no limit is set. */
    availableMicroUsd: lefts.length ? Math.max(Math.min(...lefts), 0) : null,
    /** Hosted: what the plan includes this billing period through Pluton's own keys; null without a plan. */
    platform: withPacks(platformQuota(ws.id)),
  };
}

/** The packs of credits on sale, priced in euro cents at the fixed rate. */
const withPacks = <T extends object>(quota: T | null) =>
  quota && { ...quota, packs: TOP_UP_PACKS.map((credits) => ({ credits, priceCents: topUpPriceCents(credits) })) };

export class BudgetError extends Error {}

/** Smallest amount worth starting a run with. */
const MIN_RESERVE = 10_000;

/**
 * How much a new run of this Play may spend. In `enforce` mode it is the Play's cap, trimmed to
 * what is left; nothing left refuses the run. Throws BudgetError (and says so in Activity).
 */
export async function planReservation(db: Db, play: Play, trigger: RunTrigger) {
  const ws = (await db.query.workspaces.findFirst({ where: eq(workspaces.id, play.workspaceId) }))!;
  const status = await budgetStatus(db, ws);
  const cap = toMicro(play.definition.policy?.maxCostUsd ?? status.settings.runCapUsd);
  // Every run needs Claude: through Pluton's key, it is held to what the plan has left, whatever the budget's mode.
  const quota = status.platform && paidByPlatform("claude", ws.id) ? status.platform : null;
  const budgetLeft = status.settings.mode === "enforce" ? status.availableMicroUsd : null;
  const which =
    quota && quota.leftMicroUsd < MIN_RESERVE
      ? "quota"
      : budgetLeft === null || budgetLeft >= MIN_RESERVE
        ? null
        : status.dailyLimitMicroUsd !== null && status.spentTodayMicroUsd + status.heldMicroUsd >= status.dailyLimitMicroUsd
          ? "daily"
          : "monthly";
  if (which) {
    const until = (which === "quota" ? quota!.periodEnd : status.period.end).toISOString();
    await recordActivity(db, play.workspaceId, "credits", "run.refused", { playId: play.id, trigger, which });
    await notifyDescribed(db, play.workspaceId, {
      category: "runs",
      kind: "run.refused",
      tone: "warning",
      link: "/workspace/billing",
      payload: { play: play.name, which, until },
      dedupeKey: `refused:${play.id}:${localDayStart(new Date(), ws.timezone).toISOString()}`,
    });
    throw new BudgetError(budgetRefusal(which, until));
  }
  return Math.min(cap, quota?.leftMicroUsd ?? cap, budgetLeft ?? cap);
}

export async function createHold(db: Db, run: { id: string; workspaceId: string; playId: string }, reservedMicroUsd: number) {
  const [hold] = await db
    .insert(creditHolds)
    .values({ workspaceId: run.workspaceId, runId: run.id, playId: run.playId, reservedMicroUsd })
    .onConflictDoNothing({ target: creditHolds.runId })
    .returning();
  return hold;
}

export async function getRunHold(db: Db, runId: string) {
  return db.query.creditHolds.findFirst({ where: eq(creditHolds.runId, runId) });
}

/** Closes a run's hold with its actual spend; the rest goes back to the budget. */
export async function settleRunHold(db: Db, runId: string) {
  const hold = await getRunHold(db, runId);
  if (!hold || hold.status !== "held") return null;
  const spent = await runSpend(db, runId);
  const [settled] = await db
    .update(creditHolds)
    .set({ status: "settled", spentMicroUsd: spent, settledAt: new Date() })
    .where(and(eq(creditHolds.id, hold.id), eq(creditHolds.status, "held")))
    .returning();
  if (!settled) return null;
  await recordActivity(db, hold.workspaceId, "credits", "run.settled", {
    runId,
    playId: hold.playId,
    reservedMicroUsd: hold.reservedMicroUsd,
    spentMicroUsd: spent,
  });
  await checkBudgetThresholds(db, hold.workspaceId);
  return settled;
}

/** Holds whose run ended without settling (worker restart, deleted run). Run by the scheduler. */
export async function settleOrphanHolds(db: Db) {
  const open = await db
    .select({ hold: creditHolds, runStatus: leadFindingRuns.status })
    .from(creditHolds)
    .leftJoin(leadFindingRuns, eq(leadFindingRuns.id, creditHolds.runId))
    .where(eq(creditHolds.status, "held"));
  let n = 0;
  for (const { hold, runStatus } of open) {
    if (runStatus === "queued" || runStatus === "running") continue;
    if (hold.runId && runStatus) {
      if (await settleRunHold(db, hold.runId)) n++;
    } else {
      await db.update(creditHolds).set({ status: "settled", settledAt: new Date() }).where(eq(creditHolds.id, hold.id));
      n++;
    }
  }
  return n;
}

/**
 * Hosted: says once per billing period when the plan's credits reach 80%, then when they run out,
 * with the way to more, so nobody finds their searches stopped without warning.
 */
async function checkQuotaThresholds(db: Db, workspaceId: string) {
  const quota = platformQuota(workspaceId);
  if (!quota || quota.quotaMicroUsd <= 0) return;
  const share = quota.spentMicroUsd / quota.quotaMicroUsd;
  const key = quota.periodStart.toISOString().slice(0, 10);
  for (const threshold of [1, 0.8]) {
    if (share < threshold) continue;
    await notifyDescribed(db, workspaceId, {
      category: "budget",
      kind: threshold === 1 ? "quota.exhausted" : "quota.warning",
      tone: "warning",
      payload: { until: quota.periodEnd.toISOString() },
      link: "/workspace/billing",
      dedupeKey: `quota${threshold * 100}:${workspaceId}:${key}`,
    });
    break;
  }
}

/** Alerts once per period at 80% and 100% of the monthly budget. */
export async function checkBudgetThresholds(db: Db, workspaceId: string) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) return;
  await checkQuotaThresholds(db, workspaceId);
  const status = await budgetStatus(db, ws);
  if (!status.limitMicroUsd) return;
  const share = status.spentMicroUsd / status.limitMicroUsd;
  const key = status.period.start.toISOString().slice(0, 10);
  for (const threshold of [1, 0.8]) {
    if (share < threshold) continue;
    const full = threshold === 1;
    const sent = await notifyDescribed(db, workspaceId, {
      category: "budget",
      kind: full ? "budget.exhausted" : "budget.warning",
      tone: "warning",
      payload: { mode: status.settings.mode, spentMicroUsd: status.spentMicroUsd, limitMicroUsd: status.limitMicroUsd },
      link: "/workspace/billing",
      dedupeKey: `budget${threshold * 100}:${workspaceId}:${key}`,
    });
    if (sent) await recordActivity(db, workspaceId, "credits", full ? "budget.exhausted" : "budget.warning", { spentMicroUsd: status.spentMicroUsd, limitMicroUsd: status.limitMicroUsd });
    break;
  }
}

/**
 * Stops a run when its billed spend reaches the hold. Returns an unsubscribe function.
 * Cost entries are written in the process making the calls, which is the run's own worker.
 */
export function watchRunSpend(runId: string, reservedMicroUsd: number, onExceeded: () => void) {
  let fired = false;
  return onCostRecorded(async (entry, db) => {
    if (fired || entry.runId !== runId || !entry.billed) return;
    if ((await runSpend(db, runId)) >= reservedMicroUsd) {
      fired = true;
      onExceeded();
    }
  });
}

let watchingThresholds = false;
/** Budget alerts as soon as a billed cost lands, not only when a run settles. Once per process. */
export function watchBudgetThresholds() {
  if (watchingThresholds) return;
  watchingThresholds = true;
  onCostRecorded(async (entry, db) => {
    if (entry.billed && entry.workspaceId) await checkBudgetThresholds(db, entry.workspaceId);
  });
}

// ── Estimates and reports ────────────────────────────────────────────────────

/** Expected cost of the next run: billed spend per lead from past runs (this Play first, else the workspace). */
export async function estimateRun(db: Db, playId: string) {
  const play = await db.query.plays.findFirst({ where: eq(plays.id, playId) });
  if (!play) throw new Error("Play not found");
  const perLead = async (where: ReturnType<typeof eq>) => {
    const [cost] = await db
      .select({ n: sql<number>`coalesce(sum(${creditEntries.costMicroUsd}), 0)`.mapWith(Number) })
      .from(creditEntries)
      .innerJoin(leadFindingRuns, eq(leadFindingRuns.id, creditEntries.runId))
      .where(and(where, eq(creditEntries.billed, true)));
    const [found] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(leads)
      .innerJoin(leadFindingRuns, eq(leadFindingRuns.id, leads.runId))
      .where(and(where, ne(leads.stage, "disqualified")));
    return Number(found?.n ?? 0) > 0 ? { micro: Number(cost?.n ?? 0) / Number(found!.n), leads: Number(found!.n) } : null;
  };
  const own = await perLead(eq(leadFindingRuns.playId, playId));
  const fleet = own ?? (await perLead(eq(leadFindingRuns.workspaceId, play.workspaceId)));
  const ws = (await db.query.workspaces.findFirst({ where: eq(workspaces.id, play.workspaceId) }))!;
  const status = await budgetStatus(db, ws);
  return {
    basis: own ? ("play" as const) : fleet ? ("workspace" as const) : ("none" as const),
    perLeadMicroUsd: fleet ? Math.round(fleet.micro) : null,
    estimateMicroUsd: fleet ? Math.round(fleet.micro * play.definition.target) : null,
    capMicroUsd: toMicro(play.definition.policy?.maxCostUsd ?? status.settings.runCapUsd),
    availableMicroUsd: status.availableMicroUsd,
    mode: status.settings.mode,
  };
}

export type UsageRange = { from: Date; to: Date };

export async function usageReport(db: Db, workspaceId: string, range: UsageRange) {
  const inRange = and(eq(creditEntries.workspaceId, workspaceId), gte(creditEntries.createdAt, range.from), lt(creditEntries.createdAt, range.to));
  const billed = sql<number>`coalesce(sum(case when ${creditEntries.billed} then ${creditEntries.costMicroUsd} else 0 end), 0)`.mapWith(Number);
  const unbilled = sql<number>`coalesce(sum(case when ${creditEntries.billed} then 0 else ${creditEntries.costMicroUsd} end), 0)`.mapWith(Number);
  const calls = sql<number>`count(*)`.mapWith(Number);
  const num = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((r) => ({ ...r, billed: Number(r.billed), unbilled: Number(r.unbilled), calls: Number(r.calls) }));

  const [totals] = num(await db.select({ billed, unbilled, calls }).from(creditEntries).where(inRange));
  const byDay = num(
    await db
      .select({ day: dayOf(creditEntries.createdAt), billed, unbilled, calls })
      .from(creditEntries)
      .where(inRange)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  );
  const byPurpose = num(await db.select({ purpose: creditEntries.purpose, billed, unbilled, calls }).from(creditEntries).where(inRange).groupBy(creditEntries.purpose));
  const bySource = num(await db.select({ source: creditEntries.source, billed, unbilled, calls }).from(creditEntries).where(inRange).groupBy(creditEntries.source));
  const playCosts = num(
    await db
      .select({ playId: creditEntries.playId, billed, unbilled, calls, runs: sql<number>`count(distinct ${creditEntries.runId})`.mapWith(Number) })
      .from(creditEntries)
      .where(and(inRange, sql`${creditEntries.playId} is not null`))
      .groupBy(creditEntries.playId),
  );
  const playLeads = await db
    .select({ playId: leads.playId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(leads)
    .where(and(eq(leads.workspaceId, workspaceId), ne(leads.stage, "disqualified"), gte(leads.createdAt, range.from), lt(leads.createdAt, range.to)))
    .groupBy(leads.playId);
  const playRows = await db.select({ id: plays.id, name: plays.name, status: plays.status }).from(plays).where(eq(plays.workspaceId, workspaceId));
  const byPlay = playRows
    .map((p) => {
      const c = playCosts.find((r) => r.playId === p.id);
      const found = Number(playLeads.find((r) => r.playId === p.id)?.n ?? 0);
      return {
        playId: p.id,
        name: p.name,
        status: p.status,
        billed: c?.billed ?? 0,
        unbilled: c?.unbilled ?? 0,
        runs: Number(c?.runs ?? 0),
        leads: found,
        perLead: found > 0 && c ? Math.round(c.billed / found) : null,
      };
    })
    .filter((p) => p.billed + p.unbilled > 0 || p.leads > 0)
    .sort((a, b) => b.billed - a.billed || b.unbilled - a.unbilled);
  return { range, totals: totals ?? { billed: 0, unbilled: 0, calls: 0 }, byDay, byPurpose, bySource, byPlay };
}

export async function listCreditEntries(
  db: Db,
  workspaceId: string,
  opts: { beforeId?: number; limit?: number; playId?: string; purpose?: CostPurpose; source?: string } = {},
) {
  const where = [eq(creditEntries.workspaceId, workspaceId)];
  if (opts.beforeId) where.push(lt(creditEntries.id, opts.beforeId));
  if (opts.playId) where.push(eq(creditEntries.playId, opts.playId));
  if (opts.purpose) where.push(eq(creditEntries.purpose, opts.purpose));
  if (opts.source) where.push(eq(creditEntries.source, opts.source));
  const limit = opts.limit ?? 50;
  const rows = await db
    .select({ entry: creditEntries, playName: plays.name })
    .from(creditEntries)
    .leftJoin(plays, eq(plays.id, creditEntries.playId))
    .where(and(...where))
    .orderBy(desc(creditEntries.id))
    .limit(limit + 1);
  return { entries: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]!.entry.id : null };
}

/** A cost Pluton can't see (a provider's monthly plan, a refund): positive adds spend, negative returns it. */
export async function addAdjustment(db: Db, workspaceId: string, input: { amountUsd: number; note: string; source?: string }) {
  const [entry] = await db
    .insert(creditEntries)
    .values({
      workspaceId,
      kind: "adjustment",
      purpose: "other",
      source: input.source?.trim() || "manual",
      operation: "adjustment",
      costMicroUsd: toMicro(input.amountUsd),
      billed: true,
      note: input.note,
    })
    .returning();
  await recordActivity(db, workspaceId, "credits", "adjustment.added", { amountMicroUsd: entry!.costMicroUsd, note: input.note });
  await checkBudgetThresholds(db, workspaceId);
  return entry!;
}

export async function deleteAdjustment(db: Db, workspaceId: string, id: number) {
  await db.delete(creditEntries).where(and(eq(creditEntries.id, id), eq(creditEntries.workspaceId, workspaceId), eq(creditEntries.kind, "adjustment")));
}

/** Spend of one Play: this period and all time, with cost per lead. */
export async function playConsumption(db: Db, playId: string) {
  const play = await db.query.plays.findFirst({ where: eq(plays.id, playId) });
  if (!play) throw new Error("Play not found");
  const ws = (await db.query.workspaces.findFirst({ where: eq(workspaces.id, play.workspaceId) }))!;
  const period = budgetPeriod(new Date(), budgetSettings(ws).periodStartDay, ws.timezone);
  const sum = async (since?: Date) => {
    const where = [eq(creditEntries.playId, playId)];
    if (since) where.push(gte(creditEntries.createdAt, since));
    const [row] = await db
      .select({
        billed: sql<number>`coalesce(sum(case when ${creditEntries.billed} then ${creditEntries.costMicroUsd} else 0 end), 0)`.mapWith(Number),
        unbilled: sql<number>`coalesce(sum(case when ${creditEntries.billed} then 0 else ${creditEntries.costMicroUsd} end), 0)`.mapWith(Number),
      })
      .from(creditEntries)
      .where(and(...where));
    return { billed: Number(row?.billed ?? 0), unbilled: Number(row?.unbilled ?? 0) };
  };
  const [periodSpend, allTime, found] = await Promise.all([
    sum(period.start),
    sum(),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(leads)
      .where(and(eq(leads.playId, playId), ne(leads.stage, "disqualified"), inArray(leads.stage, ["qualified", "needs_review"]))),
  ]);
  const n = Number(found[0]?.n ?? 0);
  return { period, periodSpend, allTime, leads: n, perLeadMicroUsd: n > 0 ? Math.round(allTime.billed / n) : null };
}
