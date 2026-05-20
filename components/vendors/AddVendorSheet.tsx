"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { createVendor, type CreateVendorResult } from "@/app/actions/vendors";
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
  "min-h-[72px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:opacity-50 dark:bg-input/30",
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
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {req ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export function AddVendorSheet() {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [similar, setSimilar] = React.useState<
    CreateVendorResult & { ok: false; code: "SIMILAR_VENDORS" } | null
  >(null);
  const [dupField, setDupField] = React.useState<{
    message: string;
    vendorId?: string;
  } | null>(null);
  const [confirmDifferent, setConfirmDifferent] = React.useState(false);
  const [ackReason, setAckReason] = React.useState("");

  const resetSoft = () => {
    setSimilar(null);
    setDupField(null);
    setConfirmDifferent(false);
    setAckReason("");
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      resetSoft();
    }
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    if (similar && (!confirmDifferent || !ackReason.trim())) {
      toast.error("Confirm this is a different vendor and provide a reason.");
      return;
    }

    startTransition(async () => {
      const result = await createVendor({
        businessName: String(fd.get("businessName") ?? ""),
        gst: String(fd.get("gst") ?? ""),
        address: String(fd.get("address") ?? ""),
        pocName: String(fd.get("pocName") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        email: String(fd.get("email") ?? ""),
        accountName: String(fd.get("accountName") ?? ""),
        accountNumber: String(fd.get("accountNumber") ?? ""),
        ifsc: String(fd.get("ifsc") ?? ""),
        bankName: String(fd.get("bankName") ?? ""),
        similarVendorAckReason:
          similar && ackReason.trim() ? ackReason.trim() : undefined,
      }).catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Could not save vendor.");
        return null;
      });

      if (!result) {
        return;
      }

      if (result.ok) {
        toast.success("Vendor saved.");
        form.reset();
        resetSoft();
        setOpen(false);
        return;
      }

      if (result.code === "DUPLICATE_FIELD") {
        setSimilar(null);
        setConfirmDifferent(false);
        setAckReason("");
        const label =
          result.field === "phone"
            ? "phone number"
            : result.field === "email"
              ? "email"
              : "GST";
        setDupField({
          message: `A vendor with this ${label} already exists — ${result.existingVendorName}. Change the field or view the existing vendor.`,
          vendorId: result.existingVendorId,
        });
        toast.error(`Duplicate ${label}`);
        return;
      }

      if (result.code === "SIMILAR_VENDORS") {
        setDupField(null);
        setSimilar(result);
        setConfirmDifferent(false);
        setAckReason("");
        toast.warning("Similar vendor names found — review and acknowledge.");
        return;
      }

      toast.error(result.message);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger
        render={<Button type="button">Add vendor</Button>}
      />
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add vendor</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-4 pb-6">
          {dupField ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {dupField.message}{" "}
              {dupField.vendorId ? (
                <Link href={`/vendors/${dupField.vendorId}`} className="font-medium underline">
                  View existing vendor
                </Link>
              ) : null}
            </p>
          ) : null}

          {similar ? (
            <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Similar business names found (possible duplicate)
              </p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {similar.matches.map((m) => (
                  <li key={m.id}>
                    {m.businessName} — {m.pocName}, {m.phone}
                  </li>
                ))}
              </ul>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={confirmDifferent}
                  onChange={(ev) => setConfirmDifferent(ev.target.checked)}
                  className="mt-1 size-4 rounded border-input"
                />
                <span>I confirm this is a different vendor from those listed above.</span>
              </label>
              <div className="space-y-1.5">
                <label htmlFor="ackReason" className="text-sm font-medium">
                  Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="ackReason"
                  value={ackReason}
                  onChange={(ev) => setAckReason(ev.target.value)}
                  className={fieldClass}
                  rows={3}
                  placeholder="Why this vendor is distinct…"
                />
              </div>
            </div>
          ) : null}

          <Card size="sm">
            <CardHeader>
              <CardTitle>Basic info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field id="businessName" label="Vendor business name" required>
                <Input id="businessName" name="businessName" required autoComplete="organization" />
              </Field>
              <Field id="gst" label="GST">
                <Input id="gst" name="gst" autoComplete="off" />
              </Field>
              <Field id="address" label="Address">
                <textarea id="address" name="address" className={fieldClass} rows={2} />
              </Field>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field id="pocName" label="POC name" required>
                <Input id="pocName" name="pocName" required autoComplete="name" />
              </Field>
              <Field id="phone" label="Phone" required>
                <Input id="phone" name="phone" type="tel" required autoComplete="tel" />
              </Field>
              <Field id="email" label="Email" required>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </Field>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Bank details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field id="accountName" label="Account name" required>
                <Input id="accountName" name="accountName" required autoComplete="off" />
              </Field>
              <Field id="accountNumber" label="Account number" required>
                <Input id="accountNumber" name="accountNumber" required autoComplete="off" />
              </Field>
              <Field id="ifsc" label="IFSC" required>
                <Input id="ifsc" name="ifsc" required autoComplete="off" />
              </Field>
              <Field id="bankName" label="Bank name" required>
                <Input id="bankName" name="bankName" required autoComplete="off" />
              </Field>
            </CardContent>
          </Card>

          <div className="mt-auto flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                pending ||
                Boolean(similar && (!confirmDifferent || !ackReason.trim()))
              }
            >
              {pending ? "Saving…" : "Save vendor"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
