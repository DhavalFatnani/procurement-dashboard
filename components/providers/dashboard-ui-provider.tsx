"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useKeyboardShortcut } from "@/lib/keyboard";
import { Role } from "@prisma/client";

const CommandPalette = dynamic(
  () =>
    import("@/components/shared/CommandPalette").then((m) => ({
      default: m.CommandPalette,
    })),
  { ssr: false },
);

export type PageKeyboardHandlers = {
  onFocusSearch?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
};

type DashboardUiContextValue = {
  openCommandPalette: () => void;
  registerPageHandlers: (handlers: PageKeyboardHandlers | null) => void;
};

const DashboardUiContext = React.createContext<DashboardUiContextValue | null>(null);

export function useDashboardUi() {
  const ctx = React.useContext(DashboardUiContext);
  if (!ctx) {
    throw new Error("useDashboardUi must be used within DashboardUiProvider");
  }
  return ctx;
}

export function useDashboardUiOptional() {
  return React.useContext(DashboardUiContext);
}

export function DashboardUiProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [commandOpen, setCommandOpen] = React.useState(false);
  const pageHandlersRef = React.useRef<PageKeyboardHandlers | null>(null);

  const registerPageHandlers = React.useCallback((handlers: PageKeyboardHandlers | null) => {
    pageHandlersRef.current = handlers;
  }, []);

  const value = React.useMemo(
    () => ({
      openCommandPalette: () => setCommandOpen(true),
      registerPageHandlers,
    }),
    [registerPageHandlers],
  );

  useKeyboardShortcut("k", () => setCommandOpen(true), { metaOrCtrl: true });

  useKeyboardShortcut(
    "/",
    () => pageHandlersRef.current?.onFocusSearch?.(),
    { preventDefault: true },
  );

  useKeyboardShortcut(
    "a",
    () => pageHandlersRef.current?.onApprove?.(),
    { enabled: role === Role.OPS_HEAD },
  );

  useKeyboardShortcut(
    "r",
    () => pageHandlersRef.current?.onReject?.(),
    { enabled: role === Role.OPS_HEAD },
  );

  useKeyboardShortcut(
    "Enter",
    () => {
      const form = document.querySelector<HTMLFormElement>("form[data-submit-shortcut]");
      form?.requestSubmit();
    },
    { metaOrCtrl: true, allowInInput: true },
  );

  return (
    <DashboardUiContext.Provider value={value}>
      {children}
      {commandOpen ? (
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          role={role}
          onNavigate={(href) => router.push(href)}
        />
      ) : null}
    </DashboardUiContext.Provider>
  );
}

/** Register page-level keyboard handlers (search focus, PR approve/reject). */
export function usePageKeyboardHandlers(handlers: PageKeyboardHandlers) {
  const ui = useDashboardUiOptional();
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    if (!ui) {
      return;
    }
    ui.registerPageHandlers({
      onFocusSearch: () => handlersRef.current.onFocusSearch?.(),
      onApprove: () => handlersRef.current.onApprove?.(),
      onReject: () => handlersRef.current.onReject?.(),
    });
    return () => ui.registerPageHandlers(null);
  }, [ui]);
}
