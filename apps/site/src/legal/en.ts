import { HOST, PUBLISHER, type LegalDoc, type LegalDocId } from "./publisher.ts";

const fill = (value: string, what: string) => value || `[To fill in: ${what}]`;
const email = fill(PUBLISHER.email, "contact email address");
const publisher = `${PUBLISHER.name}, sole trader (entrepreneur individuel, EI)`;

/** A translation of the French texts, which prevail. */
const en: Record<LegalDocId, LegalDoc> = {
  notice: {
    title: "Legal notice",
    sections: [
      {
        heading: "Publisher",
        body: [
          {
            list: [
              `${publisher}, trading as Pluton`,
              `SIRET: ${fill(PUBLISHER.siret, "SIRET number")}`,
              `Address: ${fill(PUBLISHER.address, "postal address")}`,
              `Email: ${email}`,
              "VAT not applicable, article 293 B of the French General Tax Code",
            ],
          },
          `Publication director: ${PUBLISHER.name}.`,
        ],
      },
      {
        heading: "Hosting",
        body: [
          "The Pluton website and app are hosted on a server in Germany, in the European Union, by:",
          { list: [HOST.name, `${HOST.address}, Germany`, `Phone: ${HOST.phone}`, HOST.website] },
        ],
      },
      {
        heading: "Intellectual property",
        body: [
          `The Pluton name, its logo, and the website's text, interface and layout belong to ${PUBLISHER.name}. Reproduction without written permission is prohibited.`,
          "Pluton's source code is published on GitHub under the PolyForm Noncommercial 1.0.0 license: it may be used free of charge for noncommercial purposes, and any commercial use requires written permission.",
          "The website's photographs are used under their respective licenses, listed on the Picture credits page.",
        ],
      },
      {
        heading: "Contact",
        body: [`For any question, or to report unlawful content: ${email}.`],
      },
    ],
  },

  terms: {
    title: "Terms of use",
    intro:
      "These terms of use set the rules for using the Pluton website and the hosted Pluton service. The commercial terms of the subscription are in the terms of sale.",
    sections: [
      {
        heading: "1. Purpose and acceptance",
        body: [
          `Pluton is an online service published by ${publisher} (“the Publisher”). By creating an account, the User fully accepts these terms of use, the terms of sale and the privacy policy.`,
          "The hosted service is reserved for professionals using it for their business. It is not intended for consumers.",
        ],
      },
      {
        heading: "2. Definitions",
        body: [
          {
            list: [
              "Service: the Pluton app hosted by the Publisher, including its MCP server, available after subscribing.",
              "User or Customer: the professional who creates an account and subscribes.",
              "Customer Content: everything the Customer provides or the Service produces for them (company information, Brain, Plays, leads, messages, settings).",
              "Prospect Data: personal data about the people the Customer searches for or contacts with the Service.",
            ],
          },
        ],
      },
      {
        heading: "3. Account",
        body: [
          "The User signs in with their Google or Apple account. They are responsible for the security of that account and for any action taken from their Pluton session.",
          "Access to the Service, including the onboarding questions, opens only after a paid subscription is taken out under the terms of sale.",
        ],
      },
      {
        heading: "4. The Service",
        body: [
          "From the Customer's website, Pluton builds a “Brain” of their company (target market, personas, competitors, voice), finds and scores leads from public sources and the services the Customer connects, and prepares LinkedIn and email sequences written in their style.",
          "No message is sent unless the Customer has reviewed it or has turned on automatic sending for a sequence themselves. Content produced by artificial intelligence (text, scores, analyses) may contain errors: the Customer checks it before relying on it.",
          "The Publisher develops the Service and may change its features, without removing its core during a subscription.",
        ],
      },
      {
        heading: "5. User obligations",
        body: [
          "The User agrees to use the Service in compliance with applicable law, in particular:",
          {
            list: [
              "the GDPR and the French Data Protection Act for Prospect Data, for which they are the controller (legal basis, informing people, honoring objections);",
              "the rules on electronic business prospecting: a message related to the recipient's job and a simple way to opt out;",
              "the terms of use of LinkedIn and of the other services they connect.",
            ],
          },
          "They must not send bulk unsolicited messages or unlawful, misleading or harassing content, work around the Service's technical limits, attempt to compromise its security, or resell or share their access.",
          "Messages sent from the Service are sent in the Customer's name and under their sole responsibility, including when automatic sending is on.",
        ],
      },
      {
        heading: "6. Third-party services",
        body: [
          "At the Customer's request, the Service can connect to third-party services: LinkedIn (through Unipile), their mailbox (SMTP and IMAP), Slack, HubSpot, Attio, Pipedrive, data providers (Hunter, Apify, TheirStack) and, on the “Your own AI” plan, their Claude or Codex subscription or API keys.",
          "These services remain subject to their own terms. The Publisher is not responsible for their availability, their prices, or restrictions they apply to the Customer's account, such as a limit placed on their LinkedIn account.",
        ],
      },
      {
        heading: "7. Customer Content",
        body: [
          "The Customer keeps ownership of their Customer Content. They grant the Publisher the right to host it, process it and send it to the services they have connected, only to provide the Service to them.",
          "The Publisher does not use Customer Content to train artificial intelligence models and does not sell it.",
        ],
      },
      {
        heading: "8. Personal data processed for the Customer",
        body: [
          "For Prospect Data and other personal data in Customer Content, the Customer is the controller and the Publisher acts as processor under article 28 of the GDPR. As such, the Publisher:",
          {
            list: [
              "processes this data only to provide the Service, following the instructions the Customer gives by using it;",
              "keeps the data confidential and secure;",
              "uses the subprocessors listed in the privacy policy, and informs the Customer of any change so they can object;",
              "helps the Customer answer requests from data subjects and meet their security obligations;",
              "notifies the Customer of any personal data breach without undue delay after becoming aware of it;",
              "deletes the data at the end of the subscription, within the periods set in the terms of sale;",
              "makes available, on request, the information needed to show these obligations are met.",
            ],
          },
        ],
      },
      {
        heading: "9. Intellectual property",
        body: [
          "The Service, its brand and its interface belong to the Publisher. The subscription gives the Customer a personal, non-exclusive, non-transferable right to use the hosted Service for the duration of the subscription.",
          "The source code published on GitHub remains governed by its own license (PolyForm Noncommercial 1.0.0).",
        ],
      },
      {
        heading: "10. Availability",
        body: [
          "The Publisher takes reasonable steps to keep the Service available at all times, without guaranteeing availability. It may interrupt the Service for maintenance, with advance notice where possible.",
        ],
      },
      {
        heading: "11. Suspension and account closure",
        body: [
          "If these terms are breached, the Publisher may suspend access to the Service after a formal notice left unanswered for 8 days, or immediately in case of a serious threat to the Service's security or to third parties' rights.",
          `The Customer can cancel their subscription from the app and ask for their account to be closed at ${email}.`,
        ],
      },
      {
        heading: "12. Changes to these terms",
        body: [
          "The Publisher may change these terms. Any significant change is notified to the Customer at least 30 days before it takes effect; a Customer who refuses it can cancel their subscription before that date.",
        ],
      },
      {
        heading: "13. Governing law",
        body: ["These terms are governed by French law. Disputes are handled as set out in the terms of sale."],
      },
    ],
  },

  sales: {
    title: "Terms of sale",
    intro: `These terms of sale apply to subscriptions to the hosted Pluton service, entered into between ${publisher} (“the Publisher”) and its business customers (“the Customer”).`,
    sections: [
      {
        heading: "1. Scope",
        body: [
          "Subscriptions are reserved for professionals, individuals or companies, acting for the purposes of their business. By subscribing, the Customer declares they act in that capacity.",
          "These terms prevail over any other document from the Customer. They complement the terms of use.",
          "The self-hosted version of Pluton, published on GitHub, is not covered: it is governed by its license.",
        ],
      },
      {
        heading: "2. Plans",
        body: [
          {
            list: [
              "“Your own AI”: €39.99 per month. The Customer provides their own Claude or Codex subscription, or their API keys, at their own cost.",
              "“All included”: €59.99 per month. Usage of Claude and of the data sources Pluton provides is included up to 2,015 credits a month, one credit being $0.01 of usage at the providers' public prices. A month's unused credits do not carry over. Once this quota is spent, the Service pauses until the next month, unless the Customer buys additional credits in the app, at the price shown at the time of purchase. Purchased credits remain valid from month to month until used.",
            ],
          },
          "Unless stated otherwise, the third-party services the Customer connects with their own keys (data providers, LinkedIn through Unipile, CRMs) are paid by the Customer directly to those services.",
        ],
      },
      {
        heading: "3. Prices",
        body: [
          "Prices are in euros. VAT not applicable, article 293 B of the French General Tax Code: the amounts shown are the amounts paid.",
          "The Publisher may change its prices. The new price is notified to the Customer at least 30 days in advance and applies from the next renewal; a Customer who refuses it can cancel before that date.",
        ],
      },
      {
        heading: "4. Subscribing",
        body: [
          "The Customer signs in with Google or Apple, chooses a plan, then pays on Stripe's secure payment page. The contract is formed once payment is confirmed, and access to the Service opens immediately.",
        ],
      },
      {
        heading: "5. Payment",
        body: [
          "The subscription is paid by card, in advance, every month, through Stripe. The Customer authorizes these recurring payments until cancellation. Additional credits are paid in advance, by card, when bought.",
          "Invoices are available in the app, under Settings → Budget → Manage subscription.",
          "If a payment fails, Stripe retries it. If it remains unpaid, access to the Service is suspended until payment is made. Under article L441-10 of the French Commercial Code, late payment incurs penalties of three times the legal interest rate and a fixed €40 collection fee.",
        ],
      },
      {
        heading: "6. Term and cancellation",
        body: [
          "The subscription runs for one month and renews automatically every month.",
          "The Customer can cancel at any time from Settings → Budget → Manage subscription. Cancellation takes effect at the end of the current period, already paid; no prorated refund is due.",
          "The Customer can change plans the same way; the change takes effect on the terms shown when confirming it.",
          "If either party seriously breaches its obligations, the other may terminate after a formal notice left unanswered for 15 days.",
        ],
      },
      {
        heading: "7. No right of withdrawal",
        body: [
          "As the Service is reserved for professionals, the right of withdrawal under the French Consumer Code does not apply.",
        ],
      },
      {
        heading: "8. Getting data back and deletion",
        body: [
          "During the subscription, the Customer can export their leads (CSV or to their CRM). After the subscription ends, their Customer Content is kept for 30 days, during which they can resubscribe to recover it, then deleted, except data the Publisher must keep by law (invoicing).",
        ],
      },
      {
        heading: "9. Warranties",
        body: [
          "The Publisher undertakes to provide the Service with care, as an obligation of means. It does not guarantee a number of leads, replies or any business result, nor the accuracy of content produced by artificial intelligence or of data from third-party sources.",
        ],
      },
      {
        heading: "10. Liability",
        body: [
          "The Publisher is liable only for proven direct damage resulting from a breach of its obligations. It is not liable for indirect damage, such as loss of revenue, customers or opportunities, nor for the consequences of how the Customer uses messages, leads or third-party services.",
          "Except in case of gross negligence or willful misconduct, the Publisher's total liability is limited to the amounts paid by the Customer in the 12 months before the event giving rise to the claim.",
        ],
      },
      {
        heading: "11. Force majeure",
        body: [
          "Neither party is liable for a failure caused by force majeure within the meaning of article 1218 of the French Civil Code, including a general outage of a host or an essential supplier.",
        ],
      },
      {
        heading: "12. Personal data",
        body: [
          "Personal data processing is described in the privacy policy. The Publisher's commitments as processor are in article 8 of the terms of use.",
        ],
      },
      {
        heading: "13. Governing law and disputes",
        body: [
          "These terms are governed by French law. In case of dispute, the parties first seek an amicable solution for 30 days from either party's written complaint. Failing that, the dispute is brought before the competent French courts.",
        ],
      },
    ],
  },

  privacy: {
    title: "Privacy policy",
    intro: "This policy explains what personal data Pluton processes, why, with whom, for how long, and how to exercise your rights.",
    sections: [
      {
        heading: "1. Who is responsible",
        body: [
          `The controller is ${publisher}, ${fill(PUBLISHER.address, "postal address")}. Contact for any question about your data: ${email}.`,
          "If you run Pluton on your own machine (self-hosted version), your data stays on that machine: the Publisher receives none of it.",
        ],
      },
      {
        heading: "2. Two different roles",
        body: [
          {
            list: [
              "For your account, subscription and website data, the Publisher is the controller.",
              "For the data you process with Pluton, in particular about the people you prospect, you are the controller and the Publisher is your processor (article 8 of the terms of use).",
            ],
          },
        ],
      },
      {
        heading: "3. Your account data",
        body: [
          {
            list: [
              "Sign-in: the technical identifier Google or Apple sends us, your email address (possibly Apple's relay address) and your name. Purpose: create your account and sign you in. Legal basis: performance of the contract.",
              "Subscription: your Stripe customer ID, the plan chosen, the subscription status and dates, your invoices. Your card details are entered at Stripe and never reach us. Legal bases: performance of the contract and our accounting obligations.",
              "Security: server logs (IP address, date, page requested). Purpose: run and protect the Service. Legal basis: our legitimate interest.",
              "Correspondence: the messages you send us. Purpose: reply to you.",
            ],
          },
          "The marketing website sets no cookies and uses no analytics or advertising tools.",
        ],
      },
      {
        heading: "4. Data processed on your behalf",
        body: [
          "To provide the Service, Pluton hosts and processes on your behalf:",
          {
            list: [
              "information about your company and your Brain;",
              "your prospects' data: name, job title, company, LinkedIn profile, work email address, public signals (job posts, technologies, posts);",
              "your messages, the replies received and sequence history;",
              "the access you connect (LinkedIn account through Unipile, mailbox, API keys), encrypted with AES-256-GCM.",
            ],
          },
          "This data is used only to provide the Service. It is never sold or used to train artificial intelligence models.",
        ],
      },
      {
        heading: "5. Recipients and subprocessors",
        body: [
          "Your data is accessible only to the Publisher and to the providers the Service needs:",
          {
            list: [
              "Hetzner Online GmbH (Germany): hosting of the website, app and database;",
              "Stripe Payments Europe, Ltd. (Ireland): payment and invoicing;",
              "Google and Apple: sign-in, if you choose to sign in that way;",
              "Anthropic (United States): the Claude AI, including its web search, on the “All included” plan. On the “Your own AI” plan, this processing goes through your own account.",
            ],
          },
          "The services you connect yourself (Unipile for LinkedIn, your mailbox, Hunter, Apify, TheirStack, Slack, HubSpot, Attio, Pipedrive) receive only the data needed for the action you start, under their own terms.",
        ],
      },
      {
        heading: "6. Transfers outside the European Union",
        body: [
          "Your data is hosted in the European Union. Some providers (Anthropic, and where applicable Stripe, Google or Apple) may process it in the United States. These transfers rely on the EU–US Data Privacy Framework or on the European Commission's standard contractual clauses.",
        ],
      },
      {
        heading: "7. Retention",
        body: [
          {
            list: [
              "Account and Customer Content: during the subscription, then 30 days after it ends;",
              "Invoices and accounting records: 10 years (article L123-22 of the French Commercial Code);",
              "Server logs: 12 months at most;",
              "Session cookie: 30 days.",
            ],
          },
        ],
      },
      {
        heading: "8. Cookies and local storage",
        body: [
          "The app uses only cookies it needs to work, which do not require your consent:",
          {
            list: ["pluton_session: keeps you signed in, 30 days;", "pluton_oauth: secures sign-in with Google or Apple, 10 minutes."],
          },
          "It also keeps your display preferences (language, theme, views) in your browser. No advertising or analytics cookies are used.",
        ],
      },
      {
        heading: "9. Security",
        body: [
          "Traffic is encrypted with HTTPS. Session tokens are stored as hashes, never in clear text, and the secrets you save (API keys, access) are encrypted. Server access is restricted to the Publisher.",
        ],
      },
      {
        heading: "10. Your rights",
        body: [
          `You have the right of access, rectification, erasure, restriction, portability and objection, and the right to set instructions for what happens to your data after your death. To exercise them, write to ${email}. We reply within one month.`,
          "You can also lodge a complaint with the CNIL, the French data protection authority: 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, France, www.cnil.fr.",
        ],
      },
      {
        heading: "11. Contacted through Pluton?",
        body: [
          `The company that wrote to you is responsible for your data: send your requests to them first. You can also write to ${email}, and we will pass your request on to the customer concerned.`,
        ],
      },
      {
        heading: "12. Changes",
        body: [
          "This policy may change. The update date is shown at the top of the page, and significant changes are notified to customers by email.",
        ],
      },
    ],
  },
};

export default en;
