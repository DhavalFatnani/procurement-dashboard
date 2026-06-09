"use client";

import { CategoryBillingGranularity } from "@/lib/prisma-enums";
import * as React from "react";
import { toast } from "sonner";

import { createCategory, updateCategory } from "@/app/actions/taxonomy";
import { FormDrawer } from "@/components/shared/Drawer";
import { Field } from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryListRow } from "@/lib/queries/taxonomy";

type Mode = { kind: "create" } | { kind: "edit"; category: CategoryListRow };

const GRANULARITY_LABEL: Record<CategoryBillingGranularity, string> = {
  [CategoryBillingGranularity.CATALOG_ITEM]: "Catalog items (pick items on PRs)",
  [CategoryBillingGranularity.SUBCATEGORY]: "Subcategory quantity (qty per subcategory row)",
};

export function CategoryFormDrawer({
  open,
  onOpenChange,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  onSaved: () => void;
}) {
  const isEdit = mode.kind === "edit";
  const [name, setName] = React.useState("");
  const [billingGranularity, setBillingGranularity] =
    React.useState<CategoryBillingGranularity>(CategoryBillingGranularity.SUBCATEGORY);
  const [submitting, setSubmitting] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setName(mode.category.name);
      setBillingGranularity(mode.category.billingGranularity);
    } else {
      setName("");
      setBillingGranularity(CategoryBillingGranularity.SUBCATEGORY);
    }
  }, [open, mode, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = isEdit
        ? await updateCategory(mode.category.id, { name, billingGranularity })
        : await createCategory({ name, billingGranularity });
      if (!res.ok) {
        toast.error(res.message ?? "Failed to save category.");
        return;
      }
      toast.success(isEdit ? "Category updated." : "Category created.");
      onOpenChange(false);
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit category" : "Add category"}
      description={
        isEdit
          ? `${mode.category.subcategoryCount} subcategor${mode.category.subcategoryCount === 1 ? "y" : "ies"}`
          : "Top-level procurement grouping for purchase requests."
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
            disabled={submitting}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {isEdit ? "Save changes" : "Create"}
          </Button>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        <Field label="Name" htmlFor="category-name" required>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Packaging"
            required
          />
        </Field>
        <Field label="Billing granularity" htmlFor="category-granularity" required>
          <Select
            value={billingGranularity}
            onValueChange={(v) => setBillingGranularity(v as CategoryBillingGranularity)}
          >
            <SelectTrigger id="category-granularity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CategoryBillingGranularity).map((value) => (
                <SelectItem key={value} value={value}>
                  {GRANULARITY_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </form>
    </FormDrawer>
  );
}
