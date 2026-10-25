import { ArrowCounterClockwise, ImageSquare, Moon, Sparkle, Sun, Trash, UploadSimple } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button, Group, PageHeader, Row, Section } from "../components/ui.tsx";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";
import { useChannel } from "../lib/use-job-events.ts";

type Theme = "light" | "dark";
const MAX_BYTES = 15 * 1024 * 1024;

export function AppearancePage() {
  const t = useT("settings");
  const trpc = useTRPC();
  const wallpapers = useQuery(trpc.appearance.wallpapers.queryOptions());
  return (
    <>
      <PageHeader
        title={t("appearance.title")}
        description={t("appearance.description")}
      />
      <div className="flex flex-col gap-8">
        <Section title={t("appearance.wallpapers")}>
          <Group className="grid gap-x-4 gap-y-6 p-4 sm:grid-cols-2">
            <WallpaperSlot theme="light" url={wallpapers.data?.light?.url ?? null} />
            <WallpaperSlot theme="dark" url={wallpapers.data?.dark?.url ?? null} />
          </Group>
        </Section>
        {wallpapers.data && (wallpapers.data.light || wallpapers.data.dark) && <TuningSection tuning={wallpapers.data.tuning} />}
        {wallpapers.data && <GenerateSection codex={wallpapers.data.codex} />}
      </div>
    </>
  );
}

function WallpaperSlot({ theme, url }: { theme: Theme; url: string | null }) {
  const t = useT("settings");
  const tc = useT("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.appearance.wallpapers.queryKey() });
  const upload = useMutation(trpc.appearance.upload.mutationOptions({ onSuccess: refresh, onError: (e) => setError(e.message) }));
  const remove = useMutation(trpc.appearance.remove.mutationOptions({ onSuccess: refresh }));

  const take = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError(t("appearance.notAnImage"));
    if (file.size > MAX_BYTES) return setError(t("appearance.tooLarge"));
    const reader = new FileReader();
    reader.onload = () => upload.mutate({ theme, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const Icon = theme === "light" ? Sun : Moon;
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <p className="flex items-center gap-1.5 text-sm">
        <Icon size={15} className="text-muted" /> {t(`appearance.theme.${theme}`)}
      </p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files[0]);
        }}
        aria-label={t(`appearance.choose.${theme}`)}
        className={cn(
          "group relative aspect-video overflow-hidden rounded-lg bg-raised text-muted shadow-[inset_0_0_0_0.5px_var(--color-line)] transition-[box-shadow,scale] duration-200 ease-out",
          "hover:text-ink motion-safe:active:scale-[0.99]",
          dragging && "ring-2 ring-accent",
          upload.isPending && "ai-glow",
        )}
      >
        {url ? (
          <img src={url} alt="" className="absolute inset-0 size-full object-cover transition-[scale] duration-500 ease-out group-hover:scale-[1.02]" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center text-sm">
            <ImageSquare size={22} />
            {dragging ? t("appearance.dropHere") : t("appearance.dropOrClick")}
          </span>
        )}
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden onChange={(e) => take(e.target.files?.[0])} />
      <div className="flex items-center gap-2">
        <Button variant="ghost" disabled={upload.isPending} onClick={() => input.current?.click()}>
          <UploadSimple size={14} /> {url ? t("appearance.replace") : t("appearance.chooseImage")}
        </Button>
        {url && (
          <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate({ theme })}>
            <Trash size={14} /> {tc("remove")}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-system-orange">{error}</p>}
    </div>
  );
}

