import { addRejection, type CandidatePerson } from "@pluton/core";
import type { Db, Evidence, Play, PresenceGap, RunReport } from "@pluton/db";
import { findListing, findLocalBusiness, frenchArea, searchListings, searchLocalBusinesses, type Listing, type LocalBusiness } from "@pluton/providers";
import { currentLocale, localized } from "@pluton/i18n/server";
import messages from "./messages/lead-finding.ts";

const t = localized(messages);

/** Under these, a listing has a gap: few reviews, few photos (the API shows 10 at most), a low rating. */
const FEW_REVIEWS = 10;
const FEW_PHOTOS = 5;
const LOW_RATING = 4;

/** Pages of 20 listings read per trade and place (Google Maps gives 60 at most). */
const MAPS_PAGES = 3;

export type LocalCandidate = CandidatePerson & { signal: string; evidence: Evidence[]; phone?: string };

/**
 * The gaps the Play looks for that this business has. No listing at all is the only gap known
 * without one: its website, reviews and photos are then unknown.
 */
export function gapsOf(listing: Listing | null, wanted: PresenceGap[]): PresenceGap[] {
  if (!listing) return wanted.includes("no_google_listing") ? ["no_google_listing"] : [];
  return wanted.filter((gap) => {
    switch (gap) {
      case "no_website":
        return !listing.website;
      case "few_reviews":
        return listing.reviews < FEW_REVIEWS;
      case "few_photos":
        return listing.photos < FEW_PHOTOS;
      case "low_rating":
        return listing.rating != null && listing.reviews >= 3 && listing.rating < LOW_RATING;
      default:
        return false;
    }
  });
}

/** "No website · 3 Google reviews": what the founder reads, and what the message can mention. */
function describeGaps(gaps: PresenceGap[], listing: Listing | null) {
  return gaps
    .map((gap) =>
      gap === "few_reviews"
        ? t("gap.few_reviews", { count: listing?.reviews ?? 0 })
        : gap === "few_photos"
          ? t("gap.few_photos", { count: listing?.photos ?? 0 })
          : gap === "low_rating"
            ? t("gap.low_rating", { rating: new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 1 }).format(listing?.rating ?? 0) })
            : t(`gap.${gap}`),
    )
    .join(" · ");
}

/** The owner when the registry names them, else the business itself: for a sole trader they're one. */
function toCandidate(record: LocalBusiness | null, listing: Listing | null, gaps: PresenceGap[], place: string): LocalCandidate {
  const business = listing?.name ?? record!.names[0]!;
  const evidence: Evidence[] = [];
  if (listing) evidence.push({ label: t("mapsListing"), url: listing.mapsUrl });
  if (record) evidence.push({ label: t("registryRecord"), url: record.registryUrl });
  return {
    name: record?.owner?.name ?? business,
    title: record?.owner?.role ?? (record?.soleTrader ? t("soleTrader") : t("owner")),
    company: business,
    companyWebsite: listing?.website ?? undefined,
    location: record?.city ?? place,
    signal: describeGaps(gaps, listing),
    evidence,
    phone: listing?.phone ?? undefined,
  };
}

/**
 * Small local businesses with a gap in their online presence, for a local_business Play. Two ways in,
 * per place:
 * - Google Maps, by trade and town: one search shows 20 businesses with their website, reviews and
 *   photos, so it finds every gap but the missing listing cheaply. The registry then names the owner.
 * - The registry (France), by activity code: businesses on record whether or not they're on the map,
 *   each checked with one Maps search. The only way to find those with no listing at all.
 * Candidates go through `submit` as they're found; it returns how many passed the gate.
 */
export async function collectLocalBusinesses(opts: {
  db: Db;
  play: Play;
  report: RunReport;
  wanted: number;
  submit: (batch: LocalCandidate[]) => Promise<number>;
  say: (text: string) => Promise<void>;
  signal: AbortSignal;
}) {
  const { db, play, report, wanted, submit, say, signal } = opts;
  const local = play.definition.local;
  if (!local) return;
  const trades = play.definition.audience.industries;
  const mapsGaps = local.gaps.filter((g) => g !== "no_google_listing");
  const seen = new Set<string>();
  let accepted = 0;
  const enough = () => accepted >= wanted || signal.aborted;
  // Each registry business costs one Maps search: a few per lead wanted, as most have a listing.
  let checksLeft = wanted * 2;

  const setAside = (name: string) => {
    report.discovered++;
    addRejection(report, "presence_ok", name);
  };

  for (const place of play.definition.audience.geographies) {
    if (enough()) break;
    const area = await frenchArea(db, place).catch(() => null);
    const where = area?.label ?? place;

    for (const trade of mapsGaps.length ? trades : []) {
      let pageToken: string | undefined;
      for (let page = 0; page < MAPS_PAGES && !enough(); page++) {
        if (page === 0) await say(t("searchingMaps", { trade, place: where }));
        const { listings, next } = await searchListings(db, {
          query: `${trade} ${where}`,
          ...(area ? { region: "FR", language: "fr" } : {}),
          near: area?.centre ? { ...area.centre, radiusM: 15_000 } : undefined,
          pageToken,
        });
        const batch: LocalCandidate[] = [];
        for (const listing of listings) {
          if (!listing.operational || seen.has(listing.id)) continue;
          seen.add(listing.id);
          const gaps = gapsOf(listing, mapsGaps);
          if (!gaps.length) {
            setAside(listing.name);
            continue;
          }
          const postalCode = listing.address.match(/\b\d{5}\b/)?.[0];
          const record = area && postalCode ? await findLocalBusiness(db, listing.name, postalCode).catch(() => null) : null;
          if (record) seen.add(record.siren);
          // Whether it's a sole trader is only known from the registry.
          if (local.soleTradersOnly && area && !record?.soleTrader) continue;
          batch.push(toCandidate(record, listing, gaps, where));
        }
        if (batch.length) accepted += await submit(batch);
        if (!next) break;
        pageToken = next;
      }
    }

    if (!local.gaps.includes("no_google_listing") || enough()) continue;
    if (!area) {
      await say(t("notFrench", { place }));
      continue;
    }
    if (!local.activityCodes.length) continue;
    await say(t("readingRegistry", { place: where }));
    for (let page = 1; page <= 10 && !enough() && checksLeft > 0; page++) {
      const { businesses, pages } = await searchLocalBusinesses(db, {
        activityCodes: local.activityCodes,
        departments: area.departments,
        postalCodes: area.postalCodes,
        soleTradersOnly: local.soleTradersOnly,
        page,
      });
      const batch: LocalCandidate[] = [];
      for (const business of businesses) {
        if (enough() || checksLeft <= 0) break;
        if (seen.has(business.siren)) continue;
        seen.add(business.siren);
        checksLeft--;
        const listing = await findListing(db, { ...business, region: "FR" });
        if (listing && (seen.has(listing.id) || !listing.operational)) continue;
        if (listing) seen.add(listing.id);
        const gaps = gapsOf(listing, local.gaps);
        if (!gaps.length) {
          setAside(business.names[0]!);
          continue;
        }
        batch.push(toCandidate(business, listing, gaps, where));
        // In small groups, so the founder sees leads come in during the checks.
        if (batch.length >= 5) accepted += await submit(batch.splice(0));
      }
      if (batch.length) accepted += await submit(batch);
      if (page >= pages) break;
    }
  }
}
