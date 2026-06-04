"use client";

import { Loader2 } from "lucide-react";
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
  /**
   * Async in progress: disables both buttons and shows a spinner on confirm so
   * the click registers immediately. Pair with `closeOnConfirm={false}` and
   * close the dialog yourself once the work resolves.
   */
  pending?: boolean;
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
  pending = false,
}: ConfirmDialogProps) {
  const busy = confirmDisabled || pending;
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
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant === "destructive" ? "destructive" : "default"}
            disabled={busy}
            onClick={() => {
              onConfirm();
              if (closeOnConfirm) {
                onOpenChange(false);
              }
            }}
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} aria-hidden />
                {confirmLabel}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
