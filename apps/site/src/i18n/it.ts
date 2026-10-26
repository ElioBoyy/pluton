import type { Strings } from "./index.ts";

export default {
  meta: {
    title: "Pluton: trova le persone che si sono mosse",
    description:
      "Pluton osserva il tuo mercato, individua le persone la cui azienda ha appena iniziato ad assumere, a pubblicare o a raccogliere fondi, e scrive loro con la tua voce. Non parte nulla finché non lo dici tu.",
  },
  nav: {
    how: "Come funziona",
    blink: "Confronta un mercato",
    messages: "Messaggi",
    pricing: "Prezzi",
    faq: "Domande",
    start: "Inizia",
    language: "Lingua",
  },
  hero: {
    lines: ["Trova le persone", "che si sono mosse"],
    sub: "Pluton osserva il tuo mercato, individua le persone la cui azienda ha appena iniziato ad assumere, a pubblicare o a raccogliere fondi, e scrive loro con la tua voce. Non parte nulla finché non lo dici tu.",
    cta: "Inizia dal tuo sito",
    pause: "Ferma il lampeggio",
    play: "Fai lampeggiare le lastre",
    plateA: "23 gennaio 1930",
    plateB: "29 gennaio 1930",
    caption: "Le lastre su cui Clyde Tombaugh trovò Plutone, Lowell Observatory.",
  },
  intro: {
    heading: ["Le stelle restano.", "Guarda cosa si muove."],
    lines: ["Plutone fu scoperto nel 1930", "grazie all'unico punto", "che si muoveva tra due lastre.", "Pluton osserva il tuo mercato", "allo stesso modo."],
    note: "Clyde Tombaugh fotografava lo stesso tratto di cielo a sei giorni di distanza e passava da una lastra all'altra. Le stelle restano ferme. Ciò che si muove merita uno sguardo.",
    photoA: "Il comparatore a intermittenza usato da Tombaugh, Lowell Observatory.",
    photoB: "Il registro di Tombaugh con ogni lastra esposta.",
  },
  how: {
    heading: "Come funziona Pluton",
    stagesLabel: "Fase",
    stages: [
      {
        name: "Brain",
        clause: "Prima, legge il tuo sito",
        text: "Dagli il tuo sito, o due frasi. Pluton studia la tua azienda, il mercato, i clienti ideali, le personas, i concorrenti e il tono, e ti mostra tutto perché tu possa modificarlo.",
      },
      {
        name: "Play",
        clause: "Poi dici chi raggiungere",
        text: "Descrivili con parole semplici. Pluton chiede ciò che gli serve, poi propone un Play: chi, come trovarli, quanti e con quale frequenza.",
      },
      {
        name: "Leads",
        clause: "Dà un punteggio a ognuno",
        text: "Prima le fonti gratuite: registri delle imprese, pagine carriere, rilevamento delle tecnologie, ricerca web. Ogni punteggio da 0 a 100 arriva con le prove che lo sostengono.",
      },
      {
        name: "Message",
        clause: "Infine, scrive con la tua voce",
        text: "Fino a tre messaggi per persona, scritti a partire dal loro segnale e dal tono del tuo Brain. Li leggi tutti, e una risposta interrompe la sequenza.",
      },
    ],
    brain: {
      title: "Brain",
      company: "Atelier Kilo",
      rows: [
        ["Azienda", "Software di contabilità per studi di architettura."],
        ["Cliente ideale", "Studi da 5 a 50 persone in Francia e Belgio."],
        ["Personas", "Fondatore dello studio, office manager"],
        ["Concorrenti", "Fogli di calcolo, suite contabili generaliste"],
        ["Tono", "Semplice, breve, senza gergo."],
      ],
    },
    play: {
      title: "Studi che assumono",
      rows: [
        ["Chi", "Fondatori di studi di architettura che assumono"],
        ["Come li troviamo", "Pagine carriere, siti di annunci, registro imprese"],
        ["Quanti", "15 nuove persone a settimana"],
        ["Quando", "Nei giorni feriali alle 07:00"],
        ["Limite", "8 € per ricerca"],
      ],
      action: "Crea questo Play",
    },
    leads: {
      title: "Leads, per affinità",
      fit: "Affinità",
      rows: [
        ["Camille Roux", "Fondatrice, Atelier Roux", "Cerca un architetto capo progetto", "92"],
        ["Hugo Lefèvre", "Socio, Studio Brume", "Ha scritto delle fatture in ritardo", "87"],
        ["Inès Garnier", "Office manager, Garnier & Fils", "Ha aperto un secondo ufficio", "74"],
        ["Paul Meyer", "Fondatore, Atelier Nord", "Ha cambiato software contabile", "61"],
      ],
      evidence: "Prova: pagina carriere, tre giorni fa",
    },
    message: {
      to: "A Camille Roux, LinkedIn",
      body: "Ciao Camille, ho visto che Atelier Roux cerca un architetto capo progetto. Oltre le dieci persone, la fatturazione tende a mangiarsi i venerdì di uno studio. Atelier Kilo se ne occupa per studi della vostra dimensione. Vale un'occhiata?",
      status: "In attesa della tua revisione",
      approve: "Approva",
      edit: "Modifica",
    },
    sample: "Spazio di esempio. I nomi sono inventati.",
  },
  blink: {
    heading: "Confronta un mercato",
    text: "Le stesse sessanta aziende, lunedì e giovedì. Cambia lastra: ciò che si è mosso merita un messaggio.",
    monday: "Lunedì",
    thursday: "Giovedì",
    switchLabel: "Mostra la lastra di giovedì",
    hint: "Tocca un'azienda segnata per vedere perché si è mossa.",
    sample: "Mercato di esempio. I nomi sono inventati.",
    fit: "Affinità",
    source: "Fonte",
    movers: [
      ["Atelier Roux", "Cerca un architetto capo progetto", "Pagina carriere, 3 giorni fa", "92"],
      ["Studio Brume", "Il fondatore ha scritto delle fatture in ritardo", "Post LinkedIn, ieri", "87"],
      ["Maison Arc", "Ha chiuso un round seed", "Stampa, 2 giorni fa", "81"],
      ["Garnier & Fils", "Ha aperto un secondo ufficio", "Registro imprese, questa settimana", "74"],
      ["Atelier Nord", "Ha cambiato software contabile", "Tecnologie del sito, 4 giorni fa", "61"],
    ],
  },
  compose: {
    heading: "Ogni parola passa da te",
    blocks: [
      {
        title: "LinkedIn o email",
        text: "Pluton scrive entrambe le versioni di ogni messaggio e passa all'email quando un invito resta senza risposta.",
      },
      {
        title: "Nella loro lingua",
        text: "Cinque lingue, quella del tuo Brain o una scelta per ogni sequenza.",
      },
      {
        title: "Scegli tu chi invia",
        text: "Invia dal tuo account collegato in una fascia oraria feriale, oppure ricevi una lista di cose da fare con il testo pronto da copiare.",
      },
      {
        title: "Niente parte senza di te",
        text: "Ogni messaggio aspetta la tua revisione. Una risposta interrompe la sequenza da sola.",
      },
    ],
    channelLabel: "Canale",
    languageLabel: "Lingua",
    modeLabel: "Invio",
    modeAuto: "Automatico",
    modeManual: "A mano",
    approve: "Approva",
    approved: "Approvato",
    undo: "Annulla",
    to: "A",
    subject: "Oggetto",
    statusReview: "In attesa della tua revisione",
    statusAuto: "Parte martedì alle 9:40. Dieci minuti per annullare.",
    statusManual: "Nella tua lista, pronto da copiare.",
  },
  pricing: {
    heading: "Pluton, in hosting",
    planLabel: "Piano",
    own: "La tua IA",
    all: "Tutto incluso",
    perMonth: "al mese",
    ownLines: [
      "Usa il token del tuo abbonamento Claude o Codex, o le tue chiavi API",
      "Brain, Plays, leads, sequenze LinkedIn ed email",
      "Slack, HubSpot, Attio, Pipedrive e MCP per la tua IA",
      "Continua a funzionare anche a portatile chiuso",
    ],
    allLines: [
      "Claude incluso, fino a una quota mensile",
      "L'uso oltre la quota è fatturato a parte",
      "Brain, Plays, leads, sequenze LinkedIn ed email",
      "Slack, HubSpot, Attio, Pipedrive e MCP per la tua IA",
    ],
    cta: "Inizia",
    selfHost: "Oppure gestiscilo tu. Sulla tua macchina Pluton è gratuito per uso non commerciale.",
    selfHostLink: "Il codice su GitHub",
  },
  faq: {
    heading: "Prima di iniziare",
    items: [
      [
        "Parte qualcosa senza di me?",
        "No. Ogni messaggio aspetta la tua revisione, e ciò che approvi può ancora essere annullato per dieci minuti. Una risposta della persona interrompe la sua sequenza.",
      ],
      [
        "Da dove arrivano i leads?",
        "Prima dalle fonti gratuite: registri delle imprese, pagine carriere, rilevamento delle tecnologie dei siti e ricerca web. Aggiungi una chiave TheirStack, Apify o Hunter e Pluton cerca anche negli annunci di lavoro di tutto il mercato, nell'engagement su LinkedIn e negli indirizzi email.",
      ],
      [
        "Come tratta il mio account LinkedIn?",
        "Agisce solo in una fascia di invio feriale, entro limiti giornalieri per account (80 visite, 20 inviti, 50 messaggi di default) e con pause casuali tra un'azione e l'altra. Puoi cambiare tutto, oppure inviare tutto a mano.",
      ],
      [
        "Mi serve un mio account Claude?",
        "Con il piano da 19,99 €, sì: porti un token di abbonamento Claude o Codex, oppure delle chiavi API. Con il piano da 49,99 € Claude è incluso fino a una quota mensile.",
      ],
      [
        "Posso usarlo da Claude Code o Codex?",
        "Sì. Pluton ha un server MCP con le stesse azioni dell'app. Una ricerca mostra prima il suo costo e aspetta la tua conferma, e lo stesso vale per le sequenze e gli export verso il CRM.",
      ],
      [
        "Tiene sotto controllo la mia spesa?",
        "Ogni chiamata a pagamento è registrata al suo costo reale, per Play e per lead. Imposta un budget mensile e un tetto per ricerca; una ricerca si ferma al suo tetto e restituisce ciò che non ha usato.",
      ],
      [
        "Posso inviare i leads al mio CRM?",
        "Sì: HubSpot, Attio e Pipedrive, a mano o all'approvazione, più l'export CSV. Pluton crea solo record; non aggiorna né cancella mai nulla nel tuo CRM.",
      ],
      [
        "Cosa cambia se lo ospito io?",
        "Tutto vive in un file SQLite sulla tua macchina e nulla ne esce, tranne le chiamate ai servizi che colleghi. È gratuito per uso non commerciale; l'uso commerciale richiede un'autorizzazione scritta.",
      ],
    ],
  },
  footer: {
    notes: [
      "Pluton è progettato e sviluppato da Mathis Sportiello.",
      "Gratuito sulla tua macchina per uso non commerciale.",
    ],
    top: "Torna alle lastre",
    display: "github.com/ElioBoyy/pluton",
    license: "Licenza",
    picturesLabel: "Immagini",
    year: "2026",
  },
} satisfies Strings;
