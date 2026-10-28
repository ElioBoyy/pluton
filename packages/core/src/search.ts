import { createHash } from "node:crypto";
import path from "node:path";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import {
  and,
  asc,
  brainItems,
  type BrainSection,
  campaigns,
  copilotConversations,
  copilotMessages,
  type Db,
  enrollments,
  eq,
  HOSTED,
  inArray,
  isNotNull,
  isNull,
  leadEvents,
  leadFeedback,
  leads,
  messageDrafts,
  or,
  outreachActions,
  people,
  plays,
  replies,
  repoRoot,
  searchDocuments,
  type SearchKind,
  sql,
  workspaces,
} from "@pluton/db";
import { format, LOCALES, type Locale } from "@pluton/i18n";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/search.ts";

// ── Model ────────────────────────────────────────────────────────────────────

/**
 * Runs on this machine (ONNX, ~120 MB downloaded once into data/models), so nothing leaves it.
 * Multilingual: a French query finds an English lead and the other way round. It reads the first
 * 128 tokens of a document, which is why documents start with what identifies them.
 */
export const SEARCH_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

let model: Promise<FeatureExtractionPipeline> | undefined;
let modelReady = false;

function loadModel() {
  model ??= import("@huggingface/transformers").then(async ({ env, pipeline }) => {
    env.cacheDir = path.resolve(repoRoot, "data/models");
    // The generic overloads of pipeline() are too deep for the type checker; the task fixes the type.
    const extractor = (await (pipeline as (...args: unknown[]) => Promise<unknown>)("feature-extraction", SEARCH_MODEL, {
      dtype: "q8",
    })) as FeatureExtractionPipeline;
    modelReady = true;
    return extractor;
  });
  // Offline on first start: forget the failure so the next sync tries the download again.
  model.catch(() => (model = undefined));
  return model;
}

async function embed(texts: string[]): Promise<number[][]> {
  const extractor = await loadModel();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
}

// ── Documents ────────────────────────────────────────────────────────────────

type Doc = { kind: SearchKind; refId: string; title: string; subtitle: string | null; href: string; text: string };

/** Beyond this a document is cut (a very long conversation): the index stays small. */
const MAX_TEXT = 40_000;

/**
 * `about` holds the words people type for a page, in English and French. Its title, in every
 * language, goes into the index too (a query in any of them finds it) and is shown in the founder's.
 */
