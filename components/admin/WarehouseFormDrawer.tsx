"use client";

import * as React from "react";
import { toast } from "sonner";

import { createWarehouse, updateWarehouse } from "@/app/actions/warehouses";
import { FormDrawer } from "@/components/shared/Drawer";
import { Field } from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WarehouseRow } from "@/lib/queries/warehouses";

type Mode = { kind: "create" } | { kind: "edit"; warehouse: WarehouseRow };

export function WarehouseFormDrawer({
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
  const [name, setName] = React.useState(isEdit ? mode.warehouse.name : "");
  const [location, setLocation] = React.useState(isEdit ? mode.warehouse.location : "");
  const [submitting, setSubmitting] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(isEdit ? mode.warehouse.name : "");
    setLocation(isEdit ? mode.warehouse.location : "");
  }, [open, mode, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = isEdit
        ? await updateWarehouse(mode.warehouse.id, { name, location })
        : await createWarehouse({ name, location });
      if (!res.ok) {
        toast.error(res.message ?? "Failed to save warehouse.");
        return;
      }
      toast.success(isEdit ? "Warehouse updated." : "Warehouse created.");
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
      title={isEdit ? "Edit warehouse" : "Add warehouse"}
      description={
        isEdit
          ? `${mode.warehouse.userCount} user${mode.warehouse.userCount === 1 ? "" : "s"} assigned`
          : "Register a new operating warehouse."
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
        <Field label="Name" htmlFor="warehouse-name" required>
          <Input
            id="warehouse-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mumbai – DC1"
            required
          />
        </Field>
        <Field label="Location" htmlFor="warehouse-location" required>
          <Input
            id="warehouse-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Mumbai, India"
            required
          />
        </Field>
      </form>
    </FormDrawer>
  );
}
