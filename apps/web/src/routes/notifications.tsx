import { CheckCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Row, Section, Segmented, Switch } from "../components/ui.tsx";
import { DigestView } from "../features/activity/digest-view.tsx";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";
import { useChannel } from "../lib/use-job-events.ts";

type Settings = inferRouterOutputs<AppRouter>["notifications"]["settings"]["settings"];

const FREQUENCIES: Array<{ value: Settings["digest"]; label: string }> = [
  { value: "daily", label: "Every weekday" },
  { value: "weekly", label: "Mondays" },
  { value: "off", label: "Off" },
];

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
  const off = form.digest === "off";

  return (
    <>
      <PageHeader title="Notifications" description="What reaches the bell in the sidebar, and the morning digest." />
      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
      >
        <Section title="In the app">
          <Group>
            {data.data.categories
              .filter((c) => c.key !== "digest")
              .map((c) => (
                <Row key={c.key} label={c.label} description={c.description}>
                  <Switch checked={form.categories[c.key]} onChange={(v) => setForm({ ...form, categories: { ...form.categories, [c.key]: v } })} label={c.label} />
                </Row>
              ))}
          </Group>
        </Section>

        <Section
          title="Morning digest"
          description="What waits for you (leads to review, replies, LinkedIn steps, Brain suggestions) and what you spent. Skipped when there's nothing new."
        >
          <Group>
            <Row label="Frequency">
              <Segmented label="Frequency" size="sm" options={FREQUENCIES} value={form.digest} onChange={(digest) => setForm({ ...form, digest })} />
            </Row>
            <Row label={<label htmlFor="digest-time">At</label>} description="Your workspace timezone" className={cn(off && "opacity-50")}>
              {/* Input is w-full: the wrapper sets its width. */}
              <div className="w-28 shrink-0">
                <Input id="digest-time" type="time" value={form.digestTime} onChange={(e) => setForm({ ...form, digestTime: e.target.value })} disabled={off} />
              </div>
            </Row>
            <Row
              label="Also send it by email"
              description={
                data.data.smtpConfigured ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle size={12} weight="fill" className="text-system-green" /> SMTP is set up
                  </span>
                ) : (
                  <>
                    Needs your SMTP server in{" "}
                    <Link to="/workspace/api-keys" className="text-accent hover:underline">
                      API keys → Email
                    </Link>
                  </>
                )
              }
              className={cn(off && "opacity-50")}
            >
              <Switch checked={form.email} onChange={(v) => setForm({ ...form, email: v })} label="Email the digest" disabled={off} />
            </Row>
            {form.email && (
              <Row label={<label htmlFor="digest-to">Send to</label>} className={cn(off && "opacity-50")}>
                <div className="w-60 shrink-0 max-sm:w-40">
                  <Input id="digest-to" type="email" placeholder="you@company.com" value={form.emailTo} onChange={(e) => setForm({ ...form, emailTo: e.target.value })} required />
                </div>
              </Row>
            )}
          </Group>
          <div className="mt-3 flex items-center justify-end gap-3 px-1">
            {save.isSuccess && !dirty && <span className="text-sm text-muted">Saved</span>}
            {save.error && <span className="min-w-0 text-sm text-system-orange">{save.error.message}</span>}
            <Button type="submit" disabled={!dirty || save.isPending}>
              Save
            </Button>
          </div>
        </Section>
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
    <Section
      title="Next digest, as of now"
      description={
        failed ? (
          <span className="text-system-orange">{failed}</span>
        ) : jobId && last ? (
          `Sent${canEmail ? " to your inbox and" : ""} to the bell.`
        ) : undefined
      }
      actions={
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
      }
      className="mt-8"
    >
      {preview.data && <DigestView digest={preview.data} />}
    </Section>
  );
}
