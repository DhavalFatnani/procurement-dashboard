"use client";

import { isCentralOpsOrAbove } from "@/lib/admin-access";
import { ExecutionType, Role } from "@/lib/prisma-enums";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { getSerialSeriesHint, reserveSerialRangeForPR } from "@/app/actions/serial";
import {
  getLatestBarcodeLabelConfigForLock,
  loadBarcodeLabelDefaults,
  lockBarcodeLabelDefaults,
  normalizeBarcodeLabelConfig,
  saveBarcodeLabelDefaultsDraft,
  saveBarcodeLabelConfigToSession,
  unlockBarcodeLabelDefaults,
  type BarcodeLabelConfig,
} from "@/lib/barcode-label-config";
import { MAX_INTERNAL_PRINT_QUANTITY, formatSerialNumberForSeries } from "@/lib/serial-series";
import {
  createPR,
  createVendorRequest,
  submitPR,
  submitPRForApproval,
  updatePR,
} from "@/app/actions/purchase-requests";
import type {
  CatalogItemOption,
  CategoryOption,
  SubcategoryOption,
} from "@/lib/queries/purchase-requests";
import {
  emptyLineDraft,
  PRLineEditor,
  toLineInputs,
  type PRLineDraft,
} from "@/components/purchase-requests/PRLineEditor";
import { CreatePRTypePicker } from "@/components/purchase-requests/CreatePRTypePicker";
import { ReserveSerialRangeDialog } from "@/components/purchase-requests/ReserveSerialRangeDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageAlert } from "@/components/shared/PageAlert";
import { ExecutionTypeBadge } from "@/components/shared/ExecutionTypeBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { QuantityInput } from "@/components/shared/QuantityInput";
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
import type { WarehouseOption } from "@/lib/format-warehouse";
import { useServerMutation } from "@/lib/use-server-mutation";
import { cn } from "@/lib/utils";

type SerialHint = NonNullable<Awaited<ReturnType<typeof getSerialSeriesHint>>>;

type SerialHintState = {
  subcategoryId: string;
  hint: SerialHint;
};

type RequestMode = "unset" | "vendor" | "print";

