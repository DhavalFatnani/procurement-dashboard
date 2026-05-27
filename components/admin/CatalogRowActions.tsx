"use client";

import { CatalogItemStatus } from "@prisma/client";
import * as React from "react";
import { toast } from "sonner";

import {
  approveCatalogItem,
  deactivateCatalogItem,
  reactivateCatalogItem,
  rejectCatalogItem,
} from "@/app/actions/catalog";
import type { CatalogItemListRow } from "@/lib/queries/catalog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TextareaActionDialog } from "@/components/shared/TextareaActionDialog";
import { Button } from "@/components/ui/button";

export type CatalogItemResolveOutcome =
  | "approved"
  | "rejected"
  | "deactivated"
  | "reactivated";

export function CatalogRowActions({
  row,
  onEdit,
  onResolved,
}: {
  row: CatalogItemListRow;
  onEdit: () => void;
  /** Optimistic row update — skips full-page refresh when provided. */
  onResolved?: (id: string, outcome: CatalogItemResolveOutcome) => void;
}) {
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [reactivateOpen, setReactivateOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function runAction(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    onSuccess: () => void,
  ) {
    setBusy(true);
    try {
      const r = await fn();
      if (r.ok) {
        onSuccess();
      } else {
        toast.error(r.message ?? "Action failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (row.status === CatalogItemStatus.PENDING_APPROVAL) {
    return (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setApproveOpen(true)}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setRejectOpen(true)}
        >
          Reject
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onEdit}>
          Edit
        </Button>
        <ConfirmDialog
          open={approveOpen}
          onOpenChange={setApproveOpen}
          title={`Approve “${row.name}”?`}
          description="Item becomes active and selectable on vendor purchase requests."
          confirmLabel="Approve"
          onConfirm={() => {
            void runAction(
              () => approveCatalogItem(row.id),
              () => {
                toast.success("Catalog item approved.");
                setApproveOpen(false);
                onResolved?.(row.id, "approved");
              },
            );
          }}
        />
        <TextareaActionDialog
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          title="Reject catalog item"
          description={`Rejecting “${row.name}” removes it from open purchase requests.`}
          label="Rejection reason"
          confirmLabel="Reject"
          onConfirm={(text) => {
            void runAction(
              () => rejectCatalogItem(row.id, text),
              () => {
                toast.success("Catalog item rejected.");
                setRejectOpen(false);
                onResolved?.(row.id, "rejected");
              },
            );
          }}
        />
      </div>
    );
  }

  if (row.status === CatalogItemStatus.ACTIVE) {
    return (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onEdit}>
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setDeactivateOpen(true)}
        >
          Deactivate
        </Button>
        <ConfirmDialog
          open={deactivateOpen}
          onOpenChange={setDeactivateOpen}
          title={`Deactivate “${row.name}”?`}
          description="Stops new PRs from selecting this item. History on existing PRs and POs is kept."
          confirmLabel="Deactivate"
          confirmVariant="destructive"
          onConfirm={() => {
            void runAction(
              () => deactivateCatalogItem(row.id),
              () => {
                toast.success("Catalog item deactivated.");
                setDeactivateOpen(false);
                onResolved?.(row.id, "deactivated");
              },
            );
          }}
        />
      </div>
    );
  }

  if (row.status === CatalogItemStatus.INACTIVE) {
    return (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onEdit}>
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setReactivateOpen(true)}
        >
          Reactivate
        </Button>
        <ConfirmDialog
          open={reactivateOpen}
          onOpenChange={setReactivateOpen}
          title={`Reactivate “${row.name}”?`}
          description="Item will appear again in vendor PR line pickers."
          confirmLabel="Reactivate"
          onConfirm={() => {
            void runAction(
              () => reactivateCatalogItem(row.id),
              () => {
                toast.success("Catalog item reactivated.");
                setReactivateOpen(false);
                onResolved?.(row.id, "reactivated");
              },
            );
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <span className="text-ds-xs text-muted-foreground">No actions</span>
    </div>
  );
}
