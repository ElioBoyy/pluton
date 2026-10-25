import { z } from "zod";
import {
  getCampaign,
  getLeadWithPerson,
  getSingleton,
  listBrain,
  renderTemplate,
  stepLabel,
  templateVars,
  upsertDraft,
  type BrainItemView,
} from "@pluton/core";
import { and, eq, getSetting, inArray, messageDrafts, senders, type Campaign, type CampaignStep, type Db, type Lead, type Person } from "@pluton/db";
import { APIFY_KEY, profilePosts } from "@pluton/providers";
import { runAgent } from "./backend.ts";
import { FAST_MODEL, WRITER_MODEL, localTool } from "./run-agent.ts";

const WRITER_SYSTEM = `You write LinkedIn outreach for a founder, in their voice, one person at a time.
Rules:
- Write like a peer, not a salesperson. Short: LinkedIn messages of 2–4 sentences, under 600 characters.
- Every message follows its step's guidelines exactly.
- Ground the opener in something true and specific about THIS person (their post, role change, hiring, project). Never invent facts; if you know little, say less.
- No flattery, no "I hope this finds you well", no buzzwords, no emojis unless the voice asks for them.
- Messages 2 and 3 assume no reply to the previous ones and don't repeat them.
- Write in the requested language. Use the person's first name as given, correctly capitalized.`;

async function brainContext(db: Db, workspaceId: string) {
  const items = await listBrain(db, workspaceId);
  const pick = (section: string, max = 6) =>
    items
      .filter((i) => i.section === section)
      .slice(0, max)
      .map((i: BrainItemView) => JSON.stringify(i.data))
      .join("\n");
  const voice = (await getSingleton(db, workspaceId, "voice"))?.data;
  return {
    voice,
    text: `Company: ${pick("company", 1)}
Voice: ${voice ? JSON.stringify(voice) : "plain, friendly, concise"}
Message pillars:
${pick("message_pillar")}
Objections to anticipate:
${pick("objection")}
Buyer personas:
${pick("persona")}`,
  };
}

export async function campaignLanguage(db: Db, campaign: Campaign) {
  return campaign.language ?? (await getSingleton(db, campaign.workspaceId, "voice"))?.data.language ?? "the language of the company's website";
}

/** Their recent LinkedIn posts (Apify, cached), the best material for a specific opener. */
async function recentActivity(db: Db, person: Person) {
  if (!person.linkedinUrl || !getSetting(APIFY_KEY)?.trim()) return [];
  try {
    const posts = await profilePosts(db, [person.linkedinUrl], { maxPosts: 3 });
    return posts.posts.map((p) => `${p.postedAt ?? ""} ${p.text.slice(0, 500)}`);
  } catch {
    return [];
  }
}

function objectiveText(campaign: Campaign) {
  const o = campaign.objective;
  if (o.kind === "book_meeting") return `Goal: a short call. Calendar link (only use it if a message's guidelines ask for it): ${o.link ?? "none"}`;
  if (o.kind === "share_app") return `Goal: get them to try the product. Link (only if a message's guidelines ask for it): ${o.link ?? "none"}`;
  return "Goal: start a conversation.";
}

/**
 * Writes or renders every message step for these leads. AI steps get one Claude call per lead;
 * template steps are filled in. Edited or reviewed drafts are kept unless `force`.
 */
