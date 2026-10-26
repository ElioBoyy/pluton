import { ArrowSquareOut, Check, CircleNotch, Copy, Key } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Button, Input, Segmented } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { authStateQuery, post } from "../account/auth-state.ts";

const CONSOLE_KEYS = "https://console.anthropic.com/settings/keys";
const CONSOLE_BILLING = "https://console.anthropic.com/settings/billing";
const INSTALL_CLAUDE_CODE = "curl -fsSL https://claude.ai/install.sh | bash";

type Way = "subscription" | "api_key";

/**
 * Nothing runs before Pluton can reach Claude, so the onboarding opens on this when it can't.
 * Hosted, on the Bring your own AI plan: the workspace's Anthropic API key. On your own computer:
 * your Claude subscription through Claude Code, or an API key. A key is saved, then proven with a
 * real call; one Anthropic refuses is removed again, so a saved key always works.
 */
export function ConnectAiModal() {
  const t = useT("onboarding");
  const trpc = useTRPC();
  const auth = useQuery(authStateQuery).data;
  // Checked again when you come back from the terminal or the console.
  const access = useQuery({ ...trpc.settings.ai.queryOptions(), refetchOnWindowFocus: true });
  const [way, setWay] = useState<Way | null>(null);

  if (!auth || !access.data || access.data.ready) return null;
  const hosted = auth.hosted;
  if (hosted && auth.user?.plan !== "byo") return null;
  const chosen: Way = hosted ? "api_key" : (way ?? access.data.backend);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/20 px-4 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full w-full max-w-[460px] items-center py-8">
        <div role="dialog" aria-modal="true" aria-labelledby="connect-ai-title" className="glass modal-in w-full min-w-0 p-6 max-sm:p-5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Key size={20} weight="fill" />
          </span>
          <h2 id="connect-ai-title" className="mt-4 text-lg font-semibold">
            {t("ai.title")}
          </h2>
          <p className="mt-2 text-sm text-muted">{hosted ? t("ai.intro") : t("ai.introLocal")}</p>

          {!hosted && (
            <div className="mt-5">
              <Segmented
                label={t("ai.title")}
                options={[
                  { value: "subscription", label: t("ai.choice.subscription") },
                  { value: "api_key", label: t("ai.choice.apiKey") },
                ]}
                value={chosen}
                onChange={(v) => setWay(v as Way)}
              />
            </div>
          )}

          {chosen === "subscription" ? <ClaudeCodeSteps installed={access.data.claudeCodeInstalled} /> : <ApiKeyForm switchBackend={!hosted && access.data.backend !== "api_key"} />}

          {hosted && <SwitchPlan />}
        </div>
      </div>
    </div>
  );
}

/** Your own computer: Claude Code installed and signed in, then a check. */
function ClaudeCodeSteps({ installed }: { installed: boolean }) {
  const t = useT("onboarding");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const save = useMutation(trpc.settings.save.mutationOptions());
  const [checked, setChecked] = useState(false);
  const check = useMutation({
    mutationFn: async () => {
      await save.mutateAsync({ key: "agent_backend", value: "subscription" });
      await queryClient.invalidateQueries({ queryKey: trpc.settings.ai.queryKey() });
      setChecked(true);
    },
  });

  return (
    <>
      <ol className="mt-5 flex flex-col gap-3 text-sm">
        <Step n={1}>
          {t("ai.sub.step1")}
          <Command text={INSTALL_CLAUDE_CODE} />
        </Step>
        <Step n={2}>{t("ai.sub.step2")}</Step>
      </ol>
      {checked && !check.isPending && (
        <p role="alert" className="mt-4 text-sm text-system-orange">
          {installed ? t("ai.sub.notSignedIn") : t("ai.sub.notInstalled")}
        </p>
      )}
      <Button type="button" onClick={() => check.mutate()} disabled={check.isPending} className="mt-5 h-9 w-full">
        {check.isPending && <CircleNotch size={14} className="animate-spin" />}
        {t("ai.sub.check")}
      </Button>
      <p className="mt-2.5 text-xs text-muted">{t("ai.sub.personal")}</p>
    </>
  );
}

