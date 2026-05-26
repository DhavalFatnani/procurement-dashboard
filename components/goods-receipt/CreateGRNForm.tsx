"use client";

import { GRNExceptionType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { createGRN, getPOForGRN, getPOsForGRN, type POForGRNOption } from "@/app/actions/grn";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
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
  const [receivedAt, setReceivedAt] = React.useState(today);
  const [deliveryNoteRef, setDeliveryNoteRef] = React.useState("");
  const [flagException, setFlagException] = React.useState(false);
  const [exceptionType, setExceptionType] = React.useState<GRNExceptionType>("DAMAGED");
  const [exceptionQty, setExceptionQty] = React.useState("");
  const [exceptionNote, setExceptionNote] = React.useState("");
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
      return;
    }
    setLineQty(Object.fromEntries(selected.lines.map((line) => [line.poLineId, ""])));
  }, [selected]);

  const receivedNum = selected
    ? selected.lines.reduce((sum, line) => sum + (Number(lineQty[line.poLineId]) || 0), 0)
    : 0;
  const exceptionNum = flagException ? Number(exceptionQty) || 0 : 0;
  const acceptedPreview = Math.max(0, receivedNum - exceptionNum);
  const disputedPreview = exceptionNum;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!poId || !selected) {
      toast.error("Select a purchase order.");
      return;
    }
    setSubmitting(true);
    const res = await createGRN({
      poId,
      lineReceipts: selected.lines
        .map((line) => ({
          poLineId: line.poLineId,
          receivedQty: Number(lineQty[line.poLineId]) || 0,
        }))
        .filter((r) => r.receivedQty > 0),
      receivedAt,
      deliveryNoteRef: deliveryNoteRef.trim() || undefined,
      exception: flagException
        ? {
            exceptionType,
            exceptionQty: exceptionNum,
            note: exceptionNote.trim(),
          }
        : undefined,
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
                {selected.lines.map((line) => (
                  <div key={line.poLineId} className="rounded-lg border border-border-subtle p-3">
                    <p className="text-ds-sm font-medium">
                      Line {line.lineNumber}: {line.label}
                    </p>
                    <p className="text-ds-xs text-muted-foreground">
                      Pending {line.pendingQty} of {line.orderedQty} ordered
                    </p>
                    <label
                      htmlFor={`line-qty-${line.poLineId}`}
                      className="mt-2 block text-ds-sm font-medium"
                    >
                      Received qty
                    </label>
                    <Input
                      id={`line-qty-${line.poLineId}`}
                      type="number"
                      min={0}
                      max={line.pendingQty}
                      value={lineQty[line.poLineId] ?? ""}
                      onChange={(e) =>
                        setLineQty((prev) => ({ ...prev, [line.poLineId]: e.target.value }))
                      }
                      className="mt-1 max-w-[200px]"
                    />
                  </div>
                ))}
                <p className="text-ds-sm text-muted-foreground">
                  Total received this entry: <strong>{receivedNum}</strong>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Exception (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 text-ds-sm">
              <input
                type="checkbox"
                checked={flagException}
                onChange={(e) => setFlagException(e.target.checked)}
              />
              Flag an exception on this receipt
            </label>
            {flagException ? (
              <>
                <div className="space-y-1">
                  <label htmlFor="exceptionType" className="text-ds-sm font-medium">
                    Exception type
                  </label>
                  <Select
                    value={exceptionType}
                    onValueChange={(v) => setExceptionType(v as GRNExceptionType)}
                  >
                    <SelectTrigger className="w-full" aria-label="Exception type">
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
                  <label htmlFor="exceptionQty" className="text-ds-sm font-medium">
                    Exception quantity
                  </label>
                  <Input
                    id="exceptionQty"
                    type="number"
                    min={1}
                    max={receivedNum || undefined}
                    required
                    value={exceptionQty}
                    onChange={(e) => setExceptionQty(e.target.value)}
                    className="mt-1 max-w-[200px]"
                  />
                </div>
                <div>
                  <label htmlFor="exceptionNote" className="text-ds-sm font-medium">
                    Exception note
                  </label>
                  <textarea
                    id="exceptionNote"
                    required
                    value={exceptionNote}
                    onChange={(e) => setExceptionNote(e.target.value)}
                    className="mt-1 min-h-[88px] w-full rounded-lg border border-input px-2 py-2 text-sm"
                  />
                </div>
                {receivedNum > 0 ? (
                  <p className="text-ds-sm text-muted-foreground">
                    Accepted qty will be {acceptedPreview} and disputed qty will be {disputedPreview}.
                    These must sum to {receivedNum}.
                  </p>
                ) : null}
              </>
            ) : null}
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
