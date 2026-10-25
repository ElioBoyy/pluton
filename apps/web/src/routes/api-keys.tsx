import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Section, Segmented } from "../components/ui.tsx";
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
      <div className="flex flex-col gap-8">
        {GROUPS.map((g) => (
          <Section key={g.id} title={g.title} description={g.description}>
            <Group>
              {(list.data ?? [])
                .filter((s) => s.group === g.id)
                .map((s) => (
                  <SettingItem key={s.key} setting={s} />
                ))}
            </Group>
          </Section>
        ))}
      </div>
    </>
  );
}

/** One setting in its own box, for pages that list a few settings apart (Integrations). */
export function SettingRow({ setting }: { setting: Setting }) {
  return (
    <Group>
      <SettingItem setting={setting} />
    </Group>
  );
}

/** One setting as a row of a Group: label and state leading, its field or choice trailing. */
export function SettingItem({ setting: s }: { setting: Setting }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const onSaved = (data: Setting[]) => queryClient.setQueryData(trpc.settings.list.queryKey(), data);
  const save = useMutation(trpc.settings.save.mutationOptions({ onSuccess: onSaved }));
  const test = useMutation(trpc.settings.test.mutationOptions({ onSuccess: setResult }));
  const testable = ["agent_backend", "anthropic_api_key", "apify_token", "hunter_api_key", "smtp_password"].includes(s.key);

  return (
    <div className="px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-56">
          <p className="flex items-center gap-1.5 text-sm">
            {s.label}
            {s.configured ? (
              <CheckCircle size={14} weight="fill" className="shrink-0 text-system-green" aria-label="Set" />
            ) : (
              <span className="rounded-full bg-control px-1.5 py-px text-xs font-medium text-muted">Not set</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted">{s.description}</p>
          {/* "Not set" is already the chip; the source line only says where a value comes from. */}
          {s.source !== "unset" && (
            <p className="mt-0.5 truncate text-xs text-muted">
              {SOURCE_LABEL[s.source]}
              {s.preview && <span className="font-mono"> · {s.preview}</span>}
            </p>
          )}
        </div>

        {s.options ? (
          <Segmented
            label={s.label}
            size="sm"
            options={s.options.map((o) => ({ value: o.value, label: o.label }))}
            value={s.value ?? ""}
            onChange={(value) => save.mutate({ key: s.key, value })}
          />
        ) : (
          <form
            className="flex shrink-0 items-center gap-2 max-sm:w-full"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ key: s.key, value: draft }, { onSuccess: () => setDraft("") });
            }}
          >
            {/* Input is w-full: the wrapper sets its width. */}
            <div className="w-52 max-sm:w-auto max-sm:flex-1">
              <Input
                type="password"
                autoComplete="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={s.configured ? "Replace key" : "Paste key"}
                aria-label={s.label}
              />
            </div>
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
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Button variant="ghost" disabled={test.isPending} onClick={() => test.mutate({ key: s.key })}>
            {test.isPending && <CircleNotch size={12} className="animate-spin" />} Test
          </Button>
          {result && (
            <span className={cn("flex min-w-0 items-center gap-1.5 text-xs", result.ok ? "text-system-green" : "text-system-orange")}>
              {result.ok ? <CheckCircle size={13} className="shrink-0" /> : <WarningCircle size={13} className="shrink-0" />} {result.message}
            </span>
          )}
        </div>
      )}
      {save.error && <p className="mt-2 text-xs text-system-orange">{save.error.message}</p>}
    </div>
  );
}