export async function writeDrafts(
  db: Db,
  opts: { campaignId: string; leadIds: string[]; force?: boolean; signal?: AbortSignal; onLead?: (leadId: string, ok: boolean) => Promise<void> },
) {
  const campaign = await getCampaign(db, opts.campaignId);
  if (!campaign) throw new Error("Sequence not found");
  const steps = campaign.steps.filter((s) => s.kind === "message" && s.enabled);
  const brain = await brainContext(db, campaign.workspaceId);
  const language = await campaignLanguage(db, campaign);
  const existing = await db
    .select()
    .from(messageDrafts)
    .where(and(eq(messageDrafts.campaignId, campaign.id), inArray(messageDrafts.leadId, opts.leadIds)));
  const sender = (await db.select().from(senders).where(eq(senders.workspaceId, campaign.workspaceId)).limit(1))[0];
  let written = 0;

  for (const leadId of opts.leadIds) {
    if (opts.signal?.aborted) break;
    const row = await getLeadWithPerson(db, leadId);
    if (!row) continue;
    const keep = (s: CampaignStep) => {
      const d = existing.find((x) => x.leadId === leadId && x.stepId === s.id);
      return d && (d.sentAt || (!opts.force && (d.origin === "edited" || d.review === "reviewed")));
    };
    const vars = templateVars(row.person, sender, campaign.objective.link);
    for (const s of steps.filter((s) => s.mode === "template" && !keep(s))) {
      const { text, skipReason } = renderTemplate(s.template ?? "", vars, s);
      await upsertDraft(db, { campaignId: campaign.id, leadId, stepId: s.id, text, origin: "rendered", review: "not_reviewed", stepRevision: s.revision, skipReason });
    }
    const aiSteps = steps.filter((s) => s.mode !== "template" && !keep(s));
    if (aiSteps.length === 0) {
      await opts.onLead?.(leadId, true);
      continue;
    }
    for (const s of aiSteps) {
      await upsertDraft(db, { campaignId: campaign.id, leadId, stepId: s.id, text: "", origin: "generated", review: "being_written", stepRevision: s.revision });
    }
    try {
      const texts = await writeForLead(db, { campaign, steps, aiSteps, lead: row.lead, person: row.person, brain: brain.text, language, signal: opts.signal });
      for (const s of aiSteps) {
        await upsertDraft(db, { campaignId: campaign.id, leadId, stepId: s.id, text: texts.get(s.id) ?? "", origin: "generated", review: texts.get(s.id) ? "not_reviewed" : "failed", stepRevision: s.revision, error: texts.get(s.id) ? null : "Not written" });
      }
      written++;
      await opts.onLead?.(leadId, true);
    } catch (error) {
      for (const s of aiSteps) {
        await upsertDraft(db, { campaignId: campaign.id, leadId, stepId: s.id, text: "", origin: "generated", review: "failed", stepRevision: s.revision, error: (error as Error).message.slice(0, 300) });
      }
      await opts.onLead?.(leadId, false);
      if (opts.signal?.aborted) break;
    }
  }
  return { written };
}

async function writeForLead(
  db: Db,
  o: { campaign: Campaign; steps: CampaignStep[]; aiSteps: CampaignStep[]; lead: Lead; person: Person; brain: string; language: string; signal?: AbortSignal },
) {
  const activity = await recentActivity(db, o.person);
  const texts = new Map<string, string>();
  await runAgent({
    system: WRITER_SYSTEM,
    model: WRITER_MODEL,
    noWeb: true,
    maxTurns: 4,
    required: ["write_messages"],
    signal: o.signal,
    prompt: `${o.brain}

${objectiveText(o.campaign)}
Language: ${o.language}

The person:
${JSON.stringify({ name: o.person.name, title: o.person.title, company: o.person.company, location: o.person.location })}
Why they were picked: ${o.lead.reason}
Signal: ${o.lead.signal}
Evidence: ${o.lead.evidence.map((e) => e.label).join(" | ") || "none"}
Their recent LinkedIn posts: ${activity.length ? `\n${activity.join("\n---\n")}` : "unknown"}

Write these messages (the sequence sends them in this order, each only if there was no reply):
${o.aiSteps.map((s) => `- stepId ${s.id} (${stepLabel(o.steps, s)}, ${s.delayHours} h after the previous step): ${s.guidelines ?? ""}`).join("\n")}`,
    tools: [
      localTool({
        name: "write_messages",
        description: "Save one message per step, by stepId.",
        schema: z.object({ messages: z.array(z.object({ stepId: z.string(), text: z.string().trim().min(1).max(1500) })) }),
        run: async ({ messages }) => {
          for (const m of messages) if (o.aiSteps.some((s) => s.id === m.stepId)) texts.set(m.stepId, m.text);
          const missing = o.aiSteps.filter((s) => !texts.has(s.id));
          return missing.length ? `Missing: ${missing.map((s) => s.id).join(", ")}` : "saved";
        },
      }),
    ],
  });
  return texts;
}

