"use client";

import { UserStatus } from "@/lib/prisma-enums";
import { Key, Pencil, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { deactivateUser, deleteUser, reactivateUser } from "@/app/actions/users";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { UserListRow } from "@/lib/queries/users";

export type UserRowResolveOutcome = "deactivated" | "reactivated" | "deleted";

export function UserRowActions({
  row,
  currentUserId,
  canDelete = false,
  onEdit,
  onResetPassword,
  onResolved,
}: {
  row: UserListRow;
  currentUserId: string;
  canDelete?: boolean;
  onEdit: () => void;
  onResetPassword: (row: UserListRow) => void | Promise<void>;
  onResolved?: (id: string, outcome: UserRowResolveOutcome) => void;
}) {
  const isSelf = row.id === currentUserId;
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [reactivateOpen, setReactivateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function runAction(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    onSuccess: () => void,
  ) {
    setBusy(true);
    try {
      const r = await fn();
      if (r.ok) {
        onSuccess();
      } else {
        toast.error(r.message ?? "Action failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1 px-2"
        disabled={busy}
        onClick={onEdit}
      >
        <Pencil className="size-3" strokeWidth={1.5} aria-hidden />
        Edit
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1 px-2"
        disabled={busy || row.status === UserStatus.INACTIVE}
        onClick={() => void onResetPassword(row)}
      >
        <Key className="size-3" strokeWidth={1.5} aria-hidden />
        Reset password
      </Button>
      {row.status === UserStatus.ACTIVE ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || isSelf}
          title={isSelf ? "You cannot deactivate your own account." : undefined}
          onClick={() => setDeactivateOpen(true)}
        >
          Deactivate
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setReactivateOpen(true)}
        >
          Reactivate
        </Button>
      )}
      {canDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 px-2 text-destructive hover:text-destructive"
          disabled={busy || isSelf}
          title={isSelf ? "You cannot delete your own account." : undefined}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3" strokeWidth={1.5} aria-hidden />
          Delete
        </Button>
      ) : null}

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title={`Deactivate ${row.name}?`}
        description="They will be signed out and cannot sign in again. Procurement history is kept."
        confirmLabel="Deactivate"
        confirmVariant="destructive"
        onConfirm={() => {
          void runAction(
            () => deactivateUser(row.id),
            () => {
              toast.success("User deactivated.");
              setDeactivateOpen(false);
              onResolved?.(row.id, "deactivated");
            },
          );
        }}
      />
      <ConfirmDialog
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        title={`Reactivate ${row.name}?`}
        description="They can sign in again with their existing credentials."
        confirmLabel="Reactivate"
        onConfirm={() => {
          void runAction(
            () => reactivateUser(row.id),
            () => {
              toast.success("User reactivated.");
              setReactivateOpen(false);
              onResolved?.(row.id, "reactivated");
            },
          );
        }}
      />
      {canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Delete ${row.name}?`}
          description="Permanently removes this account. Only allowed when the user has no procurement history; otherwise deactivate instead."
          confirmLabel="Delete user"
          confirmVariant="destructive"
          onConfirm={() => {
            void runAction(
              () => deleteUser(row.id),
              () => {
                toast.success("User deleted.");
                setDeleteOpen(false);
                onResolved?.(row.id, "deleted");
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}
