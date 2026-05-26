"use client";

import { Building2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { WarehouseFormDrawer } from "@/components/admin/WarehouseFormDrawer";
import {
  DataTable,
  getRowId,
  type DataTableColumn,
} from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { formatDateMedium } from "@/lib/format-datetime";
import type { WarehouseRow } from "@/lib/queries/warehouses";

export function WarehousesView({ rows }: { rows: WarehouseRow[] }) {
  const router = useRouter();
  const [drawerMode, setDrawerMode] = React.useState<
    { kind: "create" } | { kind: "edit"; warehouse: WarehouseRow } | null
  >(null);

  const columns: DataTableColumn<WarehouseRow>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Warehouse",
        cell: (r) => <span className="font-medium text-foreground">{r.name}</span>,
      },
      { id: "location", header: "Location", cell: (r) => r.location },
      {
        id: "users",
        header: "Users",
        variant: "numeric",
        cell: (r) => r.userCount.toString(),
      },
      {
        id: "createdAt",
        header: "Created",
        variant: "date",
        cell: (r) => formatDateMedium(r.createdAt),
      },
      {
        id: "actions",
        header: "",
        revealOnHover: true,
        cell: (r) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 px-2"
              onClick={() => setDrawerMode({ kind: "edit", warehouse: r })}
            >
              <Pencil className="size-3" strokeWidth={1.5} aria-hidden />
              Edit
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
        title="Warehouses"
        subtitle="The operational network. Each user is assigned to a warehouse for SM scoping."
        action={
          <Button onClick={() => setDrawerMode({ kind: "create" })}>
            <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
            Add warehouse
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No warehouses yet"
          description="Add your first warehouse before provisioning Store Manager users."
          icon={Building2}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowKey={getRowId}
          onRowClick={(r) => setDrawerMode({ kind: "edit", warehouse: r })}
        />
      )}

      <WarehouseFormDrawer
        open={drawerMode != null}
        onOpenChange={(open) => {
          if (!open) setDrawerMode(null);
        }}
        mode={drawerMode ?? { kind: "create" }}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
