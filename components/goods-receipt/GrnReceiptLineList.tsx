"use client";

import { Chip } from "@/components/shared/Chip";
import { SheetSection } from "@/components/shared/SheetSection";
import type { GRNDetailLine } from "@/lib/queries/grn";
import { cn } from "@/lib/utils";

export function GrnReceiptLineList({ lines }: { lines: GRNDetailLine[] }) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <SheetSection title="Line items">
      <ul className="space-y-2">
        {lines.map((line) => (
          <li
            key={line.poLineItemId}
            className="space-y-2 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm"
          >
            <div>
              <p className="font-medium">
                Line {line.lineNumber}
                {line.lineItemNumber > 1 ? `.${line.lineItemNumber}` : ""}: {line.label}
              </p>
              <p className="mt-1 text-ds-xs text-muted-foreground">
                Received {line.receivedQty} · Accepted{" "}
                <span className="text-[var(--status-success)]">{line.acceptedQty}</span>
                {line.disputedQty > 0 ? (
                  <>
                    {" "}
                    · Disputed{" "}
                    <span className="text-[var(--status-warning)]">{line.disputedQty}</span>
                  </>
                ) : null}
              </p>
            </div>
            {line.exception ? (
              <GrnLineExceptionSummary exception={line.exception} />
            ) : null}
          </li>
        ))}
      </ul>
    </SheetSection>
  );
}

export function GrnLineExceptionSummary({
  exception,
  className,
}: {
  exception: NonNullable<GRNDetailLine["exception"]>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-1 rounded-md border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)]/40 px-2.5 py-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ds-xs font-medium">
          {exception.exceptionType.replaceAll("_", " ")} · Qty {exception.exceptionQty}
        </span>
        {exception.resolutionStatus ? (
          <Chip tone="success" size="sm">
            {exception.resolutionStatus.replaceAll("_", " ")}
          </Chip>
        ) : (
          <Chip tone="error" size="sm" showDot>
            Open
          </Chip>
        )}
      </div>
      <p className="text-ds-xs text-muted-foreground">{exception.note}</p>
      {exception.resolutionNote ? (
        <p className="text-ds-xs text-muted-foreground">Resolution: {exception.resolutionNote}</p>
      ) : null}
    </div>
  );
}
