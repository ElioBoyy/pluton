import {
  ArrowUpRight,
  Brain,
  Check,
  Copy,
  EnvelopeSimple,
  GithubLogo,
  Globe,
  ImageSquare,
  Lightning,
  LinkedinLogo,
  PaperPlaneTilt,
  TerminalWindow,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import {
  Avatar,
  Button,
  Card,
  Code,
  Disclosure,
  Glass,
  LinkButton,
  Logo,
  Menubar,
  Note,
  Row,
  Score,
  Segmented,
  SideItem,
  Sidebar,
  Window,
} from "@pluton/glass";
import type { CSSProperties } from "react";
import { LOCALES, LOCALE_NAMES, pathFor, type Locale, type Strings } from "../i18n/index.ts";
import { SAMPLE_MESSAGES } from "../i18n/messages.ts";
import { LICENSE_URL, REPO_URL, SIGNUP_URL } from "../links.ts";
import { Agent } from "./Agent.tsx";

type T = Strings;
type Props = { t: T; locale: Locale };

/** Prices read "19.99 €" in English as in the copy, with each language's own decimal mark. */
const euros = (locale: Locale, n: number) =>
  `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(n)}\u00a0€`;

/* ------------------------------------------------------------------ menu bar */

function Bar({ t, locale }: Props) {
  const links = [
    ["#how", t.nav.how],
    ["#agent", t.nav.agent],
    ["#ai", t.nav.ai],
    ["#pricing", t.nav.pricing],
    ["#faq", t.nav.faq],
  ] as const;
  return (
    <Menubar className="bar">
      <a className="bar-logo" href={pathFor(locale)} aria-label="Pluton">
        <Logo />
      </a>
      <nav className="bar-links" aria-label="Pluton">
        {links.map(([href, label]) => (
          <a key={href} className="gg-menubar__item" href={href} data-chapter={href.slice(1)}>
            {label}
          </a>
        ))}
      </nav>
      <details className="lang">
        <summary className="gg-menubar__item" aria-label={t.nav.language}>
          <Globe aria-hidden />
          <span>{locale.toUpperCase()}</span>
        </summary>
        <Glass weight="thick" className="lang-menu">
          {LOCALES.map((l) => (
            <a key={l} href={pathFor(l)} hrefLang={l} lang={l} aria-current={l === locale ? "page" : undefined}>
              {LOCALE_NAMES[l]}
              {l === locale && <Check weight="bold" aria-hidden />}
            </a>
          ))}
        </Glass>
      </details>
      <LinkButton variant="accent" size="sm" href={SIGNUP_URL} className="bar-start">
        {t.nav.start}
      </LinkButton>
    </Menubar>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero({ t }: Props) {
  // Two lines in every language, broken after the comma; the size fits the longer line to the column.
  const lines = t.hero.title.split(/(?<=,)\s+/);
  const chars = Math.max(...lines.map((l) => l.length));
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title" className="display reveal" style={{ "--chars": chars } as CSSProperties}>
          {lines.map((l) => (
            <span key={l} className="line">
              {l}
            </span>
          ))}
        </h1>
        <p className="lead reveal">{t.hero.sub}</p>
        <div className="hero-actions reveal">
          <LinkButton variant="accent" size="lg" href={SIGNUP_URL}>
            {t.hero.cta}
          </LinkButton>
          <LinkButton variant="glass" size="lg" href={REPO_URL}>
            <GithubLogo weight="fill" aria-hidden />
            {t.hero.code}
          </LinkButton>
        </div>
        <p className="hero-price reveal">{t.hero.price}</p>
      </div>
      <Agent t={t} />
    </section>
  );
}

/* ------------------------------------------------------------------ the name */

function Story({ t }: Props) {
  return (
    <section className="story section" aria-labelledby="story-heading">
      <div className="story-copy">
        <h2 id="story-heading" className="headline reveal">
          {t.story.heading}
        </h2>
        <p className="body reveal">{t.story.text}</p>
      </div>
      <Window
        className="plates reveal"
        icon={<ImageSquare weight="fill" aria-hidden />}
        title={t.story.window}
        tools={
          <Button
            size="sm"
            variant="plain"
            className="blink-pause"
            aria-pressed="false"
            data-pause={t.story.pause}
            data-play={t.story.play}
          >
            {t.story.pause}
          </Button>
        }
      >
        <figure className="plates-figure">
          <div className="plates-stage is-blinking" role="img" aria-label={`${t.story.caption} ${t.story.plateA}, ${t.story.plateB}.`}>
            <img className="plate plate-a" src="/img/plate-a.webp" width="760" height="760" alt="" loading="lazy" />
            <img className="plate plate-b" src="/img/plate-b.webp" width="760" height="760" alt="" loading="lazy" />
            <span className="ring ring-a" aria-hidden />
            <span className="ring ring-b" aria-hidden />
          </div>
          <figcaption>
            <span className="plate-date">
              <span className="date-a">{t.story.plateA}</span>
              <span className="date-b">{t.story.plateB}</span>
            </span>
            <span>{t.story.caption}</span>
          </figcaption>
        </figure>
      </Window>
    </section>
  );
}

/* ------------------------------------------------------------------ how it works */

const STAGE_ICONS = [Brain, Lightning, UsersThree, PaperPlaneTilt];

function StageView({ t, i }: { t: T; i: number }) {
  if (i === 0)
    return (
      <Card className="frag">
        <p className="frag-title">{t.how.brain.company}</p>
        <dl className="frag-dl">
          {t.how.brain.rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    );
  if (i === 1)
    return (
      <Card className="frag">
        <p className="frag-title">{t.how.play.title}</p>
        <dl className="frag-dl">
          {t.how.play.rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="frag-actions">
          <Button variant="accent" size="sm">
            {t.how.play.action}
          </Button>
        </div>
      </Card>
    );
  if (i === 2)
    return (
      <Card className="frag frag-list">
        <p className="frag-title">{t.how.leads.title}</p>
        {t.how.leads.rows.map(([name = "", role, signal, fit = "0"], n) => (
          <Row
            key={name}
            selected={n === 0}
            leading={<Avatar name={name} />}
            title={name}
            detail={`${role} · ${signal}`}
            trailing={<Score value={Number(fit)} label={`${t.how.leads.fit} ${fit}`} />}
          />
        ))}
        <p className="frag-note">{t.how.leads.evidence}</p>
      </Card>
    );
  return (
    <Card className="frag">
      <p className="frag-meta">
        <LinkedinLogo weight="fill" aria-hidden /> {t.how.message.to}
      </p>
      <p className="frag-body">{t.how.message.body}</p>
      <p className="frag-status">{t.how.message.status}</p>
      <div className="frag-actions">
        <Button variant="accent" size="sm">
          {t.how.message.approve}
        </Button>
        <Button variant="plain" size="sm">
          {t.how.message.edit}
        </Button>
      </div>
    </Card>
  );
}

function How({ t }: Props) {
  return (
    <section className="how section" id="how" aria-labelledby="how-heading">
      <h2 id="how-heading" className="headline reveal">
        {t.how.heading}
      </h2>
      <Window
        className="how-window reveal"
        sidebar={
          <Sidebar label="Atelier Kilo" role="tablist" aria-label={t.how.stagesLabel} aria-orientation="vertical">
            {t.how.stages.map((s, i) => {
              const Icon = STAGE_ICONS[i]!;
              return (
                <SideItem
                  key={s.name}
                  role="tab"
                  id={`stage-tab-${i}`}
                  aria-controls={`stage-${i}`}
                  selected={i === 0}
                  tabIndex={i === 0 ? 0 : -1}
                  data-stage-tab={i}
                  icon={<Icon weight="fill" aria-hidden />}
                >
                  {s.name}
                </SideItem>
              );
            })}
          </Sidebar>
        }
      >
        {t.how.stages.map((s, i) => (
          <div
            key={s.name}
            className="stage"
            role="tabpanel"
            id={`stage-${i}`}
            aria-labelledby={`stage-tab-${i}`}
            data-stage={i}
            hidden={i !== 0}
          >
            <div className="stage-copy">
              <h3 className="title">{s.clause}</h3>
              <p className="body">{s.text}</p>
            </div>
            <StageView t={t} i={i} />
          </div>
        ))}
        <p className="window-note">{t.how.sample}</p>
      </Window>
    </section>
  );
}

/* ------------------------------------------------------------------ control */

function Trust({ t }: Props) {
  const n = t.trust;
  return (
    <section className="trust band" aria-labelledby="trust-heading">
      <video className="band-photo" autoPlay muted loop playsInline preload="none" poster="/img/flyover-poster.webp" aria-hidden>
        <source src="/img/flyover.webm" type="video/webm" />
        <source src="/img/flyover.mp4" type="video/mp4" />
      </video>
      <div className="band-inner">
        <div className="trust-copy">
          <h2 id="trust-heading" className="headline reveal">
            {n.heading}
          </h2>
          <p className="body reveal">{n.text}</p>
          <ul className="trust-points">
            {n.points.map(([k, v]) => (
              <li key={k} className="reveal">
                <strong>{k}</strong>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="trust-stack" aria-label="Pluton">
          <Note
            className="reveal"
            time={n.search.time}
            title={n.search.title}
            body={n.search.body}
            actions={
              <>
                <Button variant="accent" size="sm">
                  {n.search.run}
                </Button>
                <Button variant="plain" size="sm">
                  {n.search.later}
                </Button>
              </>
            }
          />
          <Note className="reveal" time={n.cap.time} title={n.cap.title} body={n.cap.body} />
          <Note
            className="reveal"
            time={n.review.time}
            title={n.review.title}
            body={n.review.body}
            actions={
              <Button variant="plain" size="sm">
                {n.review.action}
              </Button>
            }
          />
          <Note className="reveal" time={n.reply.time} title={n.reply.title} body={n.reply.body} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ messages */

function Compose({ t, locale }: Props) {
  const c = t.compose;
  return (
    <section className="compose section" id="messages" aria-labelledby="compose-heading">
      <div className="compose-copy">
        <h2 id="compose-heading" className="headline reveal">
          {c.heading}
        </h2>
        <div className="compose-controls">
          <div className="control reveal">
            <h3 className="title">{c.blocks[0]!.title}</h3>
            <p className="body">{c.blocks[0]!.text}</p>
            <Segmented
              name="channel"
              label={c.channelLabel}
              value="linkedin"
              options={[
                { value: "linkedin", label: "LinkedIn" },
                { value: "email", label: "Email" },
              ]}
            />
          </div>
          <div className="control reveal">
            <h3 className="title">{c.blocks[1]!.title}</h3>
            <p className="body">{c.blocks[1]!.text}</p>
            <Segmented
              name="lang"
              label={c.languageLabel}
              value={locale}
              options={LOCALES.map((l) => ({ value: l, label: <span title={LOCALE_NAMES[l]}>{l.toUpperCase()}</span> }))}
            />
          </div>
          <div className="control reveal">
            <h3 className="title">{c.blocks[2]!.title}</h3>
            <p className="body">{c.blocks[2]!.text}</p>
            <Segmented
              name="mode"
              label={c.modeLabel}
              value="auto"
              options={[
                { value: "auto", label: c.modeAuto },
                { value: "manual", label: c.modeManual },
              ]}
            />
          </div>
          <div className="control reveal">
            <h3 className="title">{c.blocks[3]!.title}</h3>
            <p className="body">{c.blocks[3]!.text}</p>
          </div>
        </div>
      </div>
      <Window
        className="mail reveal"
        data-channel="linkedin"
        data-lang={locale}
        data-mode="auto"
        icon={
          <>
            <LinkedinLogo weight="fill" className="mail-icon-linkedin" aria-hidden />
            <EnvelopeSimple weight="fill" className="mail-icon-email" aria-hidden />
          </>
        }
        title="Camille Roux, Atelier Roux"
      >
        <div className="mail-head">
          <p>
            <span>{c.to}</span> Camille Roux
          </p>
          {LOCALES.map((l) => (
            <p key={l} className="mail-subject" data-l={l} hidden>
              <span>{c.subject}</span> {SAMPLE_MESSAGES[l].subject}
            </p>
          ))}
        </div>
        <div className="mail-bodies">
          {LOCALES.flatMap((l) =>
            (["linkedin", "email"] as const).map((ch) => (
              <p key={l + ch} className="mail-body" lang={l} data-l={l} data-c={ch} hidden={!(l === locale && ch === "linkedin")}>
                {SAMPLE_MESSAGES[l][ch]}
              </p>
            )),
          )}
        </div>
        <div className="mail-foot">
          <p className="mail-status" role="status">
            <span className="st-review">{c.statusReview}</span>
            <span className="st-auto">{c.statusAuto}</span>
            <span className="st-manual">{c.statusManual}</span>
          </p>
          <Button variant="accent" className="mail-approve" aria-pressed="false">
            <span className="approve-off">{c.approve}</span>
            <span className="approve-on">
              <Check weight="bold" aria-hidden /> {c.approved} · {c.undo}
            </span>
          </Button>
        </div>
      </Window>
    </section>
  );
}

/* ------------------------------------------------------------------ your AI */

const MCP_URL = "http://localhost:8787/api/mcp";
const TOKEN = "pluton_…";
const CLIENTS = {
  code: `claude mcp add --transport http pluton ${MCP_URL} --header "Authorization: Bearer ${TOKEN}"`,
  desktop: JSON.stringify(
    { mcpServers: { pluton: { command: "npx", args: ["-y", "mcp-remote@latest", MCP_URL, "--header", `Authorization:Bearer ${TOKEN}`] } } },
    null,
    2,
  ),
  codex: `[mcp_servers.pluton]\nurl = "${MCP_URL}"\nhttp_headers = { Authorization = "Bearer ${TOKEN}" }`,
};

function Mcp({ t }: Props) {
  const m = t.mcp;
  const hints = { code: m.hintCode, desktop: m.hintDesktop, codex: m.hintCodex };
  return (
    <section className="mcp section" id="ai" aria-labelledby="mcp-heading">
      <div className="mcp-copy">
        <h2 id="mcp-heading" className="headline reveal">
          {m.heading}
        </h2>
        <p className="body reveal">{m.text}</p>
        <p className="body mcp-rule reveal">{m.rule}</p>
      </div>
      <Window
        className="mcp-window reveal"
        data-client="code"
        icon={<TerminalWindow weight="fill" aria-hidden />}
        title={m.clientLabel}
        tools={
          <Button size="sm" variant="plain" iconOnly className="mcp-copy-button" aria-label="Copy">
            <Copy aria-hidden />
          </Button>
        }
      >
        <div className="mcp-body">
          <Segmented
            name="client"
            label={m.clientLabel}
            value="code"
            options={[
              { value: "code", label: "Claude Code" },
              { value: "desktop", label: "Claude Desktop" },
              { value: "codex", label: "Codex" },
            ]}
          />
          {(Object.keys(CLIENTS) as (keyof typeof CLIENTS)[]).map((k) => (
            <div key={k} className="mcp-client" data-for={k} hidden={k !== "code"}>
              <p className="mcp-hint">{hints[k]}</p>
              <Code>{CLIENTS[k]}</Code>
            </div>
          ))}
          <p className="window-note">{m.token}</p>
        </div>
      </Window>
    </section>
  );
}

/* ------------------------------------------------------------------ pricing */

function Pricing({ t, locale }: Props) {
  const p = t.pricing;
  return (
    <section className="pricing section" id="pricing" aria-labelledby="pricing-heading">
      <img
        className="price-planet"
        src="/img/pluto-disc.webp"
        width="846"
        height="846"
        alt="Pluto photographed by New Horizons, July 2015"
        loading="lazy"
      />
        <Glass weight="thick" className="price-panel reveal" data-plan="own">
          <div className="price-top">
            <h2 id="pricing-heading" className="headline">
              {p.heading}
            </h2>
            <Segmented
              name="plan"
              label={p.planLabel}
              value="own"
              options={[
                { value: "own", label: p.own },
                { value: "all", label: p.all },
              ]}
            />
          </div>
          <div className="price-main">
            <p className="price">
              <span className="plan-own">{euros(locale, 19.99)}</span>
              <span className="plan-all">{euros(locale, 49.99)}</span>
              <small>{p.perMonth}</small>
            </p>
            <ul className="price-lines plan-own">
              {p.ownLines.map((l) => (
                <li key={l}>
                  <Check weight="bold" aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
            <ul className="price-lines plan-all">
              {p.allLines.map((l) => (
                <li key={l}>
                  <Check weight="bold" aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="price-actions">
            <LinkButton variant="accent" size="lg" href={`${SIGNUP_URL}?plan=own`} className="plan-own">
              {p.cta} · {p.own}
            </LinkButton>
            <LinkButton variant="accent" size="lg" href={`${SIGNUP_URL}?plan=all`} className="plan-all">
              {p.cta} · {p.all}
            </LinkButton>
          </div>
        </Glass>
        <p className="self-host reveal">
          {p.selfHost}{" "}
          <a href={REPO_URL}>
            {p.selfHostLink}
            <ArrowUpRight weight="bold" aria-hidden />
          </a>
        </p>
    </section>
  );
}

/* ------------------------------------------------------------------ questions */

function Faq({ t }: Props) {
  return (
    <section className="faq section" id="faq" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="headline reveal">
        {t.faq.heading}
      </h2>
      <div className="faq-list">
        {t.faq.items.map(([q, a], i) => (
          <Disclosure key={q} name="faq" className="reveal" summary={q} open={i === 0}>
            {a}
          </Disclosure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer({ t, locale }: Props) {
  return (
    <footer className="foot">
      <Glass weight="regular" className="foot-sheet">
        <div className="foot-top">
          <div className="foot-notes">
            {t.footer.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
          <nav className="foot-langs" aria-label={t.nav.language}>
            {LOCALES.map((l) => (
              <a key={l} href={pathFor(l)} hrefLang={l} lang={l} aria-current={l === locale ? "page" : undefined}>
                {LOCALE_NAMES[l]}
              </a>
            ))}
          </nav>
        </div>
        <a className="foot-logo" href="#top" aria-label={t.footer.top}>
          <Logo />
        </a>
        <div className="foot-meta">
          <a href={REPO_URL}>GitHub</a>
          <a href={LICENSE_URL}>{t.footer.license}</a>
          <a href={`${pathFor(locale)}credits/`}>{t.footer.creditsLink}</a>
          <span>© {t.footer.year} Mathis Sportiello</span>
          <span>{t.footer.domain}</span>
          <a href="#top" className="foot-up">
            {t.footer.top}
          </a>
        </div>
      </Glass>
    </footer>
  );
}

/* ------------------------------------------------------------------ the page */

export function Landing({ t, locale }: Props) {
  return (
    <>
      <div className="wall" aria-hidden>
        <img className="wall-day" src="/img/wall-day.webp" width="1920" height="1080" alt="" fetchPriority="high" />
        <img className="wall-night" src="/img/wall-night.webp" width="1920" height="1080" alt="" />
      </div>
      <Bar t={t} locale={locale} />
      <main id="top">
        <Hero t={t} locale={locale} />
        <Story t={t} locale={locale} />
        <How t={t} locale={locale} />
        <Trust t={t} locale={locale} />
        <Compose t={t} locale={locale} />
        <Mcp t={t} locale={locale} />
        <Pricing t={t} locale={locale} />
        <Faq t={t} locale={locale} />
      </main>
      <Footer t={t} locale={locale} />
    </>
  );
}
