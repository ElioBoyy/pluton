import { ImageSquare, Moon, Sparkle, Sun, Trash, UploadSimple } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button, Card, PageHeader } from "../components/ui.tsx";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";
import { useChannel } from "../lib/use-job-events.ts";

type Theme = "light" | "dark";
const MAX_BYTES = 15 * 1024 * 1024;

export function AppearancePage() {
  const trpc = useTRPC();
  const wallpapers = useQuery(trpc.appearance.wallpapers.queryOptions());
  return (
    <>
      <PageHeader
        title="Appearance"
        description="A picture behind the whole app, one for the light appearance and one for dark. Panels blur what sits behind them, so everything stays readable."
      />
      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 text-sm font-semibold">Wallpapers</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <WallpaperSlot theme="light" url={wallpapers.data?.light?.url ?? null} />
            <WallpaperSlot theme="dark" url={wallpapers.data?.dark?.url ?? null} />
          </div>
        </Card>
        {wallpapers.data && <GenerateCard codex={wallpapers.data.codex} />}
      </div>
    </>
  );
}

function WallpaperSlot({ theme, url }: { theme: Theme; url: string | null }) {
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
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    if (file.size > MAX_BYTES) return setError("That image is over 15 MB. Try a smaller one.");
    const reader = new FileReader();
    reader.onload = () => upload.mutate({ theme, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const Icon = theme === "light" ? Sun : Moon;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Icon size={15} className="text-muted" /> {theme === "light" ? "Light" : "Dark"}
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
        aria-label={`Choose the ${theme} wallpaper`}
        className={cn(
          "group relative aspect-video overflow-hidden rounded-xl bg-raised text-muted transition-[box-shadow,scale] duration-200 ease-out",
          "hover:text-ink motion-safe:active:scale-[0.99]",
          dragging && "ring-2 ring-accent",
          upload.isPending && "ai-glow",
        )}
      >
        {url ? (
          <img src={url} alt="" className="absolute inset-0 size-full object-cover transition-[scale] duration-500 ease-out group-hover:scale-[1.02]" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1.5 text-sm">
            <ImageSquare size={22} />
            {dragging ? "Drop it here" : "Drop an image or click to choose"}
          </span>
        )}
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden onChange={(e) => take(e.target.files?.[0])} />
      <div className="flex items-center gap-2">
        <Button variant="ghost" disabled={upload.isPending} onClick={() => input.current?.click()}>
          <UploadSimple size={14} /> {url ? "Replace" : "Choose image"}
        </Button>
        {url && (
          <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate({ theme })}>
            <Trash size={14} /> Remove
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-cat-orange">{error}</p>}
    </div>
  );
}

/** One prompt, two wallpapers: Codex draws the light one, then the same scene at night. */
function GenerateCard({ codex }: { codex: boolean }) {
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
        setStatus("Starting Codex…");
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
    if (event.type === "error") setError(payload.message ?? "Codex could not draw the wallpaper.");
    if (event.type === "done" || event.type === "error" || event.type === "cancelled") {
      setStatus(null);
      void refreshActive();
    }
  });

  const working = Boolean(jobId) || generate.isPending;
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkle size={15} weight="fill" className="text-cat-purple" /> Generate with Codex
      </h2>
      <p className="mt-1 text-sm text-muted">
        Describe a picture once. Codex draws it for the light appearance, then repaints the same scene at night for dark.
      </p>
      {codex ? (
        <form
          className="mt-4 flex flex-col gap-3"
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
            placeholder="Misty pine forest above a still lake, soft morning haze"
            className="w-full resize-none rounded-xl bg-raised px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:focus-ring disabled:opacity-60"
          />
          <div className="flex items-center gap-3">
            {working ? (
              <Button type="button" variant="ghost" disabled={!jobId || cancel.isPending} onClick={() => jobId && cancel.mutate({ jobId })}>
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={prompt.trim().length < 3}>
                <Sparkle size={14} weight="fill" /> Generate both
              </Button>
            )}
            {working && <span className="ai-text text-sm">{status ?? "Codex is drawing…"}</span>}
            {!working && <span className="text-xs text-faint">Takes a few minutes. Uses your ChatGPT plan through Codex.</span>}
          </div>
          {error && <p className="text-sm text-cat-orange">{error}</p>}
        </form>
      ) : (
        <p className="mt-4 rounded-xl bg-raised px-3.5 py-3 text-sm text-muted">
          Codex isn't installed on this computer. Install the Codex CLI and sign in with ChatGPT, then come back here:{" "}
          <code className="rounded bg-control px-1.5 py-0.5 font-mono text-xs text-ink">npm i -g @openai/codex</code>
        </p>
      )}
    </Card>
  );
}
