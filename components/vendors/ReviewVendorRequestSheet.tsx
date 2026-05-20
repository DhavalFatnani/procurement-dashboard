"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  reviewVendorRequest,
  type ActivateVendorFromRequestInput,
  type PendingVendorRequestRow,
} from "@/app/actions/vendors";
import { Button } from "@/components/ui/button";
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

const emptyBank: ActivateVendorFromRequestInput = {
  accountName: "",
  accountNumber: "",
  ifsc: "",
  bankName: "",
  address: "",
  gst: "",
};

export function ReviewVendorRequestSheet({ request }: { request: PendingVendorRequestRow }) {
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
          toast.success(action === "ACTIVATED" ? "Vendor activated." : "Request rejected.");
          setOpen(false);
          router.refresh();
        }
        return;
      }
      toast.error(result.message ?? "Review failed.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm">Review</Button>} />
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Review vendor request</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6 text-sm">
          <dl className="space-y-2">
            <div>
              <dt className="text-muted-foreground">Business name</dt>
              <dd className="font-medium">{request.businessName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">POC</dt>
              <dd>{request.pocName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{request.phone}</dd>
            </div>
            {request.linkedPRId ? (
              <div>
                <dt className="text-muted-foreground">Linked PR</dt>
                <dd>{request.linkedPRId}</dd>
              </div>
            ) : null}
          </dl>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="font-medium">Bank details (required to activate)</p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Account name</label>
              <Input
                value={bank.accountName}
                onChange={(e) => setBank((b) => ({ ...b, accountName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Account number</label>
              <Input
                value={bank.accountNumber}
                onChange={(e) => setBank((b) => ({ ...b, accountNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">IFSC</label>
              <Input value={bank.ifsc} onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Bank name</label>
              <Input
                value={bank.bankName}
                onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Address (optional)</label>
              <Input
                value={bank.address ?? ""}
                onChange={(e) => setBank((b) => ({ ...b, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">GST (optional)</label>
              <Input value={bank.gst ?? ""} onChange={(e) => setBank((b) => ({ ...b, gst: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reject-reason" className="text-sm font-medium">
              Rejection reason (required to reject)
            </label>
            <textarea
              id="reject-reason"
              className={fieldClass}
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="flex-1"
              disabled={
                pending ||
                !bank.accountName.trim() ||
                !bank.accountNumber.trim() ||
                !bank.ifsc.trim() ||
                !bank.bankName.trim()
              }
              onClick={() => run("ACTIVATED")}
            >
              Activate vendor
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={pending || !rejectReason.trim()}
              onClick={() => run("REJECTED")}
            >
              Reject
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
