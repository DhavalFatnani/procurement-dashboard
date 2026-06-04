"use client";

import { GRNExceptionOutcome } from "@/lib/prisma-enums";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { resolveGRNException } from "@/app/actions/purchase-orders";
import { GrnLineExceptionSummary } from "@/components/goods-receipt/GrnReceiptLineList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatInr } from "@/lib/format-datetime";
import type { GrnExceptionSnapshot } from "@/lib/grn-exception-lines";
import {
  allowedOutcomes,
  defaultOutcome,
  OUTCOME_DESCRIPTIONS,
  OUTCOME_LABELS,
  resolutionNoteHint,
  resolutionNoteRequired,
} from "@/lib/grn-exception-outcomes";
import type { ResolveGrnExceptionInput } from "@/lib/grn-resolution-types";
import { describeResolutionChoice } from "@/lib/grn-resolution-types";
import { roundMoney } from "@/lib/po-gst";
import type { POReceivingLineRow } from "@/lib/po-receiving-lines";

export type ResolveDraft = {
  outcome: GRNExceptionOutcome;
  note: string;
  disputedUnitPrice: string;
};

export function defaultResolveDraft(exception: GrnExceptionSnapshot): ResolveDraft {
  return {
    outcome: defaultOutcome(exception.exceptionType),
    note: "",
    disputedUnitPrice: "",
  };
}

type ResolvePhase = "form" | "submitting";