/** "✦ Sharpen": a tighter version of a step's guidelines, for the founder to confirm or dismiss. */
export async function sharpenGuidelines(db: Db, campaignId: string, stepId: string, guidelines: string) {
  const campaign = await getCampaign(db, campaignId);
  const step = campaign?.steps.find((s) => s.id === stepId);
  if (!campaign || !step) throw new Error("Step not found");
  const brain = await brainContext(db, campaign.workspaceId);
  let suggestion = "";
  await runAgent({
    system: "You improve the guidelines an AI follows to write one LinkedIn outreach message. Keep the founder's intent; make them concrete, checkable and short (a few bullet lines). Include what to avoid. Plain text, no preamble.",
    model: WRITER_MODEL,
    noWeb: true,
    maxTurns: 3,
    required: ["suggest"],
    prompt: `${brain.text}

${objectiveText(campaign)}
This is ${stepLabel(campaign.steps, step)} of ${campaign.steps.filter((s) => s.kind === "message" && s.enabled).length}, sent ${step.delayHours} h after the previous step.
Current guidelines:
${guidelines || "(empty)"}`,
    tools: [
      localTool({
        name: "suggest",
        description: "The improved guidelines.",
        schema: z.object({ guidelines: z.string().trim().min(10).max(2000) }),
        run: async ({ guidelines: g }) => {
          suggestion = g;
          return "saved";
        },
      }),
    ],
  });
  return suggestion;
}

export type ReplyVerdict = { label: "positive" | "in_your_hands" | "not_interested"; summary: string };

/** positive: interested or open to talk. in_your_hands: a question or anything only you should answer. */
export async function classifyReply(opts: { reply: string; lastMessage?: string }): Promise<ReplyVerdict> {
  let verdict: ReplyVerdict = { label: "in_your_hands", summary: "" };
  await runAgent({
    system: `Classify a reply to a LinkedIn outreach message.
- positive: interested, wants to talk, asks for the link or a time.
- not_interested: declines, asks to stop, wrong person with no lead.
- in_your_hands: anything else (a question, a referral, an out-of-office, ambiguity). When unsure, in_your_hands.`,
    model: FAST_MODEL,
    noWeb: true,
    maxTurns: 2,
    required: ["classify"],
    prompt: `Our last message: ${opts.lastMessage ?? "(unknown)"}\n\nTheir reply: ${opts.reply}`,
    tools: [
      localTool({
        name: "classify",
        description: "Record the label and a one-line summary for the founder.",
        schema: z.object({ label: z.enum(["positive", "in_your_hands", "not_interested"]), summary: z.string().trim().max(200) }),
        run: async (v) => {
          verdict = v;
          return "recorded";
        },
      }),
    ],
  });
  return verdict;
}

/** The single automatic answer to a positive reply: thanks, the link, nothing else. */
export async function writeAutoReply(db: Db, opts: { campaign: Campaign; person: Person; reply: string }) {
  const brain = await brainContext(db, opts.campaign.workspaceId);
  const language = await campaignLanguage(db, opts.campaign);
  let text = "";
  await runAgent({
    system: `${WRITER_SYSTEM}\nYou now answer a positive reply. One or two sentences: a warm thanks matching their tone, then the link. Don't pitch.`,
    model: WRITER_MODEL,
    noWeb: true,
    maxTurns: 3,
    required: ["answer"],
    prompt: `${brain.text}\n${objectiveText(opts.campaign)}\nLanguage: ${language}\nTheir name: ${opts.person.name}\nTheir reply: ${opts.reply}\nThe link to include, verbatim: ${opts.campaign.objective.link}`,
    tools: [
      localTool({
        name: "answer",
        description: "The reply to send.",
        schema: z.object({ text: z.string().trim().min(5).max(600) }),
        run: async ({ text: t }) => {
          text = t;
          return "saved";
        },
      }),
    ],
  });
  if (opts.campaign.objective.link && !text.includes(opts.campaign.objective.link)) text = `${text}\n${opts.campaign.objective.link}`;
  return text;
}
