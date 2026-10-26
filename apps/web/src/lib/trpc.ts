import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import type { AppRouter } from "@pluton/server/router";
import { getLocale, onLocaleChange } from "../i18n/locale.ts";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } },
});

/**
 * Hosted, the API answers 401 once the session ends and 402 once the subscription does: reload
 * from the top so the router sends the browser to sign-in or to the plans.
 */
const fetchSignedIn: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 401 || res.status === 402) window.location.assign("/");
  return res;
};

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({ url: "/rpc", transformer: superjson }),
      // The server writes its sentences (activity, notifications, labels) in the app's language.
      false: httpBatchLink({ url: "/rpc", transformer: superjson, fetch: fetchSignedIn, headers: () => ({ "x-pluton-locale": getLocale() }) }),
    }),
  ],
});

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

// What the server wrote in the old language is refetched in the new one.
onLocaleChange(() => void queryClient.invalidateQueries());
