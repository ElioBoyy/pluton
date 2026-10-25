import { ArrowSquareOut, CircleNotch, Envelope, LinkedinLogo } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import { useTRPC } from "../../lib/trpc.ts";
import type { AppRouter } from "@pluton/server/router";
import { cn } from "../../lib/cn.ts";

export type LeadRow = inferRouterOutputs<AppRouter>["leads"]["list"][number];

const STAGE = {
  qualified: { label: "Qualified", className: "bg-cat-green/15 text-cat-green" },
  needs_review: { label: "To review", className: "bg-cat-yellow/15 text-cat-yellow" },
  disqualified: { label: "Disqualified", className: "bg-raised text-faint" },
} as const;

const TABS = [
  { key: "all", label: "All" },
  { key: "qualified", label: "Qualified" },
  { key: "needs_review", label: "To review" },
  { key: "disqualified", label: "Disqualified" },
] as const;

/** Read-only lead list; approval, rejection with reasons and the detail drawer arrive in phase 5. */
export function LeadTable({ leads, showPlay }: { leads: LeadRow[]; showPlay?: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const shown = leads.filter((l) => (tab === "all" ? l.stage !== "disqualified" : l.stage === tab));
  const n = (k: string) => (k === "all" ? leads.filter((l) => l.stage !== "disqualified").length : leads.filter((l) => l.stage === k).length);

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn("rounded-lg px-2.5 py-1 text-sm", tab === t.key ? "bg-raised text-ink" : "text-muted hover:text-ink")}
          >
            {t.label} <span className="text-faint">{n(t.key)}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-faint">No leads here yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-faint">
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Why they fit</th>
                <th className="px-3 py-2 font-medium">Signal</th>
                <th className="px-3 py-2 font-medium">Fit</th>
                {showPlay && <th className="px-3 py-2 font-medium">Play</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.id} className="border-b border-line align-top last:border-0">
                  <td className="w-64 px-3 py-3">
                    <p className="flex items-center gap-1.5 font-medium">
                      {l.person.name}
                      {l.person.linkedinUrl && (
                        <a href={l.person.linkedinUrl} target="_blank" rel="noreferrer" aria-label="LinkedIn profile" className="text-faint hover:text-cat-blue">
                          <LinkedinLogo size={14} weight="fill" />
                        </a>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {l.person.title}
                      {l.person.company && ` · ${l.person.company}`}
                    </p>
                    <Enrich lead={l} />
                  </td>
                  <td className="px-3 py-3 text-muted">{l.reason}</td>
                  <td className="w-60 px-3 py-3 text-xs text-muted">
                    {l.signal}
                    {l.evidence.map(
                      (e, i) =>
                        e.url && (
                          <a key={i} href={e.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-faint hover:text-ink">
                            {e.label.slice(0, 40)} <ArrowSquareOut size={10} />
                          </a>
                        ),
                    )}
                  </td>
                  <td className="w-28 px-3 py-3">
                    <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", STAGE[l.stage].className)}>{STAGE[l.stage].label}</span>
                    <p className="mt-1 text-xs tabular-nums text-faint">{l.fit}/100</p>
                  </td>
                  {showPlay && <td className="px-3 py-3 text-xs text-muted">{l.playName}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Email and LinkedIn for one lead: shown when known, otherwise a button to look them up. */
function Enrich({ lead }: { lead: LeadRow }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.leads.list.queryKey() });
  const email = useMutation(trpc.leads.findEmail.mutationOptions({ onSuccess: refresh }));
  const linkedin = useMutation(trpc.leads.findLinkedin.mutationOptions({ onSuccess: refresh }));
  const p = lead.person;
  const notFound = (m: typeof email | typeof linkedin, what: string) =>
    m.isSuccess && !(m.data as { email?: string | null; url?: string | null })[what === "email" ? "email" : "url"];

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
      {p.email ? (
        <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-muted hover:text-ink">
          <Envelope size={12} /> {p.email}
        </a>
      ) : (
        <button
          disabled={email.isPending}
          onClick={() => email.mutate({ leadId: lead.id })}
          title={p.companyWebsite ? "Find a work email (Hunter)" : "Needs the company website"}
          className="flex items-center gap-1 text-faint hover:text-ink disabled:opacity-60"
        >
          {email.isPending ? <CircleNotch size={11} className="animate-spin" /> : <Envelope size={12} />}
          {notFound(email, "email") ? "No email found" : "Find email"}
        </button>
      )}
      {!p.linkedinUrl && (
        <button
          disabled={linkedin.isPending}
          onClick={() => linkedin.mutate({ leadId: lead.id })}
          className="flex items-center gap-1 text-faint hover:text-ink disabled:opacity-60"
        >
          {linkedin.isPending ? <CircleNotch size={11} className="animate-spin" /> : <LinkedinLogo size={12} />}
          {notFound(linkedin, "linkedin") ? "Not found" : "Find LinkedIn"}
        </button>
      )}
      {(email.error ?? linkedin.error) && <span className="text-cat-orange">{(email.error ?? linkedin.error)!.message}</span>}
    </div>
  );
}
