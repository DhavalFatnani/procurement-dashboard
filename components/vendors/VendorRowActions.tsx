"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { deactivateVendor, type VendorListRow } from "@/app/actions/vendors";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VendorRowActions({ row }: { row: VendorListRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

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
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Deactivate
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Deactivate ${row.businessName}?`}
        description="This prevents future purchases but keeps all history intact."
        confirmLabel="Deactivate"
        confirmVariant="destructive"
        onConfirm={() => {
          startTransition(async () => {
            const r = await deactivateVendor(row.id);
            if (r.ok) {
              toast.success("Vendor deactivated.");
              router.refresh();
            }
          });
        }}
      />
    </div>
  );
}
