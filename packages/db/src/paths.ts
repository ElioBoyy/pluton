import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * The hosted app (PLUTON_HOSTED=1): each account has its own workspaces, and nothing falls back to
 * "the workspace the app shows", which only means something on a self-hosted install.
 */
export const HOSTED = process.env.PLUTON_HOSTED === "1";
