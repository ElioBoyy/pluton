import { AppleLogo, CheckCircle, CircleNotch, Minus, Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LinkButton } from "@pluton/glass";
import { useEffect, useState, type ReactNode } from "react";
import { PlutonLogo } from "../../components/logo.tsx";
import { Button, Input, Segmented } from "../../components/ui.tsx";
import { Wallpaper } from "../../components/wallpaper.tsx";
import { useLocale, useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { euros, LEADS_A_MONTH, PRICES, yearlySaving, type Interval, type PlanId } from "../../lib/pricing.ts";
import { authStateQuery, post } from "./auth-state.ts";
import { useResetOnReturn } from "../../lib/redirect.ts";

/** The hosted plans, cheapest first; their prices are in lib/pricing.ts. */
const PLANS: PlanId[] = ["byo", "all"];

const ERRORS = ["cancelled", "expired", "provider", "link"] as const;

/** What the email routes answer with; anything else reads as a generic failure. */
const EMAIL_ERRORS = ["invalid_credentials", "weak_password", "invalid_email", "too_many", "email_failed"] as const;
const emailError = (error: unknown) => EMAIL_ERRORS.find((e) => e === (error as Error | null)?.message) ?? "generic";

/** The marketing site, where the legal pages live (English at the root, other languages under /<lang>/). */
const SITE_URL = "https://plut0n.com";

function LegalLink({ doc, children }: { doc: "terms" | "sales" | "privacy"; children: ReactNode }) {
  const locale = useLocale();
  return (
    <a href={`${SITE_URL}${locale === "en" ? "" : `/${locale}`}/legal/${doc}/`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      {children}
    </a>
  );
}

/** Pluto behind, one pane of glass in the middle: the app before there is an app. */
function AccountFrame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <Wallpaper defaultOnly />
      <main className="glass w-full max-w-[400px] p-8 max-sm:p-6">
        <PlutonLogo className="mb-8 h-7 text-ink" />
        {children}
      </main>
      {footer && <div className="mt-4 text-center text-xs text-muted">{footer}</div>}
    </div>
  );
}

/** Google's "G" in its four colours, as its sign-in guidelines ask. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Sign in and sign up are the same page: Google or Apple says who you are, and a new address
 * becomes a new account; or an email and password, confirmed by a link before the account
 * exists. Payment comes next; nothing about the business is asked before it.
 */
export function SignupPage({ error }: { error?: string }) {
  const t = useT("account");
  const state = useQuery(authStateQuery).data;
  const providers = state?.providers ?? { google: false, apple: false, password: false };
  const known = ERRORS.find((e) => e === error);

  return (
    <AccountFrame footer={t("signup.next")}>
      <h1 className="text-[28px] leading-[30px] font-bold tracking-[-0.03em] text-balance">{t("signup.title")}</h1>
      <p className="mt-3 text-sm text-muted">{t("signup.description")}</p>

      <div className="mt-8 flex flex-col gap-2.5">
        {/* Full-page navigations: the providers' pages can't open inside a fetch. */}
        {providers.google && (
          <LinkButton href="/api/auth/google" variant="plain" size="lg" className="w-full gap-2.5 text-sm font-medium">
            <GoogleMark />
            {t("signup.google")}
          </LinkButton>
        )}
        {providers.apple && (
          <LinkButton
            href="/api/auth/apple"
            size="lg"
            // Apple's guidelines: a black button with the white logo (white on black in dark).
            className="w-full gap-2.5 bg-black text-sm font-medium text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85"
          >
            <AppleLogo size={18} weight="fill" />
            {t("signup.apple")}
          </LinkButton>
        )}
        {state && !providers.google && !providers.apple && !providers.password && <p className="text-sm text-system-orange">{t("signup.unavailable")}</p>}
      </div>

      {providers.password && (
        <>
          {(providers.google || providers.apple) && (
            <div className="my-6 flex items-center gap-3 text-xs text-muted" aria-hidden>
              <span className="h-px flex-1 bg-[var(--gg-edge)]" />
              {t("signup.or")}
              <span className="h-px flex-1 bg-[var(--gg-edge)]" />
            </div>
          )}
          <EmailForm />
        </>
      )}

      {known && (
        <p role="alert" className="mt-4 text-sm text-system-orange">
          {t(`error.${known}`)}
        </p>
      )}
      <p className="mt-6 text-xs text-muted text-pretty">
        {t.rich("signup.legal", {
          terms: <LegalLink doc="terms">{t("signup.terms")}</LegalLink>,
          sales: <LegalLink doc="sales">{t("signup.sales")}</LegalLink>,
          privacy: <LegalLink doc="privacy">{t("signup.privacy")}</LegalLink>,
        })}
      </p>
    </AccountFrame>
  );
}

type EmailMode = "signIn" | "signUp" | "forgot";

