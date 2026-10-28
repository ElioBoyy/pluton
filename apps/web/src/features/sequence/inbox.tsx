import { Copy, UserCheck } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button, Group, Section } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useRefreshSequences } from "./add-to-campaign.tsx";
import { REPLY_LABEL, actionLabel, when } from "./labels.ts";

/*
 * What the sequences need from you: replies to answer and, for manual LinkedIn accounts, the steps to
 * do by hand. Shown in a Play's Sequence tab for that Play, and on the Messages page for all of them.
 */

/** Replies Pluton can't answer alone: one Play's sequence, or every sequence without `campaignId` (the Messages page). */
export function NeedsYou({ campaignId }: { campaignId?: string }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const list = useQuery(trpc.campaigns.replies.needingYou.queryOptions({ campaignId }, { refetchInterval: 30_000 }));
  const handled = useMutation(trpc.campaigns.replies.handled.mutationOptions({ onSuccess: () => refresh() }));
  const rows = list.data ?? [];
  // Across sequences, each reply says which Play it came from.
  const playNames = usePlayNames(!campaignId);
  return (
    <Section title={<>{t("needsYou.title")} {rows.length > 0 && <span className="text-system-orange tabular-nums">· {rows.length}</span>}</>}>
      {rows.length === 0 ? (
        <Group className="px-4 py-3">
          <p className="text-sm text-muted">{t("needsYou.empty")}</p>
        </Group>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.reply.id} className="bg-panel px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Link to="/plays/$playId" params={{ playId: r.playId }} search={{ tab: "leads", lead: r.leadId }} className="truncate font-medium hover:underline">
                  {r.person.name}
                </Link>
                {playNames && <span className="min-w-0 flex-1 truncate text-xs text-muted">{playNames.get(r.playId)}</span>}
                {r.reply.label && <span className={cn("inline-flex rounded-full h-5 shrink-0 items-center px-2 text-xs", REPLY_LABEL[r.reply.label]?.className)}>{REPLY_LABEL[r.reply.label]?.label}</span>}
              </div>
              <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted">“{r.reply.text}”</p>
              {r.reply.summary && <p className="mt-1 text-xs text-muted">{r.reply.summary}</p>}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {r.person.linkedinUrl && (
                  <a href={r.person.linkedinUrl} target="_blank" rel="noreferrer" className="mr-auto text-sm text-accent hover:underline">
                    {t("needsYou.answer")}
                  </a>
                )}
                <Button variant="ghost" onClick={() => handled.mutate({ replyId: r.reply.id })}>
                  {t("needsYou.markHandled")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Manual accounts: what to do on LinkedIn now, with the text ready to paste; one Play's, or every Play's without `playId`. */
export function Tasks({ playId }: { playId?: string }) {
  const t = useT("sequence");
  const tc = useT("common");
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const list = useQuery(trpc.campaigns.tasks.list.queryOptions(undefined, { refetchInterval: 30_000 }));
  const complete = useMutation(trpc.campaigns.tasks.complete.mutationOptions({ onSuccess: () => refresh(), onError: (e) => toast(e.message, { tone: "error" }) }));
  const answer = useMutation(trpc.campaigns.enrollments.invitationAnswer.mutationOptions({ onSuccess: () => refresh() }));
  const tasks = (list.data?.tasks ?? []).filter((t) => !playId || t.playId === playId);
  const waiting = (list.data?.waiting ?? []).filter((t) => !playId || t.playId === playId);
  if (tasks.length === 0 && waiting.length === 0) return null;
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast(tc("copied")));

  return (
    // Invitations waiting for an answer are tasks too: they need you to say when they're accepted.
    <Section title={t("tasks.title", { count: tasks.length + waiting.length })} description={t("tasks.description")}>
      <ul className="flex flex-col gap-2">
        {tasks.map(({ action, person, sender, playName }) => (
          <li key={action.id} className="bg-panel px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{actionLabel(action.kind)}</span>
              <span className="truncate text-xs text-muted">{sender?.name}</span>
            </div>
            <p className="text-xs text-muted">
              {person.name}
              {!playId && ` · ${playName}`}
              {person.linkedinUrl && (
                <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="ml-1.5 text-accent hover:underline">
                  {t("tasks.openProfile")}
                </a>
              )}
            </p>
            {action.detail && action.kind !== "message" && <p className="mt-0.5 text-xs text-muted">{action.detail}</p>}
            {action.text && (
              <div className="mt-2 bg-canvas px-3 py-2 text-sm whitespace-pre-wrap">
                {action.text}
                <button onClick={() => copy(action.text!)} className="mt-1.5 flex items-center gap-1 text-xs text-accent hover:underline">
                  <Copy size={11} /> {tc("copy")}
                </button>
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {action.kind === "visit_profile" ? (
                <>
                  <Button onClick={() => complete.mutate({ actionId: action.id, done: true, connected: false })}>
                    {t("tasks.doneNotConnected")}
                  </Button>
                  <Button variant="ghost" onClick={() => complete.mutate({ actionId: action.id, done: true, connected: true })}>
                    {t("tasks.doneConnected")}
                  </Button>
                </>
              ) : (
                <Button onClick={() => complete.mutate({ actionId: action.id, done: true })}>
                  {tc("done")}
                </Button>
              )}
              <Button variant="ghost" onClick={() => complete.mutate({ actionId: action.id, done: false })}>
                {t("tasks.skip")}
              </Button>
            </div>
          </li>
        ))}
        {waiting.map(({ enrollment, person, playName }) => (
          <li key={enrollment.id} className="bg-panel px-4 py-3 text-sm">
            <span className="font-medium">{t("tasks.waiting", { name: person.name })}</span>
            <p className="mt-0.5 text-xs text-muted">
              {t("tasks.invited", { when: when(enrollment.inviteSentAt) })}
              {!playId && ` · ${playName}`}
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button onClick={() => answer.mutate({ enrollmentId: enrollment.id, accepted: true })}>
                <UserCheck size={12} /> {t("tasks.accepted")}
              </Button>
              <Button variant="ghost" onClick={() => answer.mutate({ enrollmentId: enrollment.id, accepted: false })}>
                {t("tasks.giveUp")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Play names by id, when a list mixes Plays; null when it doesn't need them. */
function usePlayNames(enabled: boolean) {
  const trpc = useTRPC();
  const plays = useQuery({ ...trpc.plays.list.queryOptions(), enabled });
  return useMemo(() => (enabled && plays.data ? new Map(plays.data.map((p) => [p.id, p.name])) : null), [enabled, plays.data]);
}
