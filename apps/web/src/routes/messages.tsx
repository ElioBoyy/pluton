import { Link } from "@tanstack/react-router";
import { PageHeader } from "../components/ui.tsx";
import { NeedsYou, Tasks } from "../features/sequence/inbox.tsx";
import { useT } from "../i18n/index.ts";

/** Everything the sequences wait on you for, across every Play: replies first, then LinkedIn steps by hand. */
export function MessagesPage() {
  const t = useT("sequence");
  const ts = useT("shell");
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader title={ts("nav.messages")} description={t("inbox.description")} />
      <div className="flex flex-col gap-8">
        <NeedsYou />
        <Tasks />
      </div>
      <p className="mt-8 px-1 text-xs text-muted">
        {t.rich("inbox.footnote", {
          plays: (
            <Link to="/plays" className="text-accent hover:underline">
              {ts("nav.plays")}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
