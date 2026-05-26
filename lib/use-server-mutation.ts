"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

export type ServerMutationResult = { ok: boolean; message?: string };

type RunHandlers = {
  onSuccess?: (result: ServerMutationResult) => void;
  onError?: (message: string) => void;
  /** Run router.refresh / onRefresh after success. Default true. */
  refresh?: boolean;
};

/**
 * Tracks async server-action duration with real `isPending` state.
 * `useTransition(async () => …)` does not keep pending true while awaiting the action.
 */
export function useServerMutation(options?: { onRefresh?: () => void }) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [, startTransition] = React.useTransition();

  const run = React.useCallback(
    async (
      fn: () => Promise<ServerMutationResult | void>,
      handlers?: RunHandlers,
    ): Promise<ServerMutationResult | void> => {
      setIsPending(true);
      try {
        const result = await fn();
        if (result && !result.ok) {
          handlers?.onError?.(result.message ?? "Request failed.");
          return result;
        }
        handlers?.onSuccess?.(result ?? { ok: true });
        if (handlers?.refresh !== false) {
          startTransition(() => {
            if (options?.onRefresh) {
              options.onRefresh();
            } else {
              router.refresh();
            }
          });
        }
        return result ?? { ok: true };
      } finally {
        setIsPending(false);
      }
    },
    [options?.onRefresh, router, startTransition],
  );

  return { isPending, run, startTransition, router };
}