export function CreatePRForm({
  role,
  categories,
  subcategories,
  catalogItems,
  warehouses,
  defaultWarehouseId = "",
}: {
  role: Role;
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  catalogItems: CatalogItemOption[];
  warehouses: WarehouseOption[];
  defaultWarehouseId?: string;
}) {
  const router = useRouter();
  const { isPending: submitPending, run: runSubmit } = useServerMutation();
  const isOps = isCentralOpsOrAbove(role);
  const requiresWarehousePick = isOps;
  const [warehouseId, setWarehouseId] = React.useState(defaultWarehouseId);
  const warehouseReady = !requiresWarehousePick || warehouseId.length > 0;
  const selectedWarehouse = React.useMemo(
    () => warehouses.find((w) => w.id === warehouseId) ?? null,
    [warehouses, warehouseId],
  );
  const [prId, setPrId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<RequestMode>("unset");
  const [changeTypeConfirmOpen, setChangeTypeConfirmOpen] = React.useState(false);
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
  const printIdempotencyKeyRef = React.useRef<string | null>(null);
  const confirmPrintInFlightRef = React.useRef(false);
  const [labelDefaults] = React.useState(() => loadBarcodeLabelDefaults());
  const [barcodeLabelConfig, setBarcodeLabelConfig] = React.useState<BarcodeLabelConfig>(() =>
    normalizeBarcodeLabelConfig(labelDefaults.config),
  );
  const [labelLayoutLocked, setLabelLayoutLocked] = React.useState(labelDefaults.locked);
  const barcodeLabelConfigRef = React.useRef(barcodeLabelConfig);
  barcodeLabelConfigRef.current = barcodeLabelConfig;
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
      setMode("vendor");
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

  function resetFormState() {
    setPrId(null);
    setCategoryId("");
    setSubcategoryId("");
    setQuantity(1);
    setVendorLines([emptyLineDraft()]);
    applyDownstreamReset();
  }

  function hasUnsavedProgress(): boolean {
    if (prId) {
      return true;
    }
    if (vendorRequestId || pendingVendorLabel) {
      return true;
    }
    if (mode === "vendor") {
      return vendorLines.some(
        (line) => line.categoryId || line.subcategoryId || line.quantity !== 1,
      );
    }
    if (mode === "print") {
      return Boolean(subcategoryId) || quantity !== 1;
    }
    return false;
  }

  function requestTypeChange() {
    if (hasUnsavedProgress()) {
      setChangeTypeConfirmOpen(true);
      return;
    }
    resetFormState();
    setMode("unset");
  }

  function confirmTypeChange() {
    resetFormState();
    setMode("unset");
    setChangeTypeConfirmOpen(false);
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

  function enterVendorMode() {
    setCategoryId("");
    setSubcategoryId("");
    applyDownstreamReset();
    setMode("vendor");
  }

  const typeChosen = mode !== "unset";
  const modeLabel =
    mode === "vendor" ? "Vendor purchase" : mode === "print" ? "Internal print" : "";

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

  React.useEffect(() => {
    if (printOpen) {
      printIdempotencyKeyRef.current = crypto.randomUUID();
      confirmPrintInFlightRef.current = false;
      const saved = loadBarcodeLabelDefaults();
      const normalized = normalizeBarcodeLabelConfig(saved.config);
      barcodeLabelConfigRef.current = normalized;
      setBarcodeLabelConfig(normalized);
      setLabelLayoutLocked(saved.locked);
    }
  }, [printOpen]);

  const printSubcategories = React.useMemo(() => {
    if (!lockTagsCategory) {
      return [];
    }
    return internalPrintSubcategories(subcategories, lockTagsCategory.id);
  }, [subcategories, lockTagsCategory]);

  function formPayload() {
    if (mode === "vendor") {
      return {
        lines: toLineInputs(vendorLines, categories),
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

  function renderWarehouseField(forceSelect = false) {
    if (!forceSelect && !isOps && warehouses.length <= 1) {
      return (
        <p className="rounded-md border border-border-subtle bg-muted/30 px-3 py-2 text-ds-sm">
          {selectedWarehouse?.label ?? "—"}
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
              {warehouse.label}
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
    void runSubmit(
      () => submitPRForApproval(formPayload(), prId),
      {
        refresh: false,
        onSuccess: (result) => {
          const id =
            result && typeof result === "object" && "prId" in result && result.prId
              ? result.prId
              : prId;
          toast.success("Submitted for approval.");
          if (id) {
            router.push(`/purchase-requests/${id}`);
          }
        },
        onError: (message) => toast.error(message),
      },
    );
  }

  function confirmPrint() {
    if (!selection || executionType !== ExecutionType.INTERNAL_PRINT) {
      return;
    }
    if (confirmPrintInFlightRef.current) {
      return;
    }
    const idempotencyKey = printIdempotencyKeyRef.current;
    if (!idempotencyKey) {
      return;
    }

    confirmPrintInFlightRef.current = true;
    setPrintReserving(true);
    setPrintWaitMessage(null);

    startTransition(async () => {
      const maxAttempts = 4;
      let lastError: string | undefined;
      let resolvedPrId: string | undefined = prId ?? undefined;

      try {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (attempt > 0) {
            setPrintWaitMessage("Waiting for another print to finish…");
            await new Promise((r) => setTimeout(r, 300 * attempt));
          }

          const result = await reserveSerialRangeForPR({
            prId: resolvedPrId,
            categoryId: selection.categoryId,
            subcategoryId: selection.subcategoryId,
            quantity,
            warehouseId,
            idempotencyKey,
          });

          if (result.ok && result.prId) {
            resolvedPrId = result.prId;
            setPrId(result.prId);
            if (result.reservationId) {
              saveBarcodeLabelConfigToSession(
                result.reservationId,
                barcodeLabelConfigRef.current,
              );
            }
            setPrintOpen(false);
            toast.success("Serial range reserved.");
            window.location.assign(`/purchase-requests/${result.prId}/print?fresh=1`);
            return;
          }

          lastError = result.error;
          const isConflict =
            result.error?.includes("Another print request") ?? false;
          if (!isConflict || attempt === maxAttempts - 1) {
            break;
          }
        }

        toast.error(lastError ?? "Serial reservation failed.", {
          action:
            lastError?.includes("Another print request") ?? false
              ? {
                  label: "Retry",
                  onClick: () => confirmPrint(),
                }
              : undefined,
        });
      } finally {
        confirmPrintInFlightRef.current = false;
        setPrintReserving(false);
        setPrintWaitMessage(null);
      }
    });
  }

  function handleLabelConfigChange(next: BarcodeLabelConfig) {
    const normalized = normalizeBarcodeLabelConfig(next);
    barcodeLabelConfigRef.current = normalized;
    setBarcodeLabelConfig(normalized);
    if (!labelLayoutLocked) {
      saveBarcodeLabelDefaultsDraft(normalized);
    }
  }

  function handleLockLabelLayout() {
    const state = lockBarcodeLabelDefaults(getLatestBarcodeLabelConfigForLock());
    setLabelLayoutLocked(state.locked);
    toast.success("Label layout locked as your default for future prints.");
  }

  function handleUnlockLabelLayout() {
    const state = unlockBarcodeLabelDefaults(barcodeLabelConfigRef.current);
    setLabelLayoutLocked(state.locked);
    toast.message("Layout unlocked — adjust settings, then lock again to save as default.");
  }

  const printRangeStart = serialHint?.nextStart ?? "";
  const printRangeEnd =
    serialHint?.nextStart && serialHint.series
      ? formatSerialNumberForSeries(
          serialHint.series,
          BigInt(serialHint.nextStart) + BigInt(Math.max(quantity - 1, 0)),
        )
      : "";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Create purchase request"
        subtitle={
          typeChosen
            ? "Complete the details below, then save or submit."
            : "Pick vendor purchase or internal print first — each follows a different workflow."
        }
        action={
          <Link href="/purchase-requests" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to list
          </Link>
        }
      />

      {!warehouseReady ? (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-card p-5 shadow-ds">
          <div className="space-y-1">
            <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step 1 — Warehouse
            </p>
            <h2 className="text-ds-md font-semibold tracking-tight text-foreground">
              Which warehouse is this request for?
            </h2>
            <p className="max-w-2xl text-ds-sm text-muted-foreground">
              Select the store or facility before choosing the request type.
            </p>
          </div>
          {renderWarehouseField(true)}
        </section>
      ) : !typeChosen ? (
        <CreatePRTypePicker
          warehouses={warehouses}
          selectedWarehouseName={selectedWarehouse?.label ?? "—"}
          onSelectVendor={enterVendorMode}
          onSelectPrint={enterPrintMode}
          warehouseField={isOps ? renderWarehouseField(true) : undefined}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <ExecutionTypeBadge
                type={
                  mode === "vendor"
                    ? ExecutionType.VENDOR_PURCHASE
                    : ExecutionType.INTERNAL_PRINT
                }
              />
              <span className="text-ds-sm font-medium text-foreground">{modeLabel}</span>
              <span className="hidden text-muted-foreground sm:inline" aria-hidden>
                ·
              </span>
              <span className="text-ds-sm text-muted-foreground">
                {selectedWarehouse?.label ?? "No warehouse"}
              </span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={requestTypeChange}>
              Change request type
            </Button>
          </div>

      {mode === "vendor" ? (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-card p-4">
          <div className="space-y-3">
            <h2 className="text-ds-sm font-semibold">2. Line items</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <li className="rounded-lg border border-border-subtle bg-muted/20 px-3 py-2.5 text-ds-xs">
                <p className="font-medium text-foreground">Packaging, Lock Tags, Last Mile</p>
                <p className="mt-0.5 text-muted-foreground">
                  Choose subcategory and quantity — one billed line per subcategory.
                </p>
              </li>
              <li className="rounded-lg border border-border-subtle bg-muted/20 px-3 py-2.5 text-ds-xs">
                <p className="font-medium text-foreground">Warehouse Maintenance</p>
                <p className="mt-0.5 text-muted-foreground">
                  In-warehouse facility spend — pick catalog items or propose new names.
                </p>
              </li>
              <li className="rounded-lg border border-border-subtle bg-muted/20 px-3 py-2.5 text-ds-xs">
                <p className="font-medium text-foreground">IT and Hardware Assets</p>
                <p className="mt-0.5 text-muted-foreground">
                  Laptops, networking, and other assets — catalog item per SKU or model.
                </p>
              </li>
            </ul>
          </div>
          <PRLineEditor
            categories={categories}
            subcategories={subcategories}
            catalogItems={catalogItems}
            lines={vendorLines}
            onChange={setVendorLines}
            vendorPurchaseOnly
          />
          <div className="space-y-1.5 border-t border-border-subtle pt-4">
            <span className="text-ds-sm font-medium">Warehouse</span>
            {renderWarehouseField()}
          </div>
        </section>
      ) : null}

      {mode === "print" ? (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-card p-4">
          <div className="space-y-1">
            <h2 className="text-ds-sm font-semibold">2. Subcategory selection</h2>
            <p className="text-ds-xs text-muted-foreground">
              Pick the lock-tag subcategory to print. Category is fixed to Lock Tags.
            </p>
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
                <label htmlFor="pr-subcategory" className="block text-ds-sm font-medium">
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
              <label htmlFor="pr-quantity" className="block text-ds-sm font-medium">
                Quantity
              </label>
              <QuantityInput
                id="pr-quantity"
                value={quantity}
                min={1}
                max={MAX_INTERNAL_PRINT_QUANTITY}
                showSteppers
                onChange={setQuantity}
                className="max-w-[10rem]"
              />
              <p className="text-ds-xs text-muted-foreground">
                Up to {MAX_INTERNAL_PRINT_QUANTITY} per print job.
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="text-ds-sm font-medium">Warehouse</span>
              {renderWarehouseField()}
            </div>
          </div>
        </section>
      ) : null}

      {showVendorRequestSection ? (
        <section
          key={`vendor-request-${flowKey}`}
          className="space-y-4 rounded-xl border border-border-subtle bg-card p-4"
        >
          <h2 className="text-ds-sm font-semibold">3. Vendor request (optional)</h2>
          <p className="text-ds-xs text-muted-foreground">
            Suggest a new vendor for Ops Head to review. This is separate from saving or
            submitting the purchase request — save or submit the PR when line items are ready.
          </p>
          {pendingVendorLabel ? (
            <PageAlert variant="info">
              Vendor request submitted for <strong>{pendingVendorLabel}</strong>. Ops Head will
              review on the Vendors page. Save or submit this purchase request separately when
              ready.
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
            System suggestion for {selection?.subcategoryName}. Preview only — the range is
            committed when a purchase order is created (vendor purchase) or when you confirm
            print (internal print).
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
              disabled={pending || submitPending}
              loading={submitPending}
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

      {showInternalPrintActions && serialHint ? (
        <ReserveSerialRangeDialog
          key={`print-dialog-${flowKey}`}
          open={printOpen}
          onOpenChange={setPrintOpen}
          series={serialHint.series}
          seriesName={serialHint.seriesName}
          categoryName={serialHint.categoryName}
          quantity={quantity}
          rangeStart={printRangeStart}
          rangeEnd={printRangeEnd}
          warehouseLabel={selectedWarehouse?.label ?? "—"}
          waitMessage={printWaitMessage}
          reserving={printReserving}
          labelConfig={barcodeLabelConfig}
          onLabelConfigChange={handleLabelConfigChange}
          layoutLocked={labelLayoutLocked}
          onLockLayout={handleLockLabelLayout}
          onUnlockLayout={handleUnlockLabelLayout}
          onConfirm={() => confirmPrint()}
        />
      ) : null}

      <ConfirmDialog
        open={changeTypeConfirmOpen}
        onOpenChange={setChangeTypeConfirmOpen}
        title="Change request type?"
        confirmLabel="Change type"
        cancelLabel="Keep editing"
        body={
          <p className="text-ds-sm text-muted-foreground">
            Switching between vendor purchase and internal print clears line items, quantities,
            and any draft saved on this page. This cannot be undone.
          </p>
        }
        onConfirm={() => confirmTypeChange()}
      />
        </>
      )}
    </div>
  );
}

function VendorRequestSheetContent({
  onCreated,
}: {
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
            const r = await createVendorRequest({ businessName, pocName, phone, email });
            if (r.ok && r.requestId) {
              onCreated(r.requestId, businessName);
              toast.success(
                "Vendor request submitted. Save or submit this purchase request when ready.",
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
