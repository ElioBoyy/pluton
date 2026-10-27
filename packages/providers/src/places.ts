import { HOSTED, type Db } from "@pluton/db";
import { httpJson, providerCall, toDomain } from "./runtime.ts";

/**
 * A company's shop or office on the map, and the contacts its listing shows (website, phone, email):
 * the registry gives the establishment's names (legal name, trade names) and where it is, then
 * OpenStreetMap's search (Nominatim) finds the listing by name in that town, kept only when it sits
 * at the registered address. Free, no key. Coverage is partial: many small businesses aren't on the
 * map, or are without contacts; a miss returns null.
 */
const REGISTRY = "https://recherche-entreprises.api.gouv.fr/search";
// Usage policy: at most one request a second, from an identified client (runtime's user-agent).
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PROVIDER = "places";

/**
 * Self-hosted installs only, and opt-in (PLUTON_MAP_LISTINGS=1): the public Nominatim is a volunteer
 * service, not meant for a hosted app's traffic from one address.
 */
export const MAP_LISTINGS = !HOSTED && process.env.PLUTON_MAP_LISTINGS === "1";

export type Place = { name: string; website: string | null; phone: string | null; email: string | null; source: "osm" };

type ApiEstablishment = {
  siren: string;
  nom_complet: string;
  siege?: { latitude?: string; longitude?: string; code_postal?: string; libelle_commune?: string; liste_enseignes?: string[] | null; nom_commercial?: string | null };
};
type NominatimResult = { name?: string; lat: string; lon: string; extratags?: Record<string, string> | null };

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Legal forms and small words: they never tell two businesses apart. */
const NOISE = new Set(["sas", "sasu", "sarl", "eurl", "sa", "sci", "snc", "eirl", "ei", "ets", "et", "de", "du", "des", "la", "le", "les", "l", "d", "au", "aux", "en"]);
const words = (s: string) => fold(s).split(" ").filter((w) => w.length >= 2 && !NOISE.has(w));

/**
 * Same business: every word of one name is in the other. "Garage Dupont" and "Garage Martin" share
 * a word but not all of them, so the garage next door never passes for this one.
 */
export function sameBusiness(a: string, b: string) {
  const wa = words(a);
  const wb = words(b);
  if (!wa.length || !wb.length) return false;
  return wa.every((w) => wb.includes(w)) || wb.every((w) => wa.includes(w));
}

/** Metres between two points (haversine). */
function distance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

const first = (tags: Record<string, string>, keys: string[]) => keys.map((k) => tags[k]?.split(";")[0]?.trim()).find(Boolean) ?? null;

/** The listing for this SIREN's head office, with its contacts, or null. Cached a month (a miss a week). */
export async function findPlace(db: Db, siren: string): Promise<Place | null> {
  const id = siren.replace(/\D/g, "");
  if (id.length !== 9) return null;
  // Wrapped: the cache keeps a miss too, and it can't store a bare null.
  const { place } = await providerCall<{ place: Place | null }>(db, PROVIDER, "osm", { siren: id }, async () => {
    const miss = { value: { place: null }, items: 0, ttlMs: 7 * 24 * 3600_000 };
    const { results } = await httpJson<{ results: ApiEstablishment[] }>(PROVIDER, `${REGISTRY}?q=${id}&per_page=1`, { minIntervalMs: 160 });
    const company = results.find((r) => r.siren === id);
    const siege = company?.siege;
    const lat = Number(siege?.latitude);
    const lon = Number(siege?.longitude);
    if (!company || !siege?.libelle_commune || !Number.isFinite(lat) || !Number.isFinite(lon)) return miss;
    // Trade names first: the shop sign is what the map shows ("SUTTEL RACING", not "MOTO CENTER 34").
    const names = [...new Set([...(siege.liste_enseignes ?? []), siege.nom_commercial, company.nom_complet].filter((n): n is string => !!n))].slice(0, 3);

    for (const name of names) {
      const params = new URLSearchParams({ q: `${name}, ${siege.code_postal ?? ""} ${siege.libelle_commune}`, format: "jsonv2", extratags: "1", countrycodes: "fr", limit: "5" });
      const found = await httpJson<NominatimResult[]>(PROVIDER, `${NOMINATIM}?${params}`, { minIntervalMs: 1100 });
      // The same business at the registered address: a chain's other shops are further away.
      const hit = found.find((r) => r.name && sameBusiness(name, r.name) && distance(lat, lon, Number(r.lat), Number(r.lon)) < 300);
      if (!hit) continue;
      const tags = hit.extratags ?? {};
      const website = first(tags, ["website", "contact:website", "url"]);
      const place: Place = {
        name: hit.name!,
        website: website ? toDomain(website) : null,
        phone: first(tags, ["phone", "contact:phone", "contact:mobile", "mobile"]),
        email: first(tags, ["email", "contact:email"])?.toLowerCase() ?? null,
        source: "osm",
      };
      return { value: { place }, items: 1, ttlMs: 30 * 24 * 3600_000 };
    }
    return miss;
  });
  return place;
}
