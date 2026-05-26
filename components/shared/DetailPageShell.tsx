"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DetailPageShell({
  hero,
  tabs,
  body,
  side,
  actionBar,
  defaultSideOpen = true,
}: {
  hero: React.ReactNode;
  tabs?: React.ReactNode;
  body: React.ReactNode;
  side?: React.ReactNode;
  actionBar?: React.ReactNode;
  defaultSideOpen?: boolean;
}) {
  const [sideOpen, setSideOpen] = React.useState(defaultSideOpen);
  const hasSide = side != null;

  return (
    <div
      className={cn(
        "page-stack relative",
        actionBar ? "pb-24 lg:pb-0" : "pb-0",
      )}
    >
      <div
        className={cn(
          "grid gap-6",
          hasSide && sideOpen ? "lg:grid-cols-[1fr_320px]" : "lg:grid-cols-[1fr]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-6">
          <DetailHero
            hasSide={hasSide}
            sideOpen={sideOpen}
            onToggleSide={() => setSideOpen((open) => !open)}
          >
            {hero}
          </DetailHero>
          {tabs ? (
            <div className="rounded-2xl border border-border-subtle bg-card px-2 shadow-ds">
              {tabs}
            </div>
          ) : null}
          <div className="min-w-0 section-stack">{body}</div>
        </div>
        {hasSide && sideOpen ? (
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">{side}</aside>
        ) : null}
      </div>
      {actionBar ? <DetailActionBar>{actionBar}</DetailActionBar> : null}
    </div>
  );
}

function DetailHero({
  children,
  hasSide,
  sideOpen,
  onToggleSide,
}: {
  children: React.ReactNode;
  hasSide: boolean;
  sideOpen: boolean;
  onToggleSide: () => void;
}) {
  return (
    <div className="relative space-y-4 rounded-2xl border border-border-subtle bg-card p-5 shadow-ds surface-glow">
      {hasSide ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggleSide}
          aria-pressed={sideOpen}
          aria-label={sideOpen ? "Hide details panel" : "Show details panel"}
          className="absolute right-3 top-3 hidden rounded-full lg:inline-flex"
        >
          {sideOpen ? (
            <PanelRightClose className="size-3.5" strokeWidth={1.5} aria-hidden />
          ) : (
            <PanelRightOpen className="size-3.5" strokeWidth={1.5} aria-hidden />
          )}
        </Button>
      ) : null}
      {children}
    </div>
  );
}

function DetailActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 lg:hidden">
      <div className="pointer-events-auto flex w-full max-w-content items-center justify-between gap-3 rounded-2xl border border-border-subtle px-3 py-2.5 shadow-ds-2 surface-glass">
        {children}
      </div>
    </div>
  );
}

export function DetailSideCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-ds">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-ds-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="space-y-1 text-ds-sm">{children}</div>
    </div>
  );
}
