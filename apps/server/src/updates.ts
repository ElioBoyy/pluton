import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { HOSTED, repoRoot } from "@pluton/db";

const run = promisify(execFile);

/** Where self-hosted installs come from (the README clones it), and the branch they follow. */
const REPO = "ElioBoyy/pluton";
const BRANCH = "main";
const FRESH_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 60 * 60 * 1000;

/** A newer release than the one installed: its version, notes (Markdown) and page on GitHub. */
export type Update = { from: string; to: string; tag: string; notes: string; url: string };

let cache: { at: number; ttl: number; value: Update | null } | null = null;

/** The version this checkout runs: the root package.json's, bumped with each release. */
export async function installedVersion(): Promise<string> {
  const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}

/** -1, 0 or 1 as a is older than, the same as or newer than b ("1.2.10" > "1.2.9"). */
export function compareVersions(a: string, b: string) {
  const parts = (v: string) => v.replace(/^v/, "").split("-")[0]!.split(".").map((n) => Number(n) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/**
 * Whether GitHub has a newer release than this self-hosted install: the latest published release
 * (drafts and pre-releases excluded) against the installed version, asked at most every six hours.
 * Hosted, no release yet or no network all answer null: nothing to show.
 * PLUTON_UPDATE_CHECK=off turns the call to GitHub off.
 */
export async function checkForUpdate(): Promise<Update | null> {
  if (HOSTED || process.env.PLUTON_UPDATE_CHECK === "off") return null;
  if (cache && Date.now() - cache.at < cache.ttl) return cache.value;
  const value = await latestRelease().catch(() => undefined);
  cache = { at: Date.now(), ttl: value === undefined ? RETRY_MS : FRESH_MS, value: value ?? null };
  return cache.value;
}

async function latestRelease(): Promise<Update | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "pluton-update-check" },
    signal: AbortSignal.timeout(10_000),
  });
  // 404: nothing released yet.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const release = (await res.json()) as { tag_name?: string; body?: string | null; html_url?: string };
  const from = await installedVersion();
  const tag = release.tag_name ?? "";
  const to = tag.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+/.test(to) || compareVersions(to, from) <= 0) return null;
  return { from, to, tag, notes: release.body?.trim() ?? "", url: release.html_url ?? `https://github.com/${REPO}/releases` };
}

const STATUS_FILE = path.join(repoRoot, "data", "update.json");
const RUNNER = path.join(repoRoot, "apps", "server", "scripts", "self-update.mjs");
/** The processes `pnpm dev` runs under node --watch: touching their entry restarts them on the new code. */
const ENTRIES = ["apps/server/src/main.ts", "apps/worker/src/main.ts"].map((f) => path.join(repoRoot, f));
/** A run that started longer ago than this and never finished died with its machine: it no longer blocks. */
const STALE_MS = 20 * 60 * 1000;

export type UpdateProgress = {
  state: "running" | "done" | "failed";
  /** The release being installed, as its tag ("v1.2.0"). */
  tag: string;
  step: "pull" | "install" | "restart";
  log: string[];
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

/** What runs Pluton, as its owner would name it: "macOS 15.4", "Windows 11", "Ubuntu 24.04.1 LTS". */
export async function systemLabel(): Promise<string> {
  const platform = os.platform();
  if (platform === "darwin") {
    const { stdout } = await run("sw_vers", ["-productVersion"], { timeout: 3_000 }).catch(() => ({ stdout: "" }));
    return `macOS ${stdout.trim()}`.trim();
  }
  if (platform === "win32") {
    // Windows 11 still reports 10.0; its builds start at 22000.
    const build = Number(os.release().split(".")[2] ?? 0);
    return build >= 22000 ? "Windows 11" : "Windows 10";
  }
  if (platform === "linux") {
    const release = await fs.readFile("/etc/os-release", "utf8").catch(() => "");
    const pretty = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(release)?.[1];
    return pretty ?? `Linux ${os.release()}`;
  }
  return os.type();
}

/**
 * Why this checkout can't update itself, or null: the release would mix with files edited here, or
 * land on another branch than main, the one releases are cut from.
 */
export async function updateBlocker(): Promise<"local_changes" | "not_main" | null> {
  const git = (args: string[]) => run("git", args, { cwd: repoRoot, timeout: 5_000 }).then((r) => r.stdout.trim());
  if ((await git(["rev-parse", "--abbrev-ref", "HEAD"])) !== BRANCH) return "not_main";
  if (await git(["status", "--porcelain", "--untracked-files=no"])) return "local_changes";
  return null;
}

/** Under `pnpm dev` (node --watch) the update restarts Pluton itself; otherwise its owner does. */
export const restartsItself = process.execArgv.some((a) => a.startsWith("--watch"));

export async function readUpdateProgress(): Promise<UpdateProgress | null> {
  const text = await fs.readFile(STATUS_FILE, "utf8").catch(() => null);
  if (!text) return null;
  try {
    return JSON.parse(text) as UpdateProgress;
  } catch {
    // Read while the runner was writing it: the next poll gets it whole.
    return null;
  }
}

/** Starts the update in a process of its own, detached so it outlives this server's restart. */
export async function startUpdate(): Promise<void> {
  if (HOSTED) throw new Error("Hosted Pluton is updated by its operator.");
  const update = await checkForUpdate();
  if (!update) throw new Error("Pluton is already on the latest release.");
  const current = await readUpdateProgress();
  if (current?.state === "running" && Date.now() - Date.parse(current.startedAt) < STALE_MS) return;
  const blocker = await updateBlocker();
  if (blocker) throw new Error(blocker);
  // pnpm's own entry when Pluton was started through pnpm; the runner falls back to `pnpm` on the PATH.
  const pnpmEntry = /pnpm\.c?js$/.test(process.env.npm_execpath ?? "") ? process.env.npm_execpath! : "";
  await fs.mkdir(path.dirname(STATUS_FILE), { recursive: true });
  // Running from the click on: a page that reloads before the runner's first write still sees it.
  const started: UpdateProgress = { state: "running", tag: update.tag, step: "pull", log: [], startedAt: new Date().toISOString(), finishedAt: null, error: null };
  await fs.writeFile(STATUS_FILE, JSON.stringify(started));
  const args = [RUNNER, repoRoot, STATUS_FILE, update.tag, pnpmEntry, JSON.stringify(restartsItself ? ENTRIES : [])];
  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  cache = null;
}
