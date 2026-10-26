import type { Strings } from "./index.ts";

export default {
  meta: {
    title: "Pluton: encuentra a quien acaba de moverse",
    description:
      "Pluton vigila tu mercado, detecta a las personas cuya empresa acaba de empezar a contratar, a publicar o a levantar fondos, y les escribe con tu voz. No sale nada hasta que tú lo digas.",
  },
  nav: {
    how: "Cómo funciona",
    blink: "Compara un mercado",
    messages: "Mensajes",
    pricing: "Precios",
    faq: "Preguntas",
    start: "Empezar",
    language: "Idioma",
  },
  hero: {
    lines: ["Encuentra a quien", "acaba de moverse"],
    sub: "Pluton vigila tu mercado, detecta a las personas cuya empresa acaba de empezar a contratar, a publicar o a levantar fondos, y les escribe con tu voz. No sale nada hasta que tú lo digas.",
    cta: "Empieza con tu web",
    pause: "Detener el parpadeo",
    play: "Hacer parpadear las placas",
    plateA: "23 de enero de 1930",
    plateB: "29 de enero de 1930",
    caption: "Las placas en las que Clyde Tombaugh encontró Plutón, Observatorio Lowell.",
  },
  intro: {
    heading: ["Las estrellas quedan.", "Mira lo que se mueve."],
    lines: ["Plutón se descubrió en 1930", "gracias al único punto", "que se movía entre dos placas.", "Pluton vigila tu mercado", "de la misma forma."],
    note: "Clyde Tombaugh fotografiaba el mismo trozo de cielo con seis días de diferencia y alternaba entre las placas. Las estrellas no se mueven. Lo que se mueve merece una mirada.",
    photoA: "El comparador de parpadeo que usaba Tombaugh, Observatorio Lowell.",
    photoB: "El registro de Tombaugh con cada placa que expuso.",
  },
  how: {
    heading: "Cómo funciona Pluton",
    stagesLabel: "Etapa",
    stages: [
      {
        name: "Brain",
        clause: "Primero, lee tu web",
        text: "Dale tu web, o dos frases. Pluton investiga tu empresa, tu mercado, tus clientes ideales, tus personas, tus competidores y tu tono, y te lo muestra todo para que lo edites.",
      },
      {
        name: "Play",
        clause: "Luego dices a quién llegar",
        text: "Descríbelos con palabras sencillas. Pluton pregunta lo que necesita y propone un Play: quién, cómo encontrarlos, cuántos y con qué frecuencia.",
      },
      {
        name: "Leads",
        clause: "Puntúa a cada persona",
        text: "Primero las fuentes gratuitas: registros mercantiles, páginas de empleo, detección de tecnologías, búsqueda web. Cada puntuación de 0 a 100 llega con las pruebas que la respaldan.",
      },
      {
        name: "Message",
        clause: "Por último, escribe con tu voz",
        text: "Hasta tres mensajes por persona, escritos a partir de su señal y del tono de tu Brain. Los lees todos, y una respuesta detiene la secuencia.",
      },
    ],
    brain: {
      title: "Brain",
      company: "Atelier Kilo",
      rows: [
        ["Empresa", "Software de contabilidad para estudios de arquitectura."],
        ["Cliente ideal", "Estudios de 5 a 50 personas en Francia y Bélgica."],
        ["Personas", "Fundador del estudio, office manager"],
        ["Competidores", "Hojas de cálculo, suites contables generalistas"],
        ["Tono", "Claro, breve, sin jerga."],
      ],
    },
    play: {
      title: "Estudios que contratan",
      rows: [
        ["Quién", "Fundadores de estudios de arquitectura que contratan"],
        ["Cómo los encontramos", "Páginas de empleo, portales de empleo, registro mercantil"],
        ["Cuántos", "15 personas nuevas por semana"],
        ["Cuándo", "Entre semana a las 07:00"],
        ["Límite", "8 € por búsqueda"],
      ],
      action: "Crear este Play",
    },
    leads: {
      title: "Leads, por encaje",
      fit: "Encaje",
      rows: [
        ["Camille Roux", "Fundadora, Atelier Roux", "Busca un arquitecto jefe de proyecto", "92"],
        ["Hugo Lefèvre", "Socio, Studio Brume", "Publicó sobre facturas impagadas", "87"],
        ["Inès Garnier", "Office manager, Garnier & Fils", "Abrió una segunda oficina", "74"],
        ["Paul Meyer", "Fundador, Atelier Nord", "Cambió de herramienta contable", "61"],
      ],
      evidence: "Prueba: página de empleo, hace tres días",
    },
    message: {
      to: "Para Camille Roux, LinkedIn",
      body: "Hola Camille, vi que Atelier Roux busca un arquitecto jefe de proyecto. A partir de diez personas, la facturación suele comerse los viernes de un estudio. Atelier Kilo se encarga de ella para estudios de vuestro tamaño. ¿Le echas un vistazo?",
      status: "Pendiente de tu revisión",
      approve: "Aprobar",
      edit: "Editar",
    },
    sample: "Espacio de ejemplo. Los nombres son inventados.",
  },
  blink: {
    heading: "Compara un mercado",
    text: "Las mismas sesenta empresas el lunes y el jueves. Cambia de placa: lo que se movió merece un mensaje.",
    monday: "Lunes",
    thursday: "Jueves",
    switchLabel: "Mostrar la placa del jueves",
    hint: "Toca una empresa marcada para ver por qué se movió.",
    sample: "Mercado de ejemplo. Los nombres son inventados.",
    fit: "Encaje",
    source: "Fuente",
    movers: [
      ["Atelier Roux", "Busca un arquitecto jefe de proyecto", "Página de empleo, hace 3 días", "92"],
      ["Studio Brume", "El fundador publicó sobre facturas impagadas", "Post en LinkedIn, ayer", "87"],
      ["Maison Arc", "Cerró una ronda semilla", "Prensa, hace 2 días", "81"],
      ["Garnier & Fils", "Abrió una segunda oficina", "Registro mercantil, esta semana", "74"],
      ["Atelier Nord", "Cambió de herramienta contable", "Tecnología de la web, hace 4 días", "61"],
    ],
  },
  compose: {
    heading: "Cada palabra pasa por ti",
    blocks: [
      {
        title: "LinkedIn o email",
        text: "Pluton escribe las dos versiones de cada mensaje y pasa al email cuando una invitación queda sin respuesta.",
      },
      {
        title: "En su idioma",
        text: "Cinco idiomas, el de tu Brain o uno elegido para cada secuencia.",
      },
      {
        title: "Tú eliges quién envía",
        text: "Envía desde tu cuenta conectada dentro de una franja horaria entre semana, o recibe una lista de tareas con el texto listo para copiar.",
      },
      {
        title: "Nada sale sin que lo veas",
        text: "Cada mensaje espera tu revisión. Una respuesta detiene la secuencia por sí sola.",
      },
    ],
    channelLabel: "Canal",
    languageLabel: "Idioma",
    modeLabel: "Envío",
    modeAuto: "Automático",
    modeManual: "A mano",
    approve: "Aprobar",
    approved: "Aprobado",
    undo: "Deshacer",
    to: "Para",
    subject: "Asunto",
    statusReview: "Pendiente de tu revisión",
    statusAuto: "Sale el martes a las 9:40. Diez minutos para deshacer.",
    statusManual: "En tu lista de tareas, listo para copiar.",
  },
  pricing: {
    heading: "Pluton, alojado",
    planLabel: "Plan",
    own: "Tu propia IA",
    all: "Todo incluido",
    perMonth: "al mes",
    ownLines: [
      "Usa el token de tu suscripción a Claude o Codex, o tus claves API",
      "Brain, Plays, leads, secuencias de LinkedIn y email",
      "Slack, HubSpot, Attio, Pipedrive y MCP para tu IA",
      "Sigue funcionando con el portátil cerrado",
    ],
    allLines: [
      "Claude incluido, hasta una cuota mensual",
      "El uso por encima de la cuota se factura aparte",
      "Brain, Plays, leads, secuencias de LinkedIn y email",
      "Slack, HubSpot, Attio, Pipedrive y MCP para tu IA",
    ],
    cta: "Empezar",
    selfHost: "O ejecútalo tú mismo. En tu propia máquina Pluton es gratis para uso no comercial.",
    selfHostLink: "El código en GitHub",
  },
  faq: {
    heading: "Antes de empezar",
    items: [
      [
        "¿Se envía algo sin mí?",
        "No. Cada mensaje espera tu revisión, y lo que apruebas aún se puede deshacer durante diez minutos. Una respuesta de la persona detiene su secuencia.",
      ],
      [
        "¿De dónde salen los leads?",
        "Primero de fuentes gratuitas: registros mercantiles, páginas de empleo, detección de tecnologías web y búsqueda web. Añade una clave de TheirStack, Apify o Hunter y Pluton también busca en ofertas de empleo de todo el mercado, en la interacción en LinkedIn y en direcciones de email.",
      ],
      [
        "¿Cómo trata mi cuenta de LinkedIn?",
        "Solo actúa dentro de una franja de envío entre semana, con límites diarios por cuenta (80 visitas, 20 invitaciones, 50 mensajes por defecto) y con pausas aleatorias entre acciones. Puedes cambiarlo todo, o enviarlo todo a mano.",
      ],
      [
        "¿Necesito mi propia cuenta de Claude?",
        "Con el plan de 19,99 €, sí: aportas un token de suscripción a Claude o Codex, o claves API. Con el plan de 49,99 €, Claude está incluido hasta una cuota mensual.",
      ],
      [
        "¿Puedo usarlo desde Claude Code o Codex?",
        "Sí. Pluton tiene un servidor MCP con las mismas acciones que la app. Una búsqueda muestra primero su coste y espera tu confirmación, igual que las secuencias y las exportaciones al CRM.",
      ],
      [
        "¿Mantiene mi gasto bajo control?",
        "Cada llamada de pago queda registrada con su coste real, por Play y por lead. Fija un presupuesto mensual y un tope por búsqueda; una búsqueda se detiene en su tope y devuelve lo que no ha usado.",
      ],
      [
        "¿Puedo enviar los leads a mi CRM?",
        "Sí: HubSpot, Attio y Pipedrive, a mano o al aprobar, además de exportación a CSV. Pluton solo crea registros; nunca actualiza ni borra nada en tu CRM.",
      ],
      [
        "¿Qué cambia si lo alojo yo?",
        "Todo vive en un archivo SQLite en tu máquina y nada sale de ella salvo las llamadas a los servicios que conectes. Es gratis para uso no comercial; el uso comercial requiere permiso por escrito.",
      ],
    ],
  },
  footer: {
    notes: [
      "Pluton está diseñado y desarrollado por Mathis Sportiello.",
      "Gratis en tu propia máquina para uso no comercial.",
    ],
    top: "Volver a las placas",
    display: "github.com/ElioBoyy/pluton",
    license: "Licencia",
    picturesLabel: "Imágenes",
    year: "2026",
  },
} satisfies Strings;
