import { z } from "zod";
import {
  campaignsText,
  draftChannels,
  getCampaign,
  getLeadWithPerson,
  getSingleton,
  listBrain,
  renderTemplate,
  sellsServices,
  stepLabel,
  templateVars,
  upsertDraft,
  type BrainItemView,
} from "@pluton/core";
import { OUTREACH_CHANNELS, and, eq, getSetting, inArray, messageDrafts, senders, type Campaign, type CampaignStep, type Db, type Lead, type OutreachChannel, type Person } from "@pluton/db";
import { APIFY_KEY, profilePosts } from "@pluton/providers";
import { languageInstruction, localized } from "@pluton/i18n/server";
import { runAgent } from "./backend.ts";
import { SERVICES_OUTREACH } from "./offer.ts";
import { FAST_MODEL, WRITER_MODEL, localTool } from "./run-agent.ts";
import messages from "./messages/sequence.ts";

const t = localized(messages);

const WRITER_SYSTEM = `You write outreach for a founder, in their voice, one person at a time. Messages go on LinkedIn unless the prompt says a step goes by email.
Rules:
- Write like a peer, not a salesperson.
- A LinkedIn message is a chat message: 2–4 sentences, under 600 characters, no greeting line, no signature.
- An email reads as an email, not a chat message: a greeting with their first name on its own line, then 2–5 short sentences in one or two short paragraphs ending on one clear question, then a short sign-off and the founder's first name on its own line. Under 900 characters. Ignore anything in a step's guidelines that only makes sense on LinkedIn (being connected, the invitation).
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
    text: `Company: ${pick("company", 1)}${sellsServices(items) ? `\n${SERVICES_OUTREACH}` : ""}
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
  if (!campaign) throw new Error(campaignsText("notFound"));
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
    const keep = (slot: Slot) => {
      const d = existing.find((x) => x.leadId === leadId && x.stepId === slot.step.id && x.channel === slot.channel);
      return d && (d.sentAt || (!opts.force && (d.origin === "edited" || d.review === "reviewed")));
    };
    // A LinkedIn version, and an email version when their address is known (see draftChannels).
    const slots: Slot[] = steps.flatMap((step) => draftChannels(row.person, step).map((channel) => ({ step, channel })));
    const vars = templateVars(row.person, sender, campaign.objective.link);
    for (const slot of slots.filter((x) => x.step.mode === "template" && !keep(x))) {
      const { text, skipReason } = renderTemplate(slot.step.template ?? "", vars, slot.step);
      await upsertDraft(db, { ...draftKey(slot), text, origin: "rendered", review: "not_reviewed", skipReason });
    }
    const aiSlots = slots.filter((x) => x.step.mode !== "template" && !keep(x));
    if (aiSlots.length === 0) {
      await opts.onLead?.(leadId, true);
      continue;
    }
    for (const slot of aiSlots) await upsertDraft(db, { ...draftKey(slot), text: "", origin: "generated", review: "being_written" });
    try {
      const { texts, subject } = await writeForLead(db, { campaign, steps, aiSlots, lead: row.lead, person: row.person, brain: brain.text, language, sender: getSetting("smtp_from_name") || sender?.name, signal: opts.signal });
      for (const slot of aiSlots) {
        const text = texts.get(slotKey(slot));
        await upsertDraft(db, {
          ...draftKey(slot),
          text: text ?? "",
          origin: "generated",
          review: text ? "not_reviewed" : "failed",
          error: text ? null : t("draftNotWritten"),
          // One subject for the email thread: whichever email goes out first carries it.
          subject: slot.channel === "email" ? (subject ?? null) : undefined,
        });
      }
      written++;
      await opts.onLead?.(leadId, true);
    } catch (error) {
      for (const slot of aiSlots) await upsertDraft(db, { ...draftKey(slot), text: "", origin: "generated", review: "failed", error: (error as Error).message.slice(0, 300) });
      await opts.onLead?.(leadId, false);
      if (opts.signal?.aborted) break;
    }

    function draftKey(slot: Slot) {
      return { campaignId: campaign!.id, leadId, stepId: slot.step.id, channel: slot.channel, stepRevision: slot.step.revision };
    }
  }
  return { written };
}

