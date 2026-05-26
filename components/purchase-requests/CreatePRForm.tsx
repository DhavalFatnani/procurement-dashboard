"use client";

import { ExecutionType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { getSerialSeriesHint, reserveSerialRangeForPR } from "@/app/actions/serial";
import { MAX_INTERNAL_PRINT_QUANTITY } from "@/lib/serial-series";
import {
  createPR,
  createVendorRequest,
  submitPR,
  updatePR,
  type CategoryOption,
  type SubcategoryOption,
} from "@/app/actions/purchase-requests";
import {
  emptyLineDraft,
  PRLineEditor,
  toLineInputs,
  type PRLineDraft,
} from "@/components/purchase-requests/PRLineEditor";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageAlert } from "@/components/shared/PageAlert";
import { ExecutionTypeBadge } from "@/components/shared/ExecutionTypeBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DOWNSTREAM_FIELD_RESET,
  findLockTagsCategory,
  internalPrintSubcategories,
  resolveCreatePRSelection,
} from "@/lib/create-pr-selection";
import { cn } from "@/lib/utils";

type SerialHint = NonNullable<Awaited<ReturnType<typeof getSerialSeriesHint>>>;

type SerialHintState = {
  subcategoryId: string;
  hint: SerialHint;
};

type WarehouseOption = { id: string; name: string };

