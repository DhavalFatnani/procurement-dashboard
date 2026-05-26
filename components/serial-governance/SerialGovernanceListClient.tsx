"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { ListTransitionProvider } from "@/lib/list-transition-context";

export function SerialGovernanceListClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const navigate = React.useCallback(
    (params: URLSearchParams, options?: { exactCount?: boolean }) => {
      if (options?.exactCount) {
        params.set("exactCount", "1");
      } else if (!params.has("exactCount")) {
        params.delete("exactCount");
      }
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/serial-governance?${qs}` : "/serial-governance", {
          scroll: false,
        });
      });
    },
    [router],
  );

  return (
    <ListTransitionProvider isPending={isPending} navigate={navigate}>
      {children}
    </ListTransitionProvider>
  );
}
