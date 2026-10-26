import type { Db } from "@pluton/db";
import { httpJson, providerCall } from "./runtime.ts";
import type { CompanyRecord } from "./types.ts";

/** France's public company registry (recherche-entreprises.api.gouv.fr): free, no key, ~7 requests/s. */
const BASE = "https://recherche-entreprises.api.gouv.fr/search";
const PROVIDER = "registry";

/** INSEE headcount codes → label. */
const TRANCHES: Record<string, string> = {
  "00": "0",
  "01": "1–2",
  "02": "3–5",
  "03": "6–9",
  "11": "10–19",
  "12": "20–49",
  "21": "50–99",
  "22": "100–199",
  "31": "200–249",
  "32": "250–499",
  "41": "500–999",
  "42": "1,000–1,999",
  "51": "2,000–4,999",
  "52": "5,000–9,999",
  "53": "10,000+",
};

/** Brain size bands → the INSEE codes they cover (approximate at the edges). */
const BAND_TO_TRANCHES: Record<string, string[]> = {
  "1–10": ["01", "02", "03"],
  "11–50": ["11", "12"],
  "51–200": ["21", "22"],
  "201–500": ["31", "32"],
  "501–1,000": ["41"],
  "1,001–5,000": ["42", "51"],
  "5,001–10,000": ["52"],
  "10,001+": ["53"],
};

export type RegistrySearch = {
  query?: string;
  /** NAF codes, e.g. "70.21Z" (public relations). */
  industryCodes?: string[];
  sizeBands?: string[];
  departments?: string[];
  page?: number;
  perPage?: number;
};

type ApiCompany = {
  siren: string;
  nom_complet: string;
  activite_principale?: string;
  tranche_effectif_salarie?: string | null;
  date_creation?: string;
  siege?: { libelle_commune?: string; code_postal?: string };
  dirigeants?: Array<{ nom?: string; prenoms?: string; denomination?: string; qualite?: string }>;
};

export async function searchRegistry(db: Db, search: RegistrySearch) {
  const params = new URLSearchParams({
    etat_administratif: "A",
    page: String(search.page ?? 1),
    per_page: String(Math.min(search.perPage ?? 25, 25)),
  });
  if (search.query) params.set("q", search.query);
  if (search.industryCodes?.length) params.set("activite_principale", search.industryCodes.join(","));
  const tranches = (search.sizeBands ?? []).flatMap((b) => BAND_TO_TRANCHES[b] ?? []);
  if (tranches.length) params.set("tranche_effectif_salarie", tranches.join(","));
  if (search.departments?.length) params.set("departement", search.departments.join(","));
  if (!search.query && !search.industryCodes?.length) throw new Error("registry: give a query or industry codes");

  return providerCall(db, PROVIDER, "search", Object.fromEntries(params), async () => {
    const data = await httpJson<{ results: ApiCompany[]; total_results: number }>(PROVIDER, `${BASE}?${params}`, {
      minIntervalMs: 160,
    });
    const companies = data.results.map(toCompany);
    return { value: { total: data.total_results, companies }, items: companies.length };
  });
}

function toCompany(c: ApiCompany): CompanyRecord {
  return {
    name: c.nom_complet,
    siren: c.siren,
    registryUrl: `https://annuaire-entreprises.data.gouv.fr/entreprise/${c.siren}`,
    industryCode: c.activite_principale,
    sizeBand: c.tranche_effectif_salarie ? TRANCHES[c.tranche_effectif_salarie] : undefined,
    city: c.siege?.libelle_commune,
    postalCode: c.siege?.code_postal,
    country: "FR",
    createdOn: c.date_creation,
    executives: (c.dirigeants ?? [])
      .map((d) => ({
        name: d.denomination ?? [d.prenoms, d.nom].filter(Boolean).join(" "),
        role: d.qualite,
      }))
      .filter((d) => d.name),
    source: PROVIDER,
  };
}

/**
 * Lookalikes of a reference customer: same sector code and headcount band, from the registry.
 * Free stand-in for Ocean.io-style lookalike search (which needs a paid contract).
 */
export async function registryLookalikes(db: Db, referenceName: string, opts: { departments?: string[]; perPage?: number } = {}) {
  const ref = (await searchRegistry(db, { query: referenceName, perPage: 1 })).companies[0];
  if (!ref?.industryCode) return { reference: ref ?? null, companies: [] as CompanyRecord[] };
  const params = new URLSearchParams({
    activite_principale: ref.industryCode,
    etat_administratif: "A",
    per_page: String(Math.min(opts.perPage ?? 20, 25)),
  });
  const tranche = Object.entries(TRANCHES).find(([, label]) => label === ref.sizeBand)?.[0];
  if (tranche) params.set("tranche_effectif_salarie", tranche);
  if (opts.departments?.length) params.set("departement", opts.departments.join(","));
  const result = await providerCall(db, PROVIDER, "lookalikes", Object.fromEntries(params), async () => {
    const data = await httpJson<{ results: ApiCompany[] }>(PROVIDER, `${BASE}?${params}`, { minIntervalMs: 160 });
    const companies = data.results.map(toCompany).filter((c) => c.siren !== ref.siren);
    return { value: companies, items: companies.length };
  });
  return { reference: ref, companies: result };
}
