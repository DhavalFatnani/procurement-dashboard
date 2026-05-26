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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveCreatePRSelection } from "@/lib/create-pr-selection";
import {
  linesFromDetail,
  PRLineEditor,
  toLineInputs,
  type PRLineDraft,
} from "@/components/purchase-requests/PRLineEditor";
import { ProcurementRefText } from "@/components/shared/ProcurementRef";
import {
  formatPrPageTitle,
  formatProcurementRef,
} from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

const FORCE_CLOSE_ALLOWED: PRStatus[] = [
  PRStatus.DRAFT,
  PRStatus.PENDING_APPROVAL,
  PRStatus.REVISION_REQUIRED,
  PRStatus.APPROVED,
  PRStatus.REJECTED,
];

export function PRDetailView({
  pr,
  role,
  categories,
  subcategories,
  progressSlot,
  printSlot,
  versionHistorySlot,
  embeddedInShell = false,
}: {
  pr: PRDetail;
  role: Role;
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  progressSlot?: React.ReactNode;
  printSlot?: React.ReactNode;
  versionHistorySlot?: React.ReactNode;
  /** When true, header and progress sidebar are rendered by DetailPageShell. */
  embeddedInShell?: boolean;
}) {
  const router = useRouter();
  const isOps = role === Role.OPS_HEAD;
  const isSm = role === Role.SM;

  const [draftEditMode, setDraftEditMode] = React.useState(false);
  const isRevisionEditing = isSm && pr.status === PRStatus.REVISION_REQUIRED;
  const isDraftEditing = isSm && pr.status === PRStatus.DRAFT && draftEditMode;
  const showEditableFields = isRevisionEditing || isDraftEditing;

  const [categoryId, setCategoryId] = React.useState(pr.categoryId);
  const [subcategoryId, setSubcategoryId] = React.useState(pr.subcategoryId);
  const [quantity, setQuantity] = React.useState(pr.quantity);
  const [vendorLines, setVendorLines] = React.useState<PRLineDraft[]>(() =>
    linesFromDetail(pr.lines),
  );
  const awaitingPurchaseOrder =
    pr.executionType === ExecutionType.VENDOR_PURCHASE &&
    pr.status === PRStatus.APPROVED &&
    !pr.purchaseOrder;
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [revisionOpen, setRevisionOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [forceOpen, setForceOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const selection = React.useMemo(
    () => resolveCreatePRSelection(categories, subcategories, categoryId, subcategoryId),
    [categories, subcategories, categoryId, subcategoryId],
  );

  const subs = subcategories.filter((s) => s.categoryId === categoryId);
  const canForceClose = isOps && FORCE_CLOSE_ALLOWED.includes(pr.status);

  const isVendorMultiLine =
    pr.executionType === ExecutionType.VENDOR_PURCHASE && pr.lineCount > 1;
  const vendorLinesValid = vendorLines.every(
    (line) => line.categoryId && line.subcategoryId && line.quantity >= 1,
  );

  function payload() {
    if (pr.executionType === ExecutionType.VENDOR_PURCHASE) {
      return {
        lines: toLineInputs(vendorLines),
        vendorId: null,
        vendorRequestId: pr.vendorRequestId,
      };
    }
    if (!selection && showEditableFields) {
      throw new Error("Invalid category or subcategory.");
    }
    return {
      lines: [
        {
          categoryId: selection?.categoryId ?? pr.categoryId,
          subcategoryId: selection?.subcategoryId ?? pr.subcategoryId,
          quantity,
        },
      ],
      vendorId: null,
      vendorRequestId: pr.vendorRequestId,
    };
  }

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    setSubcategoryId("");
  }

  return (
    <div className="space-y-6">
      {!embeddedInShell ? (
        <PageHeader
          title={formatPrPageTitle({
            id: pr.id,
            categoryName: pr.categoryName,
            subcategoryName: pr.subcategoryName,
          })}
          subtitle={`${formatProcurementRef(pr.id)} · Created by ${pr.createdByName} on ${formatDateTimeMedium(pr.createdAt)}`}
          action={
            <Link href="/purchase-requests" className={cn(buttonVariants({ variant: "outline" }))}>
              Back to list
            </Link>
          }
        />
      ) : null}

      <div className={cn("grid gap-6", !embeddedInShell && "lg:grid-cols-3")}>
        <div className={cn("space-y-4", !embeddedInShell && "lg:col-span-2")}>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Request summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pr.status === PRStatus.REVISION_REQUIRED && pr.latestRevision ? (
                <div
                  className="rounded-lg border border-status-warning/40 border-l-[3px] border-l-status-warning bg-[var(--status-warning-bg)] px-4 py-3"
                  role="alert"
                >
                  <p className="text-ds-xs font-medium text-status-warning">
                    Revision requested by {pr.latestRevision.byName} on{" "}
                    {formatDateTimeMedium(pr.latestRevision.at)}
                  </p>
                  <p className="mt-2 text-ds-sm font-medium text-foreground">
                    {pr.latestRevision.comment}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {showEditableFields && pr.executionType === ExecutionType.VENDOR_PURCHASE ? (
                  <div className="space-y-3 sm:col-span-2">
                    <PRLineEditor
                      categories={categories}
                      subcategories={subcategories}
                      lines={vendorLines}
                      onChange={setVendorLines}
                      vendorPurchaseOnly
                    />
                  </div>
                ) : showEditableFields ? (
                  <>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-ds-xs font-medium text-muted-foreground">
                        Category
                      </label>
                      <Select
                        value={categoryId}
                        onValueChange={handleCategoryChange}
                      >
                        <SelectTrigger size="sm" aria-label="Category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-ds-xs font-medium text-muted-foreground">
                        Subcategory
                      </label>
                      <Select
                        key={categoryId}
                        value={subcategoryId}
                        onValueChange={setSubcategoryId}
                      >
                        <SelectTrigger size="sm" aria-label="Subcategory">
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          {subs.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-ds-xs font-medium text-muted-foreground">
                        Quantity
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                        className="h-8"
                      />
                    </div>
                  </>
                ) : isVendorMultiLine || pr.lines.length > 1 ? (
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-ds-xs font-medium text-muted-foreground">
                      Requirements ({pr.lineCount} items · {pr.quantity} total qty)
                    </p>
                    <div className="overflow-x-auto rounded-md border border-border-subtle">
                      <table className="w-full text-ds-sm">
                        <thead>
                          <tr className="border-b border-border-subtle bg-muted/30 text-left text-ds-xs text-muted-foreground">
                            <th className="px-3 py-2 font-medium">#</th>
                            <th className="px-3 py-2 font-medium">Category</th>
                            <th className="px-3 py-2 font-medium">Subcategory</th>
                            <th className="px-3 py-2 font-medium text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pr.lines.map((line) => (
                            <tr key={line.id} className="border-b border-border-subtle last:border-0">
                              <td className="px-3 py-2">{line.lineNumber}</td>
                              <td className="px-3 py-2">{line.categoryName}</td>
                              <td className="px-3 py-2">{line.subcategoryName}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {pr.vendorName ? (
                      <p className="mt-3 text-ds-sm">
                        <span className="text-muted-foreground">Vendor: </span>
                        {pr.vendorName}
                      </p>
                    ) : pr.vendorRequestStatus === "PENDING" ? (
                      <p className="mt-3 text-ds-sm text-muted-foreground">
                        Vendor request pending Ops Head activation
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <SummaryField label="Category" value={pr.categoryName} />
                    <SummaryField label="Subcategory" value={pr.subcategoryName} />
                    <SummaryField label="Quantity" value={String(pr.quantity)} />
                    {pr.vendorName ? (
                      <SummaryField label="Vendor" value={pr.vendorName} />
                    ) : pr.vendorRequestStatus === "PENDING" ? (
                      <SummaryField
                        label="Vendor request"
                        value="Pending Ops Head activation"
                      />
                    ) : null}
                  </>
                )}

                <SummaryField label="Warehouse" value={pr.warehouseName} />
                <SummaryField
                  label="Execution type"
                  value={<ExecutionTypeBadge type={pr.executionType} />}
                />
                <div>
                  <p className="text-ds-xs text-muted-foreground">Status</p>
                  <StatusBadge
                    kind="PRStatus"
                    status={pr.status}
                    awaitingPurchaseOrder={awaitingPurchaseOrder}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {progressSlot}

          {printSlot}

          {versionHistorySlot}
        </div>

        <aside
          className={cn(
            "space-y-3 rounded-2xl border border-border-subtle bg-card p-4 shadow-ds",
            !embeddedInShell && "lg:col-span-1",
          )}
        >
          <h2 className="text-ds-sm font-semibold">Actions</h2>

          {isSm && pr.status === PRStatus.DRAFT ? (
            <>
              {!draftEditMode ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setDraftEditMode(true)}
                >
                  Edit PR
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={pending || (draftEditMode && !vendorLinesValid && !selection)}
                  onClick={() => {
                    startTransition(async () => {
                      const u = await updatePR(pr.id, payload());
                      if (u.ok) {
                        toast.success("Changes saved.");
                        router.refresh();
                      } else {
                        toast.error(u.message ?? "Update failed.");
                      }
                    });
                  }}
                >
                  Save changes
                </Button>
              )}
              <Button
                type="button"
                className="w-full"
                disabled={pending || (draftEditMode && !vendorLinesValid && !selection)}
                onClick={() => {
                  startTransition(async () => {
                    if (draftEditMode && selection) {
                      const u = await updatePR(pr.id, payload());
                      if (!u.ok) {
                        toast.error(u.message ?? "Update failed.");
                        return;
                      }
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
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setCancelOpen(true)}
              >
                Cancel PR
              </Button>
            </>
          ) : null}

          {isSm && pr.status === PRStatus.REVISION_REQUIRED ? (
            <>
              <Button
                type="button"
                className="w-full"
                disabled={pending || !selection}
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
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setCancelOpen(true)}
              >
                Cancel PR
              </Button>
            </>
          ) : null}

          {isSm && pr.status === PRStatus.PENDING_APPROVAL ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setCancelOpen(true)}
            >
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
              disabled={!canForceClose}
              className={cn(
                "w-full text-left text-ds-xs underline-offset-4",
                canForceClose
                  ? "text-muted-foreground hover:underline"
                  : "cursor-not-allowed text-muted-foreground/50",
              )}
              onClick={() => canForceClose && setForceOpen(true)}
            >
              Force close PR
            </button>
          ) : null}

          {isOps && awaitingPurchaseOrder ? (
            <Link
              href={`/purchase-orders?fulfill=${encodeURIComponent(pr.id)}`}
              className={cn(buttonVariants({ size: "sm" }), "w-full")}
            >
              Create purchase order
            </Link>
          ) : null}

          {pr.purchaseOrder ? (
            <Link
              href={`/purchase-orders/${pr.purchaseOrder.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
            >
              View PO <ProcurementRefText id={pr.purchaseOrder.id} />
            </Link>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve purchase request?"
        description="Approves the request. Configure vendor, pricing, and delivery under Purchase Orders."
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
        description="Provide a reason for rejection. This is recorded in version history."
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
        description="The store manager must address your comments and resubmit."
        label="Revision comment"
        confirmLabel="Send for revision"
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
        description="Provide a reason. This permanently closes the purchase request."
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
      <p className="text-ds-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  );
}
