import { defineMessages } from "@pluton/i18n";

/** What the onboarding chat says when a research stage can't reach Claude or fails. */
export default defineMessages({
  en: {
    invalidKey: "I can't reach {provider}: the API key is invalid. Fix it in Settings → API keys, then retry.",
    rateLimited: "{provider} is rate-limiting me right now. Retry in a minute.",
    apiError: "{provider} returned an error ({status}). You can retry this step.",
    noKey: "I can't reach Claude: no API key is configured. Add it in Settings → API keys (or switch to your Claude subscription there), then retry.",
    failed: "This step failed: {error}",
  },
  fr: {
    invalidKey: "Je n’arrive pas à joindre {provider} : la clé d’API est invalide. Corrigez-la dans Réglages → Clés d’API, puis réessayez.",
    rateLimited: "{provider} limite mes requêtes en ce moment. Réessayez dans une minute.",
    apiError: "{provider} a renvoyé une erreur ({status}). Vous pouvez relancer cette étape.",
    noKey: "Je n’arrive pas à joindre Claude : aucune clé d’API n’est configurée. Ajoutez-la dans Réglages → Clés d’API (ou passez à votre abonnement Claude au même endroit), puis réessayez.",
    failed: "Cette étape a échoué : {error}",
  },
  it: {
    invalidKey: "Non riesco a raggiungere {provider}: la chiave API non è valida. Correggila in Impostazioni → Chiavi API, poi riprova.",
    rateLimited: "{provider} sta limitando le mie richieste in questo momento. Riprova tra un minuto.",
    apiError: "{provider} ha restituito un errore ({status}). Puoi riprovare questo passaggio.",
    noKey: "Non riesco a raggiungere Claude: nessuna chiave API configurata. Aggiungila in Impostazioni → Chiavi API (o passa al tuo abbonamento Claude da lì), poi riprova.",
    failed: "Questo passaggio non è riuscito: {error}",
  },
  es: {
    invalidKey: "No puedo conectar con {provider}: la clave de API no es válida. Corrígela en Ajustes → Claves de API y vuelve a intentarlo.",
    rateLimited: "{provider} está limitando mis peticiones ahora mismo. Reinténtalo en un minuto.",
    apiError: "{provider} devolvió un error ({status}). Puedes reintentar este paso.",
    noKey: "No puedo conectar con Claude: no hay ninguna clave de API configurada. Añádela en Ajustes → Claves de API (o cambia allí a tu suscripción de Claude) y vuelve a intentarlo.",
    failed: "Este paso ha fallado: {error}",
  },
  de: {
    invalidKey: "Ich erreiche {provider} nicht: Der API-Schlüssel ist ungültig. Korrigieren Sie ihn unter Einstellungen → API-Schlüssel und versuchen Sie es erneut.",
    rateLimited: "{provider} drosselt gerade meine Anfragen. Versuchen Sie es in einer Minute erneut.",
    apiError: "{provider} hat einen Fehler gemeldet ({status}). Sie können diesen Schritt wiederholen.",
    noKey: "Ich erreiche Claude nicht: Es ist kein API-Schlüssel eingerichtet. Fügen Sie ihn unter Einstellungen → API-Schlüssel hinzu (oder wechseln Sie dort zu Ihrem Claude-Abo) und versuchen Sie es erneut.",
    failed: "Dieser Schritt ist fehlgeschlagen: {error}",
  },
});
