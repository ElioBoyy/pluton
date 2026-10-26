import type { Strings } from "./index.ts";

export default {
  meta: {
    title: "Pluton : le bon prospect, au bon moment",
    description:
      "Pluton surveille votre marché, repère les personnes dont l'entreprise vient de recruter, de publier ou de lever des fonds, et leur écrit avec votre voix. Rien ne part sans votre accord.",
  },
  nav: {
    how: "Fonctionnement",
    blink: "Comparer un marché",
    messages: "Messages",
    pricing: "Tarifs",
    faq: "Questions",
    start: "Commencer",
    language: "Langue",
  },
  hero: {
    lines: ["Le bon prospect,", "au bon moment."],
    sub: "Pluton surveille votre marché, repère les personnes dont l'entreprise vient de recruter, de publier ou de lever des fonds, et leur écrit avec votre voix. Rien ne part sans votre accord.",
    cta: "Commencer avec votre site",
    pause: "Arrêter le clignotement",
    play: "Faire clignoter les plaques",
    plateA: "23 janvier 1930",
    plateB: "29 janvier 1930",
    caption: "Les plaques sur lesquelles Clyde Tombaugh a trouvé Pluton, observatoire Lowell.",
  },
  intro: {
    heading: ["Le marché semble immobile.", "Pas vos prochains clients."],
    lines: ["Pluton a été trouvée en 1930", "grâce au seul point", "qui bougeait entre deux plaques.", "Pluton observe votre marché", "de la même façon."],
    note: "Clyde Tombaugh photographiait le même coin de ciel à six jours d'écart et passait d'une plaque à l'autre. Les étoiles restent en place. Ce qui bouge mérite un regard.",
    photoA: "Le comparateur à clignotement de Tombaugh, observatoire Lowell.",
    photoB: "Le registre de Tombaugh, une ligne par plaque exposée.",
  },
  how: {
    heading: "Comment marche Pluton",
    stagesLabel: "Étape",
    stages: [
      {
        name: "Brain",
        clause: "D'abord, il lit votre site",
        text: "Donnez-lui votre site, ou deux phrases. Pluton étudie votre entreprise, votre marché, vos clients idéaux, vos personas, vos concurrents et votre ton, puis vous montre tout pour que vous le corrigiez.",
      },
      {
        name: "Play",
        clause: "Puis vous dites qui viser",
        text: "Décrivez-les avec vos mots. Pluton pose les questions qu'il lui faut, puis propose un Play : qui, comment les trouver, combien et à quel rythme.",
      },
      {
        name: "Leads",
        clause: "Il note chaque personne",
        text: "Les sources gratuites d'abord : registres d'entreprises, pages carrières, détection de technos, recherche web. Chaque score de 0 à 100 vient avec ses preuves.",
      },
      {
        name: "Message",
        clause: "Enfin, il écrit avec votre voix",
        text: "Jusqu'à trois messages par personne, écrits à partir de son signal et du ton de votre Brain. Vous les relisez tous, et une réponse arrête la séquence.",
      },
    ],
    brain: {
      title: "Brain",
      company: "Atelier Kilo",
      rows: [
        ["Entreprise", "Logiciel de comptabilité pour agences d'architecture."],
        ["Client idéal", "Agences de 5 à 50 personnes en France et en Belgique."],
        ["Personas", "Fondateur d'agence, office manager"],
        ["Concurrents", "Tableurs, suites comptables généralistes"],
        ["Ton", "Simple, court, sans jargon."],
      ],
    },
    play: {
      title: "Agences qui recrutent",
      rows: [
        ["Qui", "Fondateurs d'agences d'architecture qui recrutent"],
        ["Comment", "Pages carrières, sites d'emploi, registre"],
        ["Combien", "15 nouvelles personnes par semaine"],
        ["Quand", "En semaine à 07:00"],
        ["Limite", "8 € par recherche"],
      ],
      action: "Créer ce Play",
    },
    leads: {
      title: "Leads, par pertinence",
      fit: "Score",
      rows: [
        ["Camille Roux", "Fondatrice, Atelier Roux", "Recrute un architecte chef de projet", "92"],
        ["Hugo Lefèvre", "Associé, Studio Brume", "A publié sur les retards de paiement", "87"],
        ["Inès Garnier", "Office manager, Garnier & Fils", "A ouvert un second bureau", "74"],
        ["Paul Meyer", "Fondateur, Atelier Nord", "A changé d'outil comptable", "61"],
      ],
      evidence: "Preuve : page carrières, il y a trois jours",
    },
    message: {
      to: "À Camille Roux, LinkedIn",
      body: "Bonjour Camille, j'ai vu qu'Atelier Roux recrute un architecte chef de projet. Passé dix personnes, la facturation mange souvent les vendredis d'une agence. Atelier Kilo s'en charge pour les agences de votre taille. Ça vaut un coup d'œil ?",
      status: "En attente de votre relecture",
      approve: "Valider",
      edit: "Modifier",
    },
    sample: "Espace d'exemple. Les noms sont inventés.",
  },
  blink: {
    heading: "Comparez un marché",
    text: "Les mêmes soixante entreprises, lundi puis jeudi. Passez de lundi à jeudi : ceux qui ont bougé méritent un message.",
    monday: "Lundi",
    thursday: "Jeudi",
    switchLabel: "Afficher la plaque de jeudi",
    hint: "Touchez une entreprise marquée pour voir pourquoi elle a bougé.",
    sample: "Marché d'exemple. Les noms sont inventés.",
    fit: "Score",
    source: "Source",
    movers: [
      ["Atelier Roux", "Recrute un architecte chef de projet", "Page carrières, il y a 3 jours", "92"],
      ["Studio Brume", "Le fondateur a publié sur les retards de paiement", "Post LinkedIn, hier", "87"],
      ["Maison Arc", "A levé un tour d'amorçage", "Presse, il y a 2 jours", "81"],
      ["Garnier & Fils", "A ouvert un second bureau", "Registre, cette semaine", "74"],
      ["Atelier Nord", "A changé d'outil comptable", "Technos du site, il y a 4 jours", "61"],
    ],
  },
  compose: {
    heading: "Chaque mot passe par vous",
    blocks: [
      {
        title: "LinkedIn ou email",
        text: "Pluton écrit les deux versions de chaque message et passe à l'email quand une invitation reste sans réponse.",
      },
      {
        title: "Dans leur langue",
        text: "Cinq langues, celle de votre Brain ou une autre pour chaque séquence.",
      },
      {
        title: "Vous choisissez qui envoie",
        text: "Envoi depuis votre compte connecté, dans une plage horaire en semaine, ou une liste de tâches avec le texte prêt à copier.",
      },
      {
        title: "Rien ne part sans vous",
        text: "Chaque message attend votre relecture. Une réponse arrête la séquence toute seule.",
      },
    ],
    channelLabel: "Canal",
    languageLabel: "Langue",
    modeLabel: "Envoi",
    modeAuto: "Automatique",
    modeManual: "À la main",
    approve: "Valider",
    approved: "Validé",
    undo: "Annuler",
    to: "À",
    subject: "Objet",
    statusReview: "En attente de votre relecture",
    statusAuto: "Part mardi à 9:40. Dix minutes pour annuler.",
    statusManual: "Dans vos tâches, prêt à copier.",
  },
  pricing: {
    heading: "Pluton, hébergé",
    planLabel: "Formule",
    own: "Votre propre IA",
    all: "Tout compris",
    perMonth: "par mois",
    ownLines: [
      "Votre jeton d'abonnement Claude ou Codex, ou vos clés API",
      "Brain, Plays, leads, séquences LinkedIn et email",
      "Slack, HubSpot, Attio, Pipedrive et MCP pour votre IA",
      "Tourne même ordinateur fermé",
    ],
    allLines: [
      "Claude inclus, jusqu'à un quota mensuel",
      "Au-delà du quota, l'usage est facturé en plus",
      "Brain, Plays, leads, séquences LinkedIn et email",
      "Slack, HubSpot, Attio, Pipedrive et MCP pour votre IA",
    ],
    cta: "Commencer",
    selfHost: "Ou faites-le tourner vous-même. Sur votre machine, Pluton est gratuit pour un usage non commercial.",
    selfHostLink: "Le code sur GitHub",
  },
  faq: {
    heading: "Avant de commencer",
    items: [
      [
        "Est-ce que quelque chose part sans moi ?",
        "Non. Chaque message attend votre relecture, et ce que vous validez peut encore être annulé pendant dix minutes. Une réponse de la personne arrête sa séquence.",
      ],
      [
        "D'où viennent les leads ?",
        "Des sources gratuites d'abord : registres d'entreprises, pages carrières, détection des technos d'un site et recherche web. Ajoutez une clé TheirStack, Apify ou Hunter et Pluton cherche aussi dans les offres d'emploi de tout le marché, l'engagement LinkedIn et les adresses email.",
      ],
      [
        "Comment traite-t-il mon compte LinkedIn ?",
        "Il n'agit que dans une plage d'envoi en semaine, sous des limites quotidiennes par compte (80 visites, 20 invitations, 50 messages par défaut) et avec des pauses aléatoires entre les actions. Tout se règle, et vous pouvez tout envoyer à la main.",
      ],
      [
        "Ai-je besoin de mon propre compte Claude ?",
        "Avec la formule à 19,99 €, oui : vous apportez un jeton d'abonnement Claude ou Codex, ou des clés API. Avec la formule à 49,99 €, Claude est inclus jusqu'à un quota mensuel.",
      ],
      [
        "Puis-je l'utiliser depuis Claude Code ou Codex ?",
        "Oui. Pluton a un serveur MCP avec les mêmes actions que l'app. Une recherche annonce d'abord son coût et attend votre confirmation, tout comme les séquences et les exports CRM.",
      ],
      [
        "Est-ce qu'il garde mes dépenses sous contrôle ?",
        "Chaque appel payant est noté à son coût réel, par Play et par lead. Fixez un budget mensuel et un plafond par recherche ; une recherche s'arrête à son plafond et rend ce qu'elle n'a pas utilisé.",
      ],
      [
        "Puis-je envoyer les leads dans mon CRM ?",
        "Oui : HubSpot, Attio et Pipedrive, à la main ou à la validation, plus l'export CSV. Pluton ne fait que créer des fiches ; il ne modifie ni ne supprime rien dans votre CRM.",
      ],
      [
        "Qu'est-ce qui change si je l'héberge moi-même ?",
        "Tout vit dans un fichier SQLite sur votre machine et rien n'en sort, sauf les appels aux services que vous connectez. C'est gratuit pour un usage non commercial ; l'usage commercial demande une autorisation écrite.",
      ],
    ],
  },
  footer: {
    notes: [
      "Pluton est conçu et développé par Mathis Sportiello.",
      "Gratuit sur votre machine pour un usage non commercial.",
    ],
    top: "Retour aux plaques",
    display: "github.com/ElioBoyy/pluton",
    license: "Licence",
    picturesLabel: "Images",
    year: "2026",
  },
} satisfies Strings;
