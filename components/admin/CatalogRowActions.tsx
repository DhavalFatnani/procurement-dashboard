"use client";

import { CatalogItemStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
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

export function CatalogRowActions({
  row,
  onEdit,
}: {
  row: CatalogItemListRow;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [reactivateOpen, setReactivateOpen] = React.useState(false);

  function refresh() {
    router.refresh();
  }

  if (row.status === CatalogItemStatus.PENDING_APPROVAL) {
    return (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button type="button" variant="outline" size="sm" onClick={() => setApproveOpen(true)}>
          Approve
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRejectOpen(true)}>
          Reject
        </Button>
        <ConfirmDialog
          open={approveOpen}
          onOpenChange={setApproveOpen}
          title={`Approve “${row.name}”?`}
          description="Item becomes active and selectable on vendor purchase requests."
          confirmLabel="Approve"
          onConfirm={() => {
            startTransition(async () => {
              const r = await approveCatalogItem(row.id);
              if (r.ok) {
                toast.success("Catalog item approved.");
                setApproveOpen(false);
                refresh();
              } else {
                toast.error(r.message ?? "Approval failed.");
              }
            });
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
            startTransition(async () => {
              const r = await rejectCatalogItem(row.id, text);
              if (r.ok) {
                toast.success("Catalog item rejected.");
                setRejectOpen(false);
                refresh();
              } else {
                toast.error(r.message ?? "Rejection failed.");
              }
            });
          }}
        />
      </div>
    );
  }

  if (row.status === CatalogItemStatus.ACTIVE) {
    return (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDeactivateOpen(true)}>
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
            startTransition(async () => {
              const r = await deactivateCatalogItem(row.id);
              if (r.ok) {
                toast.success("Catalog item deactivated.");
                setDeactivateOpen(false);
                refresh();
              } else {
                toast.error(r.message ?? "Deactivate failed.");
              }
            });
          }}
        />
      </div>
    );
  }

  if (row.status === CatalogItemStatus.INACTIVE) {
    return (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setReactivateOpen(true)}>
          Reactivate
        </Button>
        <ConfirmDialog
          open={reactivateOpen}
          onOpenChange={setReactivateOpen}
          title={`Reactivate “${row.name}”?`}
          description="Item will appear again in vendor PR line pickers."
          confirmLabel="Reactivate"
          onConfirm={() => {
            startTransition(async () => {
              const r = await reactivateCatalogItem(row.id);
              if (r.ok) {
                toast.success("Catalog item reactivated.");
                setReactivateOpen(false);
                refresh();
              } else {
                toast.error(r.message ?? "Reactivate failed.");
              }
            });
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
