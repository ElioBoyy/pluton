import { ArrowSquareOut, ArrowUpRight, BookOpen, Code, DownloadSimple, EnvelopeSimple, LinkedinLogo, ListMagnifyingGlass, MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { PlutonLogo } from "../../components/logo.tsx";
import { Group, Input, PageHeader, Section } from "../../components/ui.tsx";
import { Wallpaper } from "../../components/wallpaper.tsx";
import { useT, type MessageKey } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { MAIL_PROVIDERS, MICROSOFT_SOURCES, type MailProvider } from "../../lib/mail-providers.ts";
import { CodeBlock } from "../../routes/mcp.tsx";

/*
 * /docs: open to anyone, signed in or not, so it never calls the app's RPC (which sends a signed-out
 * visitor to the sign-in page). The API reference reads GET /api/v1, which answers without a key.
 */

const NAV = [
  { group: "nav.guides", items: [{ to: "/docs", key: "nav.home", icon: BookOpen }, { to: "/docs/email", key: "nav.email", icon: EnvelopeSimple }, { to: "/docs/linkedin", key: "nav.linkedin", icon: LinkedinLogo }] },
  { group: "nav.api", items: [{ to: "/docs/api", key: "nav.apiStart", icon: Code }, { to: "/docs/reference", key: "nav.reference", icon: ListMagnifyingGlass }] },
] as const;

const apiBase = () => `${window.location.origin}/api/v1`;

/** The app's window over Pluto, with the docs' own sidebar: the same frame as the app itself. */
function DocsLayout({ children }: { children: ReactNode }) {
  const t = useT("docs");
  return (
    <div className="flex h-full p-2 max-md:p-0">
      <Wallpaper defaultOnly />
      <div className="relative flex min-w-0 flex-1 rounded-[var(--gg-r-window)] [corner-shape:squircle] max-md:flex-col max-md:rounded-none">
        <div aria-hidden className="gg-window pointer-events-none absolute inset-0 max-md:rounded-none" />
        <aside className="relative flex w-60 shrink-0 flex-col rounded-[calc(var(--gg-r-window)-8px)] bg-control shadow-[inset_0_0_0_1px_var(--gg-rim-low)] [corner-shape:squircle] md:m-2 md:mr-0 max-md:w-full max-md:rounded-none max-md:shadow-none">
          <Link to="/docs" className="flex h-12 items-center gap-2 px-4 pt-2">
            <PlutonLogo className="h-[18px]" />
            <span className="text-sm text-muted">{t("nav.title")}</span>
          </Link>
          <nav className="flex flex-col gap-4 px-2 pt-3 pb-3 max-md:flex-row max-md:flex-wrap max-md:gap-1 max-md:pt-1">
            {NAV.map(({ group, items }) => (
              <div key={group} className="flex flex-col gap-0.5 max-md:flex-row max-md:flex-wrap">
                <p className="px-2.5 pb-1 text-xs font-medium text-faint max-md:hidden">{t(group)}</p>
                {items.map(({ to, key, icon: Icon }) => (
                  <Link key={to} to={to} activeOptions={{ exact: true }} className="gg-side-item min-h-8 gap-2.5 text-sm font-medium">
                    <Icon size={16} />
                    <span className="flex-1">{t(key)}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="mt-auto p-2 max-md:hidden">
            <Link to="/home" className="gg-side-item min-h-8 gap-2.5 text-sm text-muted hover:text-ink">
              <ArrowUpRight size={16} />
              {t("nav.back")}
            </Link>
          </div>
        </aside>
        <main className="relative min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** A link out of Pluton, marked as such. */
function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
      {children}
      <ArrowSquareOut size={12} className="shrink-0" />
    </a>
  );
}

function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 text-[15px] leading-relaxed text-pretty", className)}>{children}</div>;
}

// ── Overview ───────────────────────────────────────────────────────────────

export function DocsHomePage() {
  const t = useT("docs");
  const cards = [
    { to: "/docs/email", title: t("nav.email"), body: t("home.email"), icon: EnvelopeSimple },
    { to: "/docs/linkedin", title: t("nav.linkedin"), body: t("home.linkedin"), icon: LinkedinLogo },
    { to: "/docs/api", title: t("nav.apiStart"), body: t("home.api"), icon: Code },
    { to: "/docs/reference", title: t("ref.title"), body: t("home.reference"), icon: ListMagnifyingGlass },
  ] as const;
  return (
    <DocsLayout>
      <PageHeader title={t("home.title")} description={t("home.description")} />
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ to, title, body, icon: Icon }) => (
          <Link key={to} to={to} className="gg-card flex flex-col gap-2 p-4 transition-colors duration-150 hover:bg-panel-hover">
            <Icon size={20} className="text-accent" />
            <span className="text-sm font-semibold">{title}</span>
            <span className="text-sm text-muted">{body}</span>
          </Link>
        ))}
      </div>
    </DocsLayout>
  );
}

// ── LinkedIn extension guide ───────────────────────────────────────────────

/** Made by this server, set to talk to it (apps/server/src/linkedin-extension.ts). */
const EXTENSION_ZIP = "/api/extension/linkedin/download";

export function DocsLinkedinPage() {
  const t = useT("docs");
  const steps = [1, 2, 3, 4, 5, 6] as const;
  return (
    <DocsLayout>
      <PageHeader title={t("li.title")} description={t("li.description")} />
      <div className="flex flex-col gap-10">
        <Section title={t("li.what.title")}>
          <Prose>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>{t("li.what.steps")}</li>
              <li>{t("li.what.tasks")}</li>
              <li>{t("li.what.open")}</li>
            </ul>
          </Prose>
        </Section>

        <Section title={t("li.install.title")} description={t("li.install.description")}>
          <a href={EXTENSION_ZIP} download className="mb-5 inline-flex h-9 w-fit self-start items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-white hover:opacity-90">
            <DownloadSimple size={16} /> {t("li.download")}
          </a>
          <ol className="flex flex-col gap-4">
            {steps.map((n) => (
              <li key={n} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-selected text-xs font-semibold text-accent tabular-nums">{n}</span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{t(`li.step${n}.title`)}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-muted">{t(`li.step${n}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link to="/workspace/linkedin" className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline">
            {t("li.openSettings")} <ArrowUpRight size={12} />
          </Link>
        </Section>

        <Section title={t("li.update.title")}>
          <Prose>
            <p>{t("li.update.body")}</p>
          </Prose>
        </Section>

        <Section title={t("li.limits.title")}>
          <Prose>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>{t("li.limits.chrome")}</li>
              <li>{t("li.limits.accepted")}</li>
              <li>
                {t("li.limits.risk")} <External href="https://www.linkedin.com/help/linkedin/answer/a1341387">{t("li.limits.riskLink")}</External>
              </li>
            </ul>
          </Prose>
        </Section>
      </div>
    </DocsLayout>
  );
}

// ── Mailbox guide ──────────────────────────────────────────────────────────

const USER_KEY: Record<MailProvider["id"], MessageKey<"docs">> = { gmail: "email.user.full", icloud: "email.user.icloud", fastmail: "email.user.full", ovh: "email.user.full" };
const PASSWORD_KEY: Record<MailProvider["id"], MessageKey<"docs">> = {
  gmail: "email.password.app",
  icloud: "email.password.appSpecific",
  fastmail: "email.password.app",
  ovh: "email.password.mailbox",
};
const NOTE_KEY: Partial<Record<MailProvider["id"], MessageKey<"docs">>> = { gmail: "email.note.gmail", fastmail: "email.note.fastmail" };

export function DocsEmailPage() {
  const t = useT("docs");
  const steps = [1, 2, 3] as const;
  return (
    <DocsLayout>
      <PageHeader title={t("email.title")} description={t("email.description")} />
      <div className="flex flex-col gap-10">
        <Section title={t("email.what.title")}>
          <Prose>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>{t("email.what.smtp")}</li>
              <li>{t("email.what.imap")}</li>
              <li className="text-muted">{t("email.what.digest")}</li>
            </ul>
          </Prose>
        </Section>

        <Section title={t("email.steps.title")}>
          <ol className="flex flex-col gap-4">
            {steps.map((n) => (
              <li key={n} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-selected text-xs font-semibold text-accent tabular-nums">{n}</span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{t(`email.step${n}.title`)}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-muted">{t(`email.step${n}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link to="/workspace/api-keys" hash="email" className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline">
            {t("email.openSettings")} <ArrowUpRight size={12} />
          </Link>
        </Section>

        <Section title={t("email.providers.title")} description={t("email.providers.description")}>
          <div className="flex flex-col gap-3">
            {MAIL_PROVIDERS.map((p) => (
              <Group key={p.id} className="p-4">
                <p className="text-[15px] font-semibold">{p.name}</p>
                <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-sm @lg:grid-cols-2">
                  <Setting label={t("email.col.smtp")} value={`${p.smtp.host} · ${p.smtp.port}`} mono />
                  <Setting label={t("email.col.imap")} value={`${p.imap.host} · ${p.imap.port}`} mono />
                  <Setting label={t("email.col.user")} value={t(USER_KEY[p.id])} />
                  <Setting
                    label={t("email.col.password")}
                    value={
                      <>
                        {t(PASSWORD_KEY[p.id])}
                        {p.passwordUrl && (
                          <>
                            {" · "}
                            <External href={p.passwordUrl}>{t("email.password.create")}</External>
                          </>
                        )}
                      </>
                    }
                  />
                </dl>
                {NOTE_KEY[p.id] && <p className="mt-3 text-xs text-muted">{t(NOTE_KEY[p.id]!)}</p>}
              </Group>
            ))}
            <div className="flex items-start gap-3 rounded-lg bg-system-orange/10 px-4 py-3 text-sm">
              <WarningCircle size={18} weight="fill" className="mt-px shrink-0 text-system-orange" />
              <div>
                <p className="font-medium">{t("email.microsoft.title")}</p>
                <p className="mt-0.5 text-muted">{t("email.microsoft.body")}</p>
              </div>
            </div>
          </div>
        </Section>

        <Section title={t("email.ports.title")}>
          <Group>
            {(["465", "587", "993"] as const).map((port) => (
              <div key={port} className="flex items-baseline gap-4 px-4 py-3 text-sm not-last:shadow-[inset_0_-1px_0_var(--color-line)]">
                <code className="w-10 shrink-0 font-mono font-semibold">{port}</code>
                <span className="text-muted">{t(`email.ports.${port}`)}</span>
              </div>
            ))}
          </Group>
        </Section>

        <Section title={t("email.trouble.title")}>
          <Prose>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>{t("email.trouble.auth")}</li>
              <li>{t("email.trouble.timeout")}</li>
              <li>{t("email.trouble.limit")}</li>
            </ul>
          </Prose>
        </Section>

        <Section title={t("email.sources")}>
          <ul className="flex flex-col gap-1.5 text-xs break-all">
            {[...MAIL_PROVIDERS.flatMap((p) => p.sources.map((url) => ({ name: p.name, url }))), ...MICROSOFT_SOURCES.map((url) => ({ name: "Microsoft", url }))].map(
              ({ name, url }) => (
                <li key={url}>
                  <span className="text-muted">{name} · </span>
                  <External href={url}>{url.replace(/^https:\/\//, "")}</External>
                </li>
              ),
            )}
          </ul>
        </Section>
      </div>
    </DocsLayout>
  );
}

function Setting({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("mt-0.5 break-words", mono && "font-mono text-[13px]")}>{value}</dd>
    </div>
  );
}

// ── API: getting started ───────────────────────────────────────────────────

const ERRORS = ["400", "401", "402", "403", "404", "405", "429"] as const;

export function DocsApiPage() {
  const t = useT("docs");
  const base = apiBase();
  const examples = [
    `curl ${base}/workspace.current \\\n  -H "Authorization: Bearer <key>"`,
    `curl -G ${base}/leads.list \\\n  -H "Authorization: Bearer <key>" \\\n  --data-urlencode 'input={"tab":"to_review","limit":20}'`,
    `curl -X POST ${base}/leads.review \\\n  -H "Authorization: Bearer <key>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"leadIds":["…"],"verdict":"up"}'`,
  ].join("\n\n");
  return (
    <DocsLayout>
      <PageHeader title={t("api.title")} description={t("api.description")} />
      <div className="flex flex-col gap-10">
        <Section title={t("api.address")}>
          <CodeBlock text={base} />
        </Section>
        <Section title={t("api.auth.title")}>
          <Prose>
            <p>{t("api.auth.body")}</p>
          </Prose>
          <div className="mt-3">
            <CodeBlock text="Authorization: Bearer pluton_sk_…" />
          </div>
          <Prose className="mt-3 text-muted">
            <p>{t("api.auth.scope")}</p>
          </Prose>
          <Link to="/workspace/api" className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline">
            {t("api.openKeys")} <ArrowUpRight size={12} />
          </Link>
        </Section>
        <Section title={t("api.call.title")}>
          <Prose>
            <p>{t("api.call.body")}</p>
          </Prose>
        </Section>
        <Section title={t("api.answer.title")}>
          <Prose>
            <p>{t("api.answer.body")}</p>
          </Prose>
        </Section>
        <Section title={t("api.errors.title")}>
          <Group>
            {ERRORS.map((code) => (
              <div key={code} className="flex items-baseline gap-4 px-4 py-3 text-sm not-last:shadow-[inset_0_-1px_0_var(--color-line)]">
                <code className="w-10 shrink-0 font-mono font-semibold">{code}</code>
                <span className="text-muted">{t(`api.error.${code}`)}</span>
              </div>
            ))}
          </Group>
        </Section>
        <Section title={t("api.examples")}>
          <CodeBlock text={examples} />
        </Section>
      </div>
    </DocsLayout>
  );
}

// ── API reference ──────────────────────────────────────────────────────────

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  description?: string;
};
type Procedure = { path: string; method: "GET" | "POST"; permission: string; input: JsonSchema | null };

function typeLabel(s: JsonSchema | undefined): string {
  if (!s) return "any";
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.anyOf) return [...new Set(s.anyOf.map(typeLabel))].join(" | ");
  if (s.type === "array") {
    const item = typeLabel(s.items);
    return item.includes(" | ") ? `(${item})[]` : `${item}[]`;
  }
  if (Array.isArray(s.type)) return s.type.join(" | ");
  return s.type ?? "any";
}

/** A value of the right shape for an example: the first allowed value, or a placeholder. */
function sample(s: JsonSchema | undefined): unknown {
  if (!s) return null;
  if (s.enum) return s.enum[0];
  if (s.const !== undefined) return s.const;
  if (s.anyOf) return sample(s.anyOf.find((x) => x.type !== "null") ?? s.anyOf[0]);
  const type = Array.isArray(s.type) ? s.type.find((x) => x !== "null") : s.type;
  if (type === "string") return "…";
  if (type === "number" || type === "integer") return 1;
  if (type === "boolean") return true;
  if (type === "array") return [sample(s.items)];
  if (type === "object") return Object.fromEntries((s.required ?? []).map((k) => [k, sample(s.properties?.[k])]));
  return null;
}

function example(p: Procedure) {
  const base = apiBase();
  const input = p.input ? sample(p.input) : undefined;
  const body = input && typeof input === "object" && Object.keys(input).length > 0 ? JSON.stringify(input) : null;
  if (p.method === "GET") {
    return `curl ${body ? "-G " : ""}${base}/${p.path} \\\n  -H "Authorization: Bearer <key>"${body ? ` \\\n  --data-urlencode 'input=${body}'` : ""}`;
  }
  return `curl -X POST ${base}/${p.path} \\\n  -H "Authorization: Bearer <key>"${body ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'` : ""}`;
}

export function DocsReferencePage() {
  const t = useT("docs");
  const ta = useT("access");
  const [query, setQuery] = useState("");
  const list = useQuery({
    queryKey: ["docs", "api-v1"],
    queryFn: async () => {
      const res = await fetch("/api/v1");
      if (!res.ok) throw new Error(res.statusText);
      return ((await res.json()) as { procedures: Procedure[] }).procedures;
    },
    staleTime: 5 * 60_000,
  });

  const areas = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<string, Procedure[]>();
    for (const p of list.data ?? []) {
      if (q && !p.path.toLowerCase().includes(q) && !ta(`perm.${p.permission}` as MessageKey<"access">).toLowerCase().includes(q)) continue;
      const area = p.permission.split(":")[0]!;
      groups.set(area, [...(groups.get(area) ?? []), p]);
    }
    return [...groups];
  }, [list.data, query, ta]);

  return (
    <DocsLayout>
      <PageHeader title={t("ref.title")} description={list.data ? t("ref.description", { count: list.data.length }) : undefined} />
      {list.isPending && <p className="text-sm text-muted">{t("ref.loading")}</p>}
      {list.isError && <p className="text-sm text-system-orange">{t("ref.error")}</p>}
      {list.data && (
        <>
          <div className="relative mb-4">
            <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("ref.search")} aria-label={t("ref.search")} className="pl-8" />
          </div>
          {/* Jump links to each area, in the order the actions come. */}
          <nav className="mb-8 flex flex-wrap gap-1.5">
            {areas.map(([area]) => (
              <a key={area} href={`#area-${area}`} className="rounded-full bg-control px-2.5 py-1 text-xs text-muted transition-colors duration-150 hover:text-ink">
                {ta(`area.${area}` as MessageKey<"access">)}
              </a>
            ))}
          </nav>
          {areas.length === 0 && <p className="text-sm text-muted">{t("ref.empty")}</p>}
          <div className="flex flex-col gap-10">
            {areas.map(([area, procedures]) => (
              <Section key={area} title={ta(`area.${area}` as MessageKey<"access">)}>
                <div id={`area-${area}`} className="-mt-24 pt-24" />
                <Group>
                  {procedures.map((p) => (
                    <ProcedureItem key={p.path} procedure={p} />
                  ))}
                </Group>
              </Section>
            ))}
          </div>
          <p className="mt-10 text-xs text-muted">{t("ref.appOnly")}</p>
        </>
      )}
    </DocsLayout>
  );
}

