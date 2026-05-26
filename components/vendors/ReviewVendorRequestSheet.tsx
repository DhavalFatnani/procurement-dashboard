"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  reviewVendorRequest,
  type ActivateVendorFromRequestInput,
} from "@/app/actions/vendors";
import type { PendingVendorRequestRow } from "@/lib/queries/vendors";
import { FormDrawer } from "@/components/shared/Drawer";
import { Field } from "@/components/shared/Field";
import { SheetSection } from "@/components/shared/SheetSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const emptyBank: ActivateVendorFromRequestInput = {
  accountName: "",
  accountNumber: "",
  ifsc: "",
  bankName: "",
  address: "",
  gst: "",
};

export function ReviewVendorRequestSheet({
  request,
}: {
  request: PendingVendorRequestRow;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [rejectReason, setRejectReason] = React.useState("");
  const [bank, setBank] = React.useState<ActivateVendorFromRequestInput>(emptyBank);

  function run(action: "ACTIVATED" | "REJECTED") {
    startTransition(async () => {
      const result = await reviewVendorRequest(
        request.id,
        action,
        action === "REJECTED" ? rejectReason : undefined,
        action === "ACTIVATED" ? bank : undefined,
      );
      if (result.ok) {
        if (action === "ACTIVATED" && result.vendorId) {
          toast.success("Vendor activated.");
          setOpen(false);
          router.push(`/vendors/${result.vendorId}`);
        } else {
          toast.success(
            action === "ACTIVATED" ? "Vendor activated." : "Request rejected.",
          );
          setOpen(false);
          router.refresh();
        }
        return;
      }
      toast.error(result.message ?? "Review failed.");
    });
  }

  const canActivate =
    !pending &&
    bank.accountName.trim() &&
    bank.accountNumber.trim() &&
    bank.ifsc.trim() &&
    bank.bankName.trim();
  const canReject = !pending && rejectReason.trim();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Review
      </Button>
      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        title="Review vendor request"
        description={request.businessName}
        footer={
          <>
            <Button
              type="button"
              variant="destructive"
              disabled={!canReject}
              onClick={() => run("REJECTED")}
            >
              Reject
            </Button>
            <Button
              type="button"
              disabled={!canActivate}
              loading={pending}
              onClick={() => run("ACTIVATED")}
            >
              {pending ? "Activating" : "Activate vendor"}
            </Button>
          </>
        }
      >
        <SheetSection title="Request summary">
          <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm">
            <div>
              <dt className="text-ds-xs text-muted-foreground">Business name</dt>
              <dd className="font-medium">{request.businessName}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">POC</dt>
              <dd>{request.pocName}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Phone</dt>
              <dd>{request.phone}</dd>
            </div>
            {request.linkedPRId ? (
              <div>
                <dt className="text-ds-xs text-muted-foreground">Linked PR</dt>
                <dd className="font-mono">{request.linkedPRId}</dd>
              </div>
            ) : null}
          </dl>
        </SheetSection>

        <SheetSection
          title="Bank details"
          description="Required to activate the vendor."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Account name" htmlFor="rev-accountName" required className="sm:col-span-2">
              <Input
                id="rev-accountName"
                value={bank.accountName}
                onChange={(e) =>
                  setBank((b) => ({ ...b, accountName: e.target.value }))
                }
              />
            </Field>
            <Field label="Account number" htmlFor="rev-accountNumber" required>
              <Input
                id="rev-accountNumber"
                value={bank.accountNumber}
                onChange={(e) =>
                  setBank((b) => ({ ...b, accountNumber: e.target.value }))
                }
              />
            </Field>
            <Field label="IFSC" htmlFor="rev-ifsc" required>
              <Input
                id="rev-ifsc"
                value={bank.ifsc}
                onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value }))}
              />
            </Field>
            <Field label="Bank name" htmlFor="rev-bankName" required className="sm:col-span-2">
              <Input
                id="rev-bankName"
                value={bank.bankName}
                onChange={(e) =>
                  setBank((b) => ({ ...b, bankName: e.target.value }))
                }
              />
            </Field>
            <Field label="Address" htmlFor="rev-address" className="sm:col-span-2">
              <Input
                id="rev-address"
                value={bank.address ?? ""}
                onChange={(e) => setBank((b) => ({ ...b, address: e.target.value }))}
              />
            </Field>
            <Field label="GST" htmlFor="rev-gst" className="sm:col-span-2">
              <Input
                id="rev-gst"
                value={bank.gst ?? ""}
                onChange={(e) => setBank((b) => ({ ...b, gst: e.target.value }))}
              />
            </Field>
          </div>
        </SheetSection>

        <SheetSection
          title="Rejection reason"
          description="Required only if rejecting the request."
        >
          <Textarea
            id="reject-reason"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Document why this request is being rejected…"
          />
        </SheetSection>
      </FormDrawer>
    </>
  );
}
