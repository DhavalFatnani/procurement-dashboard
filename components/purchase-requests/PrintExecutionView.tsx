"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { generateSerialCSV, generateSerialLabelTxt } from "@/app/actions/serial";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PrintExecutionView({
  prId,
  reservation,
}: {
  prId: string;
  reservation: {
    id: string;
    series: string;
    rangeStart: string;
    rangeEnd: string;
    quantity: number;
    warehouseName: string;
    createdByName: string;
    createdAt: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function downloadCsv() {
    startTransition(async () => {
      const csv = await generateSerialCSV(reservation.id);
      if (!csv) {
        toast.error("Could not generate CSV.");
        return;
      }
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prId}-serials.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded.");
    });
  }

  function copyLabels() {
    startTransition(async () => {
      const txt = await generateSerialLabelTxt(reservation.id);
      if (!txt) {
        toast.error("Could not generate labels.");
        return;
      }
      await navigator.clipboard.writeText(txt);
      toast.success("Label text copied to clipboard.");
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Print execution"
        subtitle={`PR ${prId} — ${reservation.series}`}
        action={
          <Link
            href={`/purchase-requests/${prId}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back to PR
          </Link>
        }
      />

      <div className="rounded-xl border bg-card p-6 text-sm space-y-3">
        <p>
          <span className="text-muted-foreground">Reserved range: </span>
          <span className="font-mono">
            {reservation.rangeStart} → {reservation.rangeEnd}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">Quantity: </span>
          {reservation.quantity}
        </p>
        <p>
          <span className="text-muted-foreground">Warehouse: </span>
          {reservation.warehouseName}
        </p>
        <p>
          <span className="text-muted-foreground">Reserved by: </span>
          {reservation.createdByName}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={downloadCsv}>
          Download CSV
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={copyLabels}>
          Copy label text
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/serial-governance")}>
          Serial governance
        </Button>
      </div>
    </div>
  );
}
