// English is the source; every other language has exactly these keys (see ./index.ts).
export default {
  meta: {
    title: "Pluton: find the people who just moved",
    description:
      "Pluton watches your market, spots the people whose company just started hiring, posting or raising, and writes to them in your voice. Nothing goes out until you say so.",
  },
  nav: {
    how: "How it works",
    blink: "Blink a market",
    messages: "Messages",
    pricing: "Pricing",
    faq: "Questions",
    start: "Start",
    language: "Language",
  },
  hero: {
    lines: ["Find the people", "who just moved"],
    sub: "Pluton watches your market, spots the people whose company just started hiring, posting or raising, and writes to them in your voice. Nothing goes out until you say so.",
    cta: "Start with your website",
    pause: "Stop blinking",
    play: "Blink the plates",
    plateA: "23 January 1930",
    plateB: "29 January 1930",
    caption: "The plates on which Clyde Tombaugh found Pluto, Lowell Observatory.",
  },
  intro: {
    heading: ["Stars stay put.", "Watch what moves."],
    lines: ["Pluto was found in 1930", "by the one dot", "that moved between two plates.", "Pluton watches your market", "the same way."],
    note: "Clyde Tombaugh photographed the same patch of sky six days apart and flicked between the plates. Stars stay put. What moves is worth a look.",
    photoA: "The blink comparator Tombaugh used, Lowell Observatory.",
    photoB: "Tombaugh's log of every plate he exposed.",
  },
  how: {
    heading: "How Pluton works",
    stagesLabel: "Stage",
    stages: [
      {
        name: "Brain",
        clause: "First, it reads your website",
        text: "Give it your site, or two sentences. Pluton researches your company, market, ideal customers, personas, competitors and voice, and lays it all out for you to edit.",
      },
      {
        name: "Play",
        clause: "Then you say who to reach",
        text: "Describe them in plain words. Pluton asks what it needs, then proposes a Play: who, how to find them, how many and how often.",
      },
      {
        name: "Leads",
        clause: "It scores every person",
        text: "Free sources first: company registries, careers pages, tech detection, web search. Each score from 0 to 100 comes with the evidence behind it.",
      },
      {
        name: "Message",
        clause: "Last, it writes in your voice",
        text: "Up to three messages per person, written from their signal and your Brain's voice. You read every one, and a reply stops the sequence.",
      },
    ],
    brain: {
      title: "Brain",
      company: "Atelier Kilo",
      rows: [
        ["Company", "Accounting software for architecture studios."],
        ["Ideal customer", "Studios of 5 to 50 people in France and Belgium."],
        ["Personas", "Studio founder, office manager"],
        ["Competitors", "Spreadsheets, generalist accounting suites"],
        ["Voice", "Plain, short, no jargon."],
      ],
    },
    play: {
      title: "Studios that are hiring",
      rows: [
        ["Who", "Founders of architecture studios hiring staff"],
        ["How we find them", "Careers pages, job boards, company registry"],
        ["How many", "15 new people a week"],
        ["When", "Weekdays at 07:00"],
        ["Limit", "8 € per search"],
      ],
      action: "Create this Play",
    },
    leads: {
      title: "Leads, by fit",
      fit: "Fit",
      rows: [
        ["Camille Roux", "Founder, Atelier Roux", "Hiring a project architect", "92"],
        ["Hugo Lefèvre", "Partner, Studio Brume", "Posted about late invoices", "87"],
        ["Inès Garnier", "Office manager, Garnier & Fils", "Opened a second office", "74"],
        ["Paul Meyer", "Founder, Atelier Nord", "Changed accounting tools", "61"],
      ],
      evidence: "Evidence: careers page, three days ago",
    },
    message: {
      to: "To Camille Roux, LinkedIn",
      body: "Hi Camille, I saw Atelier Roux is hiring a project architect. Past ten people, invoicing tends to eat a studio's Fridays. Atelier Kilo handles it for studios your size. Worth a look?",
      status: "Waiting for your review",
      approve: "Approve",
      edit: "Edit",
    },
    sample: "Sample workspace. Names are made up.",
  },
  blink: {
    heading: "Blink a market",
    text: "The same sixty companies on Monday and on Thursday. Flip the plate: what moved is worth a message.",
    monday: "Monday",
    thursday: "Thursday",
    switchLabel: "Show Thursday's plate",
    hint: "Tap a marked company to see why it moved.",
    sample: "Sample market. Names are made up.",
    fit: "Fit",
    source: "Source",
    movers: [
      ["Atelier Roux", "Hiring a project architect", "Careers page, 3 days ago", "92"],
      ["Studio Brume", "Founder posted about late invoices", "LinkedIn post, yesterday", "87"],
      ["Maison Arc", "Raised a seed round", "Press, 2 days ago", "81"],
      ["Garnier & Fils", "Opened a second office", "Company registry, this week", "74"],
      ["Atelier Nord", "Changed accounting tools", "Website tech, 4 days ago", "61"],
    ],
  },
  compose: {
    heading: "Every word is yours to check",
    blocks: [
      {
        title: "LinkedIn or email",
        text: "Pluton writes both versions of every message and moves to email when an invitation goes unanswered.",
      },
      {
        title: "In their language",
        text: "Five languages, following your Brain or set for each sequence.",
      },
      {
        title: "You choose who presses send",
        text: "Send from your connected account inside a weekday window, or get a to-do list with the text ready to copy.",
      },
      {
        title: "Nothing leaves unseen",
        text: "Every message waits for your review. A reply stops the sequence on its own.",
      },
    ],
    channelLabel: "Channel",
    languageLabel: "Language",
    modeLabel: "Sending",
    modeAuto: "Automatic",
    modeManual: "By hand",
    approve: "Approve",
    approved: "Approved",
    undo: "Undo",
    to: "To",
    subject: "Subject",
    statusReview: "Waiting for your review",
    statusAuto: "Sends Tuesday at 9:40. Ten minutes to undo.",
    statusManual: "On your to-do list, ready to copy.",
  },
  pricing: {
    heading: "Pluton, hosted",
    planLabel: "Plan",
    own: "Your own AI",
    all: "All included",
    perMonth: "per month",
    ownLines: [
      "Bring your Claude or Codex subscription token, or your API keys",
      "Brain, Plays, leads, LinkedIn and email sequences",
      "Slack, HubSpot, Attio, Pipedrive and MCP for your AI",
      "Keeps running while your laptop is closed",
    ],
    allLines: [
      "Claude included, up to a monthly quota",
      "Usage beyond the quota billed on top",
      "Brain, Plays, leads, LinkedIn and email sequences",
      "Slack, HubSpot, Attio, Pipedrive and MCP for your AI",
    ],
    cta: "Start",
    selfHost: "Or run it yourself. On your own machine Pluton is free for noncommercial use.",
    selfHostLink: "Get the code on GitHub",
  },
  faq: {
    heading: "Before you start",
    items: [
      [
        "Does anything get sent without me?",
        "No. Every message waits for your review, and anything you approve can still be undone for ten minutes. A reply from the person stops their sequence.",
      ],
      [
        "Where do the leads come from?",
        "Free sources first: company registries, careers pages, website tech detection and web search. Add a TheirStack, Apify or Hunter key and Pluton also searches job boards market-wide, LinkedIn engagement and email addresses.",
      ],
      [
        "How does it treat my LinkedIn account?",
        "It acts only inside a weekday sending window, within daily limits per account (80 visits, 20 invitations, 50 messages by default) and with random gaps between actions. You can change all of it, or send everything by hand.",
      ],
      [
        "Do I need my own Claude account?",
        "On the 19.99 € plan, yes: you bring a Claude or Codex subscription token, or API keys. On the 49.99 € plan Claude is included up to a monthly quota.",
      ],
      [
        "Can I use it from Claude Code or Codex?",
        "Yes. Pluton has an MCP server with the same actions as the app. A search shows its cost first and waits for your confirmation, and so do sequences and CRM exports.",
      ],
      [
        "Does it keep my spending in check?",
        "Every paid call is logged at its real cost, per Play and per lead. Set a monthly budget and a cap per search; a search stops at its cap and gives back what it did not use.",
      ],
      [
        "Can I send leads to my CRM?",
        "Yes: HubSpot, Attio and Pipedrive, by hand or on approval, plus CSV export. Pluton only creates records; it never updates or deletes anything in your CRM.",
      ],
      [
        "What changes if I host it myself?",
        "Everything lives in a SQLite file on your machine and nothing leaves it except calls to the services you connect. It is free for noncommercial use; commercial use needs written permission.",
      ],
    ],
  },
  footer: {
    notes: [
      "Pluton is designed and built by Mathis Sportiello.",
      "Free on your own machine for noncommercial use.",
    ],
    top: "Back to the plates",
    display: "github.com/ElioBoyy/pluton",
    license: "License",
    picturesLabel: "Pictures",
    year: "2026",
  },
};
