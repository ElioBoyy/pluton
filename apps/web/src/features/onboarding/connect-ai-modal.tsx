import { ArrowSquareOut, CircleNotch, Key } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Input } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { authStateQuery, post } from "../account/auth-state.ts";

const CONSOLE_KEYS = "https://console.anthropic.com/settings/keys";
const CONSOLE_BILLING = "https://console.anthropic.com/settings/billing";

/**
 * Hosted, on the Bring your own AI plan, nothing runs before the workspace has an Anthropic API
 * key: the onboarding opens on this. It says where to make one, then saves it and proves it with a
 * real call; a key Anthropic refuses is removed again, so a saved key is always a working one.
 */
export function ConnectAiModal() {
  const t = useT("onboarding");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const auth = useQuery(authStateQuery).data;
  const settings = useQuery(trpc.settings.list.queryOptions());
  const [key, setKey] = useState("");
  const save = useMutation(trpc.settings.save.mutationOptions());
  const test = useMutation(trpc.settings.test.mutationOptions());

  const connect = useMutation({
    mutationFn: async () => {
      await save.mutateAsync({ key: "anthropic_api_key", value: key.trim() });
      const result = await test.mutateAsync({ key: "anthropic_api_key" });
      if (!result.ok) {
        await save.mutateAsync({ key: "anthropic_api_key", value: null });
        throw new Error(result.message);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.settings.list.queryKey() }),
  });
  const switchPlan = useMutation({
    mutationFn: () => post<{ url: string }>("/api/billing/portal"),
    onSuccess: ({ url }) => window.location.assign(url),
  });

  const hasKey = settings.data?.find((s) => s.key === "anthropic_api_key")?.configured;
  if (!auth?.hosted || auth.user?.plan !== "byo" || !settings.data || hasKey) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/20 px-4 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full w-full max-w-[460px] items-center py-8">
        <div role="dialog" aria-modal="true" aria-labelledby="connect-ai-title" className="glass modal-in w-full p-6 max-sm:p-5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Key size={20} weight="fill" />
          </span>
          <h2 id="connect-ai-title" className="mt-4 text-lg font-semibold">
            {t("ai.title")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("ai.intro")}</p>

          <ol className="mt-5 flex flex-col gap-3 text-sm">
            <Step n={1}>
              {t("ai.step1")}{" "}
              <a href={CONSOLE_KEYS} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-accent hover:underline">
                {t("ai.console")} <ArrowSquareOut size={12} aria-hidden />
              </a>
            </Step>
            <Step n={2}>{t("ai.step2")}</Step>
            <Step n={3}>
              {t("ai.step3")}{" "}
              <a href={CONSOLE_BILLING} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-accent hover:underline">
                {t("ai.billing")} <ArrowSquareOut size={12} aria-hidden />
              </a>
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

          <p className="mt-5 border-t border-(--gg-edge) pt-4 text-xs text-muted">
            {t("ai.preferIncluded")}{" "}
            <button type="button" onClick={() => switchPlan.mutate()} disabled={switchPlan.isPending} className="text-accent hover:underline">
              {t("ai.switchPlan")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-control text-xs font-semibold tabular-nums text-muted">{n}</span>
      <span className="min-w-0 pt-px leading-relaxed">{children}</span>
    </li>
  );
}
