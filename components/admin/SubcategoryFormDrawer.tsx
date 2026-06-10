"use client";

import { ExecutionType, TaxonomyStatus } from "@/lib/prisma-enums";
import * as React from "react";
import { toast } from "sonner";

import { createSubcategory, updateSubcategory } from "@/app/actions/taxonomy";
import { FormDrawer } from "@/components/shared/Drawer";
import { Field } from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SubcategoryListRow,
  TaxonomyCategoryOption,
} from "@/lib/queries/taxonomy";

type Mode =
  | { kind: "create"; defaultCategoryId?: string }
  | { kind: "edit"; subcategory: SubcategoryListRow };

export type SeriesOption = { code: string; label: string };

export function SubcategoryFormDrawer({
  open,
  onOpenChange,
  mode,
  categories,
  seriesOptions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  categories: TaxonomyCategoryOption[];
  seriesOptions: SeriesOption[];
  onSaved: () => void;
}) {
  const isEdit = mode.kind === "edit";
  const activeCategories = React.useMemo(
    () => categories.filter((c) => c.status === TaxonomyStatus.ACTIVE),
    [categories],
  );
  const [categoryId, setCategoryId] = React.useState("");
  const [name, setName] = React.useState("");
  const [executionType, setExecutionType] = React.useState<ExecutionType>(
    ExecutionType.VENDOR_PURCHASE,
  );
  const [series, setSeries] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const editSubcategoryId = mode.kind === "edit" ? mode.subcategory.id : null;
  const createDefaultCategoryId =
    mode.kind === "create" ? mode.defaultCategoryId : undefined;

  // Reset form when the drawer opens or the edit/create target changes — not on every keystroke.
  React.useEffect(() => {
    if (!open) return;
    if (mode.kind === "edit") {
      setCategoryId(mode.subcategory.categoryId);
      setName(mode.subcategory.name);
      setExecutionType(mode.subcategory.executionType);
      setSeries(mode.subcategory.series ?? "");
    } else {
      setCategoryId(createDefaultCategoryId ?? activeCategories[0]?.id ?? "");
      setName("");
      setExecutionType(ExecutionType.VENDOR_PURCHASE);
      setSeries("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mode fields tracked via editSubcategoryId / createDefaultCategoryId
  }, [open, editSubcategoryId, createDefaultCategoryId, activeCategories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name,
        executionType,
        series: executionType === ExecutionType.INTERNAL_PRINT ? series : null,
      };
      const res = isEdit
        ? await updateSubcategory(mode.subcategory.id, payload)
        : await createSubcategory({ categoryId, ...payload });
      if (!res.ok) {
        toast.error(res.message ?? "Failed to save subcategory.");
        return;
      }
      toast.success(isEdit ? "Subcategory updated." : "Subcategory created.");
      onOpenChange(false);
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  const categoryOptions = (isEdit ? categories : activeCategories).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit subcategory" : "Add subcategory"}
      description={
        isEdit
          ? `${mode.subcategory.categoryName} · ${mode.subcategory.prUsageCount} PR line uses`
          : "Subcategory drives execution type and serial series on purchase requests."
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
        {!isEdit ? (
          <Field label="Category" htmlFor="subcategory-category" required>
            <Combobox
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder="Select category"
              ariaLabel="Category"
            />
          </Field>
        ) : null}
        <Field label="Name" htmlFor="subcategory-name" required>
          <Input
            id="subcategory-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Primary Packaging"
            required
          />
        </Field>
        <Field label="Execution type" htmlFor="subcategory-execution" required>
          <Select
            value={executionType}
            onValueChange={(v) => setExecutionType(v as ExecutionType)}
          >
            <SelectTrigger id="subcategory-execution">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ExecutionType.VENDOR_PURCHASE}>Vendor purchase</SelectItem>
              <SelectItem value={ExecutionType.INTERNAL_PRINT}>Internal print</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {executionType === ExecutionType.INTERNAL_PRINT ? (
          <Field label="Serial series" htmlFor="subcategory-series" required>
            <Combobox
              value={series}
              onChange={setSeries}
              options={seriesOptions.map((s) => ({ value: s.code, label: s.label }))}
              placeholder="Select series"
              ariaLabel="Serial series"
            />
          </Field>
        ) : null}
      </form>
    </FormDrawer>
  );
}
