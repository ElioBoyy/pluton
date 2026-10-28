import type { HistoryEntry, Message, Status } from "./background.ts";

/** The toolbar popup: whether LinkedIn is signed in here, a test invitation, and the latest results. */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const RESULT: Record<string, string> = {
  sent: "Invitation envoyée.",
  already_pending: "Une invitation est déjà en attente pour ce profil.",
  already_connected: "Vous êtes déjà en relation.",
  email_required: "LinkedIn demande l'e-mail de la personne : invitation non envoyée.",
  not_available: "Bouton d'invitation introuvable sur ce profil.",
  disconnected: "LinkedIn n'est pas connecté dans ce navigateur.",
  error: "L'invitation a échoué.",
};

const send = <T>(message: Message) => chrome.runtime.sendMessage(message) as Promise<T>;

function label(r: HistoryEntry["result"]) {
  const base = RESULT[r.status] ?? r.status;
  return "detail" in r && r.detail ? `${base} (${r.detail})` : base;
}

async function refresh() {
  const status = await send<Status>({ type: "status" });
  $("dot").classList.toggle("ok", status.linkedin);
  $("state").innerHTML = status.linkedin
    ? "LinkedIn est connecté dans ce navigateur."
    : 'LinkedIn n\'est pas connecté. <a href="https://www.linkedin.com/login" target="_blank">Se connecter</a>';
  const list = $("history");
  list.replaceChildren(
    ...status.history.slice(0, 5).map((h) => {
      const li = document.createElement("li");
      const who = document.createElement("span");
      who.textContent = h.profileUrl.replace(/^https?:\/\/[^/]+\/in\//, "").replace(/\/$/, "");
      const what = document.createElement("span");
      what.className = "muted";
      what.textContent = label(h.result);
      li.append(who, what);
      return li;
    }),
  );
}

$("test").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = $<HTMLButtonElement>("send");
  button.disabled = true;
  $("result").textContent = "Envoi en cours, dans un onglet en arrière-plan…";
  const result = await send<HistoryEntry["result"]>({ type: "invite", profileUrl: $<HTMLInputElement>("url").value.trim(), note: $<HTMLTextAreaElement>("note").value });
  $("result").textContent = label(result);
  button.disabled = false;
  await refresh();
});

void refresh();
