import { CheckCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Row, Section, Segmented, Switch } from "../components/ui.tsx";
import { DigestView } from "../features/activity/digest-view.tsx";
import { FIELD } from "./settings.tsx";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";
import { useChannel } from "../lib/use-job-events.ts";
import { TimePicker } from "../components/time-picker.tsx";

type Settings = inferRouterOutputs<AppRouter>["notifications"]["settings"]["settings"];

/** Each option's name is the activity namespace's `digest.<value>` string. */
const FREQUENCIES: Array<Settings["digest"]> = ["daily", "weekly", "off"];

export function NotificationsPage() {
  const t = useT("activity");
  const tc = useT("common");
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
      <PageHeader title={t("notifications.title")} description={t("notifications.description")} />
      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
      >
        <Section title={t("notifications.inApp")}>
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
          title={t("digest.title")}
          description={t("digest.description")}
        >
          <Group>
            <Row label={t("digest.frequency")}>
              <Segmented
                label={t("digest.frequency")}
                size="sm"
                options={FREQUENCIES.map((value) => ({ value, label: t(`digest.${value}`) }))}
                value={form.digest}
                onChange={(digest) => setForm({ ...form, digest })}
              />
            </Row>
            <Row label={<label htmlFor="digest-time">{t("digest.at")}</label>} description={t("digest.atHint")} className={cn(off && "opacity-50")}>
              <div className="w-28 shrink-0">
                <TimePicker id="digest-time" value={form.digestTime} onChange={(digestTime) => setForm({ ...form, digestTime })} disabled={off} />
              </div>
            </Row>
            <Row
              label={t("digest.email")}
              description={
                data.data.smtpConfigured ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle size={12} weight="fill" className="text-system-green" /> {t("digest.smtpReady")}
                  </span>
                ) : (
                  t.rich("digest.smtpNeeded", {
                    link: (
                      <Link to="/workspace/api-keys" className="text-accent hover:underline">
                        {t("digest.smtpLink")}
                      </Link>
                    ),
                  })
                )
              }
              className={cn(off && "opacity-50")}
            >
              <Switch checked={form.email} onChange={(v) => setForm({ ...form, email: v })} label={t("digest.emailSwitch")} disabled={off} />
            </Row>
            {form.email && (
              <Row label={<label htmlFor="digest-to">{t("digest.sendTo")}</label>} className={cn(off && "opacity-50")}>
                <div className={FIELD}>
                  <Input id="digest-to" type="email" placeholder={t("digest.emailPlaceholder")} value={form.emailTo} onChange={(e) => setForm({ ...form, emailTo: e.target.value })} required />
                </div>
              </Row>
            )}
          </Group>
          <div className="mt-3 flex items-center justify-end gap-3 px-1">
            {save.isSuccess && !dirty && <span className="text-sm text-muted">{tc("saved")}</span>}
            {save.error && <span className="min-w-0 text-sm text-system-orange">{save.error.message}</span>}
            <Button type="submit" disabled={!dirty || save.isPending}>
              {tc("save")}
            </Button>
          </div>
        </Section>
      </form>

      <DigestPreview canEmail={saved.email && Boolean(saved.emailTo) && data.data.smtpConfigured} />
    </>
  );
}

function DigestPreview({ canEmail }: { canEmail: boolean }) {
  const t = useT("activity");
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
  const failed = last?.type === "error" ? (last.message ?? t("preview.failed")) : null;

  return (
    <Section
      title={t("preview.title")}
      description={
        failed ? (
          <span className="text-system-orange">{failed}</span>
        ) : jobId && last ? (
          canEmail ? t("preview.sentInbox") : t("preview.sentBell")
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
          {canEmail ? t("preview.sendNow") : t("preview.putInApp")}
        </Button>
      }
      className="mt-8"
    >
      {preview.data && <DigestView digest={preview.data} />}
    </Section>
  );
}
