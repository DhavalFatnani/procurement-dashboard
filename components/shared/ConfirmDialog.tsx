"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Rich modal body; takes precedence over `description` when set */
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  confirmVariant?: "default" | "destructive";
  confirmDisabled?: boolean;
  /** When false, caller closes the dialog after async work completes. Default true. */
  closeOnConfirm?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  confirmVariant = "default",
  confirmDisabled = false,
  closeOnConfirm = true,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {body ? (
            <div className="text-sm text-muted-foreground">{body}</div>
          ) : description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirmDisabled}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant === "destructive" ? "destructive" : "default"}
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm();
              if (closeOnConfirm) {
                onOpenChange(false);
              }
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
