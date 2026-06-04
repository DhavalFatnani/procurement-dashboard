"use client";

import { Role } from "@/lib/prisma-enums";
import { Map } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import type {
  SerialActivityRow,
  SeriesConfigSummary,
  SeriesUsageSummary,
  WarehouseSeriesSnapshot,
} from "@/lib/serial-governance-types";
import type { WarehouseOption } from "@/lib/format-warehouse";
import { SerialActivityTable } from "@/components/serial-governance/SerialActivityTable";
import { SerialAdvancedConfig } from "@/components/serial-governance/SerialAdvancedConfig";
import {
  SerialGovernanceFilters,
  type SerialGovernanceFiltersValue,
} from "@/components/serial-governance/SerialGovernanceFilters";
import { SerialGovernanceListClient } from "@/components/serial-governance/SerialGovernanceListClient";
import { SerialSearchPanel } from "@/components/serial-governance/SerialSearchPanel";
import { SerialSummaryTab } from "@/components/serial-governance/SerialSummaryTab";
import { SerialWarehouseTab } from "@/components/serial-governance/SerialWarehouseTab";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/shared/Tabs";
import { listBreadcrumbs } from "@/lib/lineage";
import type { Paginated } from "@/lib/pagination";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "activity", label: "Activity" },
  { id: "warehouses", label: "By warehouse" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(value: string | null | undefined): TabId {
  if (value === "summary" || value === "activity" || value === "warehouses") {
    return value;
  }
  return "summary";
}

function tabParamsFor(next: TabId, current: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  if (next === "summary") {
    params.delete("tab");
  } else {
    params.set("tab", next);
  }
  if (next !== "activity") {
    params.delete("page");
    params.delete("series");
    params.delete("type");
    params.delete("warehouseId");
    params.delete("dateFrom");
    params.delete("dateTo");
    params.delete("batch");
    params.delete("exactCount");
  }
  return params;
}

export function SerialGovernanceView({
  role,
  initialTab,
  usageSummary,
  activity,
  warehouseSnapshots,
  seriesConfigs,
  filters,
  filterOptions,
}: {
  role: Role;
  initialTab: string;
  usageSummary: SeriesUsageSummary[];
  activity: Paginated<SerialActivityRow>;
  warehouseSnapshots: WarehouseSeriesSnapshot[];
  seriesConfigs: SeriesConfigSummary[];
  filters: SerialGovernanceFiltersValue & { page: number; batch: string };
  filterOptions: { warehouses: WarehouseOption[] };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();
  const isOps = role === Role.OPS_HEAD;

  const [activeTab, setActiveTab] = React.useState<TabId>(() => parseTab(initialTab));

  React.useEffect(() => {
    setActiveTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  function setTab(next: TabId) {
    setActiveTab(next);
    const params = tabParamsFor(next, searchParams);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/serial-governance?${qs}` : "/serial-governance", {
        scroll: false,
      });
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={listBreadcrumbs("/serial-governance")}
        title="Serial governance"
        subtitle={
          isOps
            ? "Track serial pool usage and reservation history across warehouses."
            : "View serial usage and reserved ranges from print and receipt."
        }
        action={
          <Button
            render={<Link href="/serial-governance/range-map" />}
            variant="soft"
            size="sm"
            className="gap-1.5"
          >
            <Map className="size-3.5" strokeWidth={1.75} aria-hidden />
            Range map
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={(value) => setTab(parseTab(value))}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary">
          <SerialSummaryTab summaries={usageSummary} />
        </TabsContent>

        <TabsContent value="activity">
          <SerialGovernanceListClient>
            <div className="space-y-4">
              <SerialSearchPanel />
              <SerialGovernanceFilters filters={filters} filterOptions={filterOptions} />
              <SerialActivityTable
                activity={activity}
                highlightBatchId={filters.batch}
                filters={filters}
              />
              {isOps && seriesConfigs.length > 0 ? (
                <SerialAdvancedConfig configs={seriesConfigs} />
              ) : null}
            </div>
          </SerialGovernanceListClient>
        </TabsContent>

        <TabsContent value="warehouses">
          <SerialWarehouseTab snapshots={warehouseSnapshots} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
