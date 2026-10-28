import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

/**
 * Builds the unpacked extension into dist/: load that folder in chrome://extensions (Developer mode
 * → Load unpacked). `--dev` also lets it act on http://localhost, for the fake LinkedIn test pages.
 */
const dev = process.argv.includes("--dev");
// The Pluton it pairs with by default: the hosted app, or the local server in dev; `--api=<origin>` for another.
const api = process.argv.find((a) => a.startsWith("--api="))?.slice(6) ?? (dev ? "http://localhost:8787" : "https://app.plut0n.com");

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const common = { bundle: true, target: "chrome120", outdir: "dist", minify: !dev, define: { __DEV__: String(dev) } };
// The worker and the popup load as modules; the tab script is injected as a classic script.
await build({ ...common, entryPoints: { background: "src/background.ts", popup: "src/popup.ts" }, format: "esm" });
await build({ ...common, entryPoints: { invite: "src/invite.ts" }, format: "iife" });

const manifest = {
  manifest_version: 3,
  name: dev ? "Pluton LinkedIn (dev)" : "Pluton LinkedIn",
  version: "0.1.0",
  description: "Does the LinkedIn steps Pluton hands it, from your own browser, while it is open.",
  minimum_chrome_version: "120",
  background: { service_worker: "background.js", type: "module" },
  action: { default_popup: "popup.html", default_title: "Pluton LinkedIn" },
  // `cookies` only to tell whether LinkedIn's session cookie exists, never to read or send it.
  permissions: ["storage", "scripting", "tabs", "cookies", "alarms"],
  host_permissions: ["https://www.linkedin.com/*", `${api}/*`, ...(dev ? ["http://localhost/*"] : [])],
  // Nothing is web-accessible: a page can't probe for a file of the extension to tell it is installed.
  web_accessible_resources: [],
};
await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));
await copyFile("src/popup.html", "dist/popup.html");
// The Pluton it talks to. A zip downloaded from a Pluton server gets that server's address here and
// in host_permissions (apps/server/src/linkedin-extension.ts).
await writeFile("dist/config.json", JSON.stringify({ api }));
console.log(`built dist/ (${dev ? "dev" : "prod"}, pairs with ${api})`);
