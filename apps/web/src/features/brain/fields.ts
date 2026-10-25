import type { BrainItemView } from "@pluton/core";
import { translate, type MessageKey } from "../../i18n/index.ts";

export type BrainSection = BrainItemView["section"];

/** Labels, placeholders and option names are brain namespace keys; components translate them where shown. */
type Label = MessageKey<"brain">;

export type Field =
  | { key: string; label: Label; kind: "text" | "textarea"; optional?: boolean; placeholder?: Label }
  | { key: string; label: Label; kind: "list"; placeholder?: Label }
  | { key: string; label: Label; kind: "select"; options: Array<{ value: string; label: Label }> }
  | { key: string; label: Label; kind: "bands" }
  | { key: string; label: Label; kind: "tech" };

export const COMPANY_SIZE_BANDS = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,001–5,000", "5,001–10,000", "10,001+"];

export const RELATIONS: Array<{ value: string; label: Label }> = [
  { value: "uses", label: "relation.uses" },
  { value: "integrates_with", label: "relation.integratesWith" },
  { value: "replaces", label: "relation.replaces" },
];

/** Form layout per Brain section; mirrors the zod shapes in @pluton/core, which stay the source of truth. */
export const SECTION_FIELDS: Record<BrainSection, Field[]> = {
  company: [
    { key: "name", label: "field.name", kind: "text" },
    { key: "oneLiner", label: "field.oneLiner", kind: "text" },
    { key: "category", label: "field.category", kind: "text" },
    { key: "website", label: "field.website", kind: "text", optional: true },
    { key: "statement", label: "field.statement", kind: "textarea" },
    { key: "products", label: "field.products", kind: "list" },
    { key: "geographies", label: "field.geographies", kind: "list" },
  ],
  icp: [
    { key: "summary", label: "field.summary", kind: "textarea" },
    { key: "industries", label: "field.industries", kind: "list" },
    { key: "companySizes", label: "field.companySizes", kind: "bands" },
    { key: "geographies", label: "field.geographies", kind: "list" },
  ],
  persona: [
    { key: "title", label: "field.jobTitle", kind: "text", placeholder: "placeholder.jobTitle" },
    {
      key: "role",
      label: "field.role",
      kind: "select",
      options: [
        { value: "buyer", label: "option.role.buyer" },
        { value: "champion", label: "option.role.champion" },
        { value: "user", label: "option.role.user" },
      ],
    },
    { key: "seniority", label: "field.seniority", kind: "text" },
    { key: "whyTheyBuy", label: "field.whyTheyBuy", kind: "textarea" },
  ],
  competitor: [
    { key: "name", label: "field.name", kind: "text" },
    { key: "website", label: "field.website", kind: "text", optional: true },
    { key: "linkedinUrl", label: "field.linkedinPage", kind: "text", optional: true },
    { key: "note", label: "field.overlap", kind: "textarea" },
  ],
  influencer: [
    { key: "name", label: "field.name", kind: "text" },
    { key: "linkedinUrl", label: "field.linkedinUrl", kind: "text", optional: true },
    { key: "why", label: "field.whyFollow", kind: "textarea" },
  ],
  message_pillar: [
    { key: "title", label: "field.pillar", kind: "text" },
    { key: "detail", label: "field.detail", kind: "textarea" },
  ],
  voice: [
    { key: "traits", label: "field.traits", kind: "list" },
    { key: "language", label: "field.outreachLanguage", kind: "text" },
    { key: "avoid", label: "field.avoid", kind: "list" },
  ],
  keyword: [
    { key: "phrase", label: "field.phrase", kind: "text" },
    { key: "intent", label: "field.intent", kind: "textarea" },
  ],
  hiring_signal: [{ key: "roles", label: "field.roles", kind: "list" }],
  stack_signal: [{ key: "technologies", label: "field.technologies", kind: "tech" }],
  tracked_profile: [
    { key: "name", label: "field.name", kind: "text" },
    { key: "url", label: "field.linkedinUrl", kind: "text", placeholder: "placeholder.profileUrl" },
    {
      key: "kind",
      label: "field.whoItIs",
      kind: "select",
      options: [
        { value: "competitor", label: "option.kind.competitor" },
        { value: "influencer", label: "option.kind.influencer" },
        { value: "own_brand", label: "option.kind.ownBrand" },
      ],
    },
  ],
};

export const SECTION_LABELS: Record<BrainSection, Label> = {
  company: "section.company",
  icp: "section.icp",
  persona: "section.persona",
  competitor: "section.competitor",
  influencer: "section.influencer",
  message_pillar: "section.message_pillar",
  voice: "section.voice",
  keyword: "section.keyword",
  hiring_signal: "section.hiring_signal",
  stack_signal: "section.stack_signal",
  tracked_profile: "section.tracked_profile",
};

/** First text field: used as an item's title in lists and proposals. */
export const titleOf = (section: BrainSection, data: Record<string, unknown>) => {
  const field = SECTION_FIELDS[section].find((f) => f.kind === "text");
  return field ? String(data[field.key] ?? "") : translate("brain", SECTION_LABELS[section]);
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
