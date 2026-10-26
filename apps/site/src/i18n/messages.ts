import type { Locale } from "./index.ts";

/** The sample message in the composer, in each language it can be written in, for each channel. */
export const SAMPLE_MESSAGES: Record<Locale, { linkedin: string; subject: string; email: string }> = {
  en: {
    linkedin:
      "Hi Camille, I saw Atelier Roux is hiring a project architect. Past ten people, invoicing tends to eat a studio's Fridays. Atelier Kilo handles it for studios your size. Worth a look?",
    subject: "Atelier Roux's Fridays",
    email:
      "Hi Camille,\n\nI saw Atelier Roux is hiring a project architect, congratulations. Past ten people, invoicing tends to eat a studio's Fridays: chasing payments, matching receipts, preparing the accountant's file.\n\nAtelier Kilo does that for architecture studios your size. Would a twenty-minute call next week be useful?\n\nBest,\nLéa",
  },
  fr: {
    linkedin:
      "Bonjour Camille, j'ai vu qu'Atelier Roux recrute un architecte chef de projet. Passé dix personnes, la facturation mange souvent les vendredis d'une agence. Atelier Kilo s'en charge pour les agences de votre taille. Ça vaut un coup d'œil ?",
    subject: "Les vendredis d'Atelier Roux",
    email:
      "Bonjour Camille,\n\nJ'ai vu qu'Atelier Roux recrute un architecte chef de projet, félicitations. Passé dix personnes, la facturation mange souvent les vendredis d'une agence : relances, rapprochements, dossier pour le comptable.\n\nAtelier Kilo s'en occupe pour les agences d'architecture de votre taille. Un appel de vingt minutes la semaine prochaine vous serait-il utile ?\n\nBien à vous,\nLéa",
  },
  it: {
    linkedin:
      "Ciao Camille, ho visto che Atelier Roux cerca un architetto capo progetto. Oltre le dieci persone, la fatturazione si mangia spesso i venerdì di uno studio. Atelier Kilo se ne occupa per studi della vostra dimensione. Vale un'occhiata?",
    subject: "I venerdì di Atelier Roux",
    email:
      "Ciao Camille,\n\nho visto che Atelier Roux cerca un architetto capo progetto, complimenti. Oltre le dieci persone, la fatturazione si mangia spesso i venerdì di uno studio: solleciti, riconciliazioni, il fascicolo per il commercialista.\n\nAtelier Kilo lo fa per studi di architettura della vostra dimensione. Ti sarebbe utile una chiamata di venti minuti la prossima settimana?\n\nA presto,\nLéa",
  },
  es: {
    linkedin:
      "Hola Camille, vi que Atelier Roux busca un arquitecto jefe de proyecto. Pasadas las diez personas, la facturación suele comerse los viernes de un estudio. Atelier Kilo se encarga de eso para estudios de vuestro tamaño. ¿Te vale la pena echar un vistazo?",
    subject: "Los viernes de Atelier Roux",
    email:
      "Hola Camille:\n\nVi que Atelier Roux busca un arquitecto jefe de proyecto, enhorabuena. Pasadas las diez personas, la facturación suele comerse los viernes de un estudio: reclamar pagos, cuadrar recibos, preparar la carpeta del gestor.\n\nAtelier Kilo lo hace para estudios de arquitectura de vuestro tamaño. ¿Te serviría una llamada de veinte minutos la semana que viene?\n\nUn saludo,\nLéa",
  },
  de: {
    linkedin:
      "Hallo Camille, ich habe gesehen, dass Atelier Roux einen Projektarchitekten sucht. Ab zehn Leuten frisst die Rechnungsstellung oft die Freitage eines Büros. Atelier Kilo übernimmt das für Büros Ihrer Größe. Lohnt sich ein Blick?",
    subject: "Die Freitage von Atelier Roux",
    email:
      "Hallo Camille,\n\nich habe gesehen, dass Atelier Roux einen Projektarchitekten sucht, herzlichen Glückwunsch. Ab zehn Leuten frisst die Rechnungsstellung oft die Freitage eines Büros: Mahnungen, Belege abgleichen, die Unterlagen für die Steuerberatung.\n\nAtelier Kilo übernimmt das für Architekturbüros Ihrer Größe. Wäre ein zwanzigminütiges Gespräch nächste Woche hilfreich?\n\nViele Grüße\nLéa",
  },
};
