import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/appearance.ts";

/** Appearance errors and the wallpaper job's progress, in the current language. */
export const appearanceText = localized(messages);

/**
 * Wallpapers: one image per appearance, kept on disk next to the database (data/backgrounds/light.*
 * and dark.*). The server serves them at /api/backgrounds/<theme>; the app shows the one that
 * matches the current appearance behind blurred surfaces.
 */
export type WallpaperTheme = "light" | "dark";
export const WALLPAPER_THEMES: WallpaperTheme[] = ["light", "dark"];

export const WALLPAPER_TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", avif: "image/avif" } as const;
type Ext = keyof typeof WALLPAPER_TYPES;
/** Wallpapers are shown full screen; past this they only slow the app down. */
export const WALLPAPER_MAX_BYTES = 15 * 1024 * 1024;

export const wallpaperDir = () => path.resolve(repoRoot, "data/backgrounds");

/** The stored file for a theme, if any; `version` changes with each new image, for cache busting. */
export async function findWallpaper(theme: WallpaperTheme) {
  const names = await fs.readdir(wallpaperDir()).catch(() => [] as string[]);
  const name = names.find((n) => n.startsWith(`${theme}.`) && n.slice(theme.length + 1) in WALLPAPER_TYPES);
  if (!name) return null;
  const file = path.join(wallpaperDir(), name);
  const stat = await fs.stat(file);
  return { file, type: WALLPAPER_TYPES[name.slice(theme.length + 1) as Ext], version: Math.round(stat.mtimeMs) };
}

/**
 * How the wallpaper sits behind the app: its blur in px, its colour intensity in % (100 = as
 * shot) and the veil over it in % (dark mode adds 5 points). The factory values are the ones the
 * app shipped with.
 */
export type WallpaperTuning = { blur: number; saturation: number; veil: number };
export const WALLPAPER_TUNING_DEFAULTS: WallpaperTuning = { blur: 80, saturation: 80, veil: 50 };
const tuningFile = () => path.join(wallpaperDir(), "tuning.json");

export async function wallpaperTuning(): Promise<WallpaperTuning> {
  const saved = await fs.readFile(tuningFile(), "utf8").then(JSON.parse, () => ({}));
  return { ...WALLPAPER_TUNING_DEFAULTS, ...saved };
}

/** Saves the tuning; `null` puts the factory values back. */
export async function saveWallpaperTuning(tuning: WallpaperTuning | null) {
  if (!tuning) return fs.rm(tuningFile(), { force: true });
  await fs.mkdir(wallpaperDir(), { recursive: true });
  await fs.writeFile(tuningFile(), JSON.stringify(tuning));
}

export async function wallpaperStatus() {
  const [light, dark] = await Promise.all(WALLPAPER_THEMES.map(findWallpaper));
  return {
    light: light && { url: `/api/backgrounds/light?v=${light.version}` },
    dark: dark && { url: `/api/backgrounds/dark?v=${dark.version}` },
    tuning: await wallpaperTuning(),
    codex: codexAvailable(),
  };
}

/** Replaces a theme's wallpaper. The extension comes from the image's own bytes, not from the caller. */
export async function saveWallpaper(theme: WallpaperTheme, bytes: Buffer) {
  const ext = sniffImage(bytes);
  if (!ext) throw new Error(appearanceText("notImage"));
  if (bytes.length > WALLPAPER_MAX_BYTES) throw new Error(appearanceText("tooBig"));
  await removeWallpaper(theme);
  await fs.mkdir(wallpaperDir(), { recursive: true });
  await fs.writeFile(path.join(wallpaperDir(), `${theme}.${ext}`), bytes);
}

export async function removeWallpaper(theme: WallpaperTheme) {
  const current = await findWallpaper(theme);
  if (current) await fs.rm(current.file, { force: true });
}

function sniffImage(b: Buffer): Ext | null {
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (b.subarray(4, 12).toString("latin1").startsWith("ftypavi")) return "avif";
  return null;
}

let codexCheck: { at: number; ok: boolean } | null = null;

/** Whether the Codex CLI is installed here, so the app can offer to generate wallpapers with it. Checked at most once a minute. */
export function codexAvailable() {
  if (!codexCheck || Date.now() - codexCheck.at > 60_000) {
    const r = spawnSync("codex", ["--version"], { encoding: "utf8", timeout: 5000 });
    codexCheck = { at: Date.now(), ok: r.status === 0 };
  }
  return codexCheck.ok;
}
