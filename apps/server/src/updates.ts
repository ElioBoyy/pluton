import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { HOSTED, repoRoot } from "@pluton/db";

const run = promisify(execFile);

/** Where self-hosted installs come from (the README clones it), and the branch they follow. */
const REPO = "ElioBoyy/pluton";
const BRANCH = "main";
const FRESH_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 60 * 60 * 1000;

export type Update = { behindBy: number; url: string };

let cache: { at: number; ttl: number; value: Update | null } | null = null;

/**
 * Whether a self-hosted install is behind GitHub's main branch: the commit this checkout runs is
 * compared with main, through GitHub's public API, at most every six hours. Hosted, a clone without
 * git, a commit GitHub doesn't know (local work) or no network all answer null: nothing to show.
 * PLUTON_UPDATE_CHECK=off turns the call to GitHub off.
 */
export async function checkForUpdate(): Promise<Update | null> {
  if (HOSTED || process.env.PLUTON_UPDATE_CHECK === "off") return null;
  if (cache && Date.now() - cache.at < cache.ttl) return cache.value;
  const value = await compare().catch(() => undefined);
  cache = { at: Date.now(), ttl: value === undefined ? RETRY_MS : FRESH_MS, value: value ?? null };
  return cache.value;
}

async function compare(): Promise<Update | null> {
  const { stdout } = await run("git", ["rev-parse", "HEAD"], { cwd: repoRoot, timeout: 5_000 });
  const installed = stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(installed)) return null;
  const res = await fetch(`https://api.github.com/repos/${REPO}/compare/${installed}...${BRANCH}`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "pluton-update-check" },
    signal: AbortSignal.timeout(10_000),
  });
  // 404: this commit isn't on GitHub (a fork or local commits), so "behind" means nothing here.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const body = (await res.json()) as { behind_by?: number; ahead_by?: number; html_url?: string };
  // GitHub counts from the installed commit to main: main's new commits are "ahead" of it.
  const behindBy = body.ahead_by ?? 0;
  return behindBy > 0 ? { behindBy, url: body.html_url ?? `https://github.com/${REPO}/commits/${BRANCH}` } : null;
}
