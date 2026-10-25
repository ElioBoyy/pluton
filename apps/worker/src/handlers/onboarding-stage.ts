import Anthropic from "@anthropic-ai/sdk";
import { runOnboardingStage, runSimulatedOnboardingStage } from "@pluton/agent";
import {
  RESEARCH_STEPS,
  getSession,
  jobPayloads,
  markStage,
  raiseStageCards,
  say,
  setStep,
  type JobHandler,
} from "@pluton/core";
import { localized } from "@pluton/i18n/server";
import messages from "../messages/onboarding.ts";

const t = localized(messages);

/** Runs one research stage of an onboarding session, then raises the cards the user must confirm. */
export const onboardingStage: JobHandler = async ({ db, job, signal }) => {
  const { sessionId, stage } = jobPayloads["onboarding.stage"].parse(job.payload);
  const session = await getSession(db, sessionId);
  if (!session) throw new Error(`Onboarding session ${sessionId} not found`);

  const steps = RESEARCH_STEPS.filter((s) => s.stage === stage);
  await markStage(db, sessionId, stage, "running");
  await Promise.all(steps.map((s) => setStep(db, sessionId, s.key, "running")));

  try {
    const run = process.env.PLUTON_SIMULATE_AGENT === "1" ? runSimulatedOnboardingStage : runOnboardingStage;
    const result = await run({ db, sessionId, workspaceId: session.workspaceId, stage, signal });
    if (result.missing.length) throw new Error(`Research ended without ${result.missing.join(", ")}`);
    await raiseStageCards(db, sessionId, stage);
    await markStage(db, sessionId, stage, "done");
    return { turns: result.turns };
  } catch (error) {
    await Promise.all(steps.map((s) => setStep(db, sessionId, s.key, "skipped")));
    await say(db, sessionId, describeFailure(error));
    await markStage(db, sessionId, stage, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
};

function describeFailure(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) {
    return t("invalidKey");
  }
  if (error instanceof Anthropic.RateLimitError) return t("rateLimited");
  if (error instanceof Anthropic.APIError) return t("apiError", { status: String(error.status) });
  // Raised by the SDK before any request, e.g. when no credentials are configured.
  if (error instanceof Anthropic.AnthropicError) {
    return t("noKey");
  }
  return t("failed", { error: error instanceof Error ? error.message : String(error) });
}
