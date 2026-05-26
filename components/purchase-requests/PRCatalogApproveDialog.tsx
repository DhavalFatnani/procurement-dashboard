"use client";

import * as React from "react";
import { toast } from "sonner";

import { fetchPendingCatalogItemsForPR } from "@/app/actions/purchase-requests";
import type { ApprovePRInput } from "@/lib/purchase-request-types";
import type { PendingCatalogItemRow } from "@/lib/queries/purchase-requests";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PRCatalogApproveDialog({
  open,
  onOpenChange,
  prId,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prId: string;
  onConfirm: (input: ApprovePRInput) => void;
  pending?: boolean;
}) {
  const [pendingItems, setPendingItems] = React.useState<PendingCatalogItemRow[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(false);
  const [approved, setApproved] = React.useState<Record<string, boolean>>({});
  const [rejectReasons, setRejectReasons] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    void fetchPendingCatalogItemsForPR(prId).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        toast.error(result.message ?? "Could not load catalog items.");
        setPendingItems([]);
      } else {
        setPendingItems(result.items);
        setApproved(Object.fromEntries(result.items.map((item) => [item.id, true])));
        setRejectReasons({});
      }
      setLoadingItems(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, prId]);

  function buildInput(): ApprovePRInput | null {
    const approvedCatalogItemIds: string[] = [];
    const rejected: { id: string; reason: string }[] = [];

    for (const item of pendingItems) {
      if (approved[item.id]) {
        approvedCatalogItemIds.push(item.id);
      } else {
        const reason = rejectReasons[item.id]?.trim() ?? "";
        if (!reason) {
          return null;
        }
        rejected.push({ id: item.id, reason });
      }
    }

    return { approvedCatalogItemIds, rejected };
  }

  function handleConfirm() {
    const input = buildInput();
    if (!input) {
      toast.error("Provide a rejection reason for each rejected catalog item.");
      return;
    }
    onConfirm(input);
  }

  const hasPending = pendingItems.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Approve purchase request?</AlertDialogTitle>
          <AlertDialogDescription>
            {loadingItems
              ? "Loading proposed catalog items…"
              : hasPending
                ? "Review proposed catalog items before approving. Approved items are added to the master catalog for future PRs."
                : "Approves the request. Configure vendor, pricing, and delivery under Purchase Orders."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasPending ? (
          <ul className="max-h-64 space-y-3 overflow-y-auto px-1">
            {pendingItems.map((item) => {
              const isApproved = approved[item.id] ?? true;
              return (
                <li
                  key={item.id}
                  className="rounded-lg border border-border-subtle bg-muted/20 p-3 text-ds-sm"
                >
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-ds-xs text-muted-foreground">
                    {item.categoryName} / {item.subcategoryName}
                    {item.sku ? ` · ${item.sku}` : ""} · {item.unit}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-ds-xs font-medium",
                        isApproved
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border-subtle text-muted-foreground",
                      )}
                      onClick={() =>
                        setApproved((prev) => ({ ...prev, [item.id]: true }))
                      }
                    >
                      Approve item
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-ds-xs font-medium",
                        !isApproved
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-border-subtle text-muted-foreground",
                      )}
                      onClick={() =>
                        setApproved((prev) => ({ ...prev, [item.id]: false }))
                      }
                    >
                      Reject item
                    </button>
                  </div>
                  {!isApproved ? (
                    <Input
                      className="mt-2 h-8"
                      placeholder="Rejection reason (required)"
                      value={rejectReasons[item.id] ?? ""}
                      onChange={(e) =>
                        setRejectReasons((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending || loadingItems}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            disabled={pending || loadingItems}
            onClick={handleConfirm}
          >
            Approve PR
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