/** Email and password: sign in, create an account (confirmed by a link), or ask for a reset link. */
function EmailForm() {
  const t = useT("account");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<EmailMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState<{ email: string; mode: EmailMode } | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "signIn") return post("/api/auth/password/signin", { email, password });
      if (mode === "signUp") return post("/api/auth/password/signup", { email, password, locale });
      return post("/api/auth/password/forgot", { email, locale });
    },
    onSuccess: async () => {
      if (mode !== "signIn") return setSentTo({ email: email.trim(), mode });
      await queryClient.invalidateQueries(authStateQuery);
      await navigate({ to: "/", search: {} });
    },
  });
  const switchTo = (next: EmailMode) => {
    setMode(next);
    submit.reset();
  };

  if (sentTo) {
    return (
      <div role="status" className="text-sm">
        <p>{t(sentTo.mode === "signUp" ? "signup.sent" : "signup.resetSent", { email: sentTo.email })}</p>
        <button type="button" onClick={() => (setSentTo(null), switchTo("signIn"))} className="mt-3 text-accent hover:underline">
          {t("signup.backToSignIn")}
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      <Input type="email" autoComplete="email" required placeholder={t("signup.email")} aria-label={t("signup.email")} value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
      {mode !== "forgot" && (
        <Input
          type="password"
          autoComplete={mode === "signUp" ? "new-password" : "current-password"}
          required
          minLength={mode === "signUp" ? 10 : undefined}
          placeholder={t("signup.password")}
          aria-label={t("signup.password")}
          aria-describedby={mode === "signUp" ? "password-hint" : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9"
        />
      )}
      {mode === "signUp" && (
        <p id="password-hint" className="text-xs text-muted">
          {t("signup.passwordHint")}
        </p>
      )}
      <Button type="submit" disabled={submit.isPending} className="h-9 w-full">
        {submit.isPending && <CircleNotch size={14} className="animate-spin" />}
        {t(mode === "signIn" ? "signup.signIn" : mode === "signUp" ? "signup.create" : "signup.sendReset")}
      </Button>
      {submit.isError && (
        <p role="alert" className="text-sm text-system-orange">
          {t(`error.${emailError(submit.error)}`)}
        </p>
      )}
      <div className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
        {mode === "signIn" ? (
          <>
            <button type="button" onClick={() => switchTo("signUp")} className="text-accent hover:underline">
              {t("signup.toCreate")}
            </button>
            <button type="button" onClick={() => switchTo("forgot")} className="text-muted hover:underline">
              {t("signup.forgot")}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => switchTo("signIn")} className="text-accent hover:underline">
            {mode === "signUp" ? t("signup.toSignIn") : t("signup.backToSignIn")}
          </button>
        )}
      </div>
    </form>
  );
}

/** The link in a reset email: a new password, then straight into the app. */
export function ResetPage({ token }: { token?: string }) {
  const t = useT("account");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const reset = useMutation({
    mutationFn: () => post("/api/auth/password/reset", { token, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries(authStateQuery);
      await navigate({ to: "/", search: {} });
    },
  });
  const expired = !token || (reset.error as Error | null)?.message === "link_expired";

  return (
    <AccountFrame>
      <h1 className="text-[28px] leading-[30px] font-bold tracking-[-0.03em] text-balance">{t("reset.title")}</h1>
      {expired ? (
        <>
          <p className="mt-3 text-sm text-system-orange">{t("reset.expired")}</p>
          <LinkButton href="/signup" variant="plain" size="lg" className="mt-6 w-full text-sm">
            {t("reset.again")}
          </LinkButton>
        </>
      ) : (
        <form
          className="mt-6 flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            reset.mutate();
          }}
        >
          <p className="mb-2 text-sm text-muted">{t("reset.description")}</p>
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            placeholder={t("signup.password")}
            aria-label={t("signup.password")}
            aria-describedby="reset-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9"
          />
          <p id="reset-hint" className="text-xs text-muted">
            {t("signup.passwordHint")}
          </p>
          <Button type="submit" disabled={reset.isPending} className="h-9 w-full">
            {reset.isPending && <CircleNotch size={14} className="animate-spin" />}
            {t("reset.submit")}
          </Button>
          {reset.isError && (
            <p role="alert" className="text-sm text-system-orange">
              {t(`error.${emailError(reset.error)}`)}
            </p>
          )}
        </form>
      )}
    </AccountFrame>
  );
}

function SignOut() {
  const t = useT("account");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signOut = useMutation({
    mutationFn: () => post("/api/auth/signout"),
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: "/signup", search: {} });
    },
  });
  return (
    <button type="button" onClick={() => signOut.mutate()} className="text-accent hover:underline">
      {t("subscribe.signOut")}
    </button>
  );
}

/**
 * The paywall: signed in, not subscribed yet. Picking a plan opens Stripe Checkout; Stripe sends
 * the browser back here with its session id, which is confirmed before onboarding starts.
 */
export function SubscribePage({ sessionId }: { sessionId?: string }) {
  const t = useT("account");
  const user = useQuery(authStateQuery).data?.user;
  const footer = user?.email && (
    <span className="inline-flex gap-1.5">
      {t("subscribe.signedInAs", { email: user.email })} · <SignOut />
    </span>
  );
  return <AccountFrame footer={footer}>{sessionId ? <Confirming sessionId={sessionId} /> : <PlanPicker />}</AccountFrame>;
}

