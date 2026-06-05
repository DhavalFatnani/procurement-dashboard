"use client";

import { Role } from "@/lib/prisma-enums";
import { Key, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { getUserById, sendPasswordReset } from "@/app/actions/users";
import { RecoveryLinkDialog } from "@/components/admin/RecoveryLinkDialog";
import { UserFormDrawer } from "@/components/admin/UserFormDrawer";
import { Avatar } from "@/components/shared/Avatar";
import { Chip } from "@/components/shared/Chip";
import {
  DataTable,
  getRowId,
  type DataTableColumn,
} from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterChipsRow } from "@/components/shared/FilterChipsRow";
import { FilterSearch } from "@/components/shared/FilterSearch";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import type { WarehouseOption } from "@/lib/format-warehouse";
import { formatDateMedium } from "@/lib/format-datetime";
import { ROLE_LABELS } from "@/lib/navigation";
import type { Paginated } from "@/lib/pagination";
import type { UserDetail, UserListRow } from "@/lib/queries/users";

const ROLE_TONE: Record<Role, "info" | "accent" | "neutral"> = {
  [Role.SM]: "neutral",
  [Role.OPS_HEAD]: "info",
  [Role.FINANCE]: "accent",
};

export function UsersView({
  initialRows,
  filters,
  warehouses,
}: {
  initialRows: Paginated<UserListRow>;
  filters: {
    search: string;
    role: string;
    warehouseId: string;
  };
  warehouses: WarehouseOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rows = initialRows;

  const [drawerMode, setDrawerMode] = React.useState<
    | { kind: "create" }
    | { kind: "edit"; user: UserDetail }
    | null
  >(null);
  const [recoveryLinkDialog, setRecoveryLinkDialog] = React.useState<{
    email: string;
    link: string;
  } | null>(null);

  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    router.replace(qs ? `/admin/users?${qs}` : "/admin/users", { scroll: false });
  }

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["q", "role", "warehouseId"]) {
      const v = String(fd.get(key) ?? "").trim();
      if (v) params.set(key, v);
    }
    navigate(params);
  }

  function clearFilter(key: "q" | "role" | "warehouseId") {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    params.delete("page");
    navigate(params);
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    if (page > 1) params.set("exactCount", "1");
    navigate(params);
  }

  async function openEdit(id: string) {
    const detail = await getUserById(id);
    if (!detail) {
      toast.error("User not found.");
      return;
    }
    setDrawerMode({ kind: "edit", user: detail });
  }

  async function handleResetPassword(row: UserListRow) {
    const res = await sendPasswordReset(row.id);
    if (res.ok && res.recoveryLink) {
      setRecoveryLinkDialog({ email: row.email, link: res.recoveryLink });
      toast.success(res.message ?? "Recovery link ready.");
    } else if (res.ok) {
      toast.success(res.message ?? "Done.");
    } else {
      toast.error(res.message ?? "Failed to generate recovery link.");
    }
  }

  const warehouse = filters.warehouseId
    ? warehouses.find((w) => w.id === filters.warehouseId)
    : null;

  const chipSpecs: FilterChipSpec[] = compactChipSpecs([
    filters.search && {
      key: "q",
      tone: "neutral",
      label: `Search: "${filters.search}"`,
      onClear: () => clearFilter("q"),
    },
    filters.role && {
      key: "role",
      tone: ROLE_TONE[filters.role as Role] ?? "neutral",
      label: `Role: ${ROLE_LABELS[filters.role as Role] ?? filters.role}`,
      onClear: () => clearFilter("role"),
    },
    warehouse && {
      key: "warehouseId",
      tone: "neutral",
      label: `Warehouse: ${warehouse.label}`,
      onClear: () => clearFilter("warehouseId"),
    },
  ]);

  const columns: DataTableColumn<UserListRow>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (r) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-left hover:underline"
            onClick={() => void openEdit(r.id)}
          >
            <Avatar name={r.name} size="sm" />
            <span className="font-medium text-foreground">{r.name}</span>
          </button>
        ),
      },
      { id: "email", header: "Email", cell: (r) => r.email },
      {
        id: "role",
        header: "Role",
        cell: (r) => (
          <Chip tone={ROLE_TONE[r.role]} showDot>
            {ROLE_LABELS[r.role]}
          </Chip>
        ),
      },
      { id: "warehouse", header: "Warehouses", cell: (r) => r.warehouseLabel },
      {
        id: "createdAt",
        header: "Joined",
        variant: "date",
        cell: (r) => formatDateMedium(r.createdAt),
      },
      {
        id: "actions",
        header: "",
        revealOnHover: true,
        cell: (r) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 px-2"
              onClick={() => void openEdit(r.id)}
            >
              <Pencil className="size-3" strokeWidth={1.5} aria-hidden />
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 px-2"
              onClick={() => void handleResetPassword(r)}
            >
              <Key className="size-3" strokeWidth={1.5} aria-hidden />
              Reset password
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Provision and manage dashboard accounts. Roles drive access across all modules."
        action={
          <Button onClick={() => setDrawerMode({ kind: "create" })}>
            <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
            Add user
          </Button>
        }
      />

      <form onSubmit={handleFilterSubmit}>
        <FilterBar
          resultCount={rows.total ?? undefined}
          activeChips={
            chipSpecs.length > 0 ? (
              <FilterChipsRow
                chips={chipSpecs}
                onClearAll={() => navigate(new URLSearchParams())}
              />
            ) : undefined
          }
        >
          <FilterSearch
            name="q"
            defaultValue={filters.search}
            placeholder="Name or email"
            ariaLabel="Search users"
            width="w-[240px]"
          />
          <FilterSelect
            name="role"
            defaultValue={filters.role}
            placeholder="All roles"
            ariaLabel="Role"
            triggerClassName="w-[160px]"
            options={Object.values(Role).map((r) => ({
              value: r,
              label: ROLE_LABELS[r],
            }))}
          />
          <FilterSelect
            name="warehouseId"
            defaultValue={filters.warehouseId}
            placeholder="All warehouses"
            ariaLabel="Warehouse"
            triggerClassName="w-[180px]"
            options={warehouses.map((w) => ({ value: w.id, label: w.label }))}
          />
          <Button type="submit" size="sm" className="h-8">
            Apply
          </Button>
        </FilterBar>
      </form>

      {rows.items.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Adjust filters or add a new user to get started."
          icon={MoreHorizontal}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows.items}
            getRowKey={getRowId}
            onRowClick={(r) => void openEdit(r.id)}
          />
          <Pagination
            basePath="/admin/users"
            page={rows.page}
            pageSize={rows.pageSize}
            total={rows.total}
            totalPages={rows.totalPages}
            hasNextPage={rows.hasNextPage}
            onPageChange={handlePageChange}
            searchParams={{
              q: filters.search || undefined,
              role: filters.role || undefined,
              warehouseId: filters.warehouseId || undefined,
            }}
          />
        </>
      )}

      <UserFormDrawer
        open={drawerMode != null}
        onOpenChange={(open) => {
          if (!open) setDrawerMode(null);
        }}
        warehouses={warehouses}
        mode={drawerMode ?? { kind: "create" }}
        onSaved={() => router.refresh()}
        onRecoveryLink={(email, link) => setRecoveryLinkDialog({ email, link })}
      />

      {recoveryLinkDialog ? (
        <RecoveryLinkDialog
          open
          onOpenChange={(open) => {
            if (!open) setRecoveryLinkDialog(null);
          }}
          email={recoveryLinkDialog.email}
          link={recoveryLinkDialog.link}
        />
      ) : null}
    </div>
  );
}
