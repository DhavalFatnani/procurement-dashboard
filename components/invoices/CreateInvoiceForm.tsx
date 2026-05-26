"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  createInvoice,
  getPOForInvoice,
  getPOsForInvoice,
} from "@/app/actions/invoices";
import type { POForInvoiceOption } from "@/lib/queries/invoices";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatGrnReceiptLabel } from "@/lib/display-ref";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import { computeInvoiceMatchFromExpected } from "@/lib/invoiceMatch";
import { Combobox } from "@/components/ui/combobox";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CreateInvoiceForm() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [poId, setPoId] = React.useState("");
  const [poOptions, setPoOptions] = React.useState<
    Pick<POForInvoiceOption, "id" | "label" | "vendorName">[]
  >([]);
  const [selectedPo, setSelectedPo] = React.useState<POForInvoiceOption | null>(null);
  const [loadingPoOptions, setLoadingPoOptions] = React.useState(true);
  const [loadingSelected, setLoadingSelected] = React.useState(false);
  const [selectedGrnIds, setSelectedGrnIds] = React.useState<string[]>([]);
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState(today);
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void getPOsForInvoice().then((rows) => {
      if (!cancelled) {
        setPoOptions(rows.map((p) => ({ id: p.id, label: p.label, vendorName: p.vendorName })));
        setLoadingPoOptions(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!poId) {
      setSelectedPo(null);
      return;
    }
    let cancelled = false;
    setLoadingSelected(true);
    void getPOForInvoice(poId).then((po) => {
      if (!cancelled) {
        setSelectedPo(po);
        setLoadingSelected(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [poId]);

  const poGrns = selectedPo?.grns ?? [];
  const eligibleGrns = poGrns.filter((g) => !g.alreadyInvoiced);

  React.useEffect(() => {
    setSelectedGrnIds([]);
  }, [poId]);

  const selectedGrns = eligibleGrns.filter((g) => selectedGrnIds.includes(g.id));
  const acceptedQty = selectedGrns.reduce((s, g) => s + g.acceptedQty, 0);

  const priceByLine = new Map(
    (selectedPo?.linePrices ?? []).map((line) => [line.poLineId, Number(line.unitPrice)]),
  );

  let expectedAmount: number | null = null;
  if (selectedGrns.length > 0 && priceByLine.size > 0) {
    expectedAmount = selectedGrns.reduce((sum, grn) => {
      return (
        sum +
        grn.lineAccepted.reduce((lineSum, la) => {
          const price = priceByLine.get(la.poLineId);
          return lineSum + (price != null ? la.acceptedQty * price : 0);
        }, 0)
      );
    }, 0);
  } else if (selectedPo?.unitPrice != null && acceptedQty > 0) {
    expectedAmount = acceptedQty * Number(selectedPo.unitPrice);
  }

  const amountNum = Number(amount) || 0;
  const match =
    acceptedQty > 0 && amountNum > 0
      ? computeInvoiceMatchFromExpected(expectedAmount, amountNum)
      : null;

  function toggleGrn(id: string) {
    setSelectedGrnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!poId || selectedGrnIds.length === 0) {
      toast.error("Select a PO and at least one GRN.");
      return;
    }
    if (!file) {
      toast.error("Upload an invoice file.");
      return;
    }

    const fd = new FormData();
    fd.set("poId", poId);
    selectedGrnIds.forEach((id) => fd.append("grnId", id));
    fd.set("invoiceNumber", invoiceNumber.trim());
    fd.set("amount", amount);
    fd.set("invoiceDate", invoiceDate);
    fd.set("file", file);

    setSubmitting(true);
    const res = await createInvoice(fd);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.message ?? "Failed to upload invoice.");
      return;
    }
    toast.success("Invoice uploaded.");
    router.push(`/purchase-orders/${poId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload invoice"
        subtitle="Link GRNs on a purchase order and record the supplier invoice."
        action={
          <Link href="/invoices" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to list
          </Link>
        }
      />

      <form
        data-submit-shortcut
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl space-y-4"
      >
        <Card size="sm">
          <CardHeader>
            <CardTitle>Purchase order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Combobox
              value={poId}
              onChange={setPoId}
              options={poOptions.map((p) => ({
                value: p.id,
                label: p.label,
                description: p.vendorName,
              }))}
              placeholder={loadingPoOptions ? "Loading POs…" : "Select purchase order…"}
              searchPlaceholder="Search by PO ref or vendor…"
              emptyText="No POs match"
              ariaLabel="Purchase order"
              disabled={loadingPoOptions}
              loading={loadingPoOptions}
              loadingText="Loading POs…"
            />
            {loadingSelected ? (
              <p className="text-ds-sm text-muted-foreground">Loading PO details…</p>
            ) : null}
            {selectedPo ? (
              <p className="text-ds-sm text-muted-foreground">
                Vendor: {selectedPo.vendorName}
                {selectedPo.unitPrice
                  ? ` · Unit price ${formatInr(Number(selectedPo.unitPrice))}`
                  : " · Unit price not set"}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {poId ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle>GRNs to invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {poGrns.length === 0 ? (
                <p className="text-ds-sm text-muted-foreground">
                  No GRNs with accepted quantity on this PO.
                </p>
              ) : (
                poGrns.map((g) => (
                  <label
                    key={g.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border border-border-subtle p-3",
                      g.alreadyInvoiced ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGrnIds.includes(g.id)}
                      disabled={g.alreadyInvoiced}
                      onChange={() => toggleGrn(g.id)}
                      className="mt-0.5 size-3.5"
                    />
                    <span className="text-ds-sm">
                      <span className="font-medium">
                        {selectedPo
                          ? formatGrnReceiptLabel(poId, g.receivedAt, selectedPo.vendorName)
                          : formatDateMedium(g.receivedAt)}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatDateMedium(g.receivedAt)}
                        {" "}
                        · {g.acceptedQty} accepted
                        {" "}
                        · Already invoiced? {g.alreadyInvoiced ? "Yes" : "No"}
                        {g.disputedQty > 0
                          ? ` (${g.disputedQty} disputed — excluded from invoiceable amount)`
                          : ""}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card size="sm">
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-ds-sm font-medium" htmlFor="invoiceNumber">
                Invoice number
              </label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
                placeholder="Supplier invoice number"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-ds-sm font-medium" htmlFor="amount">
                Invoice amount
              </label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-ds-sm font-medium" htmlFor="invoiceDate">
                Invoice date
              </label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-ds-sm font-medium" htmlFor="file">
                Invoice file (PDF or image)
              </label>
              <Input
                id="file"
                type="file"
                accept=".pdf,image/*"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </CardContent>
        </Card>

        {match && selectedGrnIds.length > 0 && amountNum > 0 ? (
          <Card size="sm" className="border-border">
            <CardHeader>
              <CardTitle>Match preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-ds-sm">
              <p>GRNs selected: {selectedGrnIds.join(", ")}</p>
              <p>Total accepted qty from selected GRNs: {acceptedQty} units</p>
              {(selectedPo?.linePrices.length ?? 0) > 1 ? (
                <p className="text-muted-foreground">
                  Expected amount uses per-line unit prices from the PO.
                </p>
              ) : (
                <p>
                  Unit price from PO:{" "}
                  {selectedPo?.unitPrice != null
                    ? formatInr(Number(selectedPo.unitPrice))
                    : "Not set"}
                </p>
              )}
              <p>
                Expected invoice amount:{" "}
                {match.expectedAmount != null
                  ? formatInr(match.expectedAmount)
                  : "Cannot compute"}
              </p>
              <p>Entered amount: {formatInr(amountNum)}</p>
              {match.variancePct != null ? (
                <p>
                  Variance: {formatInr(match.variance)} ({match.variancePct.toFixed(1)}%)
                </p>
              ) : null}
              <p
                className={cn(
                  "font-medium",
                  match.matchStatus === "MATCHED" && "text-status-success",
                  match.matchStatus === "MISMATCH" && "text-status-error",
                  match.matchStatus === "PENDING" && "text-muted-foreground",
                )}
              >
                {match.matchStatus === "MATCHED"
                  ? "MATCHED — within tolerance"
                  : match.matchStatus === "MISMATCH"
                    ? "MISMATCH — flagged for Ops Head override before payment"
                    : "CANNOT VERIFY — saved as pending match"}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Uploading…" : "Upload invoice"}
          </Button>
          <Link href="/invoices" className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </Link>
        </div>
        <p className="text-ds-xs text-muted-foreground">
          <kbd className="rounded bg-muted px-1 font-mono">⌘</kbd>+
          <kbd className="rounded bg-muted px-1 font-mono">Enter</kbd> to submit
        </p>
      </form>
    </div>
  );
}
