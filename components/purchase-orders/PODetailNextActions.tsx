"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import type { PONextAction } from "@/lib/po-next-actions";
import { cn } from "@/lib/utils";

/**
 * Side-panel list of contextual next steps. Mirrors the actions surfaced in
 * the sticky action bar but in a more browsable list form. Mutate-style
 * actions (mark delivery complete, force close) raise an event so the parent
 * action bar can drive the actual confirmation flow.
 */
export function PODetailNextActions({
  actions,
  onAction,
}: {
  actions: PONextAction[];
  onAction: (id: PONextAction["id"]) => void;
}) {
  if (actions.length === 0) {
    return (
      <p className="text-ds-sm text-muted-foreground">
        Nothing pending — this purchase order is closed.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {actions.map((action) => (
        <li key={action.id}>
          {action.href ? (
            <Link
              href={action.href}
              className={cn(
                "group/action flex items-start gap-2 rounded-lg border border-border-subtle bg-background px-2.5 py-2 text-left transition-colors duration-fast",
                "hover:border-border-default hover:bg-secondary/40",
                action.tone === "destructive" &&
                  "text-destructive hover:border-destructive/40",
              )}
            >
              <ActionBody action={action} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => onAction(action.id)}
              className={cn(
                "group/action flex w-full items-start gap-2 rounded-lg border border-border-subtle bg-background px-2.5 py-2 text-left transition-colors duration-fast",
                "hover:border-border-default hover:bg-secondary/40 focus-visible:shadow-ds-focus outline-none",
                action.tone === "destructive" &&
                  "text-destructive hover:border-destructive/40",
              )}
            >
              <ActionBody action={action} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ActionBody({ action }: { action: PONextAction }) {
  return (
    <>
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors group-hover/action:bg-secondary/80 group-hover/action:text-foreground">
        <ArrowRight className="size-3" strokeWidth={2} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ds-sm font-medium leading-tight">
          {action.label}
        </span>
        <span className="text-ds-xs text-muted-foreground">
          {action.description}
        </span>
      </span>
    </>
  );
}
