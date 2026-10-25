import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import type { AppRouter } from "@pluton/server/router";
import { getLocale, onLocaleChange } from "../i18n/locale.ts";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } },
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({ url: "/rpc", transformer: superjson }),
      // The server writes its sentences (activity, notifications, labels) in the app's language.
      false: httpBatchLink({ url: "/rpc", transformer: superjson, headers: () => ({ "x-pluton-locale": getLocale() }) }),
    }),
  ],
});

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

// What the server wrote in the old language is refetched in the new one.
onLocaleChange(() => void queryClient.invalidateQueries());
