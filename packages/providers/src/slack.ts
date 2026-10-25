import { getSetting } from "@pluton/db";
import { http, ProviderError } from "./runtime.ts";

/**
 * Slack Web API with a bot token, plus Socket Mode with an app-level token: button clicks arrive
 * over a WebSocket Pluton opens itself, so Approve/Reject work without a public URL.
 */
const PROVIDER = "slack";

export class SlackError extends ProviderError {
  constructor(readonly code: string) {
    super(
      PROVIDER,
      code === "not_in_channel" ? "the Pluton app isn't in this channel: invite it with /invite @YourApp" : code,
      ["invalid_auth", "not_authed", "token_revoked", "account_inactive"].includes(code) ? 401 : undefined,
    );
  }
}

async function call<T>(method: string, body: Record<string, unknown>, token = getSetting("slack_bot_token")): Promise<T> {
  if (!token) throw new ProviderError(PROVIDER, "not configured: add the bot token in Settings → Integrations → Slack");
  const res = await http(PROVIDER, `https://slack.com/api/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!data.ok) throw new SlackError(data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function slackAuthTest() {
  const r = await call<{ team: string; user: string; team_id: string }>("auth.test", {});
  return { team: r.team, bot: r.user, teamId: r.team_id };
}

export async function slackChannels() {
  const out: Array<{ id: string; name: string; isPrivate: boolean; isMember: boolean }> = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const r = await call<{ channels: Array<{ id: string; name: string; is_private: boolean; is_member: boolean }>; response_metadata?: { next_cursor?: string } }>(
      "conversations.list",
      { types: "public_channel,private_channel", exclude_archived: true, limit: 200, cursor },
    );
    out.push(...r.channels.map((c) => ({ id: c.id, name: c.name, isPrivate: c.is_private, isMember: c.is_member })));
    cursor = r.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export type SlackBlock = Record<string, unknown>;

export async function slackPost(channel: string, text: string, blocks: SlackBlock[]) {
  const r = await call<{ ts: string; channel: string }>("chat.postMessage", { channel, text, blocks, unfurl_links: false, unfurl_media: false });
  return { ts: r.ts, channel: r.channel };
}

export async function slackUpdate(channel: string, ts: string, text: string, blocks: SlackBlock[]) {
  await call("chat.update", { channel, ts, text, blocks });
}

export async function slackJoin(channel: string) {
  await call("conversations.join", { channel });
}

/** What a button click carries: `action_id` is "approve" | "reject", `value` the lead id. */
export type SlackAction = { actionId: string; value: string; channelId: string; messageTs: string; userName: string };

/**
 * Keeps a Socket Mode connection open and calls `onAction` for each button click. Reconnects when
 * Slack asks to (it refreshes connections every few hours) or the socket drops. Stops on `signal`.
 */
export async function runSlackSocket(onAction: (a: SlackAction) => Promise<void>, signal: AbortSignal, log: (msg: string) => void) {
  while (!signal.aborted) {
    const appToken = getSetting("slack_app_token");
    if (!appToken || !getSetting("slack_bot_token")) {
      await sleep(15_000, signal);
      continue;
    }
    try {
      const { url } = await call<{ url: string }>("apps.connections.open", {}, appToken);
      await new Promise<void>((resolve) => {
        const ws = new WebSocket(url);
        const close = () => ws.close();
        signal.addEventListener("abort", close, { once: true });
        ws.addEventListener("open", () => log("connected to Slack (Socket Mode)"));
        ws.addEventListener("close", () => {
          signal.removeEventListener("abort", close);
          resolve();
        });
        ws.addEventListener("error", () => ws.close());
        ws.addEventListener("message", (event) => {
          const env = JSON.parse(String(event.data)) as { type: string; envelope_id?: string; payload?: Record<string, unknown>; reason?: string };
          // Every envelope is acknowledged right away, or Slack retries it and shows an error.
          if (env.envelope_id) ws.send(JSON.stringify({ envelope_id: env.envelope_id }));
          if (env.type === "disconnect") return ws.close();
          if (env.type !== "interactive" || env.payload?.type !== "block_actions") return;
          const p = env.payload as {
            actions: Array<{ action_id: string; value: string }>;
            channel?: { id: string };
            container?: { channel_id?: string; message_ts?: string };
            message?: { ts: string };
            user?: { name?: string; username?: string };
          };
          for (const a of p.actions) {
            void onAction({
              actionId: a.action_id,
              value: a.value,
              channelId: p.channel?.id ?? p.container?.channel_id ?? "",
              messageTs: p.message?.ts ?? p.container?.message_ts ?? "",
              userName: p.user?.name ?? p.user?.username ?? "someone",
            }).catch((error) => log(`action failed: ${(error as Error).message}`));
          }
        });
      });
    } catch (error) {
      log(`Socket Mode error: ${(error as Error).message}`);
      await sleep(30_000, signal);
    }
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}
