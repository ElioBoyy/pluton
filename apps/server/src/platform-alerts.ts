import { onPlatformCapAlert, type PlatformCapAlert } from "@pluton/db";
import { appMailConfigured, sendMail } from "@pluton/providers";

const usd = (micro: number) => `$${(micro / 1_000_000).toFixed(2)}`;

function describe(a: PlatformCapAlert) {
  const share = Math.round((a.spentMicroUsd / a.capMicroUsd) * 100);
  const window = a.period === "monthly" ? "this month" : "today";
  const until = a.until.toISOString().slice(0, 16).replace("T", " ");
  return a.threshold >= 1
    ? `${a.source}: platform cap reached (${usd(a.spentMicroUsd)} of ${usd(a.capMicroUsd)} ${window}). Pluton's ${a.source} key is paused for every customer until ${until} UTC; customers with their own key carry on.`
    : `${a.source}: ${share}% of the platform cap used (${usd(a.spentMicroUsd)} of ${usd(a.capMicroUsd)} ${window}). It pauses for every customer at 100%, until ${until} UTC.`;
}

/**
 * Hosted, the operator hears when one of Pluton's own keys nears or reaches its platform-wide cap
 * (PLATFORM_MONTHLY_CAP_USD_<SOURCE>, PLATFORM_DAILY_CAP_USD_<SOURCE>): always in the server log,
 * and by email to PLUTON_OPERATOR_EMAIL when the app can send mail. In English: it is for whoever
 * runs Pluton, not for customers. Only the server listens, so one alert goes out per threshold.
 */
export function watchPlatformCaps() {
  const to = process.env.PLUTON_OPERATOR_EMAIL?.trim();
  onPlatformCapAlert((alert) => {
    const text = describe(alert);
    console.warn(`[platform cap] ${text}`);
    if (!to || !appMailConfigured()) return;
    const subject = alert.threshold >= 1 ? `Pluton: ${alert.source} paused for everyone` : `Pluton: ${alert.source} at ${Math.round(alert.threshold * 100)}% of its cap`;
    void sendMail({ to, subject, text, html: `<p>${text}</p>` }).catch((error) => console.error(`[platform cap] email failed: ${(error as Error).message}`));
  });
}
