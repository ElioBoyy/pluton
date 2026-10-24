import type { BrainItemView } from "@pluton/core";

export type BrainSection = BrainItemView["section"];

export type Field =
  | { key: string; label: string; kind: "text" | "textarea"; optional?: boolean; placeholder?: string }
  | { key: string; label: string; kind: "list"; placeholder?: string }
  | { key: string; label: string; kind: "select"; options: Array<{ value: string; label: string }> }
  | { key: string; label: string; kind: "bands" }
  | { key: string; label: string; kind: "tech" };

export const COMPANY_SIZE_BANDS = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,001–5,000", "5,001–10,000", "10,001+"];

export const RELATIONS = [
  { value: "uses", label: "They use it" },
  { value: "integrates_with", label: "It integrates with you" },
  { value: "replaces", label: "They replace it with you" },
];

/** Form layout per Brain section; mirrors the zod shapes in @pluton/core, which stay the source of truth. */
export const SECTION_FIELDS: Record<BrainSection, Field[]> = {
  company: [
    { key: "name", label: "Name", kind: "text" },
    { key: "oneLiner", label: "One-liner", kind: "text" },
    { key: "category", label: "Category", kind: "text" },
    { key: "website", label: "Website", kind: "text", optional: true },
    { key: "statement", label: "Statement", kind: "textarea" },
    { key: "products", label: "Products & offers", kind: "list" },
    { key: "geographies", label: "Geographies", kind: "list" },
  ],
  icp: [
    { key: "summary", label: "Summary", kind: "textarea" },
    { key: "industries", label: "Industries", kind: "list" },
    { key: "companySizes", label: "Company sizes", kind: "bands" },
    { key: "geographies", label: "Geographies", kind: "list" },
  ],
  persona: [
    { key: "title", label: "Job title", kind: "text", placeholder: "As written on LinkedIn" },
    {
      key: "role",
      label: "Role in the deal",
      kind: "select",
      options: [
        { value: "buyer", label: "Buyer" },
        { value: "champion", label: "Champion" },
        { value: "user", label: "User" },
      ],
    },
    { key: "seniority", label: "Seniority", kind: "text" },
    { key: "whyTheyBuy", label: "Why they buy", kind: "textarea" },
  ],
  competitor: [
    { key: "name", label: "Name", kind: "text" },
    { key: "website", label: "Website", kind: "text", optional: true },
    { key: "note", label: "How it overlaps", kind: "textarea" },
  ],
  influencer: [
    { key: "name", label: "Name", kind: "text" },
    { key: "linkedinUrl", label: "LinkedIn URL", kind: "text", optional: true },
    { key: "why", label: "Why buyers follow them", kind: "textarea" },
  ],
  message_pillar: [
    { key: "title", label: "Pillar", kind: "text" },
    { key: "detail", label: "Detail", kind: "textarea" },
  ],
  voice: [
    { key: "traits", label: "How you sound", kind: "list" },
    { key: "language", label: "Outreach language", kind: "text" },
    { key: "avoid", label: "Avoid", kind: "list" },
  ],
  keyword: [
    { key: "phrase", label: "Phrase", kind: "text" },
    { key: "intent", label: "What it signals", kind: "textarea" },
  ],
  hiring_signal: [{ key: "roles", label: "Roles to watch in job offers", kind: "list" }],
  stack_signal: [{ key: "technologies", label: "Tools to watch", kind: "tech" }],
};

export const SECTION_LABELS: Record<BrainSection, string> = {
  company: "Company",
  icp: "Ideal customer profile",
  persona: "Buyer personas",
  competitor: "Competitors",
  influencer: "Influencers & experts",
  message_pillar: "Message pillars",
  voice: "Voice",
  keyword: "Keywords",
  hiring_signal: "Hiring signal",
  stack_signal: "Stack signal",
};

/** First text field: used as an item's title in lists and proposals. */
export const titleOf = (section: BrainSection, data: Record<string, unknown>) => {
  const field = SECTION_FIELDS[section].find((f) => f.kind === "text");
  return field ? String(data[field.key] ?? "") : SECTION_LABELS[section];
};

/** Drops empty optional strings and blank list entries so the server-side schema accepts the form. */
export function cleanData(section: BrainSection, data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of SECTION_FIELDS[section]) {
    const v = data[f.key];
    if (f.kind === "list" || f.kind === "bands") out[f.key] = ((v as string[]) ?? []).map((s) => s.trim()).filter(Boolean);
    else if (f.kind === "tech") out[f.key] = ((v as Array<{ name: string }>) ?? []).filter((t) => t.name.trim());
    else if (typeof v === "string" && v.trim() === "" && f.kind !== "select" && f.optional) continue;
    else out[f.key] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

export function emptyData(section: BrainSection) {
  const out: Record<string, unknown> = {};
  for (const f of SECTION_FIELDS[section]) {
    out[f.key] = f.kind === "list" || f.kind === "bands" || f.kind === "tech" ? [] : f.kind === "select" ? f.options[0]!.value : "";
  }
  return out;
}
