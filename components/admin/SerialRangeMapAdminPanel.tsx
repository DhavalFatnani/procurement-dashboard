"use client";

import * as React from "react";
import { toast } from "sonner";

import { adminReleaseSerialReservation } from "@/app/actions/serial-admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useServerMutation } from "@/lib/use-server-mutation";

export function SerialRangeMapAdminPanel({
  reservationId,
  rangeLabel,
  onDone,
}: {
  reservationId: string;
  rangeLabel: string;
  onDone: () => void;
}) {
  const { isPending, run } = useServerMutation();
  const [reason, setReason] = React.useState("");

  return (
    <div className="mt-4 rounded-md border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/5 p-4">
      <p className="text-ds-sm font-medium">Admin override</p>
      <p className="mt-1 text-ds-xs text-muted-foreground">
        Soft-release reservation {rangeLabel}. Action is audit-logged.
      </p>
      <Textarea
        className="mt-3"
        rows={2}
        placeholder="Reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending || !reason.trim()}
          onClick={() => {
            void run(() => adminReleaseSerialReservation(reservationId, reason.trim()), {
              onSuccess: () => {
                toast.success("Reservation released.");
                setReason("");
                onDone();
              },
              onError: (msg) => toast.error(msg),
            });
          }}
        >
          Release range
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            window.location.href = "/admin/platform/serial";
          }}
        >
          Open serial control
        </Button>
      </div>
    </div>
  );
}
