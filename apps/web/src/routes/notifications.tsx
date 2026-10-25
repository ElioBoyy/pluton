import { CheckCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Card, Input, PageHeader } from "../components/ui.tsx";
import { DigestView } from "../features/activity/digest-view.tsx";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";
import { useChannel } from "../lib/use-job-events.ts";

type Settings = inferRouterOutputs<AppRouter>["notifications"]["settings"]["settings"];

export function NotificationsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const data = useQuery(trpc.notifications.settings.queryOptions());
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (data.data) setForm(data.data.settings);
  }, [data.data]);
  const save = useMutation(
    trpc.notifications.saveSettings.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.notifications.settings.queryKey() }),
    }),
  );

  if (!data.data || !form) return null;
  const saved = data.data.settings;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  return (
    <>
      <PageHeader title="Notifications" description="What reaches the bell in the sidebar, and the morning digest." />
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
      >
        <Card>
          <h2 className="mb-3 text-sm font-semibold">In the app</h2>
          <ul className="flex flex-col divide-y divide-line">
            {data.data.categories
              .filter((c) => c.key !== "digest")
              .map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-4 py-2.5">
                  <span>
                    <span className="block text-sm">{c.label}</span>
                    <span className="block text-xs text-muted">{c.description}</span>
                  </span>
                  <Toggle checked={form.categories[c.key]} onChange={(v) => setForm({ ...form, categories: { ...form.categories, [c.key]: v } })} label={c.label} />
                </li>
              ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold">Morning digest</h2>
          <p className="mb-4 text-xs text-muted">What waits for you (leads to review, replies, LinkedIn steps, Brain suggestions) and what you spent. Skipped when there's nothing new.</p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Frequency</span>
              <select
                value={form.digest}
                onChange={(e) => setForm({ ...form, digest: e.target.value as Settings["digest"] })}
                className="h-7 rounded-md border border-line bg-canvas px-2 text-sm outline-none focus:focus-ring"
              >
                <option value="daily">Every weekday</option>
                <option value="weekly">Mondays</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">At</span>
              <Input type="time" className="w-28" value={form.digestTime} onChange={(e) => setForm({ ...form, digestTime: e.target.value })} disabled={form.digest === "off"} />
            </label>
            <span className="pb-1.5 text-xs text-faint">Your workspace timezone</span>
          </div>

          <div className={cn("mt-5 flex flex-col gap-3 border-t border-line pt-4", form.digest === "off" && "opacity-50")}>
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm">Also send it by email</span>
                <span className="block text-xs text-muted">
                  {data.data.smtpConfigured ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" className="text-cat-green" /> SMTP is set up
                    </span>
                  ) : (
                    <>
                      Needs your SMTP server in{" "}
                      <Link to="/workspace/api-keys" className="text-accent hover:underline">
                        API keys → Email
                      </Link>
                    </>
                  )}
                </span>
              </span>
              <Toggle checked={form.email} onChange={(v) => setForm({ ...form, email: v })} label="Email the digest" disabled={form.digest === "off"} />
            </label>
            {form.email && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Send to</span>
                <Input type="email" placeholder="you@company.com" value={form.emailTo} onChange={(e) => setForm({ ...form, emailTo: e.target.value })} required />
              </label>
            )}
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || save.isPending}>
            Save
          </Button>
          {save.isSuccess && !dirty && <span className="text-sm text-muted">Saved</span>}
          {save.error && <span className="text-sm text-cat-orange">{save.error.message}</span>}
        </div>
      </form>

      <DigestPreview canEmail={saved.email && Boolean(saved.emailTo) && data.data.smtpConfigured} />
    </>
  );
}

function DigestPreview({ canEmail }: { canEmail: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const preview = useQuery(trpc.notifications.previewDigest.queryOptions());
  const [jobId, setJobId] = useState<string | null>(null);
  const send = useMutation(trpc.notifications.sendDigestNow.mutationOptions({ onSuccess: (job) => setJobId(job.id) }));
  const [last, setLast] = useState<{ type: string; message?: string } | null>(null);
  useChannel(jobId ? `job:${jobId}` : null, (e) => {
    if (e.type !== "done" && e.type !== "error") return;
    setLast({ type: e.type, message: (e.payload as { message?: string }).message });
    void queryClient.invalidateQueries({ queryKey: trpc.notifications.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.activity.pathKey() });
  });
  const failed = last?.type === "error" ? (last.message ?? "Failed") : null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Next digest, as of now</h2>
        <Button
          variant="ghost"
          disabled={send.isPending || (jobId !== null && !last)}
          onClick={() => {
            setLast(null);
            send.mutate();
          }}
        >
          {canEmail ? "Send it now" : "Put it in the app now"}
        </Button>
      </div>
      {jobId && last && !failed && <p className="mb-3 text-xs text-muted">Sent{canEmail ? " to your inbox and" : ""} to the bell.</p>}
      {failed && <p className="mb-3 text-xs text-cat-orange">{failed}</p>}
      {preview.data && <DigestView digest={preview.data} />}
    </section>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50", checked ? "bg-system-green" : "bg-control-pressed")}
    >
      <span className={cn("absolute top-[2px] size-[18px] rounded-full bg-white shadow-control left-[2px] transition-[translate] duration-200 ease-[var(--ease-drawer)]", checked && "translate-x-4")} />
    </button>
  );
}
