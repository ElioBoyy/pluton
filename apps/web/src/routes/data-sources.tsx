import { ArrowSquareOut, CircleNotch, Key, Play } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useState, type ReactNode } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader } from "../components/ui.tsx";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";

type Provider = inferRouterOutputs<AppRouter>["providers"]["catalog"][number];
type TryInput = inferRouterInputs<AppRouter>["providers"]["try"];
type TryOutput = inferRouterOutputs<AppRouter>["providers"]["try"];

/** Tinted status pills; the light appearance darkens the text so it stays readable on its tint. */
const PILL = "inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap";
const ACCESS = {
  free: { label: "Free", className: "bg-system-green/15 text-[color-mix(in_srgb,var(--color-system-green)_75%,black)] dark:text-system-green" },
  subscription: { label: "Your Claude subscription", className: "bg-system-purple/15 text-system-purple" },
  api_key: { label: "API key", className: "bg-system-orange/15 text-[color-mix(in_srgb,var(--color-system-orange)_75%,black)] dark:text-system-orange" },
} as const;

/** Sample query per provider: one field, turned into the `try` input. */
const SAMPLES: Record<string, { placeholder: string; initial: string; toInput: (v: string) => TryInput }> = {
  registry: { placeholder: "Keyword, e.g. affaires publiques", initial: "affaires publiques", toInput: (query) => ({ provider: "registry", query }) },
  careers: { placeholder: "Company website", initial: "doctolib.fr", toInput: (website) => ({ provider: "careers", website }) },
  stack: { placeholder: "Company website", initial: "legiwatch.fr", toInput: (website) => ({ provider: "stack", website }) },
  web: { placeholder: "Search query", initial: "outils de veille parlementaire France", toInput: (query) => ({ provider: "web", query }) },
  theirstack: {
    placeholder: "Job title, e.g. public affairs manager",
    initial: "public affairs manager",
    toInput: (title) => ({ provider: "theirstack", titles: [title], countries: ["FR"] }),
  },
  apify: {
    placeholder: "LinkedIn profile or company URL",
    initial: "https://www.linkedin.com/company/anthropicresearch/",
    toInput: (profileUrl) => ({ provider: "apify", profileUrl }),
  },
};

