import fs from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "@pluton/db";

/**
 * Each workspace's tile shows its website's own icon, fetched straight from that site (no
 * third-party favicon service) and kept in data/logos/. A site without a usable icon is asked
 * again after a day; changing the workspace's website fetches anew.
 */
const logoDir = () => path.resolve(repoRoot, "data/logos");
const RETRY_AFTER = 24 * 60 * 60 * 1000;
const MAX_BYTES = 1_000_000;

type Meta = { website: string; file: string | null; type: string | null; fetchedAt: number };

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
  return res.ok ? res : null;
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
  return [...found.map((f) => f.href), new URL("/apple-touch-icon.png", base).toString(), new URL("/favicon.ico", base).toString()];
}

async function fetchLogo(website: string) {
  const base = siteUrl(website);
  if (!base) return null;
  const page = await get(base.toString(), "text/html").catch(() => null);
  const html = page ? (await page.text()).slice(0, 300_000) : "";
  for (const href of iconCandidates(html, page ? new URL(page.url) : base)) {
    const res = await get(href, "image/*").catch(() => null);
    const type = res?.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!res || !(type.startsWith("image/") || /\.ico(\?|$)/i.test(href))) continue;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 100 || bytes.length > MAX_BYTES) continue;
    return { bytes, type: type.startsWith("image/") ? type : "image/x-icon" };
  }
  return null;
}

/** The workspace's logo, fetching it the first time; null when its site has none. */
export async function workspaceLogo(workspaceId: string, website: string | null) {
  if (!website || !/^[\w-]+$/.test(workspaceId)) return null;
  const metaFile = path.join(logoDir(), `${workspaceId}.json`);
  const meta: Meta | null = await fs.readFile(metaFile, "utf8").then(JSON.parse, () => null);
  const fresh = meta && meta.website === website && (meta.file || Date.now() - meta.fetchedAt < RETRY_AFTER);
  if (fresh) {
    if (!meta.file) return null;
    const bytes = await fs.readFile(path.join(logoDir(), meta.file)).catch(() => null);
    if (bytes) return { bytes, type: meta.type ?? "image/png" };
  }
  const logo = await fetchLogo(website).catch(() => null);
  await fs.mkdir(logoDir(), { recursive: true });
  const file = logo ? `${workspaceId}.img` : null;
  if (logo && file) await fs.writeFile(path.join(logoDir(), file), logo.bytes);
  await fs.writeFile(metaFile, JSON.stringify({ website, file, type: logo?.type ?? null, fetchedAt: Date.now() } satisfies Meta));
  return logo;
}
