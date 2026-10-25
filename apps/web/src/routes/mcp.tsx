import { Check, Copy, DownloadSimple, Eye, EyeSlash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, PageHeader } from "../components/ui.tsx";
import { cn } from "../lib/cn.ts";
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

const WHERE: Record<Client, string> = {
  "Claude Code": "Run it in a terminal.",
  "Claude Desktop": "Merge into claude_desktop_config.json (Settings → Developer → Edit config), then restart Claude Desktop. Needs Node.",
  Codex: "Add to ~/.codex/config.toml.",
};

export function McpPage() {
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
      <PageHeader title="Connect your AI" description="Ask Claude or Codex about your leads and Plays, and let them act on them, through Pluton's local MCP server." />

      <Card className="mb-6">
        <div className="mb-4 grid gap-3 sm:grid-cols-[6rem_1fr] sm:items-center">
          <span className="text-sm text-muted">Server</span>
          <code className="truncate text-sm">{url}</code>
          <span className="text-sm text-muted">Token</span>
          <span className="flex min-w-0 items-center gap-2">
            <code className="truncate text-sm">{shown}</code>
            <button onClick={() => setReveal((r) => !r)} className="rounded p-1 text-faint hover:bg-raised hover:text-ink" aria-label={reveal ? "Hide token" : "Show token"}>
              {reveal ? <EyeSlash size={14} /> : <Eye size={14} />}
            </button>
            <CopyButton text={token} label="Copy token" />
            <button
              onClick={() => confirm("Make a new token? Every connected client stops working until you set it up again.") && rotate.mutate()}
              className="ml-auto text-xs text-muted hover:text-ink"
            >
              New token
            </button>
          </span>
        </div>

        <div className="mb-2 flex gap-1" role="tablist">
          {CLIENTS.map((c) => (
            <button key={c} role="tab" aria-selected={client === c} onClick={() => setClient(c)} className={cn("h-7 rounded-md px-3 text-sm", client === c ? "bg-selected font-medium" : "text-muted hover:bg-raised hover:text-ink")}>
              {c}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-muted">{WHERE[client]}</p>
        <CodeBlock text={snippet(client, url, token)} />
        <p className="mt-3 text-xs text-faint">Local only: the server answers on this machine and checks the token on every call. Anything that can read your config files can use it.</p>
      </Card>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Guardrails</h2>
        <Card className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              Pause searches started from AI clients
              <span className="block text-xs text-muted">Clients can still read everything and review leads.</span>
            </span>
            <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={runsPaused} onChange={(e) => pause.mutate({ paused: e.target.checked })} />
          </label>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
            <li>A search shows its expected cost and the budget left first; it starts only when called again with an explicit confirmation. Your monthly budget still applies.</li>
            <li>Adding people to a LinkedIn sequence or exporting them to a CRM also needs an explicit confirmation, for those people.</li>
            <li>Everything a client does shows up in Activity.</li>
          </ul>
        </Card>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Connected clients</h2>
        {clients.length === 0 ? (
          <Card className="text-sm text-muted">No clients yet. The first one to connect appears here.</Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-medium">
                      {c.name}
                      {c.version && <span className="ml-1.5 text-xs font-normal text-faint">{c.version}</span>}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {c.calls} tool call{c.calls === 1 ? "" : "s"}
                      {c.lastTool && <span className="text-faint"> · last {c.lastTool}</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-faint">{timeAgo(c.lastSeenAt)}</td>
                    <td className="pr-3 text-right">
                      <button onClick={() => forget.mutate({ id: c.id })} className="text-xs text-muted hover:text-ink">
                        Forget
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Claude Code skill</h2>
        <p className="mb-3 text-xs text-muted">Teaches Claude how to work with Pluton: the morning check, reviewing leads, running Plays with the cost first, sequences, the Brain and spend.</p>
        <CodeBlock text={`mkdir -p ~/.claude/skills/pluton && curl -s ${skillUrl} -o ~/.claude/skills/pluton/SKILL.md`} />
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" disabled={!skill.data} onClick={() => downloadText("SKILL.md", skill.data!, "text/markdown;charset=utf-8")}>
            <DownloadSimple size={14} /> Download SKILL.md
          </Button>
        </div>
      </section>
    </>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded p-1 text-faint hover:bg-raised hover:text-ink"
      aria-label={label}
    >
      {copied ? <Check size={14} className="text-cat-green" /> : <Copy size={14} />}
    </button>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-raised p-3 pr-10 text-xs leading-relaxed">{text}</pre>
      <span className="absolute top-2 right-2">
        <CopyButton text={text} label="Copy" />
      </span>
    </div>
  );
}
