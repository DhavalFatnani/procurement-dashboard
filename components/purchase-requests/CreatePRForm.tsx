"use client";

import { ExecutionType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { getSerialSeriesHint, reserveSerialRangeForPR } from "@/app/actions/serial";
import {
  createPR,
  createVendorRequest,
  submitPR,
  updatePR,
  type CategoryOption,
  type SubcategoryOption,
} from "@/app/actions/purchase-requests";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ExecutionTypeBadge } from "@/components/shared/ExecutionTypeBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ActiveVendor = { id: string; businessName: string };

type SerialHint = Awaited<ReturnType<typeof getSerialSeriesHint>>;

export function CreatePRForm({
  categories,
  subcategories,
  activeVendors,
  warehouseName,
  warehouseId,
}: {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  activeVendors: ActiveVendor[];
  warehouseName: string;
  warehouseId: string;
}) {
  const router = useRouter();
  const [prId, setPrId] = React.useState<string | null>(null);
  const [categoryId, setCategoryId] = React.useState("");
  const [subcategoryId, setSubcategoryId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [vendorId, setVendorId] = React.useState("");
  const [vendorRequestId, setVendorRequestId] = React.useState<string | null>(null);
  const [pendingVendorLabel, setPendingVendorLabel] = React.useState<string | null>(null);
  const [serialHint, setSerialHint] = React.useState<SerialHint>(null);
  const [printOpen, setPrintOpen] = React.useState(false);
  const [vendorSheetOpen, setVendorSheetOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const selectedSub = subcategories.find((s) => s.id === subcategoryId);
  const executionType = selectedSub?.executionType;
  const isLockTags =
    serialHint?.categoryName === "Lock Tags" ||
    categories.find((c) => c.id === categoryId)?.name === "Lock Tags";

  const section1Done = Boolean(categoryId && subcategoryId);
  const section2Done = section1Done && quantity >= 1;
  const section3Done =
    executionType === ExecutionType.INTERNAL_PRINT
      ? section2Done
      : executionType === ExecutionType.VENDOR_PURCHASE
        ? section2Done && Boolean(vendorId || vendorRequestId)
        : false;

  const showFormActions =
    executionType === ExecutionType.INTERNAL_PRINT
      ? section2Done
      : section3Done;

  React.useEffect(() => {
    if (!subcategoryId) {
      setSerialHint(null);
      return;
    }
    let cancelled = false;
    void getSerialSeriesHint(subcategoryId).then((hint) => {
      if (!cancelled) {
        setSerialHint(hint);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [subcategoryId]);

  const subsForCategory = subcategories.filter((s) => s.categoryId === categoryId);

  function formPayload() {
    return {
      categoryId,
      subcategoryId,
      quantity,
      vendorId: vendorId || null,
      vendorRequestId,
    };
  }

  function saveDraft(then?: (id: string) => void) {
    startTransition(async () => {
      const payload = formPayload();
      if (prId) {
        const result = await updatePR(prId, payload);
        if (!result.ok) {
          toast.error(result.message ?? "Could not save draft.");
          return;
        }
        toast.success("Draft saved.");
        then?.(prId);
        return;
      }
      const result = await createPR(payload);
      if (!result.ok || !result.prId) {
        toast.error(result.message ?? "Could not save draft.");
        return;
      }
      setPrId(result.prId);
      toast.success("Draft saved.");
      then?.(result.prId);
    });
  }

  function submitForApproval() {
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
    const idempotencyKey = crypto.randomUUID();
    startTransition(async () => {
      const result = await reserveSerialRangeForPR({
        prId: prId ?? undefined,
        categoryId,
        subcategoryId,
        quantity,
        warehouseId,
        idempotencyKey,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Serial reservation failed.");
        return;
      }
      toast.success("Serial range reserved.");
      setPrintOpen(false);
      router.push(`/purchase-requests/${result.prId}/print`);
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Create purchase request"
        subtitle="Complete each section in order. Warehouse is assigned from your profile."
        action={
          <Link href="/purchase-requests" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to list
          </Link>
        }
      />

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">1. Category selection</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category</label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId("");
              }}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Subcategory</label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              value={subcategoryId}
              disabled={!categoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
            >
              <option value="">Select subcategory</option>
              {subsForCategory.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {executionType ? (
          <p className="text-xs text-muted-foreground">
            Execution: <ExecutionTypeBadge type={executionType} />
          </p>
        ) : null}
      </section>

      {section1Done ? (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">2. Request details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Warehouse</label>
              <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">{warehouseName}</p>
            </div>
          </div>
        </section>
      ) : null}

      {section2Done && executionType === ExecutionType.VENDOR_PURCHASE ? (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">3. Vendor</h2>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Vendor</label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                if (e.target.value) {
                  setVendorRequestId(null);
                  setPendingVendorLabel(null);
                }
              }}
            >
              <option value="">Select vendor</option>
              {pendingVendorLabel ? (
                <option value="" disabled>
                  Pending: {pendingVendorLabel} — awaiting activation
                </option>
              ) : null}
              {activeVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.businessName}
                </option>
              ))}
            </select>
          </div>
          <Sheet open={vendorSheetOpen} onOpenChange={setVendorSheetOpen}>
            <SheetTrigger
              render={
                <button type="button" className="text-sm text-primary underline-offset-4 hover:underline">
                  + Request new vendor
                </button>
              }
            />
            <VendorRequestSheetContent
              prId={prId}
              onCreated={(requestId, label) => {
                setVendorRequestId(requestId);
                setPendingVendorLabel(label);
                setVendorId("");
                setVendorSheetOpen(false);
                toast.success(
                  "Vendor request submitted. Ops Head will review. Save as draft and submit once activated.",
                );
              }}
            />
          </Sheet>
        </section>
      ) : null}

      {section2Done && isLockTags && serialHint ? (
        <section className="space-y-3 rounded-xl border border-dashed bg-muted/20 p-4">
          <h2 className="text-sm font-semibold">4. Lock tag guidance</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Series</dt>
              <dd className="font-medium">{serialHint.series}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Execution type</dt>
              <dd>
                <ExecutionTypeBadge type={serialHint.executionType} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Recommended action</dt>
              <dd>
                {serialHint.executionType === ExecutionType.VENDOR_PURCHASE
                  ? "Purchase from vendor"
                  : "Print internally"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last reserved range end</dt>
              <dd>{serialHint.lastRangeEnd ?? "None yet"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Next available start</dt>
              <dd>{serialHint.nextStart ?? "1"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {showFormActions ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => saveDraft()}>
            Save as draft
          </Button>
          {executionType === ExecutionType.VENDOR_PURCHASE ? (
            <Button
              type="button"
              disabled={pending || !section3Done}
              onClick={() => submitForApproval()}
            >
              Submit for approval
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending || !section2Done}
              onClick={() => {
                if (!section2Done) {
                  return;
                }
                setPrintOpen(true);
              }}
            >
              Confirm &amp; continue
            </Button>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        title="Reserve serial range"
        description={
          serialHint
            ? (() => {
                const start = serialHint.nextStart ? Number(serialHint.nextStart) : 1;
                const end = start + quantity - 1;
                return `You are about to reserve a serial range. Series: ${serialHint.series}. Quantity: ${quantity}. Estimated range: ${start} to ${end}. Warehouse: ${warehouseName}.`;
              })()
            : "Confirm serial reservation for this print job."
        }
        confirmLabel="Confirm print"
        onConfirm={() => confirmPrint()}
      />
    </div>
  );
}

function VendorRequestSheetContent({
  prId,
  onCreated,
}: {
  prId: string | null;
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
            const r = await createVendorRequest(
              { businessName, pocName, phone, email },
              prId ?? undefined,
            );
            if (r.ok && r.requestId) {
              onCreated(r.requestId, businessName);
            } else {
              toast.error(r.message ?? "Could not submit vendor request.");
            }
          });
        }}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Business name</label>
          <Input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">POC name</label>
          <Input required value={pocName} onChange={(e) => setPocName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Phone</label>
          <Input required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email</label>
          <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          Submit request
        </Button>
      </form>
    </SheetContent>
  );
}