export function CreatePRForm({
  categories,
  subcategories,
  warehouses,
  defaultWarehouseId,
}: {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  warehouses: WarehouseOption[];
  defaultWarehouseId: string;
}) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = React.useState(defaultWarehouseId);
  const selectedWarehouse = React.useMemo(
    () => warehouses.find((w) => w.id === warehouseId) ?? warehouses[0],
    [warehouses, warehouseId],
  );
  const [prId, setPrId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"unset" | "vendor" | "print">("unset");
  const [categoryId, setCategoryId] = React.useState("");
  const [subcategoryId, setSubcategoryId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [vendorLines, setVendorLines] = React.useState<PRLineDraft[]>([emptyLineDraft()]);
  const [vendorRequestId, setVendorRequestId] = React.useState<string | null>(null);
  const [pendingVendorLabel, setPendingVendorLabel] = React.useState<string | null>(null);
  const [serialHintState, setSerialHintState] = React.useState<SerialHintState | null>(null);
  const [printOpen, setPrintOpen] = React.useState(false);
  const [printReserving, setPrintReserving] = React.useState(false);
  const [printWaitMessage, setPrintWaitMessage] = React.useState<string | null>(null);
  const [vendorSheetOpen, setVendorSheetOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const lockTagsCategory = React.useMemo(
    () => findLockTagsCategory(categories),
    [categories],
  );

  const selection = React.useMemo(
    () => resolveCreatePRSelection(categories, subcategories, categoryId, subcategoryId),
    [categories, subcategories, categoryId, subcategoryId],
  );

  React.useEffect(() => {
    // Auto-switch to print mode when the user selects an INTERNAL_PRINT
    // subcategory — and only switch *out* if they actively pick a
    // VENDOR_PURCHASE subcategory. Don't snap back to "unset" while the user
    // is still in the middle of picking a category in print mode.
    if (selection?.executionType === ExecutionType.INTERNAL_PRINT) {
      setMode("print");
    } else if (mode === "print" && selection?.executionType === ExecutionType.VENDOR_PURCHASE) {
      setMode("unset");
    }
  }, [selection, mode]);

  const executionType =
    mode === "print"
      ? ExecutionType.INTERNAL_PRINT
      : mode === "vendor"
        ? ExecutionType.VENDOR_PURCHASE
        : (selection?.executionType ?? null);
  const isLockTags = selection?.isLockTags ?? false;
  const flowKey =
    mode === "vendor"
      ? `vendor-${vendorLines.length}`
      : (selection?.flowKey ?? "none");

  const serialHint =
    selection && serialHintState?.subcategoryId === selection.subcategoryId
      ? serialHintState.hint
      : null;

  const vendorLinesValid = vendorLines.every(
    (line) => line.categoryId && line.subcategoryId && line.quantity >= 1,
  );
  const section1Done =
    mode === "vendor"
      ? vendorLinesValid
      : mode === "print"
        ? lockTagsCategory != null && selection != null
        : false;
  const section2Done = section1Done && (mode === "vendor" || quantity >= 1);
  const showVendorRequestSection =
    section2Done && executionType === ExecutionType.VENDOR_PURCHASE;
  const showLockTagsSection = section2Done && isLockTags && serialHint != null;
  const showInternalPrintActions =
    section2Done && executionType === ExecutionType.INTERNAL_PRINT;
  const showVendorPurchaseActions =
    section2Done && executionType === ExecutionType.VENDOR_PURCHASE;

  function applyDownstreamReset() {
    setVendorRequestId(DOWNSTREAM_FIELD_RESET.vendorRequestId);
    setPendingVendorLabel(DOWNSTREAM_FIELD_RESET.pendingVendorLabel);
    setSerialHintState(DOWNSTREAM_FIELD_RESET.serialHint);
    setPrintOpen(DOWNSTREAM_FIELD_RESET.printOpen);
    setVendorSheetOpen(DOWNSTREAM_FIELD_RESET.vendorSheetOpen);
  }

  function enterPrintMode() {
    if (!lockTagsCategory) {
      toast.error("Lock Tags category is not configured. Contact Ops Head.");
      return;
    }
    setCategoryId(lockTagsCategory.id);
    setSubcategoryId("");
    applyDownstreamReset();
    setMode("print");
  }

  function handleSubcategoryChange(nextSubcategoryId: string) {
    setSubcategoryId(nextSubcategoryId);
    applyDownstreamReset();
  }

  React.useEffect(() => {
    if (mode !== "print" || !lockTagsCategory) {
      return;
    }
    if (categoryId !== lockTagsCategory.id) {
      setCategoryId(lockTagsCategory.id);
      setSubcategoryId("");
      applyDownstreamReset();
    }
  }, [mode, lockTagsCategory, categoryId]);

  const hintSubcategoryId = selection?.subcategoryId ?? null;

  React.useEffect(() => {
    if (!hintSubcategoryId) {
      setSerialHintState(null);
      return;
    }

    const subId = hintSubcategoryId;
    setSerialHintState(null);

    let cancelled = false;
    void getSerialSeriesHint(subId)
      .then((hint) => {
        if (cancelled) {
          return;
        }
        if (hint) {
          setSerialHintState({ subcategoryId: subId, hint });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSerialHintState(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hintSubcategoryId]);

  React.useEffect(() => {
    if (executionType !== ExecutionType.INTERNAL_PRINT) {
      setPrintOpen(false);
    }
  }, [executionType]);

  const printSubcategories = React.useMemo(() => {
    if (!lockTagsCategory) {
      return [];
    }
    return internalPrintSubcategories(subcategories, lockTagsCategory.id);
  }, [subcategories, lockTagsCategory]);

  function formPayload() {
    if (mode === "vendor") {
      return {
        lines: toLineInputs(vendorLines),
        vendorId: null,
        vendorRequestId,
        warehouseId,
      };
    }
    if (!selection) {
      throw new Error("Category and subcategory are required.");
    }
    return {
      lines: [
        {
          categoryId: selection.categoryId,
          subcategoryId: selection.subcategoryId,
          quantity,
        },
      ],
      vendorId: null,
      vendorRequestId: null,
      warehouseId,
    };
  }

  function renderWarehouseField() {
    if (warehouses.length <= 1) {
      return (
        <p className="rounded-md border border-border-subtle bg-muted/30 px-3 py-2 text-ds-sm">
          {selectedWarehouse?.name ?? "—"}
        </p>
      );
    }

    return (
      <Select value={warehouseId} onValueChange={setWarehouseId}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select warehouse" />
        </SelectTrigger>
        <SelectContent>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  async function persistDraft(): Promise<string | null> {
    if (!section1Done) {
      toast.error("Complete line items before saving.");
      return null;
    }
    const payload = formPayload();
    if (prId) {
      const result = await updatePR(prId, payload);
      if (!result.ok) {
        toast.error(result.message ?? "Could not save draft.");
        return null;
      }
      return prId;
    }
    const result = await createPR(payload);
    if (!result.ok || !result.prId) {
      toast.error(result.message ?? "Could not save draft.");
      return null;
    }
    setPrId(result.prId);
    return result.prId;
  }

  function saveDraft(then?: (id: string) => void) {
    startTransition(async () => {
      const id = await persistDraft();
      if (id) {
        toast.success("Draft saved.");
        then?.(id);
      }
    });
  }

  function submitForApproval() {
    if (executionType !== ExecutionType.VENDOR_PURCHASE) {
      return;
    }
    startTransition(async () => {
      let id = prId;
      if (!id) {
        const created = await createPR(formPayload());
        if (!created.ok || !created.prId) {
          toast.error(created.message ?? "Could not create PR.");
          return;
        }
        id = created.prId;
        setPrId(id);
      } else {
        const updated = await updatePR(id, formPayload());
        if (!updated.ok) {
          toast.error(updated.message ?? "Could not update PR.");
          return;
        }
      }
      const submitted = await submitPR(id);
      if (submitted.ok) {
        toast.success("Submitted for approval.");
        router.push(`/purchase-requests/${id}`);
      } else {
        toast.error(submitted.message ?? "Submit failed.");
      }
    });
  }

  function confirmPrint() {
    if (!selection || executionType !== ExecutionType.INTERNAL_PRINT) {
      return;
    }
    const idempotencyKey = crypto.randomUUID();
    startTransition(async () => {
      setPrintReserving(true);
      setPrintWaitMessage(null);

      const maxAttempts = 4;
      let lastError: string | undefined;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          setPrintWaitMessage("Waiting for another print to finish…");
          await new Promise((r) => setTimeout(r, 300 * attempt));
        }

        const result = await reserveSerialRangeForPR({
          prId: prId ?? undefined,
          categoryId: selection.categoryId,
          subcategoryId: selection.subcategoryId,
          quantity,
          warehouseId,
          idempotencyKey,
        });

        if (result.ok) {
          setPrintReserving(false);
          setPrintWaitMessage(null);
          toast.success("Serial range reserved.");
          setPrintOpen(false);
          router.push(`/purchase-requests/${result.prId}/print`);
          return;
        }

        lastError = result.error;
        const isConflict =
          result.error?.includes("Another print request") ?? false;
        if (!isConflict || attempt === maxAttempts - 1) {
          break;
        }
      }

      setPrintReserving(false);
      setPrintWaitMessage(null);
      toast.error(lastError ?? "Serial reservation failed.", {
        action:
          lastError?.includes("Another print request") ?? false
            ? {
                label: "Retry",
                onClick: () => confirmPrint(),
              }
            : undefined,
      });
    });
  }

  const printRangeStart = serialHint?.nextStart ? Number(serialHint.nextStart) : 1;
  const printRangeEnd = printRangeStart + quantity - 1;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Create purchase request"
        subtitle="Add vendor line items or use internal print for serial batches. Warehouse is assigned from your profile."
        action={
          <Link href="/purchase-requests" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to list
          </Link>
        }
      />

      {mode === "unset" ? (
        <section className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setMode("vendor")}>
            Vendor purchase (multi-line)
          </Button>
          <Button type="button" variant="outline" onClick={() => enterPrintMode()}>
            Internal print
          </Button>
        </section>
      ) : null}

      {mode === "vendor" ? (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-ds-sm font-semibold">1. Line items</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("unset")}>
              Change type
            </Button>
          </div>
          <p className="text-ds-xs text-muted-foreground">
            Add one or more vendor-purchase requirements. Ops will create a single PO with per-line
            pricing after approval.
          </p>
          <PRLineEditor
            categories={categories}
            subcategories={subcategories}
            lines={vendorLines}
            onChange={setVendorLines}
            vendorPurchaseOnly
          />
        </section>
      ) : null}

      {mode === "print" ? (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-ds-sm font-semibold">1. Subcategory selection</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("unset")}>
              Change type
            </Button>
          </div>
          {!lockTagsCategory ? (
            <PageAlert variant="warning">
              Lock Tags category is missing from the catalog. Internal print cannot proceed until
              Ops Head configures it.
            </PageAlert>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-ds-sm font-medium">Category</span>
                <p className="rounded-md border border-border-subtle bg-muted/30 px-3 py-2 text-ds-sm">
                  {lockTagsCategory.name}
                </p>
                <p className="text-ds-xs text-muted-foreground">
                  Internal print always uses Lock Tags.
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pr-subcategory" className="text-ds-sm font-medium">
                  Subcategory
                </label>
                <Select value={subcategoryId} onValueChange={handleSubcategoryChange}>
                  <SelectTrigger
                    id="pr-subcategory"
                    size="sm"
                    aria-label="Subcategory"
                  >
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {printSubcategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {section1Done && mode === "print" ? (
        <section
          key={`details-${flowKey}`}
          className="space-y-4 rounded-xl border border-border-subtle bg-card p-4"
        >
          <h2 className="text-ds-sm font-semibold">2. Request details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="pr-quantity" className="text-ds-sm font-medium">
                Quantity
              </label>
              <Input
                id="pr-quantity"
                type="number"
                min={1}
                max={MAX_INTERNAL_PRINT_QUANTITY}
                required
                value={quantity}
                onChange={(e) => {
                  const next = Number(e.target.value) || 1;
                  setQuantity(Math.min(MAX_INTERNAL_PRINT_QUANTITY, Math.max(1, next)));
                }}
                className="h-8"
              />
              <p className="text-ds-xs text-muted-foreground">
                Up to {MAX_INTERNAL_PRINT_QUANTITY.toLocaleString()} per print job.
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="text-ds-sm font-medium">Warehouse</span>
              {renderWarehouseField()}
            </div>
          </div>
        </section>
      ) : null}

      {section1Done && mode === "vendor" ? (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-card p-4">
          <h2 className="text-ds-sm font-semibold">2. Warehouse</h2>
          {renderWarehouseField()}
        </section>
      ) : null}

      {showVendorRequestSection ? (
        <section
          key={`vendor-request-${flowKey}`}
          className="space-y-4 rounded-xl border border-border-subtle bg-card p-4"
        >
          <h2 className="text-ds-sm font-semibold">3. Vendor request (optional)</h2>
          <p className="text-ds-xs text-muted-foreground">
            Ops Head will assign the fulfilling vendor when creating the purchase order. Request a
            new vendor here if none exists yet.
          </p>
          {pendingVendorLabel ? (
            <PageAlert variant="info">
              Vendor request submitted for <strong>{pendingVendorLabel}</strong>. Ops Head will
              review before fulfillment.
            </PageAlert>
          ) : null}
          <Sheet open={vendorSheetOpen} onOpenChange={setVendorSheetOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  className="text-ds-sm text-primary underline-offset-4 hover:underline"
                >
                  + Request new vendor
                </button>
              }
            />
            <VendorRequestSheetContent
              key={flowKey}
              ensureDraft={async () => {
                if (prId) {
                  return prId;
                }
                if (!section2Done) {
                  toast.error("Complete line items before requesting a vendor.");
                  return null;
                }
                return persistDraft();
              }}
              onCreated={(requestId, label) => {
                setVendorRequestId(requestId);
                setPendingVendorLabel(label);
                setVendorSheetOpen(false);
              }}
            />
          </Sheet>
        </section>
      ) : null}

      {showLockTagsSection && serialHint ? (
        <section
          key={`lock-tags-${flowKey}`}
          className="space-y-3 rounded-xl border border-dashed border-border-subtle bg-muted/20 p-4"
        >
          <h2 className="text-ds-sm font-semibold">4. Lock tag guidance</h2>
          <p className="text-ds-xs text-muted-foreground">
            System suggestion for {selection?.subcategoryName} (informational only)
          </p>
          <dl className="grid gap-3 text-ds-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Series</dt>
              <dd className="font-mono font-medium">{serialHint.series}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Execution type</dt>
              <dd>
                <ExecutionTypeBadge type={serialHint.executionType} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Recommended action</dt>
              <dd className="font-medium">
                {serialHint.executionType === ExecutionType.VENDOR_PURCHASE
                  ? "Purchase from vendor"
                  : "Print internally"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last reserved range end</dt>
              <dd className="font-mono">{serialHint.lastRangeEnd ?? "None yet"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Next available start</dt>
              <dd className="font-mono">{serialHint.nextStart ?? "1"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {showInternalPrintActions || showVendorPurchaseActions ? (
        <div
          key={`actions-${flowKey}`}
          className="flex flex-wrap gap-2 border-t border-border-subtle pt-4"
        >
          <Button type="button" variant="outline" disabled={pending} onClick={() => void saveDraft()}>
            Save as draft
          </Button>
          {showVendorPurchaseActions ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => submitForApproval()}
            >
              Submit for approval
            </Button>
          ) : null}
          {showInternalPrintActions ? (
            <Button
              type="button"
              disabled={pending || serialHint == null}
              onClick={() => setPrintOpen(true)}
            >
              Confirm &amp; continue
            </Button>
          ) : null}
        </div>
      ) : null}

      {showInternalPrintActions ? (
        <ConfirmDialog
          key={`print-dialog-${flowKey}`}
          open={printOpen}
          onOpenChange={setPrintOpen}
          title="Reserve serial range"
          confirmLabel={printReserving ? "Reserving…" : "Confirm print"}
          cancelLabel="Cancel"
          confirmDisabled={printReserving}
          closeOnConfirm={false}
          body={
            serialHint ? (
              <div className="space-y-3 text-ds-sm">
                <p>You are about to reserve a serial range assigned to your warehouse.</p>
                {printWaitMessage ? (
                  <p className="text-muted-foreground">{printWaitMessage}</p>
                ) : null}
                <ul className="space-y-1.5">
                  <li>
                    <span className="text-muted-foreground">Series: </span>
                    <span className="font-mono font-medium">{serialHint.series}</span>
                  </li>
                  <li>
                    <span className="text-muted-foreground">Quantity: </span>
                    <span className="font-medium">{quantity}</span>
                  </li>
                  <li>
                    <span className="text-muted-foreground">Estimated range: </span>
                    <span className="font-mono font-medium">
                      {printRangeStart} to {printRangeEnd}
                    </span>
                  </li>
                  <li>
                    <span className="text-muted-foreground">Warehouse: </span>
                    <span className="font-medium">{selectedWarehouse?.name ?? "—"}</span>
                  </li>
                </ul>
                <p className="text-ds-xs text-muted-foreground">
                  Allocation is atomic across all warehouses — concurrent prints receive
                  distinct, non-overlapping ranges.
                </p>
              </div>
            ) : null
          }
          onConfirm={() => confirmPrint()}
        />
      ) : null}
    </div>
  );
}

function VendorRequestSheetContent({
  ensureDraft,
  onCreated,
}: {
  ensureDraft: () => Promise<string | null>;
  onCreated: (requestId: string, businessName: string) => void;
}) {
  const [businessName, setBusinessName] = React.useState("");
  const [pocName, setPocName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  return (
    <SheetContent side="right" className="w-full sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Request new vendor</SheetTitle>
      </SheetHeader>
      <form
        className="space-y-3 px-4 pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const linkedPrId = await ensureDraft();
            const r = await createVendorRequest(
              { businessName, pocName, phone, email },
              linkedPrId ?? undefined,
            );
            if (r.ok && r.requestId) {
              onCreated(r.requestId, businessName);
              toast.success(
                "Vendor request submitted. Ops Head will review when creating the purchase order.",
              );
            } else {
              toast.error(r.message ?? "Could not submit vendor request.");
            }
          });
        }}
      >
        <div className="space-y-1.5">
          <label className="text-ds-sm font-medium">Business name</label>
          <Input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-ds-sm font-medium">POC name</label>
          <Input required value={pocName} onChange={(e) => setPocName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-ds-sm font-medium">Phone</label>
          <Input required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-ds-sm font-medium">Email</label>
          <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          Submit request
        </Button>
      </form>
    </SheetContent>
  );
}
