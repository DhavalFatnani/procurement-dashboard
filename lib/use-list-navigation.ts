"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Wrap list filter/pagination navigations so Next.js keeps the current UI visible while RSC reloads. */
export function useListNavigation() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => {
      router.push(href);
    });
  }

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return { isPending, navigate, refresh };
}
