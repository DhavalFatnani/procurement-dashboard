"use client";

import { Loader2, Pencil } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { updatePendingCatalogItem } from "@/app/actions/catalog";
import { fetchPendingCatalogItemsForPR } from "@/app/actions/purchase-requests";
import type { ApprovePRInput } from "@/lib/purchase-request-types";
import type { PendingCatalogItemRow } from "@/lib/queries/purchase-requests";
import { FormDrawer } from "@/components/shared/Drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ItemDraft = {
  name: string;
  sku: string;
  unit: string;
};

function draftsFromItems(items: PendingCatalogItemRow[]): Record<string, ItemDraft> {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        name: item.name,
        sku: item.sku ?? "",
        unit: item.unit,
      },
    ]),
  );
}

function draftDirty(item: PendingCatalogItemRow, draft: ItemDraft): boolean {
  return (
    draft.name.trim() !== item.name ||
    (draft.sku.trim() || null) !== item.sku ||
    draft.unit.trim() !== item.unit
  );
}

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
  const [drafts, setDrafts] = React.useState<Record<string, ItemDraft>>({});
  const [loadingItems, setLoadingItems] = React.useState(false);
  const [approved, setApproved] = React.useState<Record<string, boolean>>({});
  const [rejectReasons, setRejectReasons] = React.useState<Record<string, string>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !prId) {
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    setEditingId(null);
    void fetchPendingCatalogItemsForPR(prId).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        toast.error(result.message ?? "Could not load catalog items.");
        setPendingItems([]);
        setDrafts({});
      } else {
        setPendingItems(result.items);
        setDrafts(draftsFromItems(result.items));
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

  const hasPending = pendingItems.length > 0;
  const anyDirty = pendingItems.some((item) => {
    const draft = drafts[item.id];
    return draft ? draftDirty(item, draft) : false;
  });

  async function saveItemEdits(item: PendingCatalogItemRow) {
    const draft = drafts[item.id];
    if (!draft) {
      return;
    }
    if (!draftDirty(item, draft)) {
      setEditingId(null);
      return;
    }
    setSavingId(item.id);
    const res = await updatePendingCatalogItem(item.id, {
      name: draft.name,
      sku: draft.sku.trim() || null,
      unit: draft.unit,
    });
    setSavingId(null);
    if (!res.ok) {
      toast.error(res.message ?? "Could not save item.");
      return;
    }
    const nextItem: PendingCatalogItemRow = {
      ...item,
      name: draft.name.trim(),
      sku: draft.sku.trim() || null,
      unit: draft.unit.trim() || "pcs",
    };
    setPendingItems((prev) =>
      prev.map((row) => (row.id === item.id ? nextItem : row)),
    );
    setDrafts((prev) => ({
      ...prev,
      [item.id]: {
        name: nextItem.name,
        sku: nextItem.sku ?? "",
        unit: nextItem.unit,
      },
    }));
    setEditingId(null);
    toast.success("Item updated.");
  }

  function handleConfirm() {
    if (anyDirty) {
      toast.error("Save your edits to each catalog item before approving the PR.");
      return;
    }
    const input = buildInput();
    if (!input) {
      toast.error("Add a rejection reason for each rejected catalog item.");
      return;
    }
    onConfirm(input);
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      width="xl"
      title={hasPending ? "Review proposed catalog items" : "Approve purchase request?"}
      description={
        loadingItems
          ? "Loading items proposed on this PR…"
          : hasPending
            ? "Approve, reject, or edit each proposed item. All items must be decided before the PR can be approved."
            : "No new catalog proposals on this PR. Approving moves it forward for PO creation."
      }
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={pending || loadingItems}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || loadingItems}
            onClick={handleConfirm}
          >
            {pending ? "Approving…" : "Approve PR"}
          </Button>
        </>
      }
    >
      {loadingItems ? (
        <p className="flex items-center gap-2 text-ds-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading catalog items…
        </p>
      ) : null}

      {!loadingItems && hasPending ? (
        <ul className="space-y-3">
          {pendingItems.map((item) => {
            const isApproved = approved[item.id] ?? true;
            const draft = drafts[item.id] ?? draftsFromItems([item])[item.id]!;
            const isEditing = editingId === item.id;
            const isDirty = draftDirty(item, draft);
            const isSaving = savingId === item.id;

            return (
              <li
                key={item.id}
                className="rounded-xl border border-border-subtle bg-card p-4 shadow-ds-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-ds-sm font-semibold text-foreground">{item.name}</p>
                    <p className="text-ds-xs text-muted-foreground">
                      {item.categoryName} / {item.subcategoryName}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    onClick={() => setEditingId(isEditing ? null : item.id)}
                  >
                    <Pencil className="size-3.5" strokeWidth={1.5} aria-hidden />
                    {isEditing ? "Close edit" : "Edit item"}
                  </Button>
                </div>

                {isEditing ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label
                        htmlFor={`catalog-name-${item.id}`}
                        className="text-ds-xs font-medium text-muted-foreground"
                      >
                        Item name
                      </label>
                      <Input
                        id={`catalog-name-${item.id}`}
                        value={draft.name}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, name: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`catalog-sku-${item.id}`}
                        className="text-ds-xs font-medium text-muted-foreground"
                      >
                        SKU (optional)
                      </label>
                      <Input
                        id={`catalog-sku-${item.id}`}
                        value={draft.sku}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, sku: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`catalog-unit-${item.id}`}
                        className="text-ds-xs font-medium text-muted-foreground"
                      >
                        Unit
                      </label>
                      <Input
                        id={`catalog-unit-${item.id}`}
                        value={draft.unit}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, unit: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isSaving || !isDirty}
                        onClick={() => void saveItemEdits(item)}
                      >
                        {isSaving ? "Saving…" : "Save changes"}
                      </Button>
                      {isDirty ? (
                        <p className="self-center text-ds-xs text-status-warning">
                          Unsaved edits
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-ds-xs text-muted-foreground">
                    {item.sku ? `SKU ${item.sku} · ` : ""}
                    Unit: {item.unit}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-1 text-ds-xs font-medium transition-colors",
                      isApproved
                        ? "border-[color-mix(in_srgb,var(--brand-accent)_40%,transparent)] surface-accent-soft"
                        : "border-border-subtle text-muted-foreground hover:bg-muted/40",
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
                      "rounded-md border px-3 py-1 text-ds-xs font-medium transition-colors",
                      !isApproved
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-border-subtle text-muted-foreground hover:bg-muted/40",
                    )}
                    onClick={() =>
                      setApproved((prev) => ({ ...prev, [item.id]: false }))
                    }
                  >
                    Reject item
                  </button>
                </div>

                {!isApproved ? (
                  <div className="mt-2 space-y-1">
                    <label
                      htmlFor={`reject-reason-${item.id}`}
                      className="text-ds-xs font-medium text-muted-foreground"
                    >
                      Rejection reason
                    </label>
                    <textarea
                      id={`reject-reason-${item.id}`}
                      required
                      placeholder="Why is this item rejected?"
                      value={rejectReasons[item.id] ?? ""}
                      onChange={(e) =>
                        setRejectReasons((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="min-h-[72px] w-full rounded-lg border border-input px-2 py-2 text-sm"
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </FormDrawer>
  );
}