const PAGES = [
  { ref: "home", href: "/home", about: "Overview, what needs you today, getting started checklist. Accueil" },
  { ref: "brain", href: "/brain", about: "Company, ideal customers, personas, competitors, market and voice. Entreprise, clients idéaux, concurrents, marché" },
  { ref: "agent", href: "/agent", about: "Talk to Pluton, ask questions, conversations. Agent, discuter, poser une question" },
  { ref: "plays", href: "/plays", about: "Lead-finding campaigns run on a schedule. Campagnes de prospection" },
  { ref: "new-play", href: "/plays/new", about: "Describe who you want to reach and create a Play. Nouvelle campagne, créer" },
  { ref: "leads", href: "/leads", about: "People found by your Plays, to review, approve or reject. Prospects, contacts à valider" },
  { ref: "messages", href: "/messages", about: "Replies to answer, LinkedIn steps to do by hand, invitations to confirm. Messages, réponses, boîte de réception, à faire" },
  { ref: "onboarding", href: "/onboarding", about: "Research your website and build the Brain again. Recommencer, analyser mon site" },
  { ref: "profile", href: "/workspace/profile", about: "Your name, email signature, language, sign-in methods, sign out. Profil, mon compte, se déconnecter, mot de passe, langue" },
  { ref: "settings", href: "/workspace/settings", about: "Workspace name, website, icon, timezone. Paramètres, réglages, fuseau horaire" },
  { ref: "appearance", href: "/workspace/appearance", about: "Light and dark mode, wallpaper, theme. Apparence, mode sombre, fond d'écran" },
  { ref: "notifications", href: "/workspace/notifications", about: "Notification bell, morning digest, email. Résumé du matin" },
  { ref: "linkedin", href: "/workspace/linkedin", about: "Connect LinkedIn senders, Chrome extension, daily limits. Comptes LinkedIn, extension Chrome, connecter" },
  { ref: "mcp", href: "/workspace/mcp", about: "MCP server for Claude Code, Claude Desktop and Codex. Connecter mon IA" },
  { ref: "api-keys", href: "/workspace/api-keys", about: "Anthropic, TheirStack, Apify, Hunter, SMTP keys. Clés API, token" },
  { ref: "data-sources", href: "/workspace/data-sources", about: "Where leads come from: registries, careers pages, providers. Sources de données" },
  { ref: "integrations", href: "/workspace/integrations", about: "Slack, HubSpot, Attio, Pipedrive CRM export. Intégrations, exporter vers le CRM" },
  { ref: "usage", href: "/workspace/usage", about: "Spend per Play and per lead, provider calls, costs. Consommation, coûts, dépenses" },
  { ref: "billing", href: "/workspace/billing", about: "Monthly budget, daily cap, spend limit per run. Budget mensuel, plafond, facturation" },
  { ref: "activity", href: "/workspace/activity", about: "Everything that happened: runs, leads, replies, history. Activité, historique, réponses" },
  { ref: "whats-new", href: "/workspace/whats-new", about: "Release notes, changelog. Nouveautés" },
] as const satisfies ReadonlyArray<{ ref: string; href: string; about: string }>;

const t = localized(messages);
const inEnglish = (key: Parameters<typeof t>[0]) => format(messages, "en", key);
/** A label in every language, for the indexed text. */
const inEveryLanguage = (key: Parameters<typeof t>[0]) => [...new Set(LOCALES.map((l: Locale) => format(messages, l, key)))].join(" · ");

/** The field that names an item in lists; sections without one go by their label. */
const BRAIN_TITLE_KEY: Partial<Record<BrainSection, string>> = {
  company: "name",
  persona: "title",
  competitor: "name",
  influencer: "name",
  message_pillar: "title",
  keyword: "phrase",
  tracked_profile: "name",
};

/** Brain tab each section lives on (the `tab` search param of /brain). */
export const BRAIN_TAB: Record<BrainSection, string> = {
  company: "company",
  icp: "icps",
  persona: "icps",
  competitor: "competitors",
  influencer: "influencers",
  voice: "outreach",
  message_pillar: "outreach",
  tracked_profile: "market",
  keyword: "market",
  hiring_signal: "market",
  stack_signal: "market",
};

/** Every string inside a Brain item's data, in field order. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** Lowercase without accents: "Marié" and "marie" match. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const join = (...parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(" · ");

/** Groups rows by a key, keeping their order. */
function groupBy<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  return (k: string) => groups.get(k) ?? [];
}

/** A labelled block of a document, left out when empty. */
const section = (label: string, lines: Array<string | null | undefined | false>) => {
  const kept = lines.filter((l): l is string => Boolean(l && l.trim()));
  return kept.length ? `${label}:\n${kept.join("\n")}` : null;
};

const STAGE_LABELS: Record<string, string> = { qualified: "Strong match", needs_review: "Worth a look", disqualified: "Set aside" };

