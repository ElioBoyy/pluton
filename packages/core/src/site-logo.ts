import fs from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "@pluton/db";

/**
 * Each workspace's tile shows its website's own icon, fetched straight from that site (no
 * third-party favicon service) and kept in data/logos/. A site without a usable icon is asked
 * again after a day, one with an icon every week; changing the workspace's website fetches anew.
 */
const logoDir = () => path.resolve(repoRoot, "data/logos");
const RETRY_AFTER = 24 * 60 * 60 * 1000;
const REFRESH_AFTER = 7 * 24 * 60 * 60 * 1000;
const MAX_HTML_BYTES = 300_000;
const MAX_ICON_BYTES = 1_000_000;

type Meta = { website: string; file: string | null; type: string | null; fetchedAt: number };
export type SiteLogo = { bytes: Buffer; type: string };

const siteUrl = (website: string) => {
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

async function get(url: string, accept: string) {
  const res = await fetch(url, { headers: { Accept: accept, "User-Agent": "Mozilla/5.0 (Pluton)" }, redirect: "follow", signal: AbortSignal.timeout(6000) });
  if (res.ok) return res;
  await res.body?.cancel();
  return null;
}

/** Reads at most `max` bytes; a longer body is cut (`truncated`) instead of downloaded whole. */
async function readCapped(res: Response, max: number) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body?.getReader();
  if (!reader) return { bytes: Buffer.alloc(0), truncated: false };
  while (true) {
    const { done, value } = await reader.read();
    if (done) return { bytes: Buffer.concat(chunks), truncated: false };
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return { bytes: Buffer.concat(chunks), truncated: true };
    }
    chunks.push(value);
  }
}

/**
 * The image type from the bytes themselves, never from the site's header: a server that answers
 * /favicon.ico with its HTML page must not end up saved as the logo.
 */
function sniff(bytes: Buffer): string | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (starts(0x00, 0x00, 0x01, 0x00)) return "image/x-icon";
  const head = bytes.subarray(0, 1000).toString("utf8").trimStart().toLowerCase();
  if ((head.startsWith("<svg") || head.startsWith("<?xml")) && head.includes("<svg")) return "image/svg+xml";
  return null;
}

/** Icon links in the page, best first: Apple touch icons, then the largest declared icon, then SVG. */
function iconCandidates(html: string, base: URL) {
  const found: { href: string; rank: number }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attr = (name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
    const rel = attr("rel")?.toLowerCase() ?? "";
    const href = attr("href");
    if (!href || !/\bicon\b|apple-touch-icon/.test(rel) || /mask-icon/.test(rel)) continue;
    const size = Math.max(0, ...(attr("sizes")?.match(/\d+/g) ?? []).map(Number));
    const rank = rel.includes("apple-touch-icon") ? 1000 + size : /\.svg(\?|$)/i.test(href) ? 500 : size || 32;
    try {
      found.push({ href: new URL(href, base).toString(), rank });
    } catch {
      // A malformed href: skip it.
    }
  }
  found.sort((a, b) => b.rank - a.rank);
  const fallbacks = [new URL("/apple-touch-icon.png", base).toString(), new URL("/favicon.ico", base).toString()];
  return [...new Set([...found.map((f) => f.href), ...fallbacks])];
}

async function fetchLogo(website: string): Promise<SiteLogo | null> {
  const base = siteUrl(website);
  if (!base) return null;
  const page = await get(base.toString(), "text/html").catch(() => null);
  const html = page ? (await readCapped(page, MAX_HTML_BYTES).catch(() => null))?.bytes.toString("utf8") ?? "" : "";
  for (const href of iconCandidates(html, page ? new URL(page.url) : base)) {
    const res = await get(href, "image/*").catch(() => null);
    if (!res) continue;
    const body = await readCapped(res, MAX_ICON_BYTES).catch(() => null);
    if (!body || body.truncated || body.bytes.length < 100) continue;
    const type = sniff(body.bytes);
    if (type) return { bytes: body.bytes, type };
  }
  return null;
}

/** Writes through a temporary file, so a reader never sees half an image. */
async function writeAtomic(file: string, data: string | Buffer) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

async function loadLogo(workspaceId: string, website: string): Promise<SiteLogo | null> {
  const metaFile = path.join(logoDir(), `${workspaceId}.json`);
  const meta: Meta | null = await fs.readFile(metaFile, "utf8").then(JSON.parse, () => null);
  const age = meta ? Date.now() - meta.fetchedAt : Infinity;
  const cached = meta?.website === website && meta.file ? await fs.readFile(path.join(logoDir(), meta.file)).catch(() => null) : null;
  const cachedLogo = cached && meta?.type ? { bytes: cached, type: meta.type } : null;
  if (meta?.website === website && age < (cachedLogo ? REFRESH_AFTER : RETRY_AFTER)) return cachedLogo;

  const logo = await fetchLogo(website).catch(() => null);
  // A site that can't be reached this time keeps the icon it had.
  if (!logo && cachedLogo) {
    await writeAtomic(metaFile, JSON.stringify({ ...meta!, fetchedAt: Date.now() } satisfies Meta));
    return cachedLogo;
  }
  await fs.mkdir(logoDir(), { recursive: true });
  const file = logo ? `${workspaceId}.img` : null;
  if (logo && file) await writeAtomic(path.join(logoDir(), file), logo.bytes);
  await writeAtomic(metaFile, JSON.stringify({ website, file, type: logo?.type ?? null, fetchedAt: Date.now() } satisfies Meta));
  return logo;
}

const inFlight = new Map<string, Promise<SiteLogo | null>>();

/** The workspace's logo, fetching it when needed; null when its site has none. Tiles asking at once share one fetch. */
export function workspaceLogo(workspaceId: string, website: string | null): Promise<SiteLogo | null> {
  if (!website || !/^[\w-]+$/.test(workspaceId)) return Promise.resolve(null);
  const key = `${workspaceId}\n${website}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const run = loadLogo(workspaceId, website).finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}
