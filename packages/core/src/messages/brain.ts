import { defineMessages } from "@pluton/i18n";

/** Errors the founder can hit while editing the Brain or acting on a suggestion. */
export default defineMessages({
  en: {
    conflict: "This item changed since you opened it; reload and retry",
    singletonExists: "This section holds a single item; edit it instead",
    activeExists: "This section already has an active item; archive it first",
    proposalHandled: "This suggestion was already handled",
  },
  fr: {
    conflict: "Cet élément a changé depuis que vous l’avez ouvert ; rechargez et réessayez",
    singletonExists: "Cette section ne contient qu’un élément ; modifiez-le plutôt",
    activeExists: "Cette section a déjà un élément actif ; archivez-le d’abord",
    proposalHandled: "Cette suggestion a déjà été traitée",
  },
  it: {
    conflict: "Questo elemento è cambiato da quando l’hai aperto; ricarica e riprova",
    singletonExists: "Questa sezione contiene un solo elemento; modificalo invece",
    activeExists: "Questa sezione ha già un elemento attivo; archivialo prima",
    proposalHandled: "Questo suggerimento è già stato gestito",
  },
  es: {
    conflict: "Este elemento cambió desde que lo abriste; recarga y vuelve a intentarlo",
    singletonExists: "Esta sección tiene un solo elemento; edítalo en su lugar",
    activeExists: "Esta sección ya tiene un elemento activo; archívalo primero",
    proposalHandled: "Esta sugerencia ya se ha gestionado",
  },
  de: {
    conflict: "Dieses Element wurde geändert, seit Sie es geöffnet haben. Laden Sie neu und versuchen Sie es erneut",
    singletonExists: "Dieser Bereich enthält nur ein Element. Bearbeiten Sie stattdessen dieses",
    activeExists: "Dieser Bereich hat bereits ein aktives Element. Archivieren Sie es zuerst",
    proposalHandled: "Dieser Vorschlag wurde bereits bearbeitet",
  },
});
