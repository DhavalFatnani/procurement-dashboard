"use client";

import { CatalogItemStatus } from "@prisma/client";
import * as React from "react";
import { toast } from "sonner";

import {
  createCatalogItem,
  updateCatalogItemDetails,
  updatePendingCatalogItem,
} from "@/app/actions/catalog";
import { FormDrawer } from "@/components/shared/Drawer";
import { Field } from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import type { CatalogItemListRow, CatalogSubcategoryOption } from "@/lib/queries/catalog";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: CatalogItemListRow };

export function CatalogItemFormDrawer({
  open,
  onOpenChange,
  mode,
  subcategories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  subcategories: CatalogSubcategoryOption[];
  onSaved: () => void;
}) {
  const isEdit = mode.kind === "edit";
  const [subcategoryId, setSubcategoryId] = React.useState("");
  const [name, setName] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [unit, setUnit] = React.useState("pcs");
  const [submitting, setSubmitting] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setSubcategoryId(mode.item.subcategoryId);
      setName(mode.item.name);
      setSku(mode.item.sku ?? "");
      setUnit(mode.item.unit);
    } else {
      setSubcategoryId(subcategories[0]?.id ?? "");
      setName("");
      setSku("");
      setUnit("pcs");
    }
  }, [open, mode, isEdit, subcategories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = isEdit
        ? mode.item.status === CatalogItemStatus.PENDING_APPROVAL
          ? await updatePendingCatalogItem(mode.item.id, {
              name,
              sku: sku.trim() || null,
              unit,
            })
          : await updateCatalogItemDetails(mode.item.id, {
              sku: sku.trim() || null,
              unit,
            })
        : await createCatalogItem({
            subcategoryId,
            name,
            sku: sku.trim() || null,
            unit,
          });
      if (!res.ok) {
        toast.error(res.message ?? "Failed to save catalog item.");
        return;
      }
      toast.success(isEdit ? "Catalog item updated." : "Catalog item created.");
      onOpenChange(false);
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  const subcategoryOptions = subcategories.map((s) => ({
    value: s.id,
    label: s.name,
    description: s.categoryName,
    keywords: [s.categoryName],
  }));

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit catalog item" : "Add catalog item"}
      description={
        isEdit
          ? `${mode.item.categoryName} / ${mode.item.subcategoryName}`
          : "Creates an active item available on vendor purchase requests."
      }
      width="md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            disabled={submitting || (!isEdit && !subcategoryId)}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {isEdit ? "Save changes" : "Create"}
          </Button>
        </>
      }
    >
      <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {isEdit ? (
          <Field label="Item name" required={mode.item.status === CatalogItemStatus.PENDING_APPROVAL}>
            {mode.item.status === CatalogItemStatus.PENDING_APPROVAL ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-8"
              />
            ) : (
              <Input value={mode.item.name} disabled className="h-8" />
            )}
          </Field>
        ) : (
          <>
            <Field label="Subcategory" required>
              <Combobox
                value={subcategoryId}
                onChange={setSubcategoryId}
                options={subcategoryOptions}
                placeholder="Select subcategory"
                searchPlaceholder="Search subcategories…"
                emptyText="No subcategories match"
                ariaLabel="Subcategory"
                size="sm"
              />
            </Field>
            <Field label="Item name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zip lock bag — medium"
                required
                className="h-8"
              />
            </Field>
          </>
        )}
        <Field label="SKU (optional)">
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Internal SKU"
            className="h-8"
          />
        </Field>
        <Field label="Unit" required>
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="pcs"
            required
            className="h-8 max-w-[120px]"
          />
        </Field>
      </form>
    </FormDrawer>
  );
}
