"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { createVendor, type CreateVendorResult } from "@/app/actions/vendors";
import { FormDrawer } from "@/components/shared/Drawer";
import { Field } from "@/components/shared/Field";
import { SheetSection } from "@/components/shared/SheetSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AddVendorSheet({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showTrigger = true,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
} = {}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
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
  const formRef = React.useRef<HTMLFormElement>(null);

  const resetSoft = () => {
    setSimilar(null);
    setDupField(null);
    setConfirmDifferent(false);
    setAckReason("");
  };

  const onOpenChange = (next: boolean) => {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(next);
    } else {
      setInternalOpen(next);
    }
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
        onOpenChange(false);
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

  const submitDisabled =
    pending || Boolean(similar && (!confirmDifferent || !ackReason.trim()));

  return (
    <>
      {showTrigger ? (
        <Button type="button" onClick={() => onOpenChange(true)}>
          Add vendor
        </Button>
      ) : null}
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Add vendor"
        description="Capture business, contact, and bank details for a new vendor."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={pending}
              disabled={submitDisabled}
              onClick={() => formRef.current?.requestSubmit()}
            >
              {pending ? "Saving" : "Save vendor"}
            </Button>
          </>
        }
      >
        <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
          {dupField ? (
            <p className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-ds-sm text-[var(--status-error)]">
              {dupField.message}{" "}
              {dupField.vendorId ? (
                <Link
                  href={`/vendors/${dupField.vendorId}`}
                  className="font-medium underline"
                >
                  View existing vendor
                </Link>
              ) : null}
            </p>
          ) : null}

          {similar ? (
            <div className="space-y-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-ds-sm">
              <p className="font-medium text-[var(--status-warning)]">
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
                  className="mt-1 size-3.5 rounded border-input"
                />
                <span>I confirm this is a different vendor from those listed above.</span>
              </label>
              <Field label="Reason" htmlFor="ackReason" required>
                <Textarea
                  id="ackReason"
                  value={ackReason}
                  onChange={(ev) => setAckReason(ev.target.value)}
                  rows={3}
                  placeholder="Why this vendor is distinct…"
                />
              </Field>
            </div>
          ) : null}

          <SheetSection title="Basic info">
            <div className="space-y-3">
              <Field label="Vendor business name" htmlFor="businessName" required>
                <Input
                  id="businessName"
                  name="businessName"
                  required
                  autoComplete="organization"
                />
              </Field>
              <Field label="GST" htmlFor="gst">
                <Input id="gst" name="gst" autoComplete="off" />
              </Field>
              <Field label="Address" htmlFor="address">
                <Textarea id="address" name="address" rows={2} />
              </Field>
            </div>
          </SheetSection>

          <SheetSection title="Contact">
            <div className="space-y-3">
              <Field label="POC name" htmlFor="pocName" required>
                <Input id="pocName" name="pocName" required autoComplete="name" />
              </Field>
              <Field label="Phone" htmlFor="phone" required>
                <Input id="phone" name="phone" type="tel" required autoComplete="tel" />
              </Field>
              <Field label="Email" htmlFor="email" required>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </Field>
            </div>
          </SheetSection>

          <SheetSection title="Bank details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Account name" htmlFor="accountName" required className="sm:col-span-2">
                <Input id="accountName" name="accountName" required autoComplete="off" />
              </Field>
              <Field label="Account number" htmlFor="accountNumber" required>
                <Input id="accountNumber" name="accountNumber" required autoComplete="off" />
              </Field>
              <Field label="IFSC" htmlFor="ifsc" required>
                <Input id="ifsc" name="ifsc" required autoComplete="off" />
              </Field>
              <Field label="Bank name" htmlFor="bankName" required className="sm:col-span-2">
                <Input id="bankName" name="bankName" required autoComplete="off" />
              </Field>
            </div>
          </SheetSection>
        </form>
      </FormDrawer>
    </>
  );
}
