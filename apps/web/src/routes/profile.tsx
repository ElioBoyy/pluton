import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Group, Input, PageHeader, Row, Section } from "../components/ui.tsx";
import { authStateQuery, post, type AuthState } from "../features/account/auth-state.ts";
import { LOCALES, LOCALE_NAMES, setLanguagePreference, useLanguagePreference, useLocale, useT, type Locale } from "../i18n/index.ts";
import { browserLocale } from "../i18n/locale.ts";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";
import { FIELD } from "./settings.tsx";
import { Identicon } from "../components/identicon.tsx";

type Account = NonNullable<AuthState["user"]>;

/** The name the email signature uses in this workspace, from Settings (it lives with the SMTP keys). */
function useSignature() {
  const trpc = useTRPC();
  const settings = useQuery(trpc.settings.list.queryOptions());
  return settings.data?.find((s) => s.key === "smtp_from_name")?.value ?? "";
}

/**
 * Who the app is used by: the account's name when hosted, else the name the emails are signed
 * with, else "You". The sidebar's avatar and the settings' profile card show it.
 */
export function useProfileName() {
  const t = useT("settings");
  const user = useQuery(authStateQuery).data?.user;
  const signature = useSignature();
  return user?.name || signature || user?.email || t("profile.anonymous");
}

/**
 * Profile: the person, beside the workspace's settings. Their name and email (hosted), how their
 * emails are signed, the app's language, the ways they sign in, and signing out.
 */
export function ProfilePage() {
  const t = useT("settings");
  const auth = useQuery(authStateQuery).data;
  const user = auth?.hosted ? auth.user : null;

  return (
    <>
      <PageHeader title={t("section.profile")} description={t(user ? "profile.description" : "profile.descriptionLocal")} />
      <div className="flex flex-col gap-8">
        <Identity user={user} />
        <Signature />
        <LanguageSection />
        {user && auth && <SignInMethods auth={auth} user={user} />}
        {user && <SignOut />}
      </div>
    </>
  );
}

/** A text field that saves when it loses focus or on Enter, and says so below its group. */
function SavedOnBlur({
  id,
  value,
  placeholder,
  onSave,
}: {
  id: string;
  value: string;
  placeholder?: string;
  onSave: (next: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value) void onSave(draft.trim());
  };
  return (
    <Input
      id={id}
      value={draft}
      placeholder={placeholder}
      maxLength={120}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className={FIELD}
    />
  );
}

/** The card at the top: avatar, name, and the account it is (or this computer, self-hosted). */
function Identity({ user }: { user: Account | null }) {
  const t = useT("settings");
  const queryClient = useQueryClient();
  const name = useProfileName();
  const [saved, setSaved] = useState(false);
  const rename = useMutation({
    mutationFn: (next: string) => post("/api/auth/profile", { name: next }),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries(authStateQuery);
    },
  });

  return (
    <Section footnote={saved && <span role="status">{t("profile.saved")}</span>}>
      <Group>
        <div className="flex items-center gap-4 px-4 py-4">
          <Identicon seed={name} className="size-14" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{name}</p>
            <p className="truncate text-sm text-muted">{user ? (user.email ?? t("profile.account")) : t("profile.local")}</p>
          </div>
        </div>
        {user && (
          <>
            <Row label={<label htmlFor="profile-name">{t("profile.name")}</label>} description={t("profile.nameHint")}>
              <SavedOnBlur id="profile-name" value={user.name ?? ""} onSave={(next) => (next ? rename.mutateAsync(next) : Promise.resolve())} />
            </Row>
            {user.email && (
              <Row label={t("profile.email")} description={t("profile.emailHint")}>
                <span className={cn(FIELD, "truncate text-right text-sm text-muted")} title={user.email}>
                  {user.email}
                </span>
              </Row>
            )}
          </>
        )}
      </Group>
    </Section>
  );
}

