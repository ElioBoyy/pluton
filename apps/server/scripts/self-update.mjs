// Updates a self-hosted install in place to a release: fetches its tag, fast-forwards main to it,
// runs `pnpm install`, then restarts the server and the worker. The server starts it detached, so
// it outlives the server it updates: under `pnpm dev`, moving to the release changes the server's
// own files and node --watch restarts it midway.
// Progress goes to a JSON file the server (old or restarted) reads back for the app.
//
//   node self-update.mjs <repoRoot> <statusFile> <release tag> <pnpm entry or ""> <files to touch, JSON>
import { spawn } from "node:child_process";
import fs from "node:fs";

const [repoRoot, statusFile, tag, pnpmEntry, touchJson] = process.argv.slice(2);
const touch = JSON.parse(touchJson || "[]");
const status = { state: "running", tag, step: "pull", log: [], startedAt: new Date().toISOString(), finishedAt: null, error: null };

/** Written whole (a temporary file renamed over it), so a reader never gets half of it. */
function save() {
  status.log = status.log.slice(-40);
  fs.writeFileSync(`${statusFile}.tmp`, JSON.stringify(status));
  fs.renameSync(`${statusFile}.tmp`, statusFile);
}

/** Runs a command, every output line into the log; resolves on exit 0, rejects otherwise. */
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    // pnpm's own entry runs under this Node, on every system; plain `pnpm` needs a shell on Windows.
    const child = spawn(cmd, args, { cwd: repoRoot, shell: process.platform === "win32" && cmd === "pnpm", env: { ...process.env, CI: "1" } });
    const onData = (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) status.log.push(line.slice(0, 300));
      save();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`))));
  });
}

try {
  save();
  await run("git", ["fetch", "--tags", "origin"]);
  // Only forward: local commits the release doesn't contain stop the update rather than mix with it.
  await run("git", ["merge", "--ff-only", `refs/tags/${tag}`]);
  status.step = "install";
  save();
  await (pnpmEntry ? run(process.execPath, [pnpmEntry, "install"]) : run("pnpm", ["install"]));
  status.step = "restart";
  save();
  // Under node --watch, a changed entry file restarts that process with the new code and modules.
  const now = new Date();
  for (const file of touch) fs.utimesSync(file, now, now);
  status.state = "done";
} catch (err) {
  status.state = "failed";
  status.error = err instanceof Error ? err.message : String(err);
}
status.finishedAt = new Date().toISOString();
save();
