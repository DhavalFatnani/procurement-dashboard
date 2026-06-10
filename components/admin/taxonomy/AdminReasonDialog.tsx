"use client";

import * as React from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AdminReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
  pending?: boolean;
}) {
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      confirmLabel={confirmLabel}
      confirmVariant="destructive"
      closeOnConfirm={false}
      pending={pending}
      confirmDisabled={!reason.trim()}
      body={
        <div className="space-y-3">
          <p>{description}</p>
          <div className="space-y-2">
            <Label htmlFor="admin-reason">Reason</Label>
            <Textarea
              id="admin-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required — recorded in audit log"
            />
          </div>
        </div>
      }
      onConfirm={() => onConfirm(reason.trim())}
    />
  );
}