/** How the emails are signed in this workspace; the writer falls back to the LinkedIn account's name. */
function Signature() {
  const t = useT("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const signature = useSignature();
  const [saved, setSaved] = useState(false);
  const save = useMutation(
    trpc.settings.save.mutationOptions({
      onSuccess: async () => {
        setSaved(true);
        await queryClient.invalidateQueries({ queryKey: trpc.settings.list.queryKey() });
      },
    }),
  );
  return (
    <Section title={t("profile.messages")} footnote={saved && <span role="status">{t("profile.saved")}</span>}>
      <Group>
        <Row label={<label htmlFor="profile-signature">{t("profile.signature")}</label>} description={t("profile.signatureHint")}>
          <SavedOnBlur id="profile-signature" value={signature} placeholder={t("profile.signaturePlaceholder")} onSave={(next) => save.mutateAsync({ key: "smtp_from_name", value: next || null })} />
        </Row>
      </Group>
    </Section>
  );
}

/** The app's language, kept in this browser. Automatic follows the browser's own languages. */
function LanguageSection() {
  const t = useT("settings");
  const preference = useLanguagePreference();
  return (
    <Section title={t("language.title")}>
      <Group>
        <Row label={<label htmlFor="app-language">{t("language.label")}</label>} description={t("language.hint")}>
          <select
            id="app-language"
            value={preference}
            onChange={(e) => setLanguagePreference(e.target.value as Locale | "auto")}
            className={cn("capsule h-7 truncate pl-3 text-sm outline-none focus:focus-ring", FIELD)}
          >
            <option value="auto">{t("language.auto", { language: LOCALE_NAMES[browserLocale()] })}</option>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </select>
        </Row>
      </Group>
    </Section>
  );
}

/** What linking a provider from here came back with (?link=done|taken). */
const LINK_RESULTS = { done: "methods.linkDone", taken: "methods.linkTaken" } as const;

/**
 * Hosted only: the ways into this account (email and password, Google, Apple). Connecting one
 * goes through its sign-in and joins this account; the last one can't be disconnected.
 */
function SignInMethods({ auth, user }: { auth: AuthState; user: Account }) {
  const t = useT("account");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("link") as keyof typeof LINK_RESULTS | null;
    if (result && result in LINK_RESULTS) {
      setNotice(t(LINK_RESULTS[result]));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [t]);

  const unlink = useMutation({
    mutationFn: (method: "password" | "google" | "apple") => post("/api/auth/unlink", { method }),
    onSuccess: () => queryClient.invalidateQueries(authStateQuery),
    onError: () => setNotice(t("methods.last")),
  });
  const passwordLink = useMutation({
    mutationFn: () => post("/api/auth/password/forgot", { email: user.email, locale }),
    onSuccess: () => setNotice(t("methods.passwordSent", { email: user.email ?? "" })),
    onError: () => setNotice(t("error.email_failed")),
  });

  const linked = Object.values(user.methods).filter(Boolean).length;
  const status = (on: boolean) => (on ? t("methods.connected") : t("methods.notConnected"));
  const disconnect = (method: "password" | "google" | "apple") => (
    <Button type="button" variant="ghost" onClick={() => unlink.mutate(method)} disabled={unlink.isPending || linked <= 1}>
      {t("methods.disconnect")}
    </Button>
  );

  return (
    <Section title={t("methods.title")} description={t("methods.hint")} footnote={notice && <span role="status">{notice}</span>}>
      <Group>
        {auth.providers.password && user.email && (
          // Two buttons don't fit beside the label on a phone: they go under it there.
          <Row label={t("methods.password")} description={user.methods.password ? user.email : status(false)} className="max-sm:flex-wrap">
            <div className="flex shrink-0 gap-1.5 max-sm:w-full max-sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => passwordLink.mutate()} disabled={passwordLink.isPending}>
                {t(user.methods.password ? "methods.changePassword" : "methods.setPassword")}
              </Button>
              {user.methods.password && disconnect("password")}
            </div>
          </Row>
        )}
        {(["google", "apple"] as const)
          .filter((p) => auth.providers[p] || user.methods[p])
          .map((p) => (
            <Row key={p} label={t(`methods.${p}`)} description={status(user.methods[p])}>
              {user.methods[p] ? (
                disconnect(p)
              ) : (
                // A full-page navigation: the provider's sign-in, then back here.
                <Button type="button" variant="ghost" onClick={() => window.location.assign(`/api/auth/${p}?link=1`)}>
                  {t("methods.connect")}
                </Button>
              )}
            </Row>
          ))}
      </Group>
    </Section>
  );
}

function SignOut() {
  const t = useT("settings");
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
    <Section title={t("profile.session")}>
      <Group>
        <Row label={t("profile.signOut")} description={t("profile.signOutHint")}>
          <Button type="button" variant="ghost" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
            {t("profile.signOut")}
          </Button>
        </Row>
      </Group>
    </Section>
  );
}
