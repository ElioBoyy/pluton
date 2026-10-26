import {
  buildDigest,
  digestEmailFailed,
  digestWindowStart,
  getCurrentWorkspace,
  jobPayloads,
  notificationSettings,
  notifyDescribed,
  recordActivity,
  renderDigest,
  type JobHandler,
} from "@pluton/core";
import { and, desc, eq, notifications, workspaces } from "@pluton/db";
import { appMailConfigured, sendMail } from "@pluton/providers";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

/** The morning digest: a notification in the app, and an email when Resend or SMTP and a recipient are set. */
export const sendDigest: JobHandler = async ({ db, job, emit }) => {
  const { workspaceId, manual } = jobPayloads["notifications.digest"].parse(job.payload);
  const ws = (await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })) ?? (await getCurrentWorkspace(db));
  const last = await db.query.notifications.findFirst({
    where: and(eq(notifications.workspaceId, ws.id), eq(notifications.kind, "digest")),
    orderBy: desc(notifications.createdAt),
  });
  const digest = await buildDigest(db, ws, digestWindowStart(ws, last?.createdAt));
  // A scheduled digest with nothing to say stays quiet.
  if (digest.empty && !manual) {
    await emit("done", { skipped: "nothing new" });
    return { skipped: "nothing new" };
  }

  const settings = notificationSettings(ws);
  const { html, text } = renderDigest(digest, APP_URL);
  let emailed = false;
  let emailError: string | undefined;
  if (settings.email && settings.emailTo && appMailConfigured()) {
    try {
      await sendMail({ to: settings.emailTo, subject: digest.subject, html, text });
      emailed = true;
    } catch (error) {
      emailError = (error as Error).message;
    }
  }
  // Worded when read (see describeNotification), so the bell shows it in the founder's language.
  await notifyDescribed(db, ws.id, {
    category: "digest",
    kind: "digest",
    link: "/home",
    payload: { manual: Boolean(manual), facts: digest.facts },
    dedupeKey: manual ? undefined : `digest:${ws.id}:${job.idempotencyKey ?? job.id}`,
  });
  await recordActivity(db, ws.id, "system", "digest.sent", { emailed, emailError });
  if (emailError) throw new Error(digestEmailFailed(emailError));
  await emit("done", { emailed });
  return { emailed, sections: digest.sections.length };
};
