import { defineMessages } from "@pluton/i18n";

/** Why Pluton holds back a job when an account asks for too much at once. */
export default defineMessages({
  en: {
    concurrentRuns: "{count} searches are already running. Start this one when one of them is done.",
    perHour: "That's a lot of work for one hour: Pluton takes it up again in a few minutes.",
    perDay: "Pluton has done all it can for today on this account. It picks up again tomorrow.",
  },
  fr: {
    concurrentRuns: "{count} recherches tournent déjà. Lancez celle-ci quand l’une d’elles est terminée.",
    perHour: "Beaucoup de travail pour une heure : Pluton reprend dans quelques minutes.",
    perDay: "Pluton a fait tout ce qu’il pouvait aujourd’hui sur ce compte. Il reprend demain.",
  },
  it: {
    concurrentRuns: "{count} ricerche sono già in corso. Avvia questa quando una di loro è finita.",
    perHour: "È molto lavoro per un’ora: Pluton riprende tra qualche minuto.",
    perDay: "Pluton ha fatto tutto il possibile oggi su questo account. Riprende domani.",
  },
  es: {
    concurrentRuns: "Ya hay {count} búsquedas en marcha. Lanza esta cuando termine una de ellas.",
    perHour: "Es mucho trabajo para una hora: Pluton retoma en unos minutos.",
    perDay: "Pluton ha hecho todo lo que podía hoy en esta cuenta. Retoma mañana.",
  },
  de: {
    concurrentRuns: "Es laufen bereits {count} Suchen. Starten Sie diese, sobald eine davon fertig ist.",
    perHour: "Das ist viel Arbeit für eine Stunde: Pluton macht in ein paar Minuten weiter.",
    perDay: "Pluton hat heute für dieses Konto alles getan, was möglich ist. Morgen geht es weiter.",
  },
});
