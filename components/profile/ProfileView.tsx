"use client";

import { Role } from "@/lib/prisma-enums";
import { KeyRound, Mail, Shield, UserRound, Warehouse } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { signOut } from "@/app/actions/sign-out";
import {
  changeOwnPassword,
  sendOwnPasswordResetEmail,
  updateProfileName,
} from "@/app/actions/profile";
import { Avatar } from "@/components/shared/Avatar";
import { Chip } from "@/components/shared/Chip";
import { PageHeader } from "@/components/shared/PageHeader";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateMedium } from "@/lib/format-datetime";
import { formatWarehouseLabel } from "@/lib/format-warehouse";
import { ROLE_LABELS } from "@/lib/navigation";
import type { UserProfile } from "@/lib/queries/profile";
import { roleUsesMultiWarehouseAssignment } from "@/lib/warehouse-scope";

const ROLE_TONE: Record<Role, "info" | "accent" | "neutral"> = {
  [Role.SM]: "neutral",
  [Role.OPS_HEAD]: "info",
  [Role.FINANCE]: "accent",
};

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-ds-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-ds-sm text-foreground" : "text-ds-sm text-foreground"}>
        {value}
      </dd>
    </div>
  );
}

export function ProfileView({ profile }: { profile: UserProfile }) {
  const [name, setName] = React.useState(profile.name);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [namePending, startNameTransition] = React.useTransition();
  const [passwordPending, startPasswordTransition] = React.useTransition();
  const [resetPending, startResetTransition] = React.useTransition();

  const multiWarehouse = roleUsesMultiWarehouseAssignment(profile.role);

  function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    startNameTransition(async () => {
      const res = await updateProfileName(name);
      if (res.ok) {
        toast.success("Display name updated.");
      } else {
        toast.error(res.message ?? "Could not update name.");
      }
    });
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    startPasswordTransition(async () => {
      const res = await changeOwnPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (res.ok) {
        toast.success(res.message ?? "Password updated.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.message ?? "Could not update password.");
      }
    });
  }

  function handleResetEmail() {
    startResetTransition(async () => {
      const res = await sendOwnPasswordResetEmail();
      if (res.ok) {
        toast.success(res.message ?? "Reset email sent.");
      } else {
        toast.error(res.message ?? "Could not send reset email.");
      }
    });
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Profile"
        subtitle="Manage your account, security, and preferences."
      />

      <Card size="sm" className="overflow-hidden">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <Avatar name={profile.name} size="lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-ds-md font-semibold text-foreground">{profile.name}</h2>
              <Chip tone={ROLE_TONE[profile.role]} size="sm">
                {ROLE_LABELS[profile.role]}
              </Chip>
            </div>
            <p className="truncate text-ds-sm text-muted-foreground" title={profile.email}>
              {profile.email}
            </p>
            <p className="text-ds-xs text-muted-foreground">
              Member since {formatDateMedium(profile.createdAt)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4" strokeWidth={1.5} aria-hidden />
              Account
            </CardTitle>
            <CardDescription>
              Your sign-in identity and procurement role. Contact an Ops Head to change role or
              warehouse access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Email" value={profile.email} />
              <DetailRow label="Role" value={ROLE_LABELS[profile.role]} />
              <DetailRow label="User ID" value={profile.id} mono />
              <DetailRow label="Joined" value={formatDateMedium(profile.createdAt)} />
            </dl>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="size-4" strokeWidth={1.5} aria-hidden />
              {multiWarehouse ? "Warehouse access" : "Warehouse"}
            </CardTitle>
            <CardDescription>
              {multiWarehouse
                ? "Warehouses you can work across in procurement workflows."
                : "Your assigned store for purchase requests and goods receipt."}{" "}
              Names are managed under Admin → Warehouses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.warehouses.length === 0 ? (
              <p className="text-ds-sm text-muted-foreground">
                No warehouse assigned yet. Ask an Ops Head to update your profile.
              </p>
            ) : (
              <ul className="space-y-3">
                {profile.warehouses.map((warehouse) => (
                  <li
                    key={warehouse.id}
                    className="rounded-lg border border-border-subtle px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">
                        {formatWarehouseLabel(warehouse.name, warehouse.location)}
                      </p>
                      {warehouse.isPrimary ? (
                        <Chip tone="neutral" size="sm" variant="outline">
                          Primary
                        </Chip>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Display name</CardTitle>
            <CardDescription>
              Shown in the sidebar, dashboard greeting, and activity logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNameSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-ds-sm font-medium" htmlFor="profile-name">
                  Full name
                </label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={120}
                  required
                />
              </div>
              <Button type="submit" disabled={namePending || name.trim() === profile.name}>
                {namePending ? "Saving…" : "Save name"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-4" strokeWidth={1.5} aria-hidden />
              Security
            </CardTitle>
            <CardDescription>
              Update your password while signed in, or request a reset link by email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handlePasswordSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-ds-sm font-medium" htmlFor="current-password">
                  Current password
                </label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-ds-sm font-medium" htmlFor="new-password">
                  New password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-ds-sm font-medium" htmlFor="confirm-password">
                  Confirm new password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" disabled={passwordPending}>
                <KeyRound className="size-3.5" strokeWidth={1.5} aria-hidden />
                {passwordPending ? "Updating…" : "Update password"}
              </Button>
            </form>

            <div className="rounded-lg border border-border-subtle bg-muted/30 px-4 py-3">
              <p className="text-ds-sm font-medium text-foreground">Forgot your password?</p>
              <p className="mt-1 text-ds-xs text-muted-foreground">
                We&apos;ll email a secure link to {profile.email}.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={resetPending}
                onClick={handleResetEmail}
              >
                <Mail className="size-3.5" strokeWidth={1.5} aria-hidden />
                {resetPending ? "Sending…" : "Send reset link"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose how KNOT Procurement looks on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeToggle className="max-w-xs" />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Sign out of KNOT Procurement on this browser.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-ds-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{profile.email}</span>
            </p>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Log out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {profile.role === Role.OPS_HEAD ? (
        <p className="text-ds-xs text-muted-foreground">
          Manage other users from{" "}
          <Link href="/admin/users" className="text-primary underline-offset-4 hover:underline">
            Admin → Users
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
