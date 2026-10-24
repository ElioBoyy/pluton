import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import type { AppRouter } from "@pluton/server/router";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } },
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({ url: "/rpc", transformer: superjson }),
      false: httpBatchLink({ url: "/rpc", transformer: superjson }),
    }),
  ],
});

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
