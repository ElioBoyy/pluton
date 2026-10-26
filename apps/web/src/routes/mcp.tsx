import { ArrowsClockwise, Check, Copy, DownloadSimple, Eye, EyeSlash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Group, PageHeader, Row, Section, Segmented, Switch, TextButton } from "../components/ui.tsx";
import { useT } from "../i18n/index.ts";
import { timeAgo } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";
import { downloadText } from "../features/leads/use-lead-actions.ts";

const CLIENTS = ["Claude Code", "Claude Desktop", "Codex"] as const;
type Client = (typeof CLIENTS)[number];

function snippet(client: Client, url: string, token: string) {
  switch (client) {
    case "Claude Code":
      return `claude mcp add --transport http pluton ${url} --header "Authorization: Bearer ${token}"`;
    case "Claude Desktop":
      return JSON.stringify({ mcpServers: { pluton: { command: "npx", args: ["-y", "mcp-remote@latest", url, "--header", `Authorization:Bearer ${token}`] } } }, null, 2);
    case "Codex":
      return `[mcp_servers.pluton]\nurl = "${url}"\nhttp_headers = { Authorization = "Bearer ${token}" }`;
  }
}

/** Where each client's snippet goes: the settings namespace's `mcp.where.<key>`. */
const WHERE = {
  "Claude Code": "claudeCode",
  "Claude Desktop": "claudeDesktop",
  Codex: "codex",
} as const satisfies Record<Client, string>;

export function McpPage() {
  const t = useT("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const info = useQuery(trpc.mcp.info.queryOptions());
  const skill = useQuery(trpc.mcp.skill.queryOptions());
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.mcp.pathKey() });
  const rotate = useMutation(trpc.mcp.rotateToken.mutationOptions({ onSuccess: refresh }));
  const pause = useMutation(trpc.mcp.setRunsPaused.mutationOptions({ onSuccess: refresh }));
  const forget = useMutation(trpc.mcp.forgetClient.mutationOptions({ onSuccess: refresh }));
  const [client, setClient] = useState<Client>("Claude Code");
  const [reveal, setReveal] = useState(false);

  if (!info.data) return null;
  const { url, token, clients, runsPaused } = info.data;
  const shown = reveal ? token : `${token.slice(0, 10)}${"•".repeat(16)}`;
  const skillUrl = url.replace("/api/mcp", "/skills/pluton/SKILL.md");

  return (
    <>
      <PageHeader title={t("mcp.title")} description={t("mcp.description")} />

      <div className="flex flex-col gap-8">
        <Section footnote={t("mcp.footnote")}>
          <Group>
            <Row>
              <span className="w-20 shrink-0 text-sm">{t("mcp.server")}</span>
              <code className="min-w-0 flex-1 truncate text-right font-mono text-xs text-muted">{url}</code>
              <CopyButton text={url} label={t("mcp.copyServerUrl")} />
            </Row>
            <Row>
              <span className="w-20 shrink-0 text-sm">{t("mcp.token")}</span>
              <code className="min-w-0 flex-1 truncate text-right font-mono text-xs text-muted">{shown}</code>
              <span className="flex shrink-0 items-center gap-0.5">
                <IconButton onClick={() => setReveal((r) => !r)} label={reveal ? t("mcp.hideToken") : t("mcp.showToken")}>
                  {reveal ? <EyeSlash size={14} /> : <Eye size={14} />}
                </IconButton>
                <CopyButton text={token} label={t("mcp.copyToken")} />
              </span>
            </Row>
            <Row label={t("mcp.newToken")} description={t("mcp.newTokenHint")}>
              <Button
                variant="ghost"
                disabled={rotate.isPending}
                onClick={() => confirm(t("mcp.newTokenConfirm")) && rotate.mutate()}
              >
                <ArrowsClockwise size={13} /> {t("mcp.newToken")}
              </Button>
            </Row>
          </Group>
        </Section>

        <Section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Segmented label={t("mcp.aiClient")} options={CLIENTS.map((c) => ({ value: c, label: c }))} value={client} onChange={setClient} />
          </div>
          <p className="mb-2 px-1 text-xs text-muted">{t(`mcp.where.${WHERE[client]}`)}</p>
          <CodeBlock text={snippet(client, url, token)} />
        </Section>

        <Section title={t("mcp.guardrails")}>
          <Group>
            <Row label={t("mcp.pauseRuns")} description={t("mcp.pauseRunsHint")}>
              <Switch checked={runsPaused} onChange={(paused) => pause.mutate({ paused })} label={t("mcp.pauseRuns")} disabled={pause.isPending} />
            </Row>
          </Group>
          <ul className="mt-2 list-disc space-y-1 pr-1 pl-5 text-xs text-muted marker:text-muted">
            <li>{t("mcp.rule.search")}</li>
            <li>{t("mcp.rule.outreach")}</li>
            <li>{t("mcp.rule.activity")}</li>
          </ul>
        </Section>

        <Section title={t("mcp.connectedClients")}>
          <Group>
            {clients.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">{t("mcp.noClients")}</p>
            ) : (
              clients.map((c) => (
                <Row
                  key={c.id}
                  label={
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="truncate font-medium">{c.name}</span>
                      {c.version && <span className="shrink-0 text-xs text-muted">{c.version}</span>}
                    </span>
                  }
                  description={
                    <span className="block truncate">
                      {c.lastTool ? t("mcp.toolCallsLast", { count: c.calls, tool: c.lastTool }) : t("mcp.toolCalls", { count: c.calls })}
                    </span>
                  }
                >
                  <span className="shrink-0 text-xs text-muted tabular-nums">{timeAgo(c.lastSeenAt)}</span>
                  <Button variant="ghost" disabled={forget.isPending} onClick={() => forget.mutate({ id: c.id })}>
                    {t("mcp.forget")}
                  </Button>
                </Row>
              ))
            )}
          </Group>
        </Section>

        <Section
          title={t("mcp.skillTitle")}
          description={t("mcp.skillDescription")}
        >
          <CodeBlock text={`mkdir -p ~/.claude/skills/pluton && curl -s ${skillUrl} -o ~/.claude/skills/pluton/SKILL.md`} />
          <div className="mt-3 px-1">
            <TextButton disabled={!skill.data} onClick={() => downloadText("SKILL.md", skill.data!, "text/markdown;charset=utf-8")}>
              <DownloadSimple size={14} /> {t("mcp.downloadSkill")}
            </TextButton>
          </div>
        </Section>
      </div>
    </>
  );
}

/** Icon-only actions: a round, muted hit area that lights on hover. */
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex rounded-full size-7 items-center justify-center text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      label={label}
    >
      {copied ? <Check size={14} weight="bold" className="text-system-green" /> : <Copy size={14} />}
    </IconButton>
  );
}

function CodeBlock({ text }: { text: string }) {
  const tc = useT("common");
  return (
    // The copy button sits beside the scrolling code, never over it.
    <Group className="flex items-start">
      <pre className="min-w-0 flex-1 overflow-x-auto py-3 pl-4 font-mono text-xs leading-relaxed">{text}</pre>
      <span className="shrink-0 p-1.5">
        <CopyButton text={text} label={tc("copy")} />
      </span>
    </Group>
  );
}
