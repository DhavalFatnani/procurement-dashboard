"use client";

import { GRNExceptionType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { createGRN, getPOForGRN, getPOsForGRN } from "@/app/actions/grn";
import type { POForGRNOption } from "@/lib/queries/grn";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { QuantityInput } from "@/components/shared/QuantityInput";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EXCEPTION_TYPES: { value: GRNExceptionType; label: string }[] = [
  { value: "DAMAGED", label: "Damaged" },
  { value: "WRONG_ITEM", label: "Wrong item received" },
  { value: "QUANTITY_SHORT", label: "Quantity short of delivery note" },
  { value: "QUALITY_REJECTION", label: "Quality rejection" },
];

type LineExceptionDraft = {
  flagged: boolean;
  exceptionType: GRNExceptionType;
  exceptionQty: string;
  note: string;
};

function emptyLineException(): LineExceptionDraft {
  return {
    flagged: false,
    exceptionType: "DAMAGED",
    exceptionQty: "",
    note: "",
  };
}

export function CreateGRNForm({
  receivedByName,
  initialPoId,
}: {
  receivedByName: string;
  initialPoId?: string;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const poLocked = Boolean(initialPoId);

  const [poId, setPoId] = React.useState(initialPoId ?? "");
  const [poOptions, setPoOptions] = React.useState<POForGRNOption[]>([]);
  const [selected, setSelected] = React.useState<POForGRNOption | null>(null);
  const [loadingPoOptions, setLoadingPoOptions] = React.useState(true);
  const [loadingSelected, setLoadingSelected] = React.useState(false);
  const [lineQty, setLineQty] = React.useState<Record<string, string>>({});
  const [lineException, setLineException] = React.useState<Record<string, LineExceptionDraft>>(
    {},
  );
  const [receivedAt, setReceivedAt] = React.useState(today);
  const [deliveryNoteRef, setDeliveryNoteRef] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (poLocked) {
      setLoadingPoOptions(false);
      return;
    }
    let cancelled = false;
    void getPOsForGRN().then((rows) => {
      if (!cancelled) {
        setPoOptions(rows);
        setLoadingPoOptions(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [poLocked]);

  React.useEffect(() => {
    if (!poId) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    setLoadingSelected(true);
    void getPOForGRN(poId).then((po) => {
      if (!cancelled) {
        setSelected(po);
        setLoadingSelected(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [poId]);

  React.useEffect(() => {
    if (!selected) {
      setLineQty({});
      setLineException({});
      return;
    }
    setLineQty(
      Object.fromEntries(selected.lines.map((line) => [line.poLineItemId, ""])),
    );
    setLineException(
      Object.fromEntries(
        selected.lines.map((line) => [line.poLineItemId, emptyLineException()]),
      ),
    );
  }, [selected]);

  const receivedNum = selected
    ? selected.lines.reduce(
        (sum, line) => sum + (Number(lineQty[line.poLineItemId]) || 0),
        0,
      )
    : 0;
  const disputedPreview = selected
    ? selected.lines.reduce((sum, line) => {
        const draft = lineException[line.poLineItemId];
        if (!draft?.flagged) {
          return sum;
        }
        return sum + (Number(draft.exceptionQty) || 0);
      }, 0)
    : 0;
  const acceptedPreview = Math.max(0, receivedNum - disputedPreview);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!poId || !selected) {
      toast.error("Select a purchase order.");
      return;
    }
    setSubmitting(true);
    const res = await createGRN({
      poId,
      lineItemReceipts: selected.lines
        .map((line) => {
          const receivedQty = Number(lineQty[line.poLineItemId]) || 0;
          const draft = lineException[line.poLineItemId];
          return {
            poLineItemId: line.poLineItemId,
            receivedQty,
            exception:
              draft?.flagged && receivedQty > 0
                ? {
                    exceptionType: draft.exceptionType,
                    exceptionQty: Number(draft.exceptionQty) || 0,
                    note: draft.note.trim(),
                  }
                : undefined,
          };
        })
        .filter((r) => r.receivedQty > 0),
      receivedAt,
      deliveryNoteRef: deliveryNoteRef.trim() || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.message ?? "Failed to create GRN.");
      return;
    }
    toast.success("Goods receipt recorded.");
    router.push(`/purchase-orders/${poId}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New goods receipt"
        subtitle="Record delivery against an open purchase order."
        action={
          <Link
            href={poLocked ? `/purchase-orders/${initialPoId}` : "/goods-receipt"}
            className={buttonVariants({ variant: "outline" })}
          >
            {poLocked ? "Back to PO" : "Back to list"}
          </Link>
        }
      />

      <form onSubmit={(e) => void handleSubmit(e)} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Purchase order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {poLocked ? (
              <p className="text-ds-sm text-muted-foreground">
                Recording receipt for{" "}
                <ProcurementRefLink id={poId} className="font-medium" />.
              </p>
            ) : (
              <div className="space-y-1">
                <label htmlFor="poId" className="text-ds-sm font-medium">
                  Purchase order
                </label>
                <Combobox
                  value={poId}
                  onChange={setPoId}
                  options={poOptions.map((p) => ({
                    value: p.id,
                    label: p.label,
                    description: `Pending ${p.pendingQty}`,
                  }))}
                  placeholder={loadingPoOptions ? "Loading POs…" : "Select PO…"}
                  searchPlaceholder="Search by PO ref or vendor…"
                  emptyText="No POs match"
                  ariaLabel="Purchase order"
                  disabled={loadingPoOptions}
                  loading={loadingPoOptions}
                  loadingText="Loading POs…"
                />
              </div>
            )}
            {loadingSelected ? (
              <p className="text-ds-sm text-muted-foreground">Loading PO details…</p>
            ) : null}
            {poLocked && !loadingSelected && !selected ? (
              <p className="text-ds-sm text-[var(--status-error)]">
                This purchase order is not open for goods receipt (closed or fully received).{" "}
                <Link href={`/purchase-orders/${initialPoId}`} className="text-primary hover:underline">
                  Return to PO
                </Link>
              </p>
            ) : null}
            {selected ? (
              <div className="rounded-lg border border-border-subtle bg-muted/30 p-4 text-ds-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Vendor:</span> {selected.vendorName}
                </p>
                <p>
                  <span className="text-muted-foreground">Ordered:</span> {selected.orderedQty}
                </p>
                <p>
                  <span className="text-muted-foreground">Previously received:</span>{" "}
                  {selected.previouslyReceivedQty}
                </p>
                <p>
                  <span className="text-muted-foreground">Pending:</span>{" "}
                  <span className="font-semibold">{selected.pendingQty}</span>
                </p>
                {selected.isLockTags && selected.serialRange ? (
                  <p className="mt-2 border-t border-border-subtle pt-2 text-muted-foreground">
                    Serial range on this PO: {selected.serialRange.rangeStart} to{" "}
                    {selected.serialRange.rangeEnd} ({selected.serialRange.series}). Use this range
                    to cross-check physical tags received.
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Receipt entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected ? (
              <div className="space-y-3">
                {selected.lines.map((line) => {
                  const lineReceived = Number(lineQty[line.poLineItemId]) || 0;
                  const draft = lineException[line.poLineItemId] ?? emptyLineException();
                  return (
                    <div
                      key={line.poLineItemId}
                      className="space-y-3 rounded-lg border border-border-subtle p-3"
                    >
                      <p className="text-ds-sm font-medium">
                        Line {line.lineNumber}
                        {line.lineItemNumber > 1 ? `.${line.lineItemNumber}` : ""}: {line.label}
                      </p>
                      <p className="text-ds-xs text-muted-foreground">
                        Pending {line.pendingQty} of {line.orderedQty} ordered
                      </p>
                      <label
                        htmlFor={`line-qty-${line.poLineItemId}`}
                        className="block text-ds-sm font-medium"
                      >
                        Received qty
                      </label>
                      <QuantityInput
                        id={`line-qty-${line.poLineItemId}`}
                        min={0}
                        max={line.pendingQty}
                        showEmptyWhenZero
                        value={Number(lineQty[line.poLineItemId]) || 0}
                        onChange={(n) => {
                          setLineQty((prev) => ({
                            ...prev,
                            [line.poLineItemId]: n === 0 ? "" : String(n),
                          }));
                          if (n < 1) {
                            setLineException((prev) => ({
                              ...prev,
                              [line.poLineItemId]: emptyLineException(),
                            }));
                          }
                        }}
                        className="mt-1 max-w-[10rem]"
                      />
                      {lineReceived > 0 ? (
                        <div className="space-y-3 border-t border-border-subtle pt-3">
                          <label className="flex items-center gap-3 text-ds-sm">
                            <input
                              type="checkbox"
                              checked={draft.flagged}
                              onChange={(e) =>
                                setLineException((prev) => ({
                                  ...prev,
                                  [line.poLineItemId]: {
                                    ...(prev[line.poLineItemId] ?? emptyLineException()),
                                    flagged: e.target.checked,
                                  },
                                }))
                              }
                            />
                            Flag exception on this line
                          </label>
                          {draft.flagged ? (
                            <div className="space-y-3 pl-1">
                              <div className="space-y-1">
                                <label
                                  htmlFor={`exception-type-${line.poLineItemId}`}
                                  className="text-ds-sm font-medium"
                                >
                                  Exception type
                                </label>
                                <Select
                                  value={draft.exceptionType}
                                  onValueChange={(v) =>
                                    setLineException((prev) => ({
                                      ...prev,
                                      [line.poLineItemId]: {
                                        ...(prev[line.poLineItemId] ?? emptyLineException()),
                                        exceptionType: v as GRNExceptionType,
                                      },
                                    }))
                                  }
                                >
                                  <SelectTrigger
                                    className="w-full"
                                    aria-label={`Exception type for line ${line.lineNumber}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EXCEPTION_TYPES.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label
                                  htmlFor={`exception-qty-${line.poLineItemId}`}
                                  className="text-ds-sm font-medium"
                                >
                                  Exception quantity
                                </label>
                                <QuantityInput
                                  id={`exception-qty-${line.poLineItemId}`}
                                  min={1}
                                  max={lineReceived}
                                  value={
                                    draft.exceptionQty === ""
                                      ? 0
                                      : Number(draft.exceptionQty) || 1
                                  }
                                  showEmptyWhenZero
                                  onChange={(n) =>
                                    setLineException((prev) => ({
                                      ...prev,
                                      [line.poLineItemId]: {
                                        ...(prev[line.poLineItemId] ?? emptyLineException()),
                                        exceptionQty: n === 0 ? "" : String(n),
                                      },
                                    }))
                                  }
                                  className="mt-1 max-w-[10rem]"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor={`exception-note-${line.poLineItemId}`}
                                  className="text-ds-sm font-medium"
                                >
                                  Exception note
                                </label>
                                <textarea
                                  id={`exception-note-${line.poLineItemId}`}
                                  required
                                  value={draft.note}
                                  onChange={(e) =>
                                    setLineException((prev) => ({
                                      ...prev,
                                      [line.poLineItemId]: {
                                        ...(prev[line.poLineItemId] ?? emptyLineException()),
                                        note: e.target.value,
                                      },
                                    }))
                                  }
                                  className="mt-1 min-h-[72px] w-full rounded-lg border border-input px-2 py-2 text-sm"
                                />
                              </div>
                              <p className="text-ds-xs text-muted-foreground">
                                This line: accepted{" "}
                                {Math.max(
                                  0,
                                  lineReceived - (Number(draft.exceptionQty) || 0),
                                )}{" "}
                                · disputed {Number(draft.exceptionQty) || 0}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <p className="text-ds-sm text-muted-foreground">
                  Total received this entry: <strong>{receivedNum}</strong>
                  {disputedPreview > 0 ? (
                    <>
                      {" "}
                      · Accepted <strong>{acceptedPreview}</strong> · Disputed{" "}
                      <strong>{disputedPreview}</strong>
                    </>
                  ) : null}
                </p>
              </div>
            ) : (
              <p className="text-ds-sm text-muted-foreground">Select a purchase order first.</p>
            )}
            <div>
              <label htmlFor="receivedAt" className="text-ds-sm font-medium">
                Receipt date
              </label>
              <Input
                id="receivedAt"
                type="date"
                required
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="mt-1 max-w-[200px]"
              />
            </div>
            <div>
              <label htmlFor="deliveryNoteRef" className="text-ds-sm font-medium">
                Delivery note / challan ref (optional)
              </label>
              <Input
                id="deliveryNoteRef"
                value={deliveryNoteRef}
                onChange={(e) => setDeliveryNoteRef(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <p className="text-ds-sm font-medium">Received by</p>
              <p className="mt-1 text-ds-sm text-muted-foreground">{receivedByName}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting || !selected || receivedNum < 1}>
            {submitting ? "Saving…" : "Submit GRN"}
          </Button>
          <Link
            href={poLocked ? `/purchase-orders/${initialPoId}` : "/goods-receipt"}
            className={buttonVariants({ variant: "outline" })}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