export function ResolveGrnExceptionPanel({
  row,
  onResolved,
  onCancel,
  onSubmittingChange,
}: {
  row: POReceivingLineRow;
  /** Called with exception id once the server accepts the resolution. */
  onResolved: (exceptionId: string) => void;
  onCancel?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const exception = row.openException!;
  const [draft, setDraft] = React.useState<ResolveDraft>(() =>
    defaultResolveDraft(exception),
  );
  const [phase, setPhase] = React.useState<ResolvePhase>("form");
  const confirmInFlight = React.useRef(false);

  React.useEffect(() => {
    onSubmittingChange?.(phase === "submitting");
  }, [phase, onSubmittingChange]);

  const outcomes = allowedOutcomes(exception.exceptionType);
  const disputedQty = exception.exceptionQty;
  const acceptedBefore = row.acceptedQty;
  const basePrice = Number(row.effectiveUnitPrice);
  const settledQtyAfterReturn = acceptedBefore;
  const settledQtyAfterAccept =
    acceptedBefore + disputedQty;
  const repriceNum = Number(draft.disputedUnitPrice);
  const previewTotalAfterReprice =
    Number.isFinite(repriceNum) && repriceNum > 0
      ? roundMoney(
          acceptedBefore * basePrice + disputedQty * repriceNum,
        )
      : null;

  async function handleConfirm() {
    if (confirmInFlight.current || phase === "submitting") {
      return;
    }
    confirmInFlight.current = true;

    const input: ResolveGrnExceptionInput = {
      outcome: draft.outcome,
      note: draft.note.trim() || undefined,
    };
    if (draft.outcome === GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE) {
      input.disputedUnitPrice = Number(draft.disputedUnitPrice);
    }

    setPhase("submitting");
    const res = await resolveGRNException(exception.id, input);
    if (!res.ok) {
      confirmInFlight.current = false;
      setPhase("form");
      toast.error(res.message ?? "Failed to resolve exception.");
      return;
    }

    onResolved(exception.id);
    toast.success("Exception resolved.");

    startTransition(() => {
      const params = new URLSearchParams(window.location.search);
      params.delete("resolveExceptionId");
      const qs = params.toString();
      router.replace(
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
      router.refresh();
    });
  }

  if (phase === "submitting") {
    return (
      <div className="border-t border-border-subtle pt-3">
        <ResolvingDisputePanel
          outcome={draft.outcome}
          exceptionType={exception.exceptionType}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border-subtle pt-3">
      <GrnLineExceptionSummary exception={exception} />
      <p className="text-ds-xs text-muted-foreground rounded-md bg-muted/40 px-2 py-1.5">
        <span className="font-medium text-foreground">Warehouse note: </span>
        {exception.note}
      </p>
      <ResolveExceptionForm
        exception={exception}
        draft={draft}
        outcomes={outcomes}
        acceptedBefore={acceptedBefore}
        disputedQty={disputedQty}
        basePrice={basePrice}
        effectiveOrderedQty={row.effectiveOrderedQty}
        settledQtyAfterReturn={settledQtyAfterReturn}
        settledQtyAfterAccept={settledQtyAfterAccept}
        previewTotalAfterReprice={previewTotalAfterReprice}
        onPatch={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
      />
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Collapse
          </Button>
        ) : null}
        <Button size="sm" onClick={() => void handleConfirm()}>
          Confirm resolution
        </Button>
      </div>
    </div>
  );
}

function ResolvingDisputePanel({
  outcome,
  exceptionType,
}: {
  outcome: GRNExceptionOutcome;
  exceptionType: GrnExceptionSnapshot["exceptionType"];
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-muted/30 px-4 py-8 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className="size-8 animate-spin text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden
      />
      <div className="space-y-1">
        <p className="text-ds-sm font-medium text-foreground">Applying resolution</p>
        <p className="text-ds-xs text-muted-foreground">
          {OUTCOME_LABELS[outcome]}
          <span className="text-muted-foreground/80">
            {" "}
            · {exceptionType.replaceAll("_", " ").toLowerCase()}
          </span>
        </p>
        <p className="text-ds-2xs text-muted-foreground">
          Updating receipt and PO commitment…
        </p>
      </div>
    </div>
  );
}

function ResolveExceptionForm({
  exception,
  draft,
  outcomes,
  acceptedBefore,
  disputedQty,
  basePrice,
  effectiveOrderedQty,
  settledQtyAfterReturn,
  settledQtyAfterAccept,
  previewTotalAfterReprice,
  onPatch,
}: {
  exception: GrnExceptionSnapshot;
  draft: ResolveDraft;
  outcomes: GRNExceptionOutcome[];
  acceptedBefore: number;
  disputedQty: number;
  basePrice: number;
  effectiveOrderedQty: number;
  settledQtyAfterReturn: number;
  settledQtyAfterAccept: number;
  previewTotalAfterReprice: number | null;
  onPatch: (patch: Partial<ResolveDraft>) => void;
}) {
  const summary = describeResolutionChoice(draft.outcome);
  const noteRequired = resolutionNoteRequired(draft.outcome);
  const notePlaceholder = resolutionNoteHint(
    exception.exceptionType,
    draft.outcome,
  );

  return (
    <div className="space-y-2.5 rounded-lg border border-border-subtle bg-background p-3">
      <fieldset className="space-y-1.5">
        <legend className="text-ds-xs font-medium text-foreground">
          Resolution
        </legend>
        {outcomes.map((outcome) => (
          <label
            key={outcome}
            className="flex cursor-pointer flex-col gap-0.5 rounded-md border border-transparent px-1 py-1 has-[:checked]:border-border-subtle has-[:checked]:bg-muted/40"
          >
            <span className="flex items-center gap-2 text-ds-sm font-medium">
              <input
                type="radio"
                name={`outcome-${exception.id}`}
                checked={draft.outcome === outcome}
                onChange={() => onPatch({ outcome })}
              />
              {OUTCOME_LABELS[outcome]}
            </span>
            <span className="pl-6 text-ds-xs text-muted-foreground">
              {OUTCOME_DESCRIPTIONS[outcome]}
            </span>
          </label>
        ))}
      </fieldset>

      <OutcomePreview
        outcome={draft.outcome}
        disputedQty={disputedQty}
        acceptedBefore={acceptedBefore}
        effectiveOrderedQty={effectiveOrderedQty}
        settledQtyAfterReturn={settledQtyAfterReturn}
        settledQtyAfterAccept={settledQtyAfterAccept}
        basePrice={basePrice}
        previewTotalAfterReprice={previewTotalAfterReprice}
      />

      <p className="rounded-md bg-muted/50 px-2 py-1.5 text-ds-xs text-muted-foreground">
        {summary}
      </p>

      {draft.outcome === GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE ? (
        <div className="space-y-1">
          <label
            htmlFor={`disputed-price-${exception.id}`}
            className="text-ds-xs font-medium"
          >
            Agreed unit price for disputed qty
          </label>
          <p className="text-ds-2xs text-muted-foreground">
            A disputed catalog variant will be created for this SKU. PO line splits:
            {acceptedBefore} @ {formatInr(String(basePrice))} + {disputedQty} @ new
            price.
          </p>
          <Input
            id={`disputed-price-${exception.id}`}
            type="number"
            min="0"
            step="0.01"
            placeholder={String(basePrice)}
            value={draft.disputedUnitPrice}
            onChange={(e) => onPatch({ disputedUnitPrice: e.target.value })}
            className="h-8"
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor={`note-${exception.id}`} className="text-ds-xs font-medium">
          Resolution note{noteRequired ? " (required)" : " (optional)"}
        </label>
        <Textarea
          id={`note-${exception.id}`}
          value={draft.note}
          placeholder={notePlaceholder}
          onChange={(e) => onPatch({ note: e.target.value })}
          className="min-h-[72px]"
        />
      </div>
    </div>
  );
}

function OutcomePreview({
  outcome,
  disputedQty,
  acceptedBefore,
  effectiveOrderedQty,
  settledQtyAfterReturn,
  settledQtyAfterAccept,
  basePrice,
  previewTotalAfterReprice,
}: {
  outcome: GRNExceptionOutcome;
  disputedQty: number;
  acceptedBefore: number;
  effectiveOrderedQty: number;
  settledQtyAfterReturn: number;
  settledQtyAfterAccept: number;
  basePrice: number;
  previewTotalAfterReprice: number | null;
}) {
  let text: string;
  switch (outcome) {
    case GRNExceptionOutcome.ACCEPT_AT_PO_PRICE:
      text = `After resolve: ${settledQtyAfterAccept} accepted at PO price (${formatInr(String(basePrice))} / unit).`;
      break;
    case GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE:
      text = previewTotalAfterReprice != null
        ? `Invoice expectation ≈ ${formatInr(String(previewTotalAfterReprice))} (${acceptedBefore} @ base + ${disputedQty} @ new price).`
        : `Enter new unit price for ${disputedQty} disputed units.`;
      break;
    case GRNExceptionOutcome.RETURN_AND_SETTLE:
      text = `PO settles at ${settledQtyAfterReturn} units; no payment for ${disputedQty} returned.`;
      break;
    case GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN:
      text = `PO stays at ${effectiveOrderedQty} ordered; record replacement GRN for ${disputedQty} units before invoicing.`;
      break;
  }
  return (
    <p className="text-ds-xs text-muted-foreground border-l-2 border-border-subtle pl-2">
      {text}
    </p>
  );
}
