"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  adminBlockSerialRangeAction,
  adminReleaseSerialReservation,
  adminReassignSerialReservationAction,
  adminSplitSerialReservationAction,
} from "@/app/actions/serial-admin";
import { PageHeader } from "@/components/shared/PageHeader";
import { SurfaceCard, SurfaceCardDescription, SurfaceCardTitle } from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SeriesCode } from "@/lib/series-codes";
import { useServerMutation } from "@/lib/use-server-mutation";

type RepairRow = {
  id: string;
  series: SeriesCode;
  seriesName: string;
  rangeStart: string;
  rangeEnd: string;
  quantity: number;
  status: string;
  purpose: string;
  warehouseName: string;
  prId: string | null;
  prStatus: string | null;
  poId: string | null;
  poStatus: string | null;
  updatedAt: string;
};

type BlockScope = "global" | "warehouse";

export function SerialAdminConsole({
  repairQueue,
  warehouses,
  seriesOptions,
}: {
  repairQueue: RepairRow[];
  warehouses: { id: string; name: string; location: string }[];
  seriesOptions: { code: SeriesCode; displayName: string }[];
}) {
  const router = useRouter();
  const { isPending, run } = useServerMutation();
  const [series, setSeries] = React.useState<SeriesCode>(
    seriesOptions[0]?.code ?? ("LOCK_TAGS" as SeriesCode),
  );
  const [rangeStart, setRangeStart] = React.useState("");
  const [rangeEnd, setRangeEnd] = React.useState("");
  const [blockScope, setBlockScope] = React.useState<BlockScope>("global");
  const [warehouseId, setWarehouseId] = React.useState(warehouses[0]?.id ?? "");
  const [blockReason, setBlockReason] = React.useState("");
  const [releaseReason, setReleaseReason] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [splitQty, setSplitQty] = React.useState("");
  const [splitReason, setSplitReason] = React.useState("");
  const [reassignPrId, setReassignPrId] = React.useState("");
  const [reassignPoId, setReassignPoId] = React.useState("");
  const [reassignReason, setReassignReason] = React.useState("");

  const selected = repairQueue.find((row) => row.id === selectedId) ?? null;

  async function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/users" },
          { label: "Platform control", href: "/admin/platform" },
          { label: "Serial control" },
        ]}
        title="Serial control"
        subtitle="Audited overrides for blocking, releasing, splitting, and reassigning serial reservations."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard
          header={
            <>
              <SurfaceCardTitle>Block range</SurfaceCardTitle>
              <SurfaceCardDescription>
                Block a serial range globally or for one warehouse. Global blocks apply everywhere;
                warehouse blocks only restrict that site.
              </SurfaceCardDescription>
            </>
          }
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  adminBlockSerialRangeAction({
                    series,
                    rangeStart,
                    rangeEnd,
                    scope: blockScope,
                    warehouseId: blockScope === "warehouse" ? warehouseId : null,
                    reason: blockReason,
                  }),
                {
                  onSuccess: () => {
                    toast.success("Range blocked.");
                    setBlockReason("");
                    void refresh();
                  },
                  onError: (msg) => toast.error(msg),
                },
              );
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="block-series">Series</Label>
                <select
                  id="block-series"
                  className="mt-1 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-ds-sm"
                  value={series}
                  onChange={(e) => setSeries(e.target.value as SeriesCode)}
                >
                  {seriesOptions.map(({ code, displayName }) => (
                    <option key={code} value={code}>
                      {displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="block-scope">Scope</Label>
                <select
                  id="block-scope"
                  className="mt-1 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-ds-sm"
                  value={blockScope}
                  onChange={(e) => setBlockScope(e.target.value as BlockScope)}
                >
                  <option value="global">All warehouses (global)</option>
                  <option value="warehouse">One warehouse</option>
                </select>
              </div>
              {blockScope === "warehouse" ? (
                <div className="sm:col-span-2">
                  <Label htmlFor="block-warehouse">Warehouse</Label>
                  <select
                    id="block-warehouse"
                    className="mt-1 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-ds-sm"
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} — {w.location}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <Label htmlFor="block-start">Range start</Label>
                <Input id="block-start" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="block-end">Range end</Label>
                <Input id="block-end" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="block-reason">Reason</Label>
              <Textarea
                id="block-reason"
                rows={2}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isPending}>
              Block range
            </Button>
          </form>
        </SurfaceCard>

        <SurfaceCard
          header={
            <>
              <SurfaceCardTitle>Repair queue</SurfaceCardTitle>
              <SurfaceCardDescription>
                Admin blocks and reservations linked to cancelled or force-closed documents.
              </SurfaceCardDescription>
            </>
          }
        >
          {repairQueue.length === 0 ? (
            <p className="text-ds-sm text-muted-foreground">Queue is empty.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {repairQueue.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-ds-sm transition-colors ${
                      selectedId === row.id
                        ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/5"
                        : "border-border-subtle hover:bg-foreground/[0.03]"
                    }`}
                  >
                    <p className="font-medium">
                      {row.seriesName} · {row.rangeStart} → {row.rangeEnd}
                    </p>
                    <p className="mt-0.5 text-ds-xs text-muted-foreground">
                      {row.purpose} · {row.status} · {row.warehouseName}
                      {row.prStatus ? ` · PR ${row.prStatus}` : ""}
                      {row.poStatus ? ` · PO ${row.poStatus}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>

      {selected ? (
        <SurfaceCard
          header={
            <>
              <SurfaceCardTitle>Selected reservation</SurfaceCardTitle>
              <SurfaceCardDescription>
                {selected.rangeStart} → {selected.rangeEnd} ({selected.quantity} numbers)
              </SurfaceCardDescription>
            </>
          }
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => adminReleaseSerialReservation(selected.id, releaseReason), {
                  onSuccess: () => {
                    toast.success("Reservation released.");
                    setReleaseReason("");
                    setSelectedId(null);
                    void refresh();
                  },
                  onError: (msg) => toast.error(msg),
                });
              }}
            >
              <p className="text-ds-sm font-medium">Release</p>
              <Textarea
                rows={2}
                placeholder="Reason"
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                required
              />
              <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
                Soft release
              </Button>
            </form>

            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () =>
                    adminSplitSerialReservationAction({
                      reservationId: selected.id,
                      splitQuantity: Number(splitQty),
                      reason: splitReason,
                    }),
                  {
                    onSuccess: () => {
                      toast.success("Reservation split.");
                      setSplitQty("");
                      setSplitReason("");
                      void refresh();
                    },
                    onError: (msg) => toast.error(msg),
                  },
                );
              }}
            >
              <p className="text-ds-sm font-medium">Split</p>
              <Input
                type="number"
                min={1}
                max={selected.quantity - 1}
                placeholder="Split quantity"
                value={splitQty}
                onChange={(e) => setSplitQty(e.target.value)}
              />
              <Textarea
                rows={2}
                placeholder="Reason"
                value={splitReason}
                onChange={(e) => setSplitReason(e.target.value)}
                required
              />
              <Button type="submit" variant="outline" size="sm" disabled={isPending}>
                Split range
              </Button>
            </form>

            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () =>
                    adminReassignSerialReservationAction({
                      reservationId: selected.id,
                      prId: reassignPrId.trim() || null,
                      poId: reassignPoId.trim() || null,
                      reason: reassignReason,
                    }),
                  {
                    onSuccess: () => {
                      toast.success("Reservation reassigned.");
                      setReassignPrId("");
                      setReassignPoId("");
                      setReassignReason("");
                      void refresh();
                    },
                    onError: (msg) => toast.error(msg),
                  },
                );
              }}
            >
              <p className="text-ds-sm font-medium">Reassign links</p>
              <Input
                placeholder="PR id (optional)"
                value={reassignPrId}
                onChange={(e) => setReassignPrId(e.target.value)}
              />
              <Input
                placeholder="PO id (optional)"
                value={reassignPoId}
                onChange={(e) => setReassignPoId(e.target.value)}
              />
              <Textarea
                rows={2}
                placeholder="Reason"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                required
              />
              <Button type="submit" variant="outline" size="sm" disabled={isPending}>
                Reassign
              </Button>
            </form>
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
