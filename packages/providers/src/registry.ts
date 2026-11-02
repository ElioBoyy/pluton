import type { Db } from "@pluton/db";
import { fold, sameBusiness } from "./places.ts";
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

// ── Small local businesses ───────────────────────────────────────────────────

/** One establishment of a small business: where it trades and who runs it. */
export type LocalBusiness = {
  siren: string;
  /** Shop sign or trade name first ("Cyril le Plombier"), then the legal name: what the street and Google Maps show. */
  names: string[];
  /** The owner or manager, as a person ("Cyril Sourget"), when the registry names one. */
  owner?: { name: string; role?: string };
  soleTrader: boolean;
  address?: string;
  postalCode?: string;
  city: string;
  lat: number | null;
  lon: number | null;
  activityCode?: string;
  createdOn?: string;
  registryUrl: string;
};

type ApiEstablishment = {
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  latitude?: string;
  longitude?: string;
  liste_enseignes?: string[] | null;
  nom_commercial?: string | null;
  etat_administratif?: string;
  statut_diffusion_etablissement?: string;
};
type ApiLocalCompany = Omit<ApiCompany, "siege" | "dirigeants"> & {
  nature_juridique?: string;
  nom_raison_sociale?: string | null;
  statut_diffusion?: string;
  nombre_etablissements_ouverts?: number;
  siege?: ApiEstablishment;
  matching_etablissements?: ApiEstablishment[];
  dirigeants?: Array<{ nom?: string; prenoms?: string; denomination?: string; qualite?: string; type_dirigeant?: string }>;
};

/** "CYRIL YVES DOMINIQUE" "SOURGET (SOURGET)" → "Cyril Sourget": the first given name and the family name. */
const personName = (prenoms?: string, nom?: string) =>
  [prenoms?.split(" ")[0], nom?.replace(/\s*\(.*\)\s*/, "")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());

function toLocalBusiness(c: ApiLocalCompany): LocalBusiness | null {
  // Businesses that asked the registry not to share them (partial diffusion) are left alone, and so
  // are networks of shops: a few sites at most is still a local business.
  if (c.statut_diffusion === "P" || (c.nombre_etablissements_ouverts ?? 1) > 3) return null;
  // The establishment the search matched in the area, open; the head office only when none was matched.
  const place = c.matching_etablissements?.length
    ? c.matching_etablissements.find((e) => e.etat_administratif !== "F" && e.statut_diffusion_etablissement !== "P")
    : c.siege;
  if (!place?.libelle_commune) return null;
  const soleTrader = c.nature_juridique === "1000";
  // Brackets in the full name hold a usage name or a trade name, both also given elsewhere.
  const legalName = c.nom_complet.replace(/\s*\([^)]*\)/g, "");
  const names = [
    ...(place.liste_enseignes ?? []),
    place.nom_commercial,
    ...(c.siege?.liste_enseignes ?? []),
    c.siege?.nom_commercial,
    c.nom_raison_sociale,
    legalName,
  ]
    .filter((n): n is string => !!n?.trim())
    .map(titleCase);
  const boss = (c.dirigeants ?? []).find((d) => d.type_dirigeant !== "personne morale" && (d.nom || d.prenoms));
  // A sole trader is the business: the registry's name is the person's own.
  const owner = boss
    ? { name: personName(boss.prenoms, boss.nom), role: boss.qualite ?? undefined }
    : soleTrader
      ? { name: titleCase(legalName) }
      : undefined;
  const lat = Number(place.latitude);
  const lon = Number(place.longitude);
  return {
    siren: c.siren,
    names: [...new Set(names)],
    owner,
    soleTrader,
    address: place.adresse,
    postalCode: place.code_postal,
    city: titleCase(place.libelle_commune),
    lat: place.latitude && Number.isFinite(lat) ? lat : null,
    lon: place.longitude && Number.isFinite(lon) ? lon : null,
    activityCode: c.activite_principale,
    createdOn: c.date_creation,
    registryUrl: `https://annuaire-entreprises.data.gouv.fr/entreprise/${c.siren}`,
  };
}

export type LocalSearch = {
  /** NAF codes of the trades, e.g. "43.22A" (plumbing). */
  activityCodes: string[];
  departments?: string[];
  postalCodes?: string[];
  /** Sole traders only; otherwise every business under 10 employees. */
  soleTradersOnly?: boolean;
  page?: number;
};

