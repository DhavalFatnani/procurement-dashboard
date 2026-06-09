"use client";

import { TaxonomyStatus } from "@/lib/prisma-enums";
import * as React from "react";
import { toast } from "sonner";

import {
  deactivateCategory,
  deleteCategory,
  reactivateCategory,
} from "@/app/actions/taxonomy";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { CategoryListRow } from "@/lib/queries/taxonomy";

export type CategoryResolveOutcome = "deactivated" | "reactivated" | "deleted";

export function CategoryRowActions({
  row,
  onEdit,
  onResolved,
}: {
  row: CategoryListRow;
  onEdit: () => void;
  onResolved?: (id: string, outcome: CategoryResolveOutcome) => void;
}) {
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [reactivateOpen, setReactivateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

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
      {row.prUsageCount === 0 && row.subcategoryCount === 0 ? (
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
        description="Inactive categories are hidden from new purchase requests."
        confirmLabel="Deactivate"
        confirmVariant="destructive"
        onConfirm={() => {
          void run(
            () => deactivateCategory(row.id),
            () => {
              toast.success("Category deactivated.");
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
        description="Category will appear again in taxonomy pickers."
        confirmLabel="Reactivate"
        onConfirm={() => {
          void run(
            () => reactivateCategory(row.id),
            () => {
              toast.success("Category reactivated.");
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
            () => deleteCategory(row.id),
            () => {
              toast.success("Category deleted.");
              setDeleteOpen(false);
              onResolved?.(row.id, "deleted");
            },
          );
        }}
      />
    </div>
  );
}
