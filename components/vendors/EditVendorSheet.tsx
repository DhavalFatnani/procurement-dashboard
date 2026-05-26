"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  updateVendor,
  type UpdateVendorResult,
  type VendorDetail,
} from "@/app/actions/vendors";
import { FormDrawer } from "@/components/shared/Drawer";
import { Field } from "@/components/shared/Field";
import { SheetSection } from "@/components/shared/SheetSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function EditVendorSheet({ vendor }: { vendor: VendorDetail }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [dupError, setDupError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setDupError(null);

    startTransition(async () => {
      const result = (await updateVendor(vendor.id, {
        pocName: String(fd.get("pocName") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        email: String(fd.get("email") ?? ""),
        address: String(fd.get("address") ?? ""),
        accountName: String(fd.get("accountName") ?? ""),
        accountNumber: String(fd.get("accountNumber") ?? ""),
        ifsc: String(fd.get("ifsc") ?? ""),
        bankName: String(fd.get("bankName") ?? ""),
        reason: String(fd.get("reason") ?? ""),
      }).catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Update failed.");
        return null;
      })) as UpdateVendorResult | null;

      if (!result) {
        return;
      }

      if (result.ok) {
        toast.success("Vendor updated.");
        setOpen(false);
        return;
      }

      if (result.code === "DUPLICATE_FIELD") {
        setDupError(
          `A vendor with this ${result.field} already exists — ${result.existingVendorName}.`,
        );
        toast.error("Duplicate field");
        return;
      }

      if (result.code === "VALIDATION") {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>
      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        title="Edit vendor"
        description={vendor.businessName}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={pending}
              disabled={pending}
              onClick={() => formRef.current?.requestSubmit()}
            >
              {pending ? "Saving" : "Save changes"}
            </Button>
          </>
        }
      >
        <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
          {dupError ? (
            <p className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-ds-sm text-[var(--status-error)]">
              {dupError}
            </p>
          ) : null}

          <div className="rounded-lg border border-border-subtle bg-muted/40 px-3 py-2 text-ds-sm">
            <span className="text-muted-foreground">Business name (read-only): </span>
            <span className="font-medium">{vendor.businessName}</span>
          </div>

          <SheetSection title="Contact & address">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="POC name" htmlFor="pocName" required>
                <Input id="pocName" name="pocName" defaultValue={vendor.pocName} required />
              </Field>
              <Field label="Phone" htmlFor="phone" required>
                <Input id="phone" name="phone" type="tel" defaultValue={vendor.phone} required />
              </Field>
              <Field label="Email" htmlFor="email" required className="sm:col-span-2">
                <Input id="email" name="email" type="email" defaultValue={vendor.email} required />
              </Field>
              <Field label="Address" htmlFor="address" className="sm:col-span-2">
                <Textarea
                  id="address"
                  name="address"
                  rows={2}
                  defaultValue={vendor.address ?? ""}
                />
              </Field>
            </div>
          </SheetSection>

          <SheetSection title="Bank details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Account name" htmlFor="accountName" required className="sm:col-span-2">
                <Input
                  id="accountName"
                  name="accountName"
                  defaultValue={vendor.accountName}
                  required
                />
              </Field>
              <Field
                label="Account number"
                htmlFor="accountNumber"
                required
                hint="Full number is required to confirm the change."
              >
                <Input id="accountNumber" name="accountNumber" required />
              </Field>
              <Field label="IFSC" htmlFor="ifsc" required>
                <Input id="ifsc" name="ifsc" defaultValue={vendor.ifsc} required />
              </Field>
              <Field label="Bank name" htmlFor="bankName" required className="sm:col-span-2">
                <Input id="bankName" name="bankName" defaultValue={vendor.bankName} required />
              </Field>
            </div>
          </SheetSection>

          <Field
            label="Reason for this edit"
            htmlFor="reason"
            required
            hint="Documented for audit history."
          >
            <Textarea
              id="reason"
              name="reason"
              rows={3}
              required
              placeholder="Document why these details are changing…"
            />
          </Field>
        </form>
      </FormDrawer>
    </>
  );
}
