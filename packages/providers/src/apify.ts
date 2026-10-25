import type { Db } from "@pluton/db";
import { httpJson, providerCall, requireKey } from "./runtime.ts";
import type { PersonRecord, PostRecord } from "./types.ts";

/**
 * Apify actors for LinkedIn engagement. Defaults are the no-cookie harvestapi actors, so your own
 * LinkedIn account is never used for scraping.
 */
const PROVIDER = "apify";
export const APIFY_KEY = "apify_token";

const ACTORS = {
  profilePosts: () => "harvestapi~linkedin-profile-posts",
  postReactions: () => "harvestapi~linkedin-post-reactions",
  postComments: () => "harvestapi~linkedin-post-comments",
  postSearch: () => "harvestapi~linkedin-post-search",
};

/** Runs an actor and returns its dataset (synchronous endpoint: capped at 300 s by Apify). */
async function runActor<T>(actorId: string, input: unknown, maxItems: number) {
  const token = requireKey(PROVIDER, APIFY_KEY);
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?maxItems=${maxItems}&timeout=280`;
  return httpJson<T[]>(PROVIDER, url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(input),
    timeoutMs: 300_000,
    retries: 0,
  });
}

type ApiPost = {
  linkedinUrl: string;
  content?: string;
  author?: { name?: string; linkedinUrl?: string; info?: string };
  postedAt?: { date?: string };
  engagement?: { likes?: number; comments?: number };
};

/** Recent posts of LinkedIn profiles or company pages (the tracked competitors, influencers, own brand). */
export async function profilePosts(db: Db, profileUrls: string[], opts: { maxPosts?: number; postedLimit?: PostedLimit } = {}) {
  // The profile-posts actor stops at a month.
  const postedLimit = opts.postedLimit === "3months" ? "month" : (opts.postedLimit ?? "month");
  const input = { targetUrls: profileUrls, maxPosts: opts.maxPosts ?? 5, postedLimit };
  return providerCall(
    db,
    PROVIDER,
    "profile_posts",
    input,
    async () => {
      const items = await runActor<ApiPost>(ACTORS.profilePosts(), input, profileUrls.length * input.maxPosts);
      const posts: PostRecord[] = items
        .filter((p) => p.linkedinUrl)
        .map((p) => ({
          url: p.linkedinUrl,
          text: p.content ?? "",
          postedAt: p.postedAt?.date,
          author: { name: p.author?.name ?? "", linkedinUrl: p.author?.linkedinUrl },
          likes: p.engagement?.likes,
          comments: p.engagement?.comments,
          source: PROVIDER,
        }));
      return { value: { posts }, items: posts.length };
    },
    { ttlMs: 6 * 3600_000 },
  );
}

type ApiReaction = { reactionType?: string; actor?: { name?: string; position?: string; linkedinUrl?: string } };
type ApiComment = { commentary?: string; actor?: { name?: string; position?: string; linkedinUrl?: string } };

/** People who reacted to or commented on a post: the "post engagers" behind competitor/influencer signals. */
export async function postEngagers(db: Db, postUrl: string, opts: { maxReactions?: number; maxComments?: number } = {}) {
  const maxReactions = opts.maxReactions ?? 50;
  const maxComments = opts.maxComments ?? 30;
  return providerCall(
    db,
    PROVIDER,
    "post_engagers",
    { postUrl, maxReactions, maxComments },
    async () => {
      const [reactions, comments] = await Promise.all([
        runActor<ApiReaction>(ACTORS.postReactions(), { posts: [postUrl], maxItems: maxReactions }, maxReactions),
        runActor<ApiComment>(ACTORS.postComments(), { posts: [postUrl], maxItems: maxComments }, maxComments),
      ]);
      const people = new Map<string, PersonRecord>();
      for (const r of reactions) {
        if (!r.actor?.name) continue;
        people.set(r.actor.linkedinUrl ?? r.actor.name, {
          name: r.actor.name,
          headline: r.actor.position,
          linkedinUrl: r.actor.linkedinUrl,
          signal: `Reacted (${(r.reactionType ?? "like").toLowerCase()}) to ${postUrl}`,
          source: PROVIDER,
        });
      }
      // A comment is a stronger signal than a reaction, so it wins for the same person.
      for (const c of comments) {
        if (!c.actor?.name) continue;
        people.set(c.actor.linkedinUrl ?? c.actor.name, {
          name: c.actor.name,
          headline: c.actor.position,
          linkedinUrl: c.actor.linkedinUrl,
          signal: `Commented on ${postUrl}: "${(c.commentary ?? "").slice(0, 120)}"`,
          source: PROVIDER,
        });
      }
      const value = { people: [...people.values()] };
      return { value, items: value.people.length };
    },
    { ttlMs: 24 * 3600_000 },
  );
}

export type PostedLimit = "24h" | "week" | "month" | "3months";

/** Recent LinkedIn posts matching keywords: their authors are people posting about the topic. */
export async function keywordPosts(db: Db, queries: string[], opts: { maxPosts?: number; postedLimit?: PostedLimit } = {}) {
  const input = { searchQueries: queries, maxPosts: opts.maxPosts ?? 20, postedLimit: opts.postedLimit ?? "month", sortBy: "date" };
  return providerCall(
    db,
    PROVIDER,
    "keyword_posts",
    input,
    async () => {
      const items = await runActor<ApiPost>(ACTORS.postSearch(), input, input.maxPosts * queries.length);
      const posts = items
        .filter((p) => p.linkedinUrl && p.author?.name)
        .map((p) => ({
          url: p.linkedinUrl,
          text: p.content ?? "",
          postedAt: p.postedAt?.date,
          author: { name: p.author!.name!, linkedinUrl: p.author?.linkedinUrl, headline: p.author?.info },
          likes: p.engagement?.likes,
          comments: p.engagement?.comments,
          source: PROVIDER,
        }));
      return { value: { posts }, items: posts.length };
    },
    { ttlMs: 6 * 3600_000 },
  );
}

/** Maps a freshness window in days to the actors' posted-date filter. */
export function postedLimitFor(days: number): PostedLimit {
  return days <= 1 ? "24h" : days <= 7 ? "week" : days <= 31 ? "month" : "3months";
}