/** A command to paste in a terminal: it scrolls sideways inside its box rather than widening the dialog. */
function Command({ text }: { text: string }) {
  const t = useT("onboarding");
  const [copied, setCopied] = useState(false);
  return (
    <span className="mt-2 flex min-w-0 items-center gap-2 rounded-md bg-field py-1.5 pr-1.5 pl-3 shadow-[inset_0_0_0_1px_var(--gg-edge)]">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap [scrollbar-width:none]">{text}</code>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
        aria-label={copied ? t("ai.copied") : t("ai.copy")}
        title={copied ? t("ai.copied") : t("ai.copy")}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-ink"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

/** Where to make an Anthropic API key, then the key, saved and proven. */
function ApiKeyForm({ switchBackend }: { switchBackend: boolean }) {
  const t = useT("onboarding");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const save = useMutation(trpc.settings.save.mutationOptions());
  const test = useMutation(trpc.settings.test.mutationOptions());

  const connect = useMutation({
    mutationFn: async () => {
      // On your own computer the default is the subscription: an API key means switching to it.
      if (switchBackend) await save.mutateAsync({ key: "agent_backend", value: "api_key" });
      await save.mutateAsync({ key: "anthropic_api_key", value: key.trim() });
      const result = await test.mutateAsync({ key: "anthropic_api_key" });
      if (!result.ok) {
        await save.mutateAsync({ key: "anthropic_api_key", value: null });
        throw new Error(result.message);
      }
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.settings.list.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.settings.ai.queryKey() }),
      ]),
  });

  return (
    <>
      <ol className="mt-5 flex flex-col gap-3 text-sm">
        <Step n={1}>
          {t("ai.step1")} <ExternalLink href={CONSOLE_KEYS}>{t("ai.console")}</ExternalLink>
        </Step>
        <Step n={2}>{t("ai.step2")}</Step>
        <Step n={3}>
          {t("ai.step3")} <ExternalLink href={CONSOLE_BILLING}>{t("ai.billing")}</ExternalLink>
        </Step>
      </ol>

      <form
        className="mt-6 flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          connect.mutate();
        }}
      >
        <label htmlFor="anthropic-key" className="text-sm font-medium">
          {t("ai.label")}
        </label>
        <Input
          id="anthropic-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          placeholder="sk-ant-…"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            connect.reset();
          }}
          className="h-9 font-mono"
        />
        {connect.isError && (
          <p role="alert" className="text-sm text-system-orange">
            {t("ai.invalid")}
          </p>
        )}
        <Button type="submit" disabled={connect.isPending || !key.trim()} className="mt-1 h-9 w-full">
          {connect.isPending && <CircleNotch size={14} className="animate-spin" />}
          {t("ai.submit")}
        </Button>
        <p className="text-xs text-muted">{t("ai.stored")}</p>
      </form>
    </>
  );
}

/** Hosted: those who'd rather have the AI included change plan on Stripe. */
function SwitchPlan() {
  const t = useT("onboarding");
  const switchPlan = useMutation({
    mutationFn: () => post<{ url: string }>("/api/billing/portal"),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  return (
    <p className="mt-5 border-t border-(--gg-edge) pt-4 text-xs text-muted">
      {t("ai.preferIncluded")}{" "}
      <button type="button" onClick={() => switchPlan.mutate()} disabled={switchPlan.isPending} className="text-accent hover:underline">
        {t("ai.switchPlan")}
      </button>
    </p>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-accent hover:underline">
      {children} <ArrowSquareOut size={12} aria-hidden />
    </a>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-control text-xs font-semibold tabular-nums text-muted">{n}</span>
      <span className="min-w-0 flex-1 pt-px leading-relaxed">{children}</span>
    </li>
  );
}