/** Small businesses trading in an area, from the registry: free, and they needn't be on any map. */
export async function searchLocalBusinesses(db: Db, search: LocalSearch) {
  const params = new URLSearchParams({
    etat_administratif: "A",
    activite_principale: search.activityCodes.join(","),
    page: String(search.page ?? 1),
    per_page: "25",
  });
  if (search.soleTradersOnly) params.set("nature_juridique", "1000");
  // NN: no employees (most sole traders), then the bands up to 9.
  else params.set("tranche_effectif_salarie", "NN,00,01,02,03");
  if (search.postalCodes?.length) params.set("code_postal", search.postalCodes.join(","));
  else if (search.departments?.length) params.set("departement", search.departments.join(","));
  if (!search.activityCodes.length) throw new Error("registry: give activity codes");

  return providerCall(db, PROVIDER, "local_search", Object.fromEntries(params), async () => {
    const data = await httpJson<{ results: ApiLocalCompany[]; total_results: number; total_pages: number }>(PROVIDER, `${BASE}?${params}`, {
      minIntervalMs: 160,
    });
    const businesses = data.results.map(toLocalBusiness).filter((b): b is LocalBusiness => b !== null);
    return { value: { total: data.total_results, pages: data.total_pages, businesses }, items: businesses.length };
  });
}

/** The registry's record of a business seen elsewhere (a Google Maps listing), by its name and postal code. */
export async function findLocalBusiness(db: Db, name: string, postalCode: string) {
  const params = new URLSearchParams({ q: name, code_postal: postalCode, etat_administratif: "A", per_page: "5" });
  const results = await providerCall(db, PROVIDER, "local_lookup", Object.fromEntries(params), async () => {
    const data = await httpJson<{ results: ApiLocalCompany[] }>(PROVIDER, `${BASE}?${params}`, { minIntervalMs: 160 });
    const businesses = data.results.map(toLocalBusiness).filter((b): b is LocalBusiness => b !== null);
    return { value: businesses, items: businesses.length, ttlMs: 30 * 24 * 3600_000 };
  });
  return results.find((b) => b.names.some((n) => sameBusiness(n, name))) ?? null;
}

/** A town, département or postal code in France, as the registry and a map search take it. */
export type FrenchArea = { label: string; departments: string[]; postalCodes: string[]; centre: { lat: number; lon: number } | null };

/**
 * "Lyon", "Rhône", "69", "69003" → its postal codes or département, through the government's geo
 * API (geo.api.gouv.fr, free, no key). Null when it isn't a French place: the search then only uses
 * Google Maps there.
 */
export async function frenchArea(db: Db, place: string): Promise<FrenchArea | null> {
  const p = place.trim();
  if (/^\d{5}$/.test(p)) return { label: p, departments: [], postalCodes: [p], centre: null };
  // Wrapped: the cache keeps a miss too, and it can't store a bare null.
  const { area } = await providerCall<{ area: FrenchArea | null }>(db, "geo", "area", { place: fold(p) }, async () => {
    const found = (area: FrenchArea | null) => ({ value: { area }, items: area ? 1 : 0, ttlMs: 180 * 24 * 3600_000 });
    type Department = { nom: string; code: string };
    // "69", "2A": the département's name too, which a map search reads better than its number.
    if (/^(\d{2,3}|2[ab])$/i.test(p)) {
      const dept = await httpJson<Department>("geo", `https://geo.api.gouv.fr/departements/${p.toUpperCase()}`, { minIntervalMs: 100 }).catch(() => null);
      return found(dept ? { label: dept.nom, departments: [dept.code], postalCodes: [], centre: null } : null);
    }
    type Commune = { nom: string; codesPostaux: string[]; centre?: { coordinates: [number, number] } };
    const q = new URLSearchParams({ nom: p, fields: "codesPostaux,centre", boost: "population", limit: "5" });
    const communes = await httpJson<Commune[]>("geo", `https://geo.api.gouv.fr/communes?${q}`, { minIntervalMs: 100 });
    const town = communes.find((c) => fold(c.nom) === fold(p));
    if (town) {
      const [lon, lat] = town.centre?.coordinates ?? [];
      return found({ label: town.nom, departments: [], postalCodes: town.codesPostaux, centre: lat != null && lon != null ? { lat, lon } : null });
    }
    const departments = await httpJson<Department[]>("geo", `https://geo.api.gouv.fr/departements?nom=${encodeURIComponent(p)}`, { minIntervalMs: 100 });
    const dept = departments.find((d) => fold(d.nom) === fold(p));
    return found(dept ? { label: dept.nom, departments: [dept.code], postalCodes: [], centre: null } : null);
  });
  return area;
}