function PlanPicker() {
  const t = useT("account");
  const [plan, setPlan] = useState<PlanId>("byo");
  const [interval, setInterval] = useState<Interval>("month");
  const per = (amount: number) => t(interval === "year" ? "plan.perYear" : "plan.perMonth", { price: euros(amount) });
  const total = PRICES[plan][interval];

  const checkout = useMutation({
    // LinkedIn accounts aren't bought here: each one is added to this subscription when it is connected.
    mutationFn: () => post<{ url: string }>("/api/billing/checkout", { plan, interval }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  useResetOnReturn(checkout.reset);

  return (
    <>
      <h1 className="text-[28px] leading-[30px] font-bold tracking-[-0.03em] text-balance">{t("subscribe.title")}</h1>
      <p className="mt-3 text-sm text-muted">{t("subscribe.description")}</p>

      <div className="mt-8">
        <Segmented
          label={t("subscribe.interval")}
          value={interval}
          onChange={setInterval}
          options={[
            { value: "month", label: t("interval.month") },
            { value: "year", label: t("interval.year") },
          ]}
        />
      </div>
      {interval === "year" && <p className="mt-2 text-xs text-muted">{t("subscribe.yearHint")}</p>}

      <div role="radiogroup" aria-label={t("subscribe.plans")} className="mt-4 flex flex-col gap-2.5">
        {PLANS.map((id) => {
          const selected = id === plan;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(id)}
              className={cn(
                "gg-card flex items-start gap-3 p-4 text-left transition-[box-shadow] duration-150",
                selected && "shadow-[inset_0_0_0_1.5px_var(--color-accent)]",
              )}
            >
              <span className="flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold">{t(`plan.${id}.name`)}</span>
                  <span className="text-sm tabular-nums">{per(PRICES[id][interval])}</span>
                </span>
                <span className="mt-1.5 block text-xs font-semibold text-accent">{t(`plan.${id}.highlight`, LEADS_A_MONTH)}</span>
                <span className="mt-1 block text-xs text-muted">
                  {t(`plan.${id}.detail`)} {t("plan.credits", { count: PRICES[id].credits })}
                  {interval === "year" && <> {t("plan.saving", { amount: euros(yearlySaving(id)) })}</>}
                </span>
              </span>
              <CheckCircle
                size={18}
                weight="fill"
                className={cn("mt-px shrink-0 text-accent transition-opacity duration-150", !selected && "opacity-0")}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <p className="mt-3 px-1 text-xs text-muted">{t("subscribe.linkedinLater", { price: per(PRICES.linkedin[interval]) })}</p>

      <p className="mt-6 flex items-baseline justify-between text-sm">
        <span className="text-muted">{t("subscribe.total")}</span>
        <span className="font-semibold tabular-nums">{per(total)}</span>
      </p>

      <Button type="button" onClick={() => checkout.mutate()} disabled={checkout.isPending || checkout.isSuccess} className="mt-4 h-9 w-full">
        {(checkout.isPending || checkout.isSuccess) && <CircleNotch size={14} className="animate-spin" />}
        {t("subscribe.pay")}
      </Button>
      {checkout.isError && (
        <p role="alert" className="mt-3 text-sm text-system-orange">
          {t("subscribe.failed")}
        </p>
      )}
      <p className="mt-4 text-xs text-muted">{t("subscribe.stripe")}</p>
    </>
  );
}

/** − n + for a small count, e.g. LinkedIn accounts. */
export function Stepper({ value, onChange, max, label }: { value: number; onChange: (n: number) => void; max: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <Button type="button" variant="ghost" className="h-7 w-7 px-0" disabled={value <= 0} onClick={() => onChange(value - 1)} aria-label="−">
        <Minus size={12} weight="bold" />
      </Button>
      <span className="w-5 text-center text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button type="button" variant="ghost" className="h-7 w-7 px-0" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="+">
        <Plus size={12} weight="bold" />
      </Button>
    </span>
  );
}

function Confirming({ sessionId }: { sessionId: string }) {
  const t = useT("account");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const confirm = useMutation({
    mutationFn: () => post<{ paid: boolean }>("/api/billing/confirm", { sessionId }),
    onSuccess: async ({ paid }) => {
      if (!paid) return;
      await queryClient.invalidateQueries(authStateQuery);
      // Paid: now, and only now, Pluton asks about the business.
      await navigate({ to: "/onboarding", search: {}, replace: true });
    },
  });
  const { mutate } = confirm;
  useEffect(() => mutate(), [mutate]);

  const waiting = confirm.isPending || confirm.isIdle || confirm.data?.paid;
  return waiting ? (
    <p className="flex items-center gap-2 text-sm text-muted">
      <CircleNotch size={14} className="animate-spin" />
      {t("confirm.checking")}
    </p>
  ) : (
    <>
      <p className="text-sm">{confirm.isError ? t("subscribe.failed") : t("confirm.pending")}</p>
      <Button type="button" onClick={() => confirm.mutate()} className="mt-4 h-9 w-full">
        {t("confirm.retry")}
      </Button>
    </>
  );
}
