import {
  buildDigest,
  digestWindowStart,
  getOrCreateDefaultWorkspace,
  jobPayloads,
  notificationSettings,
  notify,
  recordActivity,
  renderDigest,
  type JobHandler,
} from "@pluton/core";
import { and, desc, eq, notifications, workspaces } from "@pluton/db";
import { mailerConfigured, sendMail } from "@pluton/providers";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

/** The morning digest: a notification in the app, and an email when SMTP and a recipient are set. */
export const sendDigest: JobHandler = async ({ db, job, emit }) => {
  const { workspaceId, manual } = jobPayloads["notifications.digest"].parse(job.payload);
  const ws = (await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })) ?? (await getOrCreateDefaultWorkspace(db));
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
  if (settings.email && settings.emailTo && mailerConfigured()) {
    try {
      await sendMail({ to: settings.emailTo, subject: digest.subject, html, text });
      emailed = true;
    } catch (error) {
      emailError = (error as Error).message;
    }
  }
  await notify(db, ws.id, {
    category: "digest",
    kind: "digest",
    title: manual ? "Your digest" : "Your morning digest",
    body: digest.sections.find((s) => s.title === "Waiting for you")?.lines.map((l) => l.text).join(" · ") ?? "Nothing waiting for you.",
    link: "/home",
    payload: digest,
    dedupeKey: manual ? undefined : `digest:${ws.id}:${job.idempotencyKey ?? job.id}`,
  });
  await recordActivity(db, ws.id, "system", "digest.sent", { emailed, emailError });
  if (emailError) throw new Error(`Digest saved in the app, but the email failed: ${emailError}`);
  await emit("done", { emailed });
  return { emailed, sections: digest.sections.length };
};
