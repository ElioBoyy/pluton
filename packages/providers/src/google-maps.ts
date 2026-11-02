import type { Db } from "@pluton/db";
import { distance, sameBusiness } from "./places.ts";
import { httpJson, providerCall, requireKey, toDomain } from "./runtime.ts";

/**
 * Google Maps listings (Places API, Text Search): the business's page with its website, phone,
 * rating, reviews and photos. What tells a freelancer which small businesses lack a website, a
 * listing or reviews, and how to call them.
 */
const PROVIDER = "google_maps";
export const GOOGLE_MAPS_KEY = "google_maps_api_key";
const SEARCH = "https://places.googleapis.com/v1/places:searchText";

/**
 * Asking for the website, phone and rating bills a Text Search at the Enterprise rate, $35 per 1,000
 * requests (developers.google.com/maps/billing-and-pricing/pricing, October 2026). Google's free
 * monthly calls aren't counted: spend is never under-counted.
 */
const REQUEST_MICRO_USD = 35_000;

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.photos",
  "places.googleMapsUri",
  "places.businessStatus",
  "nextPageToken",
].join(",");

export type Listing = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  reviews: number;
  /** Photos on the listing; the API returns 10 at most. */
  photos: number;
  mapsUrl: string;
  /** Still trading (closed for good or for now is not). */
  operational: boolean;
};

type ApiPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  photos?: unknown[];
  googleMapsUri?: string;
  businessStatus?: string;
};

const toListing = (p: ApiPlace): Listing => ({
  id: p.id,
  name: p.displayName?.text ?? "",
  address: p.formattedAddress ?? "",
  lat: p.location?.latitude ?? null,
  lon: p.location?.longitude ?? null,
  // A Facebook or Instagram page in the website field is not a website of their own.
  website: p.websiteUri && !/(^|\.)(facebook|instagram|linktr)\.(com|ee)$/.test(toDomain(p.websiteUri)) ? toDomain(p.websiteUri) : null,
  phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
  rating: p.rating ?? null,
  reviews: p.userRatingCount ?? 0,
  photos: p.photos?.length ?? 0,
  mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
  operational: !p.businessStatus || p.businessStatus === "OPERATIONAL",
});

export type ListingSearch = {
  /** As typed in Google Maps: "plombier Lyon", "Garage Dupont 69003 Lyon". */
  query: string;
  /** ISO country the results are biased to, e.g. "FR". */
  region?: string;
  language?: string;
  near?: { lat: number; lon: number; radiusM: number };
  pageToken?: string;
};

/** Up to 20 listings a request, and a token for the next 20 (60 at most per query). Cached a month. */
export async function searchListings(db: Db, search: ListingSearch): Promise<{ listings: Listing[]; next?: string }> {
  const key = requireKey(PROVIDER, GOOGLE_MAPS_KEY);
  const body = {
    textQuery: search.query,
    pageSize: 20,
    ...(search.region ? { regionCode: search.region } : {}),
    ...(search.language ? { languageCode: search.language } : {}),
    ...(search.pageToken ? { pageToken: search.pageToken } : {}),
    ...(search.near
      ? { locationBias: { circle: { center: { latitude: search.near.lat, longitude: search.near.lon }, radius: search.near.radiusM } } }
      : {}),
  };
  return providerCall(
    db,
    PROVIDER,
    "text_search",
    body,
    async () => {
      const data = await httpJson<{ places?: ApiPlace[]; nextPageToken?: string }>(PROVIDER, SEARCH, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key, "x-goog-fieldmask": FIELDS },
        body: JSON.stringify(body),
      });
      const listings = (data.places ?? []).map(toListing);
      return { value: { listings, next: data.nextPageToken }, items: listings.length, costMicroUsd: REQUEST_MICRO_USD };
    },
    { ttlMs: 30 * 24 * 3600_000 },
  );
}

/**
 * This business's own listing, or null when Google Maps doesn't show it: one search by its main name
 * in its town, kept when any of its names matches (see sameBusiness) and it sits nearby or in that
 * town. Craftsmen working from home often hide their address, so a listing passes on the town alone.
 */
export async function findListing(
  db: Db,
  business: { names: string[]; postalCode?: string; city: string; lat?: number | null; lon?: number | null; region?: string },
): Promise<Listing | null> {
  const near = business.lat != null && business.lon != null ? { lat: business.lat, lon: business.lon, radiusM: 2000 } : undefined;
  const town = business.city.toLowerCase();
  if (!business.names.length) return null;
  const { listings } = await searchListings(db, {
    query: `${business.names[0]} ${business.postalCode ?? ""} ${business.city}`.replace(/\s+/g, " ").trim(),
    region: business.region,
    near,
  });
  return (
    listings.find(
      (l) =>
        business.names.some((name) => sameBusiness(name, l.name)) &&
        (l.address.toLowerCase().includes(town) || (near && l.lat != null && l.lon != null && distance(near.lat, near.lon, l.lat, l.lon) < 3000)),
    ) ?? null
  );
}