/** One prompt, two wallpapers: Codex draws the light one, then the same scene at night. */
function GenerateSection({ codex }: { codex: boolean }) {
  const t = useT("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useQuery(trpc.appearance.activeGeneration.queryOptions());
  const jobId = active.data?.id ?? null;
  const refreshActive = () => queryClient.invalidateQueries({ queryKey: trpc.appearance.activeGeneration.queryKey() });
  const generate = useMutation(
    trpc.appearance.generate.mutationOptions({
      onSuccess: () => {
        setError(null);
        setStatus(t("appearance.startingCodex"));
        void refreshActive();
      },
      onError: (e) => setError(e.message),
    }),
  );
  const cancel = useMutation(trpc.appearance.cancelGeneration.mutationOptions({ onSuccess: refreshActive }));

  useChannel(jobId ? `job:${jobId}` : null, (event) => {
    const payload = event.payload as { message?: string };
    if (event.type === "progress") setStatus(payload.message ?? null);
    if (event.type === "saved") void queryClient.invalidateQueries({ queryKey: trpc.appearance.wallpapers.queryKey() });
    if (event.type === "error") setError(payload.message ?? t("appearance.codexFailed"));
    if (event.type === "done" || event.type === "error" || event.type === "cancelled") {
      setStatus(null);
      void refreshActive();
    }
  });

  const working = Boolean(jobId) || generate.isPending;
  return (
    <Section
      title={
        <span className="flex items-center gap-1.5">
          <Sparkle size={14} weight="fill" className="text-system-purple" /> {t("appearance.generateTitle")}
        </span>
      }
      description={t("appearance.generateDescription")}
      footnote={codex && !working ? t("appearance.generateFootnote") : undefined}
    >
      {codex ? (
        <Group>
          <form
            className="flex flex-col gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (prompt.trim().length >= 3) generate.mutate({ prompt: prompt.trim() });
            }}
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={working}
              aria-label={t("appearance.promptLabel")}
              placeholder={t("appearance.promptPlaceholder")}
              className="w-full resize-none rounded-md border border-line bg-canvas px-2.5 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-faint focus:border-accent/60 focus:focus-ring disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center justify-end gap-3">
              {working && <span className="ai-text mr-auto min-w-0 text-sm">{status ?? t("appearance.drawing")}</span>}
              {error && <p className="mr-auto min-w-0 text-sm text-system-orange">{error}</p>}
              {working ? (
                <Button type="button" variant="ghost" disabled={!jobId || cancel.isPending} onClick={() => jobId && cancel.mutate({ jobId })}>
                  {t("appearance.stop")}
                </Button>
              ) : (
                <Button type="submit" disabled={prompt.trim().length < 3}>
                  <Sparkle size={14} weight="fill" /> {t("appearance.generateBoth")}
                </Button>
              )}
            </div>
          </form>
        </Group>
      ) : (
        <Group className="px-4 py-3.5 text-sm text-muted">
          {t.rich("appearance.codexMissing", {
            command: <code className="rounded-md bg-control px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-ink">npm i -g @openai/codex</code>,
          })}
        </Group>
      )}
    </Section>
  );
}

type Tuning = { blur: number; saturation: number; veil: number };
/** The look the app ships with; "Restore defaults" brings these back. */
const FACTORY: Tuning = { blur: 80, saturation: 80, veil: 50 };

/** Blur, colour and veil of the wallpaper. Changes show live and are saved when you let go. */
function TuningSection({ tuning }: { tuning: Tuning }) {
  const t = useT("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const key = trpc.appearance.wallpapers.queryKey();
  const save = useMutation(trpc.appearance.tune.mutationOptions({ onSettled: () => queryClient.invalidateQueries({ queryKey: key }) }));
  // Write into the cache first, so the wallpaper behind this page follows the slider as it moves.
  const preview = (next: Tuning) => queryClient.setQueryData(key, (old) => (old ? { ...old, tuning: next } : old));
  const isFactory = tuning.blur === FACTORY.blur && tuning.saturation === FACTORY.saturation && tuning.veil === FACTORY.veil;
  const slider = (field: keyof Tuning, max: number, unit: string, label: string, hint?: string) => (
    <Row label={label} description={hint}>
      <input
        type="range"
        min={0}
        max={max}
        value={tuning[field]}
        aria-label={label}
        onChange={(e) => preview({ ...tuning, [field]: Number(e.target.value) })}
        onPointerUp={(e) => save.mutate({ ...tuning, [field]: Number(e.currentTarget.value) })}
        onKeyUp={(e) => save.mutate({ ...tuning, [field]: Number(e.currentTarget.value) })}
        className="w-48 accent-accent"
      />
      <span className="w-12 text-right text-sm text-muted tabular-nums">
        {tuning[field]}
        {unit}
      </span>
    </Row>
  );
  return (
    <Section
      title={t("appearance.tuning")}
      description={t("appearance.tuningHint")}
      actions={
        <Button
          variant="ghost"
          disabled={isFactory || save.isPending}
          onClick={() => {
            preview(FACTORY);
            save.mutate(null);
          }}
        >
          <ArrowCounterClockwise size={13} /> {t("appearance.reset")}
        </Button>
      }
    >
      <Group>
        {slider("blur", 120, " px", t("appearance.blur"))}
        {slider("saturation", 200, " %", t("appearance.saturation"))}
        {slider("veil", 90, " %", t("appearance.veil"), t("appearance.veilHint"))}
      </Group>
    </Section>
  );
}
