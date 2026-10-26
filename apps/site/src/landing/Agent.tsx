import { ArrowUp, ArrowUpRight, Lightning } from "@phosphor-icons/react/ssr";
import {
  Approval,
  Avatar,
  Bubble,
  Button,
  Card,
  Chip,
  Field,
  LinkButton,
  Logo,
  Looked,
  Meter,
  Row,
  Score,
  Thinking,
  Window,
} from "@pluton/glass";
import type { Strings } from "../i18n/index.ts";
import { APP_URL } from "../links.ts";

type T = Strings;
const PROMPTS = ["today", "best", "plan", "spend"] as const;
type Prompt = (typeof PROMPTS)[number];

function Lead({ row }: { row: string[] }) {
  const [name = "", role = "", signal = "", fit = "0"] = row;
  return (
    <Row
      leading={<Avatar name={name} />}
      title={name}
      detail={`${role} · ${signal}`}
      trailing={<Score value={Number(fit)} label={`${fit} / 100`} />}
    />
  );
}

function Decide({ t, title, meta }: { t: T; title: string; meta: string }) {
  return (
    <Approval
      className="turn-part"
      icon={<Lightning weight="fill" className="approval-icon" aria-hidden />}
      title={title}
      meta={meta}
      actions={
        <>
          <Button variant="accent" size="sm" data-approve="">
            {t.agent.approve}
          </Button>
          <Button variant="plain" size="sm" data-decline="">
            {t.agent.notNow}
          </Button>
        </>
      }
      done={<span data-done-text>{t.agent.approved}</span>}
    />
  );
}

/** One question and the agent's answer, from the sample workspace. */
function Turn({ t, prompt }: { t: T; prompt: Prompt }) {
  const a = t.agent[prompt];
  const leads = t.how.leads.rows;
  return (
    <div className="turn" data-turn={prompt}>
      <Bubble>{a.q}</Bubble>
      <div className="turn-ai">
        <Looked className="turn-part">{a.looked}</Looked>
        <p className="turn-text" data-stream="">
          {a.a}
        </p>
        {prompt === "today" && (
          <Card className="turn-part turn-list">
            <Lead row={leads[0]!} />
            <Lead row={leads[1]!} />
          </Card>
        )}
        {prompt === "best" && (
          <>
            <Card className="turn-part turn-list">
              {leads.map((r) => (
                <Lead key={r[0]} row={r} />
              ))}
            </Card>
            <Decide t={t} title={t.agent.best.card} meta={t.agent.best.cardMeta} />
          </>
        )}
        {prompt === "plan" && (
          <>
            <Card className="turn-part turn-play">
              <p className="turn-play-title">{t.how.play.title}</p>
              <dl>
                {t.how.play.rows.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Decide t={t} title={t.agent.plan.card} meta={t.agent.plan.cardMeta} />
          </>
        )}
        {prompt === "spend" && (
          <Card className="turn-part turn-spend">
            <div className="turn-spend-head">
              <span>{t.agent.spend.meter}</span>
              <strong>{t.agent.spend.spent}</strong>
            </div>
            <Meter value={14.2 / 60} label={t.agent.spend.meter} />
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * The hero's agent window: four real suggestions from the app, each answered from the sample
 * workspace. Without script the first answer is printed; scripts/landing.ts plays the rest.
 */
export function Agent({ t }: { t: T }) {
  return (
    <Window
      id="agent"
      className="agent reveal"
      icon={<Logo symbolOnly className="agent-icon" />}
      title={
        <>
          {t.agent.title}
          <span className="agent-ws"> · Atelier Kilo</span>
        </>
      }
      tools={
        <Button size="sm" variant="plain" className="agent-new" hidden>
          {t.agent.again}
        </Button>
      }
    >
      <div className="agent-scroll">
        <div className="agent-empty">
          <Logo symbolOnly className="agent-mark" aria-hidden />
          <p className="agent-empty-title">{t.agent.empty}</p>
          <p className="agent-empty-sub">{t.agent.emptySub}</p>
          <div className="agent-prompts">
            {PROMPTS.map((p) => (
              <Chip key={p} data-prompt={p}>
                {t.agent[p].q}
              </Chip>
            ))}
          </div>
        </div>
        <div className="agent-thread" aria-live="polite">
          <div className="turn-static">
            <Turn t={t} prompt="today" />
          </div>
        </div>
      </div>
      <form className="agent-form" action={APP_URL}>
        <Field
          name="q"
          autoComplete="off"
          placeholder={t.agent.placeholder}
          aria-label={t.agent.placeholder}
          trailing={
            <Button type="submit" variant="accent" size="sm" iconOnly aria-label={t.agent.send}>
              <ArrowUp weight="bold" aria-hidden />
            </Button>
          }
        />
        <p className="agent-foot">
          <span>{t.agent.reminder}</span> <span className="agent-sample">{t.agent.sample}</span>
        </p>
      </form>

      {PROMPTS.map((p) => (
        <template key={p} data-answer={p}>
          <Turn t={t} prompt={p} />
        </template>
      ))}
      <template data-answer="working">
        <Thinking className="turn-thinking">{t.agent.working}</Thinking>
      </template>
      <template data-answer="other">
        <div className="turn">
          <Bubble data-question="" />
          <div className="turn-ai">
            <p className="turn-text" data-stream="">
              {t.agent.offline}
            </p>
            <LinkButton variant="accent" size="sm" href={APP_URL} className="turn-part">
              {t.hero.cta}
              <ArrowUpRight weight="bold" aria-hidden />
            </LinkButton>
          </div>
        </div>
      </template>
      <template data-answer="declined">
        <span>{t.agent.declined}</span>
      </template>
    </Window>
  );
}