function ProcedureItem({ procedure: p }: { procedure: Procedure }) {
  const t = useT("docs");
  const ta = useT("access");
  const fields = Object.entries(p.input?.properties ?? {});
  const required = new Set(p.input?.required ?? []);
  return (
    <details id={p.path} className="group not-last:shadow-[inset_0_-1px_0_var(--color-line)]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm transition-colors duration-150 hover:bg-panel-hover [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "w-11 shrink-0 rounded-xs py-0.5 text-center font-mono text-[11px] font-semibold",
            p.method === "GET" ? "bg-system-green/15 text-system-green" : "bg-system-blue/15 text-system-blue",
          )}
        >
          {p.method}
        </span>
        <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{p.path}</code>
        <span className="truncate text-xs text-muted max-sm:hidden">{ta(`perm.${p.permission}` as MessageKey<"access">)}</span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
        <p className="text-xs text-muted">
          <code className="font-mono">{p.permission}</code> · {ta(`perm.${p.permission}.hint` as MessageKey<"access">)}
        </p>
        <div>
          <p className="mb-1.5 text-xs font-medium">{t("ref.input")}</p>
          {fields.length === 0 ? (
            <p className="text-xs text-muted">{t("ref.noInput")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md bg-canvas">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="px-3 py-2 font-medium">{t("ref.field")}</th>
                    <th className="px-3 py-2 font-medium">{t("ref.type")}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map(([name, schema]) => (
                    <tr key={name} className="align-top">
                      <td className="px-3 py-1.5 font-mono whitespace-nowrap">
                        {name}
                        {required.has(name) && <span className="ml-1.5 font-sans text-[11px] text-system-orange">{t("ref.required")}</span>}
                      </td>
                      <td className="max-w-64 px-3 py-1.5 font-mono break-words text-muted">{typeLabel(schema)}</td>
                      <td className="px-3 py-1.5 text-muted">{schema.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium">{t("ref.example")}</p>
          <CodeBlock text={example(p)} />
        </div>
      </div>
    </details>
  );
}
