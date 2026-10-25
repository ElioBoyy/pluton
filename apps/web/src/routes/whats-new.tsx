import { AppLink } from "../components/app-link.tsx";
import { PageHeader } from "../components/ui.tsx";

/** Newest first. Each entry links to where the feature lives. */
const RELEASES: Array<{ title: string; items: Array<{ text: string; to?: string }> }> = [
  {
    title: "The agent",
    items: [
      { text: "Chat with Pluton about your leads, Plays, Brain and spend; it reads what it needs.", to: "/agent" },
      { text: "Changes, searches, sequences and CRM exports wait on an approval card before they run." },
      { text: "Type a question in ⌘K to start a conversation from any page." },
      { text: "Pluton works on a phone: the sidebar becomes a menu and settings scroll sideways." },
      { text: "Get started in the sidebar ticks itself off as you go." },
    ],
  },
  {
    title: "Slack, CRM and MCP",
    items: [
      { text: "New leads in Slack with Approve and Reject buttons.", to: "/workspace/integrations/slack" },
      { text: "Export leads to HubSpot, Attio or Pipedrive (create only).", to: "/workspace/integrations" },
      { text: "Connect Claude Code, Claude Desktop or Codex to Pluton over MCP.", to: "/workspace/mcp" },
    ],
  },
  {
    title: "Spend and activity",
    items: [
      { text: "Every paid call is in the ledger, with a monthly budget and a cap per search.", to: "/workspace/usage" },
      { text: "Activity feed, notifications and a morning digest.", to: "/workspace/activity" },
    ],
  },
  {
    title: "LinkedIn sequences",
    items: [{ text: "Visit, follow, like, invite and three messages, written per lead, with a 10-minute undo.", to: "/plays" }],
  },
  {
    title: "Leads",
    items: [{ text: "Review leads with reasons that teach the next searches, find work emails, export CSV.", to: "/leads" }],
  },
  {
    title: "Plays and the Brain",
    items: [
      { text: "Describe who to find; Pluton plans the Play and searches on free sources first.", to: "/plays/new" },
      { text: "Edit the Brain and accept the agent's suggestions.", to: "/brain" },
      { text: "Onboarding deepsearch builds the Brain from your website.", to: "/onboarding" },
    ],
  },
];

/** Read as release notes: a column of reading width, each release a heading over its list, set apart by space. */
export function WhatsNewPage() {
  return (
    <>
      <PageHeader title="What's new" description="What changed in Pluton, newest first." />
      <article className="max-w-[65ch]">
        {RELEASES.map((release, i) => (
          <section key={release.title} className="[&+&]:mt-10">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[-0.01em]">
              {release.title}
              {i === 0 && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium tracking-normal text-accent">Latest</span>}
            </h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-base text-pretty">
              {release.items.map((item) => (
                <li key={item.text} className="flex gap-3">
                  <span aria-hidden className="mt-[8.5px] size-[5px] shrink-0 rounded-full bg-muted" />
                  {item.to ? (
                    <AppLink href={item.to} className="decoration-accent/40 underline-offset-[3px] hover:text-accent hover:underline">
                      {item.text}
                    </AppLink>
                  ) : (
                    <span>{item.text}</span>
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
