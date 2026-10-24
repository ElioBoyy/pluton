import type { Db } from "@pluton/db";
import { http, httpJson, providerCall, toDomain } from "./runtime.ts";
import type { JobRecord } from "./types.ts";

/**
 * Hiring signal for a known company, free: find its careers board on its website, then read the
 * board's public JSON API (Greenhouse, Lever, Ashby, Recruitee). No key, no scraping of job sites.
 */
const PROVIDER = "careers";

type Board = { ats: "greenhouse" | "lever" | "ashby" | "recruitee"; slug: string; url: string };

const BOARD_PATTERNS: Array<[Board["ats"], RegExp]> = [
  ["greenhouse", /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i],
  ["lever", /jobs\.(?:eu\.)?lever\.co\/([a-z0-9_-]+)/i],
  ["ashby", /jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/i],
  ["recruitee", /([a-z0-9-]+)\.recruitee\.com/i],
];

const CAREER_PATHS = ["", "/careers", "/jobs", "/carrieres", "/recrutement", "/join-us", "/nous-rejoindre"];

async function findBoard(domain: string): Promise<{ board: Board | null; careersUrl: string | null }> {
  const found = await scanPages(domain);
  if (found.board) return found;
  return { board: await guessBoard(domain), careersUrl: found.careersUrl };
}

/** Many boards are named after the company ("doctolib"): probe the public APIs directly. */
async function guessBoard(domain: string): Promise<Board | null> {
  const slug = domain.split(".")[0]!;
  const probes: Array<[Board["ats"], string]> = [
    ["greenhouse", `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`],
    ["ashby", `https://api.ashbyhq.com/posting-api/job-board/${slug}`],
    ["lever", `https://api.lever.co/v0/postings/${slug}?mode=json&limit=1`],
  ];
  for (const [ats, url] of probes) {
    try {
      const res = await http(PROVIDER, url, { timeoutMs: 8_000, retries: 0 });
      // Lever answers 200 with [] for unknown boards, so require a non-empty body there.
      if (res.ok && (ats !== "lever" || (await res.text()).trim() !== "[]")) return { ats, slug, url };
    } catch {
      // Try the next board.
    }
  }
  return null;
}

async function scanPages(domain: string): Promise<{ board: Board | null; careersUrl: string | null }> {
  let careersUrl: string | null = null;
  const urls = [
    ...CAREER_PATHS.map((path) => `https://${domain}${path}`),
    `https://careers.${domain}`,
    `https://jobs.${domain}`,
  ];
  for (const url of urls) {
    const path = new URL(url).pathname.replace(/\/$/, "");
    const isHome = url === `https://${domain}`;
    let html: string;
    try {
      const res = await http(PROVIDER, url, { timeoutMs: 10_000, retries: 0 });
      if (!res.ok) continue;
      html = await res.text();
    } catch {
      continue;
    }
    if (!isHome || path) careersUrl ??= url;
    for (const [ats, pattern] of BOARD_PATTERNS) {
      const match = html.match(pattern);
      if (match?.[1] && !["www", "api", "app"].includes(match[1].toLowerCase())) {
        return { board: { ats, slug: decodeURIComponent(match[1]), url: match[0] }, careersUrl };
      }
    }
  }
  return { board: null, careersUrl };
}

async function readBoard(board: Board, company: string, domain: string): Promise<JobRecord[]> {
  const base = { company, companyDomain: domain, source: `${PROVIDER}:${board.ats}` };
  switch (board.ats) {
    case "greenhouse": {
      const d = await httpJson<{ jobs: Array<{ title: string; absolute_url: string; location?: { name?: string }; updated_at?: string }> }>(
        PROVIDER,
        `https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs`,
      );
      return d.jobs.map((j) => ({ ...base, title: j.title, url: j.absolute_url, location: j.location?.name, postedAt: j.updated_at }));
    }
    case "lever": {
      const d = await httpJson<Array<{ text: string; hostedUrl: string; categories?: { location?: string; team?: string }; createdAt?: number }>>(
        PROVIDER,
        `https://api.lever.co/v0/postings/${board.slug}?mode=json`,
      );
      return d.map((j) => ({
        ...base,
        title: j.text,
        url: j.hostedUrl,
        location: j.categories?.location,
        department: j.categories?.team,
        postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
      }));
    }
    case "ashby": {
      const d = await httpJson<{ jobs: Array<{ title: string; jobUrl: string; location?: string; department?: string; publishedAt?: string }> }>(
        PROVIDER,
        `https://api.ashbyhq.com/posting-api/job-board/${board.slug}`,
      );
      return d.jobs.map((j) => ({ ...base, title: j.title, url: j.jobUrl, location: j.location, department: j.department, postedAt: j.publishedAt }));
    }
    case "recruitee": {
      const d = await httpJson<{ offers: Array<{ title: string; careers_url: string; location?: string; department?: string; published_at?: string }> }>(
        PROVIDER,
        `https://${board.slug}.recruitee.com/api/offers/`,
      );
      return d.offers.map((j) => ({ ...base, title: j.title, url: j.careers_url, location: j.location, department: j.department, postedAt: j.published_at }));
    }
  }
}

export type CareersResult = { domain: string; board: Board | null; careersUrl: string | null; jobs: JobRecord[] };

export async function companyJobs(db: Db, website: string, opts: { company?: string; titleFilter?: string[] } = {}) {
  const domain = toDomain(website);
  const result = await providerCall(
    db,
    PROVIDER,
    "company_jobs",
    { domain },
    async () => {
      const { board, careersUrl } = await findBoard(domain);
      const jobs = board ? await readBoard(board, opts.company ?? domain, domain) : [];
      // "No board found" may be a miss on our side: keep it briefly so a retry can find one.
      return {
        value: { domain, board, careersUrl, jobs } satisfies CareersResult,
        items: jobs.length,
        ttlMs: board ? undefined : 3600_000,
      };
    },
    { ttlMs: 12 * 3600_000 },
  );
  if (!opts.titleFilter?.length) return result;
  // Same matching as TheirStack's job_title_or: every word of a pattern, any order, case-insensitive.
  const patterns = opts.titleFilter.map((p) => p.toLowerCase().split(/\s+/).filter(Boolean));
  return {
    ...result,
    jobs: result.jobs.filter((j) => patterns.some((words) => words.every((w) => j.title.toLowerCase().includes(w)))),
  };
}
