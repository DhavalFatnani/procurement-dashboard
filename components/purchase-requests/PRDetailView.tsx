"use client";

import { ExecutionType, PRStatus, Role } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  approvePR,
  cancelPR,
  forceClosePR,
  rejectPR,
  resubmitPR,
  sendForRevision,
  submitPR,
  updatePR,
  type CategoryOption,
  type PRDetail,
  type SubcategoryOption,
} from "@/app/actions/purchase-requests";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ExecutionTypeBadge } from "@/components/shared/ExecutionTypeBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TextareaActionDialog } from "@/components/shared/TextareaActionDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ActiveVendor = { id: string; businessName: string };

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

const PROGRESS_STEPS = [
  { key: "prApproved", label: "PR approved" },
  { key: "poCreated", label: "PO created" },
  { key: "grnRecorded", label: "GRN recorded" },
  { key: "invoiceUploaded", label: "Invoice uploaded" },
  { key: "paymentReceived", label: "Payment received" },
] as const;

export function PRDetailView({
  pr,
  role,
  categories,
  subcategories,
  activeVendors,
}: {
  pr: PRDetail;
  role: Role;
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  activeVendors: ActiveVendor[];
}) {
  const router = useRouter();
  const isOps = role === Role.OPS_HEAD;
  const canEditSm =
    role === Role.SM &&
    (pr.status === PRStatus.DRAFT || pr.status === PRStatus.REVISION_REQUIRED);

  const [categoryId, setCategoryId] = React.useState(pr.categoryId);
  const [subcategoryId, setSubcategoryId] = React.useState(pr.subcategoryId);
  const [quantity, setQuantity] = React.useState(pr.quantity);
  const [vendorId, setVendorId] = React.useState(pr.vendorId ?? "");
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [revisionOpen, setRevisionOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [forceOpen, setForceOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  const subs = subcategories.filter((s) => s.categoryId === categoryId);

  function payload() {
    return {
      categoryId,
      subcategoryId,
      quantity,
      vendorId: vendorId || null,
      vendorRequestId: pr.vendorRequestId,
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={pr.id}
        subtitle={`Created by ${pr.createdByName} on ${formatDate(pr.createdAt)}`}
        action={
          <Link href="/purchase-requests" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to list
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {pr.status === PRStatus.REVISION_REQUIRED && pr.latestRevision ? (
            <div className="border-b border-status-warning/30 border-l-[3px] border-l-status-warning bg-[var(--status-warning-bg)] px-4 py-3.5">
              <p className="text-ds-xs text-status-warning">
                Revision requested by {pr.latestRevision.byName} · {formatDate(pr.latestRevision.at)}
              </p>
              <p className="mt-1 text-ds-base font-medium text-foreground">
                {pr.latestRevision.comment}
              </p>
            </div>
          ) : null}

          <Card size="sm">
            <CardHeader>
              <CardTitle>Request summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              {canEditSm ? (
                <>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <select
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                      value={categoryId}
                      onChange={(e) => {
                        setCategoryId(e.target.value);
                        setSubcategoryId("");
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Subcategory</label>
                    <select
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                      value={subcategoryId}
                      onChange={(e) => setSubcategoryId(e.target.value)}
                    >
                      {subs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                    <Input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                  {pr.executionType === ExecutionType.VENDOR_PURCHASE ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Vendor</label>
                      <select
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                        value={vendorId}
                        onChange={(e) => setVendorId(e.target.value)}
                        disabled={pr.vendorRequestStatus === "PENDING"}
                      >
                        <option value="">Select vendor</option>
                        {activeVendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.businessName}
                          </option>
                        ))}
                      </select>
                      {pr.vendorRequestStatus === "PENDING" ? (
                        <p className="text-xs text-amber-600">
                          Vendor request pending activation — cannot submit until approved.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <SummaryField label="Category" value={pr.categoryName} />
                  <SummaryField label="Subcategory" value={pr.subcategoryName} />
                  <SummaryField label="Quantity" value={String(pr.quantity)} />
                  <SummaryField label="Warehouse" value={pr.warehouseName} />
                  <SummaryField
                    label="Execution"
                    value={<ExecutionTypeBadge type={pr.executionType} />}
                  />
                  {pr.vendorName ? <SummaryField label="Vendor" value={pr.vendorName} /> : null}
                </>
              )}
              {!canEditSm ? (
                <>
                  <SummaryField label="Warehouse" value={pr.warehouseName} />
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <StatusBadge kind="PRStatus" status={pr.status} />
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge kind="PRStatus" status={pr.status} />
                </div>
              )}
            </CardContent>
          </Card>

          {pr.executionType === ExecutionType.VENDOR_PURCHASE ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Procurement progress</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {PROGRESS_STEPS.map((step) => (
                    <li key={step.key} className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          pr.progress[step.key] ? "bg-emerald-500" : "bg-muted-foreground/40",
                        )}
                      />
                      {step.label}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ) : null}

          {pr.executionType === ExecutionType.INTERNAL_PRINT && pr.serialReservation ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Print execution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Series: </span>
                  {pr.serialReservation.series}
                </p>
                <p>
                  <span className="text-muted-foreground">Range: </span>
                  {pr.serialReservation.rangeStart} → {pr.serialReservation.rangeEnd}
                </p>
                <p>
                  <span className="text-muted-foreground">Quantity: </span>
                  {pr.serialReservation.quantity}
                </p>
                <p>
                  <span className="text-muted-foreground">Printed by: </span>
                  {pr.serialReservation.createdByName} on{" "}
                  {formatDate(pr.serialReservation.createdAt)}
                </p>
                <Link
                  href={`/purchase-requests/${pr.id}/print`}
                  className="text-primary text-sm underline-offset-4 hover:underline"
                >
                  Open print execution →
                </Link>
                <Link
                  href="/serial-governance"
                  className="block text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  View in Serial Governance →
                </Link>
              </CardContent>
            </Card>
          ) : null}

          <Card size="sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Version history</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryOpen((o) => !o)}>
                {historyOpen ? "Collapse" : "Expand"}
              </Button>
            </CardHeader>
            {historyOpen ? (
              <CardContent className="space-y-3 text-sm">
                {pr.versions.length === 0 ? (
                  <p className="text-muted-foreground">No versions yet.</p>
                ) : (
                  pr.versions.map((v) => (
                    <div key={v.id} className="border-b pb-2 last:border-0">
                      <p className="font-medium">
                        V{v.versionNumber} — {v.changedByName} on {formatDate(v.changedAt)}
                      </p>
                      {v.revisionComment ? (
                        <p className="text-muted-foreground">{v.revisionComment}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            ) : null}
          </Card>
        </div>

        <aside className="space-y-3 rounded-xl border bg-card p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold">Actions</h2>

          {role === Role.SM && pr.status === PRStatus.DRAFT ? (
            <>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  startTransition(async () => {
                    const u = await updatePR(pr.id, payload());
                    if (!u.ok) {
                      toast.error(u.message ?? "Update failed.");
                      return;
                    }
                    const s = await submitPR(pr.id);
                    if (s.ok) {
                      toast.success("Submitted for approval.");
                      router.refresh();
                    } else {
                      toast.error(s.message ?? "Submit failed.");
                    }
                  });
                }}
              >
                Submit for approval
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => setCancelOpen(true)}>
                Cancel PR
              </Button>
            </>
          ) : null}

          {role === Role.SM && pr.status === PRStatus.REVISION_REQUIRED ? (
            <>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  startTransition(async () => {
                    const r = await resubmitPR(pr.id, payload());
                    if (r.ok) {
                      toast.success("Resubmitted for approval.");
                      router.refresh();
                    } else {
                      toast.error(r.message ?? "Resubmit failed.");
                    }
                  });
                }}
              >
                Resubmit for approval
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => setCancelOpen(true)}>
                Cancel PR
              </Button>
            </>
          ) : null}

          {role === Role.SM && pr.status === PRStatus.PENDING_APPROVAL ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => setCancelOpen(true)}>
              Cancel PR
            </Button>
          ) : null}

          {isOps &&
          pr.executionType === ExecutionType.VENDOR_PURCHASE &&
          pr.status === PRStatus.PENDING_APPROVAL ? (
            <>
              <Button type="button" className="w-full" onClick={() => setApproveOpen(true)}>
                Approve
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => setRejectOpen(true)}>
                Reject
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setRevisionOpen(true)}>
                Send for revision
              </Button>
            </>
          ) : null}

          {isOps ? (
            <button
              type="button"
              className="w-full text-left text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setForceOpen(true)}
            >
              Force close PR
            </button>
          ) : null}

          {pr.purchaseOrder ? (
            <Link
              href={`/purchase-orders/${pr.purchaseOrder.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
            >
              View PO {pr.purchaseOrder.id}
            </Link>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve purchase request?"
        description="Creates a linked purchase order."
        confirmLabel="Approve"
        onConfirm={() => {
          startTransition(async () => {
            const r = await approvePR(pr.id);
            if (r.ok) {
              toast.success("Approved.");
              router.refresh();
            } else {
              toast.error(r.message ?? "Approval failed.");
            }
          });
        }}
      />

      <TextareaActionDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject purchase request"
        label="Rejection reason"
        confirmLabel="Reject"
        onConfirm={(text) => {
          startTransition(async () => {
            const r = await rejectPR(pr.id, text);
            if (r.ok) {
              toast.success("Rejected.");
              router.refresh();
            } else {
              toast.error(r.message ?? "Reject failed.");
            }
          });
        }}
      />

      <TextareaActionDialog
        open={revisionOpen}
        onOpenChange={setRevisionOpen}
        title="Send for revision"
        label="Revision comment"
        confirmLabel="Send"
        onConfirm={(text) => {
          startTransition(async () => {
            const r = await sendForRevision(pr.id, text);
            if (r.ok) {
              toast.success("Sent for revision.");
              router.refresh();
            } else {
              toast.error(r.message ?? "Failed.");
            }
          });
        }}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this purchase request?"
        description="This cannot be undone if the PR moves to cancelled."
        confirmLabel="Cancel PR"
        confirmVariant="destructive"
        onConfirm={() => {
          startTransition(async () => {
            const r = await cancelPR(pr.id);
            if (r.ok) {
              toast.success("PR cancelled.");
              router.refresh();
            } else {
              toast.error(r.message ?? "Cancel failed.");
            }
          });
        }}
      />

      <TextareaActionDialog
        open={forceOpen}
        onOpenChange={setForceOpen}
        title="Force close PR"
        label="Reason"
        confirmLabel="Force close"
        onConfirm={(text) => {
          startTransition(async () => {
            const r = await forceClosePR(pr.id, text);
            if (r.ok) {
              toast.success("PR force closed.");
              router.refresh();
            } else {
              toast.error(r.message ?? "Force close failed.");
            }
          });
        }}
      />
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  );
}
