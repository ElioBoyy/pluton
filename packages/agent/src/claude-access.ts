import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getSetting, HOSTED } from "@pluton/db";
import { agentBackend, type AgentBackend } from "./backend.ts";

export type ClaudeAccess = {
  backend: AgentBackend;
  /** Whether the agent can reach Claude right now, as far as can be told without a paid call. */
  ready: boolean;
  /** Self-hosted: whether the `claude` command is installed on this computer. */
  claudeCodeInstalled: boolean;
};

/** `claude auth status` answers whether this computer's Claude Code is signed in; null when it isn't installed. */
const authStatus = () =>
  new Promise<{ loggedIn?: boolean } | null>((resolve) => {
    execFile("claude", ["auth", "status", "--json"], { timeout: 10_000 }, (error, stdout) => {
      if (error && (error as NodeJS.ErrnoException).code === "ENOENT") return resolve(null);
      try {
        resolve(JSON.parse(stdout) as { loggedIn?: boolean });
      } catch {
        resolve({ loggedIn: false });
      }
    });
  });

/** Claude Code keeps the signed-in account in ~/.claude.json: a fallback when the command can't answer. */
async function accountOnDisk() {
  const file = path.join(process.env.CLAUDE_CONFIG_DIR ?? os.homedir(), ".claude.json");
  const config = await fs.readFile(file, "utf8").then((t) => JSON.parse(t) as { oauthAccount?: { emailAddress?: string } }, () => null);
  return Boolean(config?.oauthAccount?.emailAddress);
}

let cached: { at: number; value: ClaudeAccess; key: string | undefined } | null = null;

/**
 * Whether Pluton can run its agents: the workspace's API key when that's the access chosen (always
 * hosted), else this computer's Claude Code sign-in. Checked at most every 15 seconds.
 */
export async function claudeAccess(): Promise<ClaudeAccess> {
  const backend = agentBackend();
  const key = getSetting("anthropic_api_key");
  if (backend === "api_key" || HOSTED) return { backend, ready: Boolean(key), claudeCodeInstalled: false };
  if (cached && cached.key === key && Date.now() - cached.at < 15_000) return cached.value;
  const status = await authStatus();
  const signedIn = Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN) || Boolean(status?.loggedIn) || (status === null && (await accountOnDisk()));
  const value = { backend, ready: signedIn, claudeCodeInstalled: status !== null };
  cached = { at: Date.now(), value, key };
  return value;
}
