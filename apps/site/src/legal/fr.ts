import { HOST, PUBLISHER, type LegalDoc, type LegalDocId } from "./publisher.ts";

const fill = (value: string, what: string) => value || `[À compléter : ${what}]`;
const email = fill(PUBLISHER.email, "adresse e-mail de contact");
const publisher = `${PUBLISHER.name}, entrepreneur individuel (EI)`;

/** La version qui fait foi. */
const fr: Record<LegalDocId, LegalDoc> = {
  notice: {
    title: "Mentions légales",
    sections: [
      {
        heading: "Éditeur",
        body: [
          {
            list: [
              `${publisher}, exerçant sous le nom commercial Pluton`,
              `SIRET : ${fill(PUBLISHER.siret, "numéro SIRET")}`,
              `Adresse : ${fill(PUBLISHER.address, "adresse postale")}`,
              `E-mail : ${email}`,
              "TVA non applicable, article 293 B du Code général des impôts",
            ],
          },
          `Directeur de la publication : ${PUBLISHER.name}.`,
        ],
      },
      {
        heading: "Hébergement",
        body: [
          "Le site et l'application Pluton sont hébergés sur un serveur situé en Allemagne, dans l'Union européenne, par :",
          { list: [HOST.name, `${HOST.address}, Allemagne`, `Téléphone : ${HOST.phone}`, HOST.website] },
        ],
      },
      {
        heading: "Propriété intellectuelle",
        body: [
          `Le nom Pluton, son logo, les textes, l'interface et la mise en page du site appartiennent à ${PUBLISHER.name}. Toute reproduction sans autorisation écrite est interdite.`,
          "Le code source de Pluton est publié sur GitHub sous la licence PolyForm Noncommercial 1.0.0 : il peut être utilisé gratuitement à des fins non commerciales, et toute utilisation commerciale demande une autorisation écrite.",
          "Les photographies du site sont utilisées selon leurs licences respectives, indiquées sur la page Crédits des images.",
        ],
      },
      {
        heading: "Contact",
        body: [`Pour toute question, ou pour signaler un contenu illicite : ${email}.`],
      },
    ],
  },

  terms: {
    title: "Conditions générales d'utilisation",
    intro:
      "Ces conditions générales d'utilisation (CGU) fixent les règles d'utilisation du site Pluton et du service Pluton hébergé. Les conditions commerciales de l'abonnement figurent dans les conditions générales de vente (CGV).",
    sections: [
      {
        heading: "1. Objet et acceptation",
        body: [
          `Pluton est un service en ligne édité par ${publisher}, ci-après « l'Éditeur ». En créant un compte, l'Utilisateur accepte sans réserve les présentes CGU, les CGV et la politique de confidentialité.`,
          "Le service hébergé est réservé aux professionnels qui l'utilisent pour les besoins de leur activité. Il n'est pas destiné aux consommateurs.",
        ],
      },
      {
        heading: "2. Définitions",
        body: [
          {
            list: [
              "Service : l'application Pluton hébergée par l'Éditeur, y compris son serveur MCP, accessible après abonnement.",
              "Utilisateur ou Client : le professionnel qui crée un compte et souscrit un abonnement.",
              "Contenus Client : tout ce que le Client fournit ou que le Service produit pour lui (informations sur son entreprise, Brain, Plays, leads, messages, réglages).",
              "Données de prospects : les données personnelles des personnes que le Client recherche ou contacte avec le Service.",
            ],
          },
        ],
      },
      {
        heading: "3. Compte",
        body: [
          "L'Utilisateur se connecte avec son compte Google ou Apple. Il est responsable de la sécurité de ce compte et de toute action réalisée depuis sa session Pluton.",
          "L'accès au Service, y compris aux questions de l'onboarding, n'est ouvert qu'après la souscription d'un abonnement payant dans les conditions des CGV.",
        ],
      },
      {
        heading: "4. Le Service",
        body: [
          "Pluton construit, à partir du site web du Client, un « Brain » de son entreprise (cible, personas, concurrents, ton), trouve et note des leads à partir de sources publiques et des services que le Client connecte, et prépare des séquences LinkedIn et e-mail rédigées dans son style.",
          "Aucun message n'est envoyé sans que le Client l'ait relu ou ait lui-même activé l'envoi automatique d'une séquence. Les contenus produits par l'intelligence artificielle (textes, scores, analyses) peuvent comporter des erreurs : le Client les vérifie avant de s'en servir.",
          "L'Éditeur fait évoluer le Service et peut en modifier les fonctionnalités, sans en supprimer l'essentiel en cours d'abonnement.",
        ],
      },
      {
        heading: "5. Engagements de l'Utilisateur",
        body: [
          "L'Utilisateur s'engage à utiliser le Service conformément aux lois applicables, notamment :",
          {
            list: [
              "le RGPD et la loi Informatique et Libertés pour les Données de prospects, dont il est responsable de traitement (base légale, information des personnes, prise en compte des oppositions) ;",
              "les règles de la prospection commerciale par voie électronique : un message lié à la fonction du destinataire et un moyen simple de s'y opposer ;",
              "les conditions d'utilisation de LinkedIn et des autres services qu'il connecte.",
            ],
          },
          "Il s'interdit d'envoyer des messages non sollicités en masse, des contenus illicites, trompeurs ou harcelants, de contourner les limites techniques du Service, de tenter d'en compromettre la sécurité et de revendre ou partager son accès.",
          "Les messages envoyés depuis le Service le sont au nom du Client et sous sa seule responsabilité, y compris lorsque l'envoi automatique est activé.",
        ],
      },
      {
        heading: "6. Services tiers",
        body: [
          "Le Service peut se connecter, à la demande du Client, à des services tiers : LinkedIn (via Unipile), sa messagerie (SMTP et IMAP), Slack, HubSpot, Attio, Pipedrive, des fournisseurs de données (Hunter, Apify, TheirStack) et, pour l'offre « Votre propre IA », son abonnement Claude ou Codex ou ses clés d'API.",
          "Ces services restent soumis à leurs propres conditions. L'Éditeur n'est pas responsable de leur disponibilité, de leurs tarifs ni des restrictions qu'ils appliquent au compte du Client, par exemple une limitation de son compte LinkedIn.",
        ],
      },
      {
        heading: "7. Contenus Client",
        body: [
          "Le Client reste propriétaire de ses Contenus Client. Il accorde à l'Éditeur le droit de les héberger, de les traiter et de les transmettre aux services qu'il a connectés, uniquement pour lui fournir le Service.",
          "L'Éditeur n'utilise pas les Contenus Client pour entraîner des modèles d'intelligence artificielle et ne les vend pas.",
        ],
      },
      {
        heading: "8. Données personnelles traitées pour le Client",
        body: [
          "Pour les Données de prospects et les autres données personnelles contenues dans les Contenus Client, le Client est responsable de traitement et l'Éditeur agit comme sous-traitant au sens de l'article 28 du RGPD. À ce titre, l'Éditeur :",
          {
            list: [
              "ne traite ces données que pour fournir le Service, selon les instructions que le Client donne en l'utilisant ;",
              "veille à la confidentialité et à la sécurité des données ;",
              "fait appel aux sous-traitants listés dans la politique de confidentialité, et informe le Client de tout changement afin qu'il puisse s'y opposer ;",
              "aide le Client à répondre aux demandes des personnes concernées et à remplir ses obligations de sécurité ;",
              "notifie au Client toute violation de données dans les meilleurs délais après en avoir pris connaissance ;",
              "supprime les données à la fin de l'abonnement, dans les délais prévus par les CGV ;",
              "met à sa disposition, sur demande, les informations nécessaires pour démontrer le respect de ces obligations.",
            ],
          },
        ],
      },
      {
        heading: "9. Propriété intellectuelle",
        body: [
          "Le Service, sa marque et son interface appartiennent à l'Éditeur. L'abonnement donne au Client un droit d'utilisation personnel, non exclusif et non transférable du Service hébergé, pour la durée de l'abonnement.",
          "Le code source publié sur GitHub reste régi par sa propre licence (PolyForm Noncommercial 1.0.0).",
        ],
      },
      {
        heading: "10. Disponibilité",
        body: [
          "L'Éditeur met en œuvre des moyens raisonnables pour que le Service soit accessible en continu, sans garantie de disponibilité. Il peut l'interrompre pour maintenance, en prévenant à l'avance lorsque c'est possible.",
        ],
      },
      {
        heading: "11. Suspension et fermeture du compte",
        body: [
          "En cas de manquement aux présentes CGU, l'Éditeur peut suspendre l'accès au Service après une mise en demeure restée sans effet pendant 8 jours, ou immédiatement en cas d'atteinte grave à la sécurité du Service ou aux droits de tiers.",
          `Le Client peut résilier son abonnement depuis l'application et demander la fermeture de son compte à ${email}.`,
        ],
      },
      {
        heading: "12. Modification des CGU",
        body: [
          "L'Éditeur peut modifier les présentes CGU. Toute modification importante est notifiée au Client au moins 30 jours avant son entrée en vigueur ; le Client qui la refuse peut résilier son abonnement avant cette date.",
        ],
      },
      {
        heading: "13. Droit applicable",
        body: ["Les présentes CGU sont soumises au droit français. Les litiges sont traités comme prévu dans les CGV."],
      },
    ],
  },

  sales: {
    title: "Conditions générales de vente",
    intro: `Ces conditions générales de vente (CGV) s'appliquent aux abonnements au service Pluton hébergé, conclus entre ${publisher} (« l'Éditeur ») et ses clients professionnels (« le Client »).`,
    sections: [
      {
        heading: "1. Champ d'application",
        body: [
          "Les abonnements sont réservés aux professionnels, personnes physiques ou morales, agissant pour les besoins de leur activité. En souscrivant, le Client déclare agir à ce titre.",
          "Les présentes CGV prévalent sur tout autre document du Client. Elles complètent les conditions générales d'utilisation (CGU).",
          "La version auto-hébergée de Pluton, publiée sur GitHub, n'est pas concernée : elle est régie par sa licence.",
        ],
      },
      {
        heading: "2. Offres",
        body: [
          {
            list: [
              "« Votre propre IA » : 39,99 € par mois. Le Client fournit son propre abonnement Claude ou Codex, ou ses clés d'API, dont le coût reste à sa charge.",
              "« Tout compris » : 59,99 € par mois. L'usage de Claude est inclus jusqu'à un quota mensuel de [À compléter : quota inclus]. Au-delà, l'usage est facturé en plus, au tarif de [À compléter : tarif du dépassement].",
            ],
          },
          "Sauf mention contraire, les services tiers que le Client connecte avec ses propres clés (fournisseurs de données, LinkedIn via Unipile, CRM) sont payés par lui directement à ces services.",
        ],
      },
      {
        heading: "3. Prix",
        body: [
          "Les prix sont indiqués en euros. TVA non applicable, article 293 B du Code général des impôts : les montants affichés sont les montants payés.",
          "L'Éditeur peut modifier ses prix. Le nouveau prix est notifié au Client au moins 30 jours à l'avance et s'applique à partir du renouvellement suivant ; le Client qui le refuse peut résilier avant cette date.",
        ],
      },
      {
        heading: "4. Souscription",
        body: [
          "Le Client se connecte avec Google ou Apple, choisit son offre puis paie sur la page de paiement sécurisée de Stripe. Le contrat est conclu dès la confirmation du paiement, et l'accès au Service est ouvert immédiatement.",
        ],
      },
      {
        heading: "5. Paiement",
        body: [
          "L'abonnement se paie par carte bancaire, d'avance, chaque mois, par l'intermédiaire de Stripe. Le Client autorise ces prélèvements récurrents jusqu'à la résiliation. Le dépassement de quota de l'offre « Tout compris » est facturé avec l'échéance suivante.",
          "Les factures sont disponibles depuis l'application, dans Réglages → Budget → Gérer l'abonnement.",
          "En cas d'échec de paiement, Stripe présente de nouveau le paiement. Si l'échéance reste impayée, l'accès au Service est suspendu jusqu'à régularisation. Conformément à l'article L441-10 du Code de commerce, tout retard de paiement entraîne des pénalités égales à trois fois le taux d'intérêt légal et une indemnité forfaitaire de 40 € pour frais de recouvrement.",
        ],
      },
      {
        heading: "6. Durée et résiliation",
        body: [
          "L'abonnement est conclu pour un mois et se renouvelle automatiquement chaque mois.",
          "Le Client peut résilier à tout moment depuis Réglages → Budget → Gérer l'abonnement. La résiliation prend effet à la fin de la période en cours, déjà payée ; aucun remboursement au prorata n'est dû.",
          "Le Client peut changer d'offre de la même façon ; le changement prend effet dans les conditions affichées au moment de le confirmer.",
          "En cas de manquement grave de l'une des parties, l'autre peut résilier après une mise en demeure restée sans effet pendant 15 jours.",
        ],
      },
      {
        heading: "7. Absence de droit de rétractation",
        body: [
          "Le Service étant réservé aux professionnels, le droit de rétractation prévu par le Code de la consommation ne s'applique pas.",
        ],
      },
      {
        heading: "8. Récupération et suppression des données",
        body: [
          "Pendant l'abonnement, le Client peut exporter ses leads (CSV ou vers son CRM). Après la fin de l'abonnement, ses Contenus Client restent conservés 30 jours, pendant lesquels il peut se réabonner pour les retrouver, puis sont supprimés, à l'exception des données que l'Éditeur doit conserver en vertu de la loi (facturation).",
        ],
      },
      {
        heading: "9. Garanties",
        body: [
          "L'Éditeur s'engage à fournir le Service avec soin, dans le cadre d'une obligation de moyens. Il ne garantit ni un nombre de leads, ni des réponses, ni un résultat commercial, ni l'exactitude des contenus produits par l'intelligence artificielle ou des données issues de sources tierces.",
        ],
      },
      {
        heading: "10. Responsabilité",
        body: [
          "L'Éditeur n'est responsable que des dommages directs et prouvés qui résultent d'un manquement à ses obligations. Il n'est pas responsable des dommages indirects, tels que la perte de chiffre d'affaires, de clientèle ou d'opportunités, ni des conséquences de l'usage que le Client fait des messages, des leads ou des services tiers.",
          "Sauf faute lourde ou dolosive, la responsabilité totale de l'Éditeur est limitée aux sommes payées par le Client au cours des 12 mois précédant le fait générateur.",
        ],
      },
      {
        heading: "11. Force majeure",
        body: [
          "Aucune partie n'est responsable d'un manquement causé par un cas de force majeure au sens de l'article 1218 du Code civil, y compris une panne générale d'un hébergeur ou d'un fournisseur essentiel.",
        ],
      },
      {
        heading: "12. Données personnelles",
        body: [
          "Les traitements de données personnelles sont décrits dans la politique de confidentialité. Les engagements de l'Éditeur en tant que sous-traitant figurent à l'article 8 des CGU.",
        ],
      },
      {
        heading: "13. Droit applicable et litiges",
        body: [
          "Les présentes CGV sont soumises au droit français. En cas de litige, les parties recherchent d'abord une solution amiable pendant 30 jours à compter de la réclamation écrite de l'une d'elles. À défaut, le litige est porté devant les juridictions françaises compétentes.",
        ],
      },
    ],
  },

  privacy: {
    title: "Politique de confidentialité",
    intro:
      "Cette politique explique quelles données personnelles Pluton traite, pourquoi, avec qui, combien de temps, et comment exercer vos droits.",
    sections: [
      {
        heading: "1. Qui est responsable",
        body: [
          `Le responsable de traitement est ${publisher}, ${fill(PUBLISHER.address, "adresse postale")}. Contact pour toute question sur vos données : ${email}.`,
          "Si vous utilisez Pluton sur votre propre machine (version auto-hébergée), vos données restent sur cette machine : l'Éditeur n'en reçoit aucune.",
        ],
      },
      {
        heading: "2. Deux rôles différents",
        body: [
          {
            list: [
              "Pour les données de votre compte, de votre abonnement et du site, l'Éditeur est responsable de traitement.",
              "Pour les données que vous traitez avec Pluton, en particulier celles des personnes que vous prospectez, vous êtes responsable de traitement et l'Éditeur est votre sous-traitant (article 8 des CGU).",
            ],
          },
        ],
      },
      {
        heading: "3. Les données de votre compte",
        body: [
          {
            list: [
              "Connexion : l'identifiant technique que Google ou Apple nous transmet, votre adresse e-mail (éventuellement l'adresse relais d'Apple) et votre nom. Finalité : créer votre compte et vous connecter. Base légale : l'exécution du contrat.",
              "Abonnement : votre identifiant client Stripe, l'offre choisie, l'état de l'abonnement et ses dates, vos factures. Vos données de carte sont saisies chez Stripe et ne nous parviennent jamais. Bases légales : l'exécution du contrat et nos obligations comptables.",
              "Sécurité : les journaux du serveur (adresse IP, date, page demandée). Finalité : faire fonctionner et protéger le Service. Base légale : notre intérêt légitime.",
              "Échanges : les messages que vous nous envoyez. Finalité : vous répondre.",
            ],
          },
          "Le site vitrine ne dépose aucun cookie et n'utilise aucun outil de mesure d'audience ni de publicité.",
        ],
      },
      {
        heading: "4. Les données traitées pour vous",
        body: [
          "Pour vous fournir le Service, Pluton héberge et traite pour votre compte :",
          {
            list: [
              "les informations sur votre entreprise et votre Brain ;",
              "les données de vos prospects : nom, fonction, entreprise, profil LinkedIn, adresse e-mail professionnelle, signaux publics (offres d'emploi, technologies, publications) ;",
              "vos messages, les réponses reçues et l'historique des séquences ;",
              "les accès que vous connectez (compte LinkedIn via Unipile, messagerie, clés d'API), chiffrés en AES-256-GCM.",
            ],
          },
          "Ces données ne servent qu'à vous fournir le Service. Elles ne sont ni vendues ni utilisées pour entraîner des modèles d'intelligence artificielle.",
        ],
      },
      {
        heading: "5. Destinataires et sous-traitants",
        body: [
          "Vos données ne sont accessibles qu'à l'Éditeur et aux prestataires nécessaires au Service :",
          {
            list: [
              "Hetzner Online GmbH (Allemagne) : hébergement du site, de l'application et de la base de données ;",
              "Stripe Payments Europe, Ltd. (Irlande) : paiement et facturation ;",
              "Google et Apple : connexion, si vous choisissez ce moyen de vous connecter ;",
              "Anthropic (États-Unis) : l'intelligence artificielle Claude, y compris sa recherche web, pour l'offre « Tout compris ». Avec l'offre « Votre propre IA », ce traitement passe par votre propre compte.",
            ],
          },
          "Les services que vous connectez vous-même (Unipile pour LinkedIn, votre messagerie, Hunter, Apify, TheirStack, Slack, HubSpot, Attio, Pipedrive) ne reçoivent que les données nécessaires à l'action que vous lancez, selon leurs propres conditions.",
        ],
      },
      {
        heading: "6. Transferts hors de l'Union européenne",
        body: [
          "Vos données sont hébergées dans l'Union européenne. Certains prestataires (Anthropic, et le cas échéant Stripe, Google ou Apple) peuvent les traiter aux États-Unis. Ces transferts sont encadrés par le Data Privacy Framework UE–États-Unis ou par les clauses contractuelles types de la Commission européenne.",
        ],
      },
      {
        heading: "7. Durées de conservation",
        body: [
          {
            list: [
              "Compte et Contenus Client : pendant l'abonnement, puis 30 jours après sa fin ;",
              "Factures et pièces comptables : 10 ans (article L123-22 du Code de commerce) ;",
              "Journaux du serveur : 12 mois au plus ;",
              "Cookie de session : 30 jours.",
            ],
          },
        ],
      },
      {
        heading: "8. Cookies et stockage local",
        body: [
          "L'application utilise uniquement des cookies nécessaires à son fonctionnement, qui ne demandent pas votre consentement :",
          {
            list: [
              "pluton_session : vous garde connecté, 30 jours ;",
              "pluton_oauth : sécurise la connexion avec Google ou Apple, 10 minutes.",
            ],
          },
          "Elle garde aussi dans votre navigateur vos préférences d'affichage (langue, thème, vues). Aucun cookie publicitaire ni de mesure d'audience n'est utilisé.",
        ],
      },
      {
        heading: "9. Sécurité",
        body: [
          "Les échanges sont chiffrés en HTTPS. Les jetons de session sont conservés sous forme d'empreinte, jamais en clair, et les secrets que vous enregistrez (clés d'API, accès) sont chiffrés. L'accès aux serveurs est réservé à l'Éditeur.",
        ],
      },
      {
        heading: "10. Vos droits",
        body: [
          `Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition, ainsi que du droit de définir des directives sur le sort de vos données après votre décès. Pour les exercer, écrivez à ${email}. Nous répondons dans un délai d'un mois.`,
          "Vous pouvez aussi introduire une réclamation auprès de la CNIL : 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, www.cnil.fr.",
        ],
      },
      {
        heading: "11. Vous avez été contacté via Pluton ?",
        body: [
          `L'entreprise qui vous a écrit est responsable de vos données : adressez-lui vos demandes en priorité. Vous pouvez aussi écrire à ${email}, et nous transmettrons votre demande au client concerné.`,
        ],
      },
      {
        heading: "12. Modifications",
        body: [
          "Cette politique peut évoluer. La date de mise à jour figure en haut de la page, et les changements importants sont notifiés aux clients par e-mail.",
        ],
      },
    ],
  },
};

export default fr;
