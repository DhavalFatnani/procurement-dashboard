"use client";

import { Role } from "@prisma/client";
import * as React from "react";
import { toast } from "sonner";

import { createUser, updateUser } from "@/app/actions/users";
import { FormDrawer } from "@/components/shared/Drawer";
import { Field } from "@/components/shared/Field";
import { SheetSection } from "@/components/shared/SheetSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/navigation";
import type { UserDetail } from "@/lib/queries/users";
import { roleUsesMultiWarehouseAssignment } from "@/lib/warehouse-scope";
import { cn } from "@/lib/utils";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; user: UserDetail };

function WarehouseCheckboxList({
  warehouses,
  selectedIds,
  onChange,
  idPrefix,
}: {
  warehouses: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  idPrefix: string;
}) {
  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2">
      {warehouses.map((w) => {
        const checked = selectedIds.includes(w.id);
        const inputId = `${idPrefix}-${w.id}`;
        return (
          <label
            key={w.id}
            htmlFor={inputId}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-ds-sm transition-colors",
              checked ? "bg-accent/10 text-foreground" : "hover:bg-muted/60",
            )}
          >
            <input
              id={inputId}
              type="checkbox"
              className="size-3.5 rounded border-border accent-accent"
              checked={checked}
              onChange={() => toggle(w.id)}
            />
            <span>{w.name}</span>
          </label>
        );
      })}
    </div>
  );
}

export function UserFormDrawer({
  open,
  onOpenChange,
  warehouses,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: { id: string; name: string }[];
  mode: Mode;
  onSaved: () => void;
}) {
  const isEdit = mode.kind === "edit";
  const initial = isEdit ? mode.user : null;

  const [name, setName] = React.useState(initial?.name ?? "");
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [role, setRole] = React.useState<Role>(initial?.role ?? Role.SM);
  const [warehouseId, setWarehouseId] = React.useState(
    initial?.warehouseId ?? warehouses[0]?.id ?? "",
  );
  const [warehouseIds, setWarehouseIds] = React.useState<string[]>(
    initial?.warehouseIds ?? (warehouses[0] ? [warehouses[0].id] : []),
  );
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const multiWarehouse = roleUsesMultiWarehouseAssignment(role);

  React.useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setName(mode.user.name);
      setEmail(mode.user.email);
      setRole(mode.user.role);
      setWarehouseId(mode.user.warehouseId);
      setWarehouseIds(
        mode.user.warehouseIds.length > 0
          ? mode.user.warehouseIds
          : [mode.user.warehouseId],
      );
      setPassword("");
    } else {
      setName("");
      setEmail("");
      setRole(Role.SM);
      setWarehouseId(warehouses[0]?.id ?? "");
      setWarehouseIds(warehouses[0] ? [warehouses[0].id] : []);
      setPassword("");
    }
  }, [open, mode, isEdit, warehouses]);

  React.useEffect(() => {
    if (multiWarehouse) {
      if (warehouseIds.length === 0 && warehouses[0]) {
        setWarehouseIds([warehouses[0].id]);
      }
    } else if (warehouseId) {
      setWarehouseIds([warehouseId]);
    }
  }, [multiWarehouse, warehouseId, warehouseIds.length, warehouses]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = multiWarehouse
        ? { warehouseIds }
        : { warehouseId };

      if (isEdit) {
        const res = await updateUser({
          id: mode.user.id,
          name,
          role,
          ...payload,
        });
        if (!res.ok) {
          toast.error(res.message ?? "Failed to update user.");
          return;
        }
        toast.success("User updated.");
      } else {
        const res = await createUser({
          email,
          name,
          role,
          ...payload,
          password: password || undefined,
        });
        if (!res.ok) {
          toast.error(res.message ?? "Failed to create user.");
          return;
        }
        toast.success(
          password
            ? "User created."
            : "User created — a password reset email was sent.",
        );
      }
      onOpenChange(false);
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit user" : "Add user"}
      description={
        isEdit ? mode.user.email : "Provision a new dashboard user."
      }
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
            {isEdit ? "Save changes" : "Create user"}
          </Button>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        <SheetSection title="Identity">
          <div className="space-y-3">
            <Field label="Full name" htmlFor="user-name" required>
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </Field>
            <Field
              label="Email"
              htmlFor="user-email"
              required
              hint={
                isEdit
                  ? "Email cannot be changed. Use Supabase admin to migrate identities."
                  : "Used for sign-in and password reset."
              }
            >
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isEdit}
                required
              />
            </Field>
          </div>
        </SheetSection>

        <SheetSection
          title="Role & warehouse"
          description={
            multiWarehouse
              ? "Ops Head and Finance users can be assigned to one or more warehouses. Data is scoped to those locations."
              : "Store Managers operate within a single warehouse."
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Role" htmlFor="user-role" required>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="user-role" aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Role).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {multiWarehouse ? (
              <Field
                label="Warehouses"
                htmlFor="user-warehouses"
                required
                hint={`${warehouseIds.length} selected`}
                className="sm:col-span-2"
              >
                <WarehouseCheckboxList
                  idPrefix="user-wh"
                  warehouses={warehouses}
                  selectedIds={warehouseIds}
                  onChange={setWarehouseIds}
                />
              </Field>
            ) : (
              <Field label="Warehouse" htmlFor="user-warehouse" required>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger id="user-warehouse" aria-label="Warehouse">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
        </SheetSection>

        {!isEdit ? (
          <SheetSection
            title="Initial password"
            description="Leave blank to send a password-setup email instead."
          >
            <Field label="Password" htmlFor="user-password" hint="Minimum 8 characters.">
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="(optional)"
              />
            </Field>
          </SheetSection>
        ) : null}
      </form>
    </FormDrawer>
  );
}
