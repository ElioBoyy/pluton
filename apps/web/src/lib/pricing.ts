import { getLocale } from "../i18n/locale.ts";

/**
 * The prices the hosted plans are sold at, in euros, as shown before and after paying. Stripe holds
 * the prices actually charged (STRIPE_PRICE_*): change both together, and the landing page's.
 */
export type PlanId = "byo" | "all";
export type Interval = "month" | "year";

/** A year is a 1-year commitment with one month free: eleven months, paid once. */
export const PRICES = {
  byo: { month: 24.99, year: 274.89, credits: 600 },
  all: { month: 59, year: 649, credits: 2000 },
  linkedin: { month: 15, year: 165 },
} as const;

/** Leads ready to contact a month on All included, from measured searches; the landing says the same. */
export const LEADS_A_MONTH = { min: 100, max: 200 } as const;

/** What a year saves against twelve months: the free month. */
export const yearlySaving = (plan: PlanId) => Math.round((PRICES[plan].month * 12 - PRICES[plan].year) * 100) / 100;

export const euros = (amount: number) =>
  new Intl.NumberFormat(getLocale(), { style: "currency", currency: "EUR", minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);

/** What the subscription billing summary says (GET /api/billing/subscription). */
export type BillingSummary = { plan: PlanId | null; interval: Interval; linkedinSeats: number; periodEnd: string | null };
