/**
 * The page a founder opens on their phone to sign in to LinkedIn through the runner's browser:
 * the browser's screen as an image, taps on it played back there, and a field to type into it
 * (masked by default: it is usually the password).
 */
export function connectPage({ expired }: { expired: boolean }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex" />
<title>Connexion LinkedIn · Pluton</title>
<style>
  :root { color-scheme: dark; --bg: #0e0e12; --panel: #1b1b22; --ink: #f4f4f7; --muted: #9a9aa6; --accent: #4f5bff; --ok: #34c759; --warn: #ff9f0a; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink); font: 15px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  body { display: flex; flex-direction: column; padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom); }
  header { padding: 14px 16px 10px; }
  h1 { margin: 0; font-size: 17px; }
  #status { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
  #status.ok { color: var(--ok); } #status.warn { color: var(--warn); }
  main { flex: 1; min-height: 0; display: flex; justify-content: center; padding: 0 12px; }
  #screen { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 12px; background: #fff; touch-action: none; user-select: none; -webkit-user-select: none; }
  #screen[hidden] { display: none; }
  form { display: flex; gap: 8px; padding: 10px 12px 12px; }
  input { flex: 1; min-width: 0; height: 44px; border: 0; border-radius: 10px; padding: 0 12px; background: var(--panel); color: var(--ink); font-size: 16px; }
  button { height: 44px; min-width: 44px; border: 0; border-radius: 10px; padding: 0 14px; background: var(--panel); color: var(--ink); font-size: 15px; }
  button.primary { background: var(--accent); color: #fff; font-weight: 600; }
  .done { margin: auto; padding: 24px; text-align: center; color: var(--muted); }
  .done strong { display: block; margin-bottom: 6px; color: var(--ink); font-size: 17px; }
</style>
</head>
<body>
${
  expired
    ? `<p class="done"><strong>Ce lien a expiré</strong>Relancez la connexion de votre compte LinkedIn depuis Pluton.</p>`
    : `<header><h1>Connexion à LinkedIn</h1><p id="status">Ouverture de LinkedIn…</p></header>
<main><img id="screen" alt="Page de connexion LinkedIn" hidden /></main>
<p class="done" id="done" hidden><strong>Compte connecté</strong>Vous pouvez fermer cette page et revenir dans Pluton.</p>
<form id="type" autocomplete="off">
  <input id="text" type="password" placeholder="Touchez un champ, puis tapez ici" autocapitalize="off" autocorrect="off" spellcheck="false" />
  <button type="button" id="reveal" aria-label="Afficher le texte">👁</button>
  <button type="button" id="back" aria-label="Effacer">⌫</button>
  <button type="button" id="enter" aria-label="Entrée">↵</button>
  <button type="submit" class="primary">Taper</button>
</form>
<script>
  const q = location.search;
  const base = location.pathname;
  const img = document.getElementById("screen");
  const status = document.getElementById("status");
  const text = document.getElementById("text");
  const STATUS = {
    starting: ["Ouverture de LinkedIn…", ""],
    login: ["Touchez un champ de la page, puis tapez votre saisie en bas.", ""],
    checkpoint: ["LinkedIn demande une vérification : suivez ses instructions.", "warn"],
    connected: ["Compte connecté.", "ok"],
    expired: ["Ce lien a expiré.", "warn"],
    error: ["La connexion n'a pas pu s'ouvrir.", "warn"],
  };
  const send = (input) => fetch(base + "/input" + q, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });

  const events = new EventSource(base + "/stream" + q);
  events.addEventListener("frame", (e) => { img.src = "data:image/jpeg;base64," + e.data; img.hidden = false; });
  events.addEventListener("status", (e) => {
    const s = JSON.parse(e.data);
    const [label, tone] = STATUS[s.status] || [s.status, ""];
    status.textContent = s.message ? label + " " + s.message : label;
    status.className = tone;
    if (s.status === "connected" || s.status === "expired") {
      events.close();
      img.hidden = true;
      document.getElementById("type").hidden = true;
      if (s.status === "connected") document.getElementById("done").hidden = false;
    }
  });

  // A tap is a click at the same place in the browser; a swipe scrolls its page.
  let start = null;
  img.addEventListener("pointerdown", (e) => { start = { x: e.clientX, y: e.clientY }; });
  img.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dy = start.y - e.clientY;
    start = null;
    const r = img.getBoundingClientRect();
    if (Math.abs(dy) > 12) return void send({ type: "scroll", dy: dy * (img.naturalHeight / r.height) });
    send({ type: "tap", x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  });

  document.getElementById("type").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (text.value) await send({ type: "text", text: text.value });
    text.value = "";
  });
  document.getElementById("enter").addEventListener("click", () => send({ type: "key", key: "Enter" }));
  document.getElementById("back").addEventListener("click", () => send({ type: "key", key: "Backspace" }));
  document.getElementById("reveal").addEventListener("click", () => { text.type = text.type === "password" ? "text" : "password"; text.focus(); });
</script>`
}
</body>
</html>`;
}