async function collectDocuments(db: Db, workspaceId: string): Promise<Doc[]> {
  const inWorkspace = eq(leads.workspaceId, workspaceId);
  const [leadRows, feedbackRows, noteRows, replyRows, draftRows, actionRows, playRows, campaignRows, brainRows, conversationRows, messageRows] =
    await Promise.all([
      db
        .select({ lead: leads, person: people, play: plays.name })
        .from(leads)
        .innerJoin(people, eq(people.id, leads.personId))
        .innerJoin(plays, eq(plays.id, leads.playId))
        .where(inWorkspace),
      db
        .select()
        .from(leadFeedback)
        .where(and(eq(leadFeedback.workspaceId, workspaceId), isNull(leadFeedback.withdrawnAt)))
        .orderBy(asc(leadFeedback.createdAt)),
      db
        .select({ leadId: leadEvents.leadId, payload: leadEvents.payload })
        .from(leadEvents)
        .innerJoin(leads, eq(leads.id, leadEvents.leadId))
        .where(and(inWorkspace, eq(leadEvents.kind, "note")))
        .orderBy(asc(leadEvents.id)),
      db
        .select({ leadId: enrollments.leadId, text: replies.text, summary: replies.summary, label: replies.label })
        .from(replies)
        .innerJoin(enrollments, eq(enrollments.id, replies.enrollmentId))
        .where(eq(enrollments.workspaceId, workspaceId))
        .orderBy(asc(replies.receivedAt)),
      db
        .select({ leadId: messageDrafts.leadId, text: messageDrafts.text, sentAt: messageDrafts.sentAt })
        .from(messageDrafts)
        .innerJoin(leads, eq(leads.id, messageDrafts.leadId))
        .where(inWorkspace)
        .orderBy(asc(messageDrafts.createdAt)),
      db
        .select({ leadId: enrollments.leadId, kind: outreachActions.kind, text: outreachActions.text, status: outreachActions.status })
        .from(outreachActions)
        .innerJoin(enrollments, eq(enrollments.id, outreachActions.enrollmentId))
        .where(eq(outreachActions.workspaceId, workspaceId))
        .orderBy(asc(outreachActions.createdAt)),
      db.select().from(plays).where(eq(plays.workspaceId, workspaceId)),
      db.select().from(campaigns).where(eq(campaigns.workspaceId, workspaceId)),
      db
        .select()
        .from(brainItems)
        .where(and(eq(brainItems.workspaceId, workspaceId), eq(brainItems.status, "active"))),
      db.select().from(copilotConversations).where(eq(copilotConversations.workspaceId, workspaceId)),
      db
        .select({ conversationId: copilotMessages.conversationId, role: copilotMessages.role, text: copilotMessages.text })
        .from(copilotMessages)
        .innerJoin(copilotConversations, eq(copilotConversations.id, copilotMessages.conversationId))
        .where(and(eq(copilotConversations.workspaceId, workspaceId), inArray(copilotMessages.role, ["user", "assistant"])))
        .orderBy(asc(copilotMessages.createdAt)),
    ]);

  const feedbackOf = groupBy(feedbackRows, (r) => r.leadId);
  const notesOf = groupBy(noteRows, (r) => r.leadId);
  const repliesOf = groupBy(replyRows, (r) => r.leadId);
  const draftsOf = groupBy(draftRows, (r) => r.leadId);
  const actionsOf = groupBy(actionRows, (r) => r.leadId);
  const campaignOf = new Map(campaignRows.map((c) => [c.playId, c]));
  const messagesOf = groupBy(messageRows, (r) => r.conversationId);

  // Stored in English; searchWorkspace shows them in the founder's language.
  const docs: Doc[] = PAGES.map((p) => ({
    kind: "page",
    refId: p.ref,
    title: inEnglish(`page.${p.ref}`),
    subtitle: null,
    href: p.href,
    text: `${inEveryLanguage(`page.${p.ref}`)}: ${p.about}`,
  }));

  for (const { lead: l, person: p, play } of leadRows) {
    const role = [p.title, p.company].filter(Boolean).join(" at ");
    docs.push({
      kind: "lead",
      refId: l.id,
      title: p.name,
      subtitle: join(p.title, p.company) || null,
      href: `/leads?tab=all&lead=${l.id}`,
      // Who they are and why they were found first (all the model reads), then everything else.
      text: [
        join(p.name, role, p.location),
        section("Signal", [l.signal]),
        section("Why they fit", [l.reason]),
        section("Evidence", l.evidence.map((e) => e.label)),
        section(
          "Founder's verdict",
          feedbackOf(l.id).map((f) => join(f.verdict === "up" ? "Good lead" : "Not a fit", f.reasons.join(", ").replaceAll("_", " "), f.comment)),
        ),
        section("Notes", notesOf(l.id).map((n) => String(n.payload.text ?? ""))),
        `Play: ${play}. Status: ${l.status.replace("_", " ")}. ${STAGE_LABELS[l.stage] ?? l.stage}, fit ${l.fit}/100, warmness ${l.warmness}/100.`,
        join(p.companyWebsite, p.linkedinUrl, p.email),
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  }

  // The conversation with each lead, its own document: a lead's would only reach it past the 128
  // tokens the model reads. Their replies lead (what is searched for most), then what was sent.
  for (const { lead: l, person: p, play } of leadRows) {
    const theirs = repliesOf(l.id);
    const ours = [
      ...draftsOf(l.id).map((d) => d.text && `${d.sentAt ? "Sent" : "Draft"}: ${d.text}`),
      ...actionsOf(l.id).map((a) => a.text && a.status === "done" && `Sent (${a.kind.replace("_", " ")}): ${a.text}`),
    ].filter((m): m is string => Boolean(m));
    if (!theirs.length && !ours.length) continue;
    const last = theirs.at(-1);
    docs.push({
      kind: "message",
      refId: l.id,
      title: p.name,
      subtitle: last ? (last.summary ?? last.text).slice(0, 140) : join(p.company, play) || null,
      href: `/leads?tab=all&lead=${l.id}`,
      text: [
        section("Replies", [...theirs].reverse().map((r) => join(r.label?.replaceAll("_", " "), r.summary, r.text))),
        section("Messages", ours),
        join(p.name, [p.title, p.company].filter(Boolean).join(" at "), `Play: ${play}`),
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  }

  for (const p of playRows) {
    const a = p.definition.audience;
    const campaign = campaignOf.get(p.id);
    docs.push({
      kind: "play",
      refId: p.id,
      title: p.name,
      subtitle: p.status === "active" ? p.summary.who : join(p.status, p.summary.who),
      href: `/plays/${p.id}`,
      text: [
        p.name,
        p.ask,
        section("Who", [p.summary.who]),
        section("How", [p.summary.how, p.summary.howMany]),
        section("Audience", [
          a.personas.length > 0 && `Personas: ${a.personas.join(", ")}`,
          a.industries.length > 0 && `Industries: ${a.industries.join(", ")}`,
          a.geographies.length > 0 && `Geographies: ${a.geographies.join(", ")}`,
          a.companySizes.length > 0 && `Company sizes: ${a.companySizes.join(", ")}`,
          a.keywords.length > 0 && `Keywords: ${a.keywords.join(", ")}`,
          a.hiringRoles.length > 0 && `Hiring: ${a.hiringRoles.join(", ")}`,
          a.technologies.length > 0 && `Technologies: ${a.technologies.join(", ")}`,
          a.exclusions.length > 0 && `Excluded: ${a.exclusions.join(", ")}`,
          p.definition.criteria,
          !!p.definition.referenceCompanies?.length && `Like: ${p.definition.referenceCompanies.join(", ")}`,
        ]),
        campaign && section("LinkedIn sequence", [campaign.inviteNote, ...strings(campaign.steps)]),
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  }

  for (const b of brainRows) {
    const label = inEnglish(`brain.${b.section}`);
    const key = BRAIN_TITLE_KEY[b.section];
    const title = (key && typeof b.data[key] === "string" && (b.data[key] as string)) || label;
    docs.push({
      kind: "brain",
      refId: b.id,
      title,
      subtitle: title === label ? "Brain" : label,
      href: `/brain?tab=${BRAIN_TAB[b.section]}`,
      text: [inEveryLanguage(`brain.${b.section}`), ...strings(b.data)].join("\n"),
    });
  }

  for (const c of conversationRows) {
    docs.push({
      kind: "conversation",
      refId: c.id,
      title: c.title,
      subtitle: inEnglish("conversation"),
      href: `/agent/${c.id}`,
      text: [c.title, ...messagesOf(c.id).map((m) => `${m.role === "user" ? "You" : "Pluton"}: ${m.text}`)].join("\n\n"),
    });
  }

  return docs.map((d) => ({ ...d, text: d.text.slice(0, MAX_TEXT) }));
}

// ── Index ────────────────────────────────────────────────────────────────────

const searchDocumentId = (workspaceId: string, d: Doc) => `${workspaceId}:${d.kind}:${d.refId}`;

const hashOf = (d: Doc) => createHash("sha1").update(JSON.stringify([SEARCH_MODEL, d.title, d.subtitle, d.href, d.text])).digest("hex");

const EMBED_BATCH = 16;
const WRITE_CHUNK = 200;

/**
 * Brings the workspace's search index in line with its source tables: new and changed rows are
 * written at once (so ⌘K finds them by name straight away), then embedded; rows whose source is
 * gone are deleted. Every read and write stays inside the workspace.
 */
export async function syncSearchIndex(db: Db, workspaceId: string) {
  // Ids carry the workspace: the same page (or anything else) indexed in two workspaces is two rows.
  const docs = (await collectDocuments(db, workspaceId)).map((d) => ({ ...d, id: searchDocumentId(workspaceId, d), hash: hashOf(d) }));
  const existing = new Map(
    (
      await db
        .select({ id: searchDocuments.id, hash: searchDocuments.hash, embedded: sql<number>`${searchDocuments.embedding} is not null` })
        .from(searchDocuments)
        .where(eq(searchDocuments.workspaceId, workspaceId))
    ).map((r) => [r.id, r]),
  );

  const wanted = new Set(docs.map((d) => d.id));
  const gone = [...existing.keys()].filter((id) => !wanted.has(id));
  for (let i = 0; i < gone.length; i += WRITE_CHUNK) {
    await db.delete(searchDocuments).where(and(eq(searchDocuments.workspaceId, workspaceId), inArray(searchDocuments.id, gone.slice(i, i + WRITE_CHUNK))));
  }

  const changed = docs.filter((d) => existing.get(d.id)?.hash !== d.hash);
  for (let i = 0; i < changed.length; i += WRITE_CHUNK) {
    const rows = changed
      .slice(i, i + WRITE_CHUNK)
      .map((d) => ({ ...d, workspaceId, folded: fold([d.title, d.subtitle, d.text].join("\n")), embedding: null }));
    await db
      .insert(searchDocuments)
      .values(rows)
      .onConflictDoUpdate({
        target: searchDocuments.id,
        set: {
          title: sql`excluded.title`,
          subtitle: sql`excluded.subtitle`,
          href: sql`excluded.href`,
          text: sql`excluded.text`,
          folded: sql`excluded.folded`,
          hash: sql`excluded.hash`,
          embedding: null,
          updatedAt: new Date(),
        },
      });
  }

  // Changed rows, plus any left unembedded by an earlier sync that couldn't load the model.
  const toEmbed = docs.filter((d) => existing.get(d.id)?.hash !== d.hash || !existing.get(d.id)?.embedded);
  for (let i = 0; i < toEmbed.length; i += EMBED_BATCH) {
    const batch = toEmbed.slice(i, i + EMBED_BATCH);
    const vectors = await embed(batch.map((d) => d.text));
    for (const [j, d] of batch.entries()) {
      await db
        .update(searchDocuments)
        .set({ embedding: vectors[j]! })
        // A newer sync may have rewritten the row meanwhile: its own embedding wins.
        .where(and(eq(searchDocuments.workspaceId, workspaceId), eq(searchDocuments.id, d.id), eq(searchDocuments.hash, d.hash)));
    }
  }

  return { documents: docs.length, written: changed.length, embedded: toEmbed.length, deleted: gone.length };
}

/** Per workspace: the sync in flight, whether another was asked for meanwhile, when the last began. */
const syncs = new Map<string, { running: Promise<void> | null; again: boolean; lastAt: number }>();

/**
 * Starts a sync unless one is running (then one more runs after it). Never throws: a failed sync,
 * offline before the model is downloaded for instance, is retried on the next request.
 */
export function requestSearchSync(db: Db, workspaceId: string, minGapMs = 0): Promise<void> {
  const state = syncs.get(workspaceId) ?? { running: null, again: false, lastAt: 0 };
  syncs.set(workspaceId, state);
  if (state.running) {
    state.again = true;
    return state.running;
  }
  if (Date.now() - state.lastAt < minGapMs) return Promise.resolve();
  state.lastAt = Date.now();
  state.running = syncSearchIndex(db, workspaceId)
    .then((r) => void (r.embedded > 0 && console.log(`[search] embedded ${r.embedded} of ${r.documents} documents`)))
    .catch((error) => console.warn(`[search] index sync failed: ${(error as Error).message}`))
    .finally(() => {
      state.running = null;
      if (state.again) {
        state.again = false;
        void requestSearchSync(db, workspaceId);
      }
    });
  return state.running;
}

/** Keeps every workspace's index fresh: now, then on an interval (each search nudges it too). */
export function watchSearchIndex(db: Db, everyMs = 30_000) {
  const tick = async () => {
    for (const w of await db.select({ id: workspaces.id }).from(workspaces)) await requestSearchSync(db, w.id);
  };
  void tick().catch(() => {});
  setInterval(() => void tick().catch(() => {}), everyMs).unref();
}

// ── Search ───────────────────────────────────────────────────────────────────

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string | null;
  href: string;
  /** The query appears in the title: the founder is looking for this item by name. */
  named: boolean;
  score: number;
};

/** Below this cosine similarity a match is noise (unrelated texts score 0.1–0.35 with this model). */
const MIN_SIMILARITY = 0.38;
/** Meaning matches this far below the best one are dropped: a strong match hides the vague ones. */
const SIMILARITY_SPREAD = 0.12;
/** When the query names something, meaning matches must be this close to show beside it. */
const MIN_SIMILARITY_BESIDE_NAMES = 0.5;
/** Shorter queries are a name being typed: matching letters says more than meaning. */
const MIN_SEMANTIC_QUERY = 3;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const cosine = (a: number[], b: number[]) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

/**
 * Hosted, Postgres keeps embeddings as plain arrays: the closest 30 are picked here, as libSQL's
 * vector_distance_cos picks them in SQL. A workspace holds a few thousand documents at most.
 */
async function closestInNode(db: Db, workspaceId: string, vector: number[]) {
  const rows = await db
    .select({ id: searchDocuments.id, kind: searchDocuments.kind, title: searchDocuments.title, subtitle: searchDocuments.subtitle, href: searchDocuments.href, embedding: searchDocuments.embedding })
    .from(searchDocuments)
    .where(and(eq(searchDocuments.workspaceId, workspaceId), isNotNull(searchDocuments.embedding)));
  return rows
    .map(({ embedding, ...r }) => ({ ...r, similarity: cosine(vector, embedding!) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 30);
}

/**
 * Finds anything in the workspace by name or by meaning. Name matches come from the folded text
 * and work before the model is downloaded; meaning comes from the embeddings.
 */
export async function searchWorkspace(db: Db, workspaceId: string, query: string, limit = 8): Promise<SearchHit[]> {
  const q = query.trim().replace(/\s+/g, " ");
  if (!q) return [];
  const folded = fold(q);
  const columns = {
    id: searchDocuments.id,
    kind: searchDocuments.kind,
    title: searchDocuments.title,
    subtitle: searchDocuments.subtitle,
    href: searchDocuments.href,
  };

  // "concurrents" also finds "Concurrent": a plural tries its singular too (not a short word, "clés" isn't "Clément").
  const forms = [folded, ...(folded.length >= 5 && /[^s]s$/.test(folded) ? [folded.slice(0, -1)] : [])];
  const named = db
    .select(columns)
    .from(searchDocuments)
    .where(
      and(
        eq(searchDocuments.workspaceId, workspaceId),
        or(...forms.map((f) => sql`${searchDocuments.folded} like ${`%${escapeLike(f)}%`} escape '\\'`)),
      ),
    )
    .limit(50);

  // Only once the model is loaded: a search never waits for the download.
  const vector = q.length >= MIN_SEMANTIC_QUERY && modelReady ? (await embed([q]))[0] : undefined;
  const similar = !vector
    ? Promise.resolve([])
    : HOSTED
      ? closestInNode(db, workspaceId, vector)
      : db
          .select({ ...columns, similarity: sql<number>`1 - vector_distance_cos(${searchDocuments.embedding}, vector32(${JSON.stringify(vector)}))`.as("similarity") })
          .from(searchDocuments)
          .where(and(eq(searchDocuments.workspaceId, workspaceId), sql`${searchDocuments.embedding} is not null`))
          .orderBy(sql`similarity desc`)
          .limit(30);
  if (!modelReady) void loadModel().catch(() => {});

  const [byName, byMeaning] = await Promise.all([named, similar]);
  const hits = new Map<string, SearchHit>();
  for (const r of byName) {
    const title = fold(r.title);
    // A name match outranks any meaning match; a title beats a mention deeper in the text.
    const score = forms.some((f) => title.startsWith(f)) ? 1.3 : forms.some((f) => title.includes(f)) ? 1.2 : 1;
    hits.set(r.id, { ...r, named: score > 1, score });
  }
  const floor = Math.max(
    (byMeaning[0]?.similarity ?? 0) - SIMILARITY_SPREAD,
    [...hits.values()].some((h) => h.named) ? MIN_SIMILARITY_BESIDE_NAMES : MIN_SIMILARITY,
  );
  for (const { similarity, ...r } of byMeaning) {
    const hit = hits.get(r.id);
    if (hit) hit.score += similarity / 10;
    else if (similarity >= floor) hits.set(r.id, { ...r, named: false, score: similarity });
  }
  return [...hits.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(inFoundersLanguage);
}

const BRAIN_SECTIONS_BY_LABEL = new Map(Object.keys(BRAIN_TAB).map((s) => [inEnglish(`brain.${s as BrainSection}`), s as BrainSection]));
const PLAY_STATUS_PREFIX = /^(draft|active|paused|archived) · /;

/** The index stores page titles and labels in English: shown in the founder's language. */
function inFoundersLanguage(hit: SearchHit): SearchHit {
  const refId = hit.id.split(":").slice(2).join(":");
  const label = (english: string | null) => {
    const section = english ? BRAIN_SECTIONS_BY_LABEL.get(english) : undefined;
    return section ? t(`brain.${section}`) : english;
  };
  switch (hit.kind) {
    case "page":
      return PAGES.some((p) => p.ref === refId) ? { ...hit, title: t(`page.${refId as (typeof PAGES)[number]["ref"]}`) } : hit;
    case "brain":
      return { ...hit, title: label(hit.title)!, subtitle: label(hit.subtitle) };
    case "conversation":
      return { ...hit, subtitle: t("conversation") };
    case "play":
      return {
        ...hit,
        subtitle: hit.subtitle?.replace(PLAY_STATUS_PREFIX, (_, status: "draft" | "active" | "paused" | "archived") => `${t(`playStatus.${status}`)} · `) ?? null,
      };
    default:
      return hit;
  }
}
