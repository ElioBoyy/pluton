import { AppLink } from "../components/app-link.tsx";
import { PageHeader } from "../components/ui.tsx";
import { useT, type MessageKey } from "../i18n/index.ts";

type Key = MessageKey<"settings">;

/** Newest first. Each entry links to where the feature lives; the text is in the settings namespace. */
const RELEASES: Array<{ title: Key; items: Array<{ text: Key; to?: string }> }> = [
  {
    title: "whatsNew.agent.title",
    items: [
      { text: "whatsNew.agent.1", to: "/agent" },
      { text: "whatsNew.agent.2" },
      { text: "whatsNew.agent.3" },
      { text: "whatsNew.agent.4" },
      { text: "whatsNew.agent.5" },
    ],
  },
  {
    title: "whatsNew.integrations.title",
    items: [
      { text: "whatsNew.integrations.1", to: "/workspace/integrations/slack" },
      { text: "whatsNew.integrations.2", to: "/workspace/integrations" },
      { text: "whatsNew.integrations.3", to: "/workspace/mcp" },
    ],
  },
  {
    title: "whatsNew.spend.title",
    items: [
      { text: "whatsNew.spend.1", to: "/workspace/usage" },
      { text: "whatsNew.spend.2", to: "/workspace/activity" },
    ],
  },
  {
    title: "whatsNew.sequences.title",
    items: [{ text: "whatsNew.sequences.1", to: "/plays" }],
  },
  {
    title: "whatsNew.leads.title",
    items: [{ text: "whatsNew.leads.1", to: "/leads" }],
  },
  {
    title: "whatsNew.plays.title",
    items: [
      { text: "whatsNew.plays.1", to: "/plays/new" },
      { text: "whatsNew.plays.2", to: "/brain" },
      { text: "whatsNew.plays.3", to: "/onboarding" },
    ],
  },
];

/** Read as release notes: a column of reading width, each release a heading over its list, set apart by space. */
export function WhatsNewPage() {
  const t = useT("settings");
  return (
    <>
      <PageHeader title={t("whatsNew.title")} description={t("whatsNew.description")} />
      <article className="max-w-[65ch]">
        {RELEASES.map((release, i) => (
          <section key={release.title} className="[&+&]:mt-10">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[-0.01em]">
              {t(release.title)}
              {i === 0 && <span className="inline-flex h-5 items-center rounded-full bg-accent/15 px-2 text-xs font-medium tracking-normal text-accent">{t("whatsNew.latest")}</span>}
            </h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-base text-pretty">
              {release.items.map((item) => (
                <li key={item.text} className="flex gap-3">
                  <span aria-hidden className="mt-[8.5px] size-[5px] shrink-0 rounded-full bg-muted" />
                  {item.to ? (
                    <AppLink href={item.to} className="decoration-accent/40 underline-offset-[3px] hover:text-accent hover:underline">
                      {t(item.text)}
                    </AppLink>
                  ) : (
                    <span>{t(item.text)}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </article>
    </>
  );
}