export function DataSourcesPage() {
  const trpc = useTRPC();
  const catalog = useQuery(trpc.providers.catalog.queryOptions());
  const usage = useQuery(trpc.providers.usage.queryOptions());

  return (
    <>
      <PageHeader
        title="Data sources"
        description="Where Plays find companies, people and signals. Free sources work now; keyed ones switch on when you add their key in API keys."
      />
      {catalog.data && (
        // One box per source: with no separators, spacing is what tells these rich rows apart.
        <div className="flex flex-col gap-3">
          {catalog.data.map((p) => (
            <ProviderRow key={p.id} provider={p} usage={usage.data?.find((u) => u.provider === p.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function ProviderRow({
  provider: p,
  usage,
}: {
  provider: Provider;
  usage?: { calls: number; failed: number; items: number };
}) {
  const [open, setOpen] = useState(false);
  const access = ACCESS[p.access];

  return (
    <Group className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="mr-0.5 text-sm font-semibold">{p.label}</h2>
            <span className={cn(PILL, access.className)}>{access.label}</span>
            {p.configured ? (
              <span className={cn(PILL, ACCESS.free.className)}>Ready</span>
            ) : (
              <Link to="/workspace/api-keys" className="ml-1 inline-flex items-center gap-1 text-xs text-accent hover:underline hover:underline-offset-2">
                <Key size={12} /> Add its key in API keys
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-muted text-pretty">{p.description}</p>
          {p.powers.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {p.powers.map((s) => (
                <li key={s} className="rounded-full bg-control px-2 py-px text-xs text-muted">
                  {s}
                </li>
              ))}
            </ul>
          )}
          {usage && (
            <p className="mt-2 text-xs text-muted tabular-nums">
              Last 30 days: {usage.calls} call{usage.calls === 1 ? "" : "s"}, {usage.items} results
              {usage.failed ? `, ${usage.failed} failed` : ""}
            </p>
          )}
        </div>
        {SAMPLES[p.id] && (
          <Button variant="ghost" className="shrink-0" disabled={!p.configured} aria-expanded={open} onClick={() => setOpen(!open)}>
            <Play size={12} weight="fill" /> Try it
          </Button>
        )}
      </div>
      {open && SAMPLES[p.id] && <TryPanel providerId={p.id} />}
    </Group>
  );
}

function TryPanel({ providerId }: { providerId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const sample = SAMPLES[providerId]!;
  const [value, setValue] = useState(sample.initial);
  const run = useMutation(
    trpc.providers.try.mutationOptions({
      onSettled: () => queryClient.invalidateQueries({ queryKey: trpc.providers.usage.queryKey() }),
    }),
  );

  return (
    <div className="mt-3 rounded-lg bg-raised p-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run.mutate(sample.toInput(value.trim()));
        }}
      >
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={sample.placeholder} aria-label={sample.placeholder} />
        <Button type="submit" className="min-w-14 shrink-0" disabled={run.isPending || !value.trim()}>
          {run.isPending ? <CircleNotch size={14} className="animate-spin" /> : "Run"}
        </Button>
      </form>
      {run.isPending && providerId === "web" && <p className="ai-text mt-2 text-xs">Claude is searching, this takes ~20–40 s…</p>}
      {run.error && <p className="mt-3 text-sm text-system-orange">{run.error.message}</p>}
      {run.data && <div className="mt-3">{renderResult(run.data)}</div>}
    </div>
  );
}

function renderResult(out: TryOutput): ReactNode {
  switch (out.provider) {
    case "registry":
      return (
        <Results empty={out.result.companies.length === 0} note={`${out.result.total} matching companies`}>
          {out.result.companies.map((c) => (
            <ResultRow
              key={c.siren}
              title={c.name}
              meta={[c.industryCode, c.sizeBand && `${c.sizeBand} employees`, c.city].filter(Boolean).join(" · ")}
              detail={c.executives?.slice(0, 3).map((e) => `${e.name}${e.role ? ` (${e.role})` : ""}`).join(", ")}
            />
          ))}
        </Results>
      );
    case "careers":
      return (
        <Results
          empty={out.result.jobs.length === 0}
          note={out.result.board ? `${out.result.board.ats} board "${out.result.board.slug}" · ${out.result.jobs.length} open roles` : "No public job board found"}
        >
          {out.result.jobs.slice(0, 12).map((j) => (
            <ResultRow key={j.url} title={j.title} meta={[j.department, j.location].filter(Boolean).join(" · ")} href={j.url} />
          ))}
        </Results>
      );
    case "stack":
      return (
        <Results empty={out.result.technologies.length === 0} note={`Detected on ${out.result.domain}`}>
          {out.result.technologies.map((t) => (
            <ResultRow key={t.name} title={t.name} meta={t.category} detail={`Evidence: ${t.evidence}`} />
          ))}
        </Results>
      );
    case "web":
      return (
        <Results empty={out.result.results.length === 0}>
          {out.result.results.map((r) => (
            <ResultRow key={r.url} title={r.title} detail={r.snippet} href={r.url} />
          ))}
        </Results>
      );
    case "theirstack":
      return (
        <Results empty={out.result.jobs.length === 0}>
          {out.result.jobs.map((j) => (
            <ResultRow key={j.url} title={`${j.title} — ${j.company}`} meta={[j.location, j.postedAt?.slice(0, 10)].filter(Boolean).join(" · ")} href={j.url} />
          ))}
        </Results>
      );
    case "apify":
      return (
        <Results empty={out.result.posts.length === 0}>
          {out.result.posts.map((p) => (
            <ResultRow key={p.url} title={p.author.name} meta={`${p.likes ?? 0} likes · ${p.comments ?? 0} comments`} detail={p.text.slice(0, 200)} href={p.url} />
          ))}
        </Results>
      );
  }
}

function Results({ empty, note, children }: { empty: boolean; note?: string; children: ReactNode }) {
  return (
    <div>
      {note && <p className="mb-1 text-xs text-muted">{note}</p>}
      {empty ? <p className="text-sm text-muted">No results.</p> : <ul className="flex flex-col gap-1">{children}</ul>}
    </div>
  );
}

function ResultRow({ title, meta, detail, href }: { title: string; meta?: string; detail?: string; href?: string }) {
  return (
    <li className="py-2">
      <p className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="min-w-0 break-words">{title}</span>
        {href && (
          <a href={href} target="_blank" rel="noreferrer" className="shrink-0 rounded-full p-0.5 text-muted hover:bg-raised hover:text-ink" aria-label="Open">
            <ArrowSquareOut size={12} />
          </a>
        )}
      </p>
      {meta && <p className="mt-0.5 text-xs text-muted">{meta}</p>}
      {detail && <p className="mt-0.5 text-xs leading-relaxed break-words text-muted">{detail}</p>}
    </li>
  );
}
