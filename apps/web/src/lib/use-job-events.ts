import { useSubscription } from "@trpc/tanstack-react-query";
import { useTRPC } from "./trpc.ts";

export type StreamEventView = { id: number; type: string; payload: unknown; createdAt: Date };

/** Follows a stream channel (`job:<id>`, `run:<id>`…) from its first event; disabled while `channel` is null. */
export function useChannel(channel: string | null, onEvent: (event: StreamEventView) => void) {
  const trpc = useTRPC();
  useSubscription(
    trpc.events.watch.subscriptionOptions(
      { channel: channel ?? "" },
      { enabled: channel !== null, onData: ({ data }) => onEvent(data) },
    ),
  );
}
