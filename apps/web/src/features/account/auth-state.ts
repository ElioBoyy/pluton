import { queryOptions } from "@tanstack/react-query";

export type AuthState = {
  /** False on a self-hosted install: no accounts, no payment, the app opens straight away. */
  hosted: boolean;
  /** The ways in this server offers; `password` needs it to send email. */
  providers: { google: boolean; apple: boolean; password: boolean };
  user: {
    email: string | null;
    name: string | null;
    plan: "byo" | "all" | null;
    paid: boolean;
    status: string | null;
    /** The ways in linked to this account. */
    methods: { password: boolean; google: boolean; apple: boolean };
  } | null;
};

/** Who is signed in and whether they have paid; the router reads it before every page. */
export const authStateQuery = queryOptions({
  queryKey: ["auth", "state"],
  queryFn: async (): Promise<AuthState> => {
    const res = await fetch("/api/auth/state", { credentials: "same-origin" });
    // A server without accounts (older, or self-hosted behind another proxy): the app opens as before.
    if (res.status === 404) return { hosted: false, providers: { google: false, apple: false, password: false }, user: null };
    if (!res.ok) throw new Error(`Auth state: ${res.status}`);
    return res.json();
  },
  staleTime: 60_000,
});

/** POSTs JSON to a billing or auth route and returns its answer, throwing on an error status. */
export async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin" });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? String(res.status));
  return json;
}

export async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? String(res.status));
  return json;
}
