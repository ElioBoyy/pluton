import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { jobPayloads, saveWallpaper, type JobHandler } from "@pluton/core";

/** Codex's image tool can take a couple of minutes per image. */
const CODEX_TIMEOUT_MS = 6 * 60_000;
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

/**
 * One prompt, two wallpapers. Codex's built-in `$imagegen` draws the light one, then gets that image
 * back with the ask to repaint the same scene at night, so both appearances share one picture.
 * Codex saves what it draws under $CODEX_HOME/generated_images; we pick up the file it just wrote.
 */
export const generateWallpaper: JobHandler = async ({ job, emit, signal }) => {
  const { prompt } = jobPayloads["appearance.generate_wallpaper"].parse(job.payload);
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "pluton-wallpaper-"));
  try {
    await emit("progress", { theme: "light", message: "Drawing the light version…" });
    const light = await codexImage(
      `$imagegen Generate one wide 16:9 desktop wallpaper, at least 1920×1080: ${prompt}. ` +
        "Daylight version: bright, airy, soft light tones that sit well behind a light interface. " +
        "No text, no logos, no interface elements, no borders.",
      [],
      work,
      signal,
    );
    await saveWallpaper("light", light);
    await emit("saved", { theme: "light" });

    await emit("progress", { theme: "dark", message: "Drawing the dark version…" });
    const lightFile = path.join(work, "light.png");
    await fs.writeFile(lightFile, light);
    const dark = await codexImage(
      "$imagegen Repaint the attached wallpaper as its night version for a dark interface: the exact same scene, " +
        "composition, framing and subjects, only the light changes. Deep, low-luminance tones, gentle night lighting, " +
        "no bright areas. Same 16:9 size. No text, no logos, no interface elements.",
      [lightFile],
      work,
      signal,
    );
    await saveWallpaper("dark", dark);
    await emit("saved", { theme: "dark" });
    await emit("done", {});
    return { prompt };
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
};

/** Runs `codex exec` once and returns the bytes of the image it generated during the run. */
async function codexImage(instruction: string, images: string[], cwd: string, signal: AbortSignal): Promise<Buffer> {
  const outDir = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "generated_images");
  const started = Date.now();
  const args = ["exec", "--skip-git-repo-check", ...images.flatMap((i) => ["--image", i]), instruction];
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn("codex", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    child.stdout.on("data", (d: Buffer) => (text += d.toString()));
    child.stderr.on("data", (d: Buffer) => (text += d.toString()));
    const stop = () => child.kill("SIGTERM");
    signal.addEventListener("abort", stop);
    const timer = setTimeout(stop, CODEX_TIMEOUT_MS);
    child.on("error", (error) =>
      reject((error as NodeJS.ErrnoException).code === "ENOENT" ? new Error("Codex is not installed on this computer.") : error),
    );
    child.on("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      if (signal.aborted) reject(new Error("Stopped."));
      else if (code === 0) resolve(text);
      else reject(new Error(`Codex stopped (exit ${code}): ${lastLines(text)}`));
    });
  });

  const fresh = await newestImage(outDir, started);
  if (!fresh) throw new Error(`Codex finished without saving an image. Is image generation on for your ChatGPT plan? ${lastLines(output)}`);
  return fs.readFile(fresh);
}

/** The most recent image written under `dir` (at any depth) since `since`. */
async function newestImage(dir: string, since: number): Promise<string | null> {
  const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
  let best: { file: string; at: number } | null = null;
  for (const e of entries) {
    if (!e.isFile() || !IMAGE_EXT.test(e.name)) continue;
    const file = path.join(e.parentPath, e.name);
    const at = (await fs.stat(file)).mtimeMs;
    if (at >= since - 1000 && (!best || at > best.at)) best = { file, at };
  }
  return best?.file ?? null;
}

const lastLines = (text: string) => text.trim().split("\n").slice(-3).join(" ").slice(0, 400);
