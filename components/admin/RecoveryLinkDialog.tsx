"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RecoveryLinkDialog({
  open,
  onOpenChange,
  email,
  link,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  link: string;
}) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Recovery link copied.");
    } catch {
      toast.error("Could not copy — select the link and copy manually.");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Password reset link</AlertDialogTitle>
          <AlertDialogDescription>
            Share this one-time link with <span className="font-medium">{email}</span>.
            It opens the password setup page without sending email (avoids Supabase
            rate limits).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Input readOnly value={link} className="font-mono text-ds-xs" onFocus={(e) => e.target.select()} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          <Button type="button" onClick={() => void copyLink()}>
            Copy link
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
