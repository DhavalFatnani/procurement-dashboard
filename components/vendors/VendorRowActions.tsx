"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { deactivateVendor } from "@/app/actions/vendors";
import type { VendorListRow } from "@/lib/queries/vendors";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VendorRowActions({
  row,
  onDeactivated,
}: {
  row: VendorListRow;
  /** Optimistically flip this row to INACTIVE before the server confirms. */
  onDeactivated?: (id: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  if (row.status === "INACTIVE") {
    return (
      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <Link href={`/vendors/${row.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          View
        </Link>
        <Link href={`/vendors/${row.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Edit
        </Link>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      <Link href={`/vendors/${row.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        View
      </Link>
      <Link href={`/vendors/${row.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        Edit
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={pending}
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Deactivate
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Deactivate ${row.businessName}?`}
        description="This prevents future purchases but keeps all history intact."
        confirmLabel="Deactivate"
        confirmVariant="destructive"
        pending={pending}
        onConfirm={() => {
          startTransition(async () => {
            onDeactivated?.(row.id); // optimistic — auto-reverts if the action fails
            const r = await deactivateVendor(row.id);
            if (r.ok) {
              toast.success("Vendor deactivated.");
              router.refresh();
            } else {
              toast.error(r.message ?? "Failed to deactivate vendor.");
            }
          });
        }}
      />
    </div>
  );
}
