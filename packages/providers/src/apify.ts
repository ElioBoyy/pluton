import type { Db } from "@pluton/db";
import { httpJson, providerCall, requireKey } from "./runtime.ts";
import type { PersonRecord, PostRecord } from "./types.ts";

/**
 * Apify actors for LinkedIn engagement. Defaults are the no-cookie harvestapi actors, so your own
 * LinkedIn account is never used for scraping. Override with APIFY_ACTOR_* if you prefer others.
 */
const PROVIDER = "apify";
export const APIFY_ENV = "APIFY_TOKEN";

const actor = (envVar: string, fallback: string) => process.env[envVar]?.trim() || fallback;
const ACTORS = {
  profilePosts: () => actor("APIFY_ACTOR_PROFILE_POSTS", "harvestapi~linkedin-profile-posts"),
  postReactions: () => actor("APIFY_ACTOR_POST_REACTIONS", "harvestapi~linkedin-post-reactions"),
  postComments: () => actor("APIFY_ACTOR_POST_COMMENTS", "harvestapi~linkedin-post-comments"),
};

/** Runs an actor and returns its dataset (synchronous endpoint: capped at 300 s by Apify). */
async function runActor<T>(actorId: string, input: unknown, maxItems: number) {
  const token = requireKey(PROVIDER, APIFY_ENV);
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
  author?: { name?: string; linkedinUrl?: string };
  postedAt?: { date?: string };
  engagement?: { likes?: number; comments?: number };
};

/** Recent posts of LinkedIn profiles or company pages (the tracked competitors, influencers, own brand). */
export async function profilePosts(db: Db, profileUrls: string[], opts: { maxPosts?: number; postedLimit?: "24h" | "week" | "month" } = {}) {
  const input = { targetUrls: profileUrls, maxPosts: opts.maxPosts ?? 5, postedLimit: opts.postedLimit ?? "month" };
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