type Slot = { step: CampaignStep; channel: OutreachChannel };
const slotKey = (slot: { step: { id: string }; channel: OutreachChannel } | { stepId: string; channel: OutreachChannel }) =>
  `${"step" in slot ? slot.step.id : slot.stepId}:${slot.channel}`;

async function writeForLead(
  db: Db,
  o: { campaign: Campaign; steps: CampaignStep[]; aiSlots: Slot[]; lead: Lead; person: Person; brain: string; language: string; sender?: string; signal?: AbortSignal },
) {
  const activity = await recentActivity(db, o.person);
  const texts = new Map<string, string>();
  let subject: string | undefined;
  const wanted = o.steps.filter((s) => o.aiSlots.some((x) => x.step.id === s.id));
  const versions = (s: CampaignStep) => o.aiSlots.filter((x) => x.step.id === s.id).map((x) => x.channel);
  const anyEmail = o.aiSlots.some((x) => x.channel === "email");
  const anyLinkedin = o.aiSlots.some((x) => x.channel === "linkedin");
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

${byEmail(o.person) ? EMAIL_CHANNEL(o.sender) : anyEmail && anyLinkedin ? BOTH_CHANNELS(o.sender) : anyEmail ? EMAIL_STEPS(o.sender) : ""}
${anyEmail ? "Also give the email thread a subject: 2 to 6 plain words, specific to them, no clickbait, no capitals for effect.\n" : ""}
Write these messages (the sequence sends them in this order, each only if there was no reply), in every version listed:
${wanted.map((s) => `- stepId ${s.id} (${stepLabel(o.steps, s)}, ${s.delayHours} h after the previous step) — versions: ${versions(s).join(", ")}: ${s.guidelines ?? ""}`).join("\n")}`,
    tools: [
      localTool({
        name: "write_messages",
        description: "Save every version of every message, by stepId and channel.",
        schema: z.object({
          messages: z.array(z.object({ stepId: z.string(), channel: z.enum(OUTREACH_CHANNELS), text: z.string().trim().min(1).max(1500) })),
          subject: z.string().trim().min(1).max(120).optional().describe("The email thread's subject, when any email version is asked for."),
        }),
        run: async ({ messages, subject: s }) => {
          if (s) subject = s;
          for (const m of messages) if (o.aiSlots.some((x) => slotKey(x) === slotKey(m))) texts.set(slotKey(m), m.text);
          const missing = o.aiSlots.filter((x) => !texts.has(slotKey(x)));
          return missing.length ? `Missing: ${missing.map((x) => `${x.step.id} (${x.channel})`).join(", ")}` : "saved";
        },
      }),
    ],
  });
  return { texts, subject };
}

/** No LinkedIn profile but an address: the sequence emails them instead (see the sequence engine). */
export const byEmail = (person: Pick<Person, "linkedinUrl" | "email">) => !person.linkedinUrl && Boolean(person.email);

const signAs = (sender?: string) => (sender ? ` Sign emails as ${sender.split(/\s+/)[0]}.` : "");

const BOTH_CHANNELS = (sender?: string) =>
  `Each message has two versions. The LinkedIn version is sent while LinkedIn works for them. The email version goes to their inbox instead when LinkedIn isn't available (the invitation wasn't accepted, the profile can't be reached) or when the step is set to go by email: follow the email rules, make it stand on its own (they may not have read anything on LinkedIn; a few words saying you also tried there are fine), and keep the same substance as the LinkedIn version. Emails 2 and 3 follow earlier emails in one thread.${signAs(sender)}`;

const EMAIL_STEPS = (sender?: string) =>
  `The versions marked "email" go to their inbox as emails (follow the email rules); the others are LinkedIn messages. An email may say in a few words that you also wrote on LinkedIn, but never repeats that message.${signAs(sender)}`;

const EMAIL_CHANNEL = (sender?: string) =>
  `This person has no LinkedIn profile: every message below is an email from the founder's own mailbox, in one thread (follow-ups answer the first). Follow the email rules and never mention LinkedIn or connecting. No links unless a step's guidelines ask for one.${signAs(sender)}`;

/** A subject for a first email whose text came from a template or an older draft. */
export async function writeEmailSubject(opts: { text: string; language: string }) {
  let subject = "";
  await runAgent({
    system: "You write the subject line of a short cold email. 2 to 6 plain words, specific to its content, no clickbait, no capitals for effect, no punctuation at the end.",
    model: FAST_MODEL,
    noWeb: true,
    maxTurns: 2,
    required: ["subject"],
    prompt: `Language: ${opts.language}\n\nThe email:\n${opts.text}`,
    tools: [
      localTool({
        name: "subject",
        description: "The subject line.",
        schema: z.object({ subject: z.string().trim().min(1).max(120) }),
        run: async ({ subject: s }) => {
          subject = s;
          return "saved";
        },
      }),
    ],
  });
  return subject;
}

/** "✦ Sharpen": a tighter version of a step's guidelines, for the founder to confirm or dismiss. */
export async function sharpenGuidelines(db: Db, campaignId: string, stepId: string, guidelines: string) {
  const campaign = await getCampaign(db, campaignId);
  const step = campaign?.steps.find((s) => s.id === stepId);
  if (!campaign || !step) throw new Error(campaignsText("stepNotFound"));
  const brain = await brainContext(db, campaign.workspaceId);
  let suggestion = "";
  await runAgent({
    system: `You improve the guidelines an AI follows to write one LinkedIn outreach message. Keep the founder's intent; make them concrete, checkable and short (a few bullet lines). Include what to avoid. Plain text, no preamble.\n${languageInstruction()}`,
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
    system: `Classify a reply to an outreach message (LinkedIn or email).
- positive: interested, wants to talk, asks for the link or a time.
- not_interested: declines, asks to stop, wrong person with no lead.
- in_your_hands: anything else (a question, a referral, an out-of-office, ambiguity). When unsure, in_your_hands.
The summary is for the founder: ${languageInstruction()}`,
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

/**
 * The single automatic answer to a positive reply. On LinkedIn: thanks and the link. By email it
 * closes like an email: greeting, an answer to what they said, the link with what it's for, a signature.
 */
export async function writeAutoReply(db: Db, opts: { campaign: Campaign; person: Person; reply: string; channel?: "linkedin" | "email"; signAs?: string }) {
  const brain = await brainContext(db, opts.campaign.workspaceId);
  const language = await campaignLanguage(db, opts.campaign);
  let text = "";
  await runAgent({
    system:
      opts.channel === "email"
        ? `${WRITER_SYSTEM}\nYou now answer, by email in the same thread, a positive reply. Write it as an email: a greeting with their first name; one sentence of thanks matching their tone that answers anything concrete they said (a day they suggested, a question); the link on its own line with a few words on what it's for (picking a time that suits them, or trying the product); a short sign-off and the founder's first name${opts.signAs ? ` (${opts.signAs.split(/\s+/)[0]})` : ""}. 3 to 5 sentences. Don't pitch.`
        : `${WRITER_SYSTEM}\nYou now answer a positive reply on LinkedIn. One or two sentences: a warm thanks matching their tone, then the link. Don't pitch.`,
    model: WRITER_MODEL,
    noWeb: true,
    maxTurns: 3,
    required: ["answer"],
    prompt: `${brain.text}\n${objectiveText(opts.campaign)}\nLanguage: ${language}\nTheir name: ${opts.person.name}\nTheir reply: ${opts.reply}\nThe link to include, verbatim: ${opts.campaign.objective.link}`,
    tools: [
      localTool({
        name: "answer",
        description: "The reply to send.",
        schema: z.object({ text: z.string().trim().min(5).max(1200) }),
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
