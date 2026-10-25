import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Card, Input, PageHeader } from "../components/ui.tsx";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";

type Setting = inferRouterOutputs<AppRouter>["settings"]["list"][number];

const GROUPS = [
  { id: "claude", title: "Claude", description: "The model behind onboarding, reviews, planning and lead finding." },
  { id: "data", title: "Data sources", description: "Optional paid sources. Free sources work without any key." },
  { id: "outreach", title: "LinkedIn sending", description: "Unipile sends from your LinkedIn accounts. Without it, sequences run in manual mode." },
  { id: "email", title: "Email", description: "Sends the morning digest from your own mailbox. Optional: the digest is always in the app." },
  { id: "automation", title: "Automation", description: "What Pluton does on its own." },
] as const;

const SOURCE_LABEL: Record<string, string> = {
  app: "Saved here",
  default: "Default",
  unset: "Not set",
};

/** Keys live in the app's database (encrypted), not in .env; changes reach the worker within seconds. */
export function ApiKeysPage() {
  const trpc = useTRPC();
  const list = useQuery(trpc.settings.list.queryOptions());

  return (
    <>
      <PageHeader
        title="API keys"
        description="Stored encrypted in Pluton's local database. Takes effect within a few seconds, no restart."
      />
      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => (
          <section key={g.id}>
            <h2 className="text-sm font-semibold">{g.title}</h2>
            <p className="mb-3 text-xs text-muted">{g.description}</p>
            <div className="flex flex-col gap-2">
              {(list.data ?? [])
                .filter((s) => s.group === g.id)
                .map((s) => (
                  <SettingRow key={s.key} setting={s} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function SettingRow({ setting: s }: { setting: Setting }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const onSaved = (data: Setting[]) => queryClient.setQueryData(trpc.settings.list.queryKey(), data);
  const save = useMutation(trpc.settings.save.mutationOptions({ onSuccess: onSaved }));
  const test = useMutation(trpc.settings.test.mutationOptions({ onSuccess: setResult }));
  const testable = ["agent_backend", "anthropic_api_key", "apify_token", "hunter_api_key", "smtp_password"].includes(s.key);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {s.label}
            {s.configured ? (
              <CheckCircle size={14} weight="fill" className="text-cat-green" />
            ) : (
              <span className="text-xs font-normal text-faint">not set</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted">{s.description}</p>
          <p className="mt-1 text-xs text-faint">
            {SOURCE_LABEL[s.source]}
            {s.preview && ` · ${s.preview}`}
          </p>
        </div>

        {s.options ? (
          <div className="flex gap-1 rounded-lg border border-line p-0.5">
            {s.options.map((o) => (
              <button
                key={o.value}
                onClick={() => save.mutate({ key: s.key, value: o.value })}
                className={cn("rounded-md px-2.5 py-1 text-xs", s.value === o.value ? "bg-raised text-ink" : "text-muted hover:text-ink")}
              >
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ key: s.key, value: draft }, { onSuccess: () => setDraft("") });
            }}
          >
            <Input
              type="password"
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={s.configured ? "Replace key" : "Paste key"}
              className="w-56"
            />
            <Button type="submit" variant="ghost" disabled={!draft.trim() || save.isPending}>
              Save
            </Button>
            {s.source === "app" && (
              <Button type="button" variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ key: s.key, value: null })}>
                Remove
              </Button>
            )}
          </form>
        )}
      </div>

      {testable && s.configured && (
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <Button variant="ghost" className="h-7 text-xs" disabled={test.isPending} onClick={() => test.mutate({ key: s.key })}>
            {test.isPending && <CircleNotch size={12} className="animate-spin" />} Test
          </Button>
          {result && (
            <span className={cn("flex items-center gap-1.5 text-xs", result.ok ? "text-cat-green" : "text-cat-orange")}>
              {result.ok ? <CheckCircle size={13} /> : <WarningCircle size={13} />} {result.message}
            </span>
          )}
        </div>
      )}
      {save.error && <p className="mt-2 text-xs text-cat-orange">{save.error.message}</p>}
    </Card>
  );
}
