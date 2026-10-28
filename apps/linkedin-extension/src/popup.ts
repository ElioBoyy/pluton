import type { HistoryEntry, Message, Status } from "./background.ts";

/** The toolbar popup: read-only. Its token for pairing, whether Pluton and LinkedIn are reached, and what was done. */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const RESULT: Record<string, string> = {
  sent: "invitation envoyée",
  visited: "profil visité",
  already_pending: "invitation déjà en attente",
  already_connected: "déjà en relation",
  email_required: "e-mail demandé : à faire vous-même",
  not_available: "impossible : à faire vous-même",
  disconnected: "LinkedIn déconnecté",
  error: "échec",
};

const send = <T>(message: Message) => chrome.runtime.sendMessage(message) as Promise<T>;

function label(r: HistoryEntry["result"]) {
  const base = RESULT[r.status] ?? r.status;
  return "detail" in r && r.detail ? `${base} (${r.detail})` : base;
}

function state(id: string, ok: boolean, text: string) {
  $(`${id}-dot`).classList.toggle("ok", ok);
  $(id).textContent = text;
}

async function refresh() {
  const s = await send<Status>({ type: "status" });
  state(
    "pluton",
    s.paired === true,
    s.paired === true ? `Associée à Pluton : ${s.name}` : s.paired === false ? "Pas encore associée à Pluton." : (s.error ?? "Pluton injoignable."),
  );
  state("linkedin", s.linkedin, s.linkedin ? "LinkedIn est connecté dans ce navigateur." : "LinkedIn n'est pas connecté dans ce navigateur.");
  $("pairing").hidden = s.paired === true;
  $("token").textContent = s.token;
  $("recent").hidden = s.history.length === 0;
  $("history").replaceChildren(
    ...s.history.slice(0, 5).map((h) => {
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

$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("token").textContent ?? "");
  $("copy").textContent = "Copié";
  setTimeout(() => ($("copy").textContent = "Copier"), 1500);
});

void refresh();
// The check-in the popup started may pair it in a moment.
setTimeout(() => void refresh(), 1500);
