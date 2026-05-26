"use client";

import * as React from "react";

/**
 * Shared transition state for list pages where the filter UI lives in one
 * client component and the table lives inside a Suspense-bound server child.
 *
 * The parent wrapper holds `useTransition` so navigations from the filters
 * keep the UI responsive; the table consumes `isPending` to render a thin
 * progress indicator while the new RSC payload streams in. The shared
 * `navigate` helper lets the table (or pagination) drive URL changes through
 * the same transition so the entire list page feels coherent.
 */
type ListTransitionContextValue = {
  isPending: boolean;
  navigate: (
    params: URLSearchParams,
    options?: { exactCount?: boolean },
  ) => void;
};

const ListTransitionContext = React.createContext<ListTransitionContextValue>({
  isPending: false,
  navigate: () => {
    /* default no-op so leaves can render without a provider in tests */
  },
});

export function ListTransitionProvider({
  isPending,
  navigate,
  children,
}: {
  isPending: boolean;
  navigate: ListTransitionContextValue["navigate"];
  children: React.ReactNode;
}) {
  const value = React.useMemo<ListTransitionContextValue>(
    () => ({ isPending, navigate }),
    [isPending, navigate],
  );
  return (
    <ListTransitionContext.Provider value={value}>
      {children}
    </ListTransitionContext.Provider>
  );
}

export function useListTransition(): ListTransitionContextValue {
  return React.useContext(ListTransitionContext);
}
