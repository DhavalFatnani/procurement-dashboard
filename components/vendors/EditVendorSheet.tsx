"use client";

import * as React from "react";
import { toast } from "sonner";

import { updateVendor, type UpdateVendorResult, type VendorDetail } from "@/app/actions/vendors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const fieldClass = cn(
  "min-h-[72px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
);

function Field({
  id,
  label,
  required: req,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {req ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export function EditVendorSheet({ vendor }: { vendor: VendorDetail }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [dupError, setDupError] = React.useState<string | null>(null);

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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            Edit
          </Button>
        }
      />
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit vendor</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-4 pb-6">
          {dupError ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {dupError}
            </p>
          ) : null}

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Business name (read-only): </span>
            <span className="font-medium">{vendor.businessName}</span>
          </div>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Contact & address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field id="pocName" label="POC name" required>
                <Input id="pocName" name="pocName" defaultValue={vendor.pocName} required />
              </Field>
              <Field id="phone" label="Phone" required>
                <Input id="phone" name="phone" type="tel" defaultValue={vendor.phone} required />
              </Field>
              <Field id="email" label="Email" required>
                <Input id="email" name="email" type="email" defaultValue={vendor.email} required />
              </Field>
              <Field id="address" label="Address">
                <textarea
                  id="address"
                  name="address"
                  className={fieldClass}
                  rows={2}
                  defaultValue={vendor.address ?? ""}
                />
              </Field>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Bank details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field id="accountName" label="Account name" required>
                <Input id="accountName" name="accountName" defaultValue={vendor.accountName} required />
              </Field>
              <Field id="accountNumber" label="Account number" required>
                <Input
                  id="accountNumber"
                  name="accountNumber"
                  required
                  placeholder="Full number required to update"
                />
              </Field>
              <Field id="ifsc" label="IFSC" required>
                <Input id="ifsc" name="ifsc" defaultValue={vendor.ifsc} required />
              </Field>
              <Field id="bankName" label="Bank name" required>
                <Input id="bankName" name="bankName" defaultValue={vendor.bankName} required />
              </Field>
            </CardContent>
          </Card>

          <Field id="reason" label="Reason for this edit" required>
            <textarea
              id="reason"
              name="reason"
              className={fieldClass}
              rows={3}
              required
              placeholder="Document why these details are changing…"
            />
          </Field>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
