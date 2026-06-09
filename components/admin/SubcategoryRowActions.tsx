"use client";

import { TaxonomyStatus } from "@/lib/prisma-enums";
import * as React from "react";
import { toast } from "sonner";

import {
  deactivateSubcategory,
  deleteSubcategory,
  reactivateSubcategory,
} from "@/app/actions/taxonomy";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { SubcategoryListRow } from "@/lib/queries/taxonomy";

export type SubcategoryResolveOutcome = "deactivated" | "reactivated" | "deleted";

export function SubcategoryRowActions({
  row,
  onEdit,
  onResolved,
}: {
  row: SubcategoryListRow;
  onEdit: () => void;
  onResolved?: (id: string, outcome: SubcategoryResolveOutcome) => void;
}) {
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [reactivateOpen, setReactivateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const canDelete = row.prUsageCount === 0 && row.catalogItemCount === 0;

  async function run(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    onSuccess: () => void,
  ) {
    setBusy(true);
    try {
      const r = await fn();
      if (r.ok) onSuccess();
      else toast.error(r.message ?? "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onEdit}>
        Edit
      </Button>
      {row.status === TaxonomyStatus.ACTIVE ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setDeactivateOpen(true)}
        >
          Deactivate
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setReactivateOpen(true)}
        >
          Reactivate
        </Button>
      )}
      {canDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      ) : null}
      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title={`Deactivate “${row.name}”?`}
        description="Inactive subcategories are hidden from new purchase requests."
        confirmLabel="Deactivate"
        confirmVariant="destructive"
        onConfirm={() => {
          void run(
            () => deactivateSubcategory(row.id),
            () => {
              toast.success("Subcategory deactivated.");
              setDeactivateOpen(false);
              onResolved?.(row.id, "deactivated");
            },
          );
        }}
      />
      <ConfirmDialog
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        title={`Reactivate “${row.name}”?`}
        description="Subcategory will appear again in taxonomy pickers."
        confirmLabel="Reactivate"
        onConfirm={() => {
          void run(
            () => reactivateSubcategory(row.id),
            () => {
              toast.success("Subcategory reactivated.");
              setReactivateOpen(false);
              onResolved?.(row.id, "reactivated");
            },
          );
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${row.name}”?`}
        description="Permanent removal. Only available when unused."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          void run(
            () => deleteSubcategory(row.id),
            () => {
              toast.success("Subcategory deleted.");
              setDeleteOpen(false);
              onResolved?.(row.id, "deleted");
            },
          );
        }}
      />
    </div>
  );
}
