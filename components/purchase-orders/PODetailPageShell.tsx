"use client";

import { Role } from "@/lib/prisma-enums";
import * as React from "react";

import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import {
  DetailPageShell,
  DetailSideCard,
} from "@/components/shared/DetailPageShell";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/shared/Tabs";
import { PODetailActionBar } from "@/components/purchase-orders/PODetailActionBar";
import { PODetailActivityTab } from "@/components/purchase-orders/PODetailActivityTab";
import { PODetailClosureChecks } from "@/components/purchase-orders/PODetailClosureChecks";
import { PODetailFinancialsTab } from "@/components/purchase-orders/PODetailFinancialsTab";
import { PODetailFulfillmentTab } from "@/components/purchase-orders/PODetailFulfillmentTab";
import { PODetailHero } from "@/components/purchase-orders/PODetailHero";
import { PODetailNextActions } from "@/components/purchase-orders/PODetailNextActions";
import { PODetailProgress } from "@/components/purchase-orders/PODetailProgress";
import { PODetailSummaryTab } from "@/components/purchase-orders/PODetailSummaryTab";
import { poDetailBreadcrumbs } from "@/lib/lineage";
import {
  getApplicablePOActions,
  type PONextActionId,
} from "@/lib/po-next-actions";
import type { PODetail } from "@/lib/queries/purchase-orders";

type TabId = "summary" | "fulfillment" | "financials" | "activity";

const TABS: { id: TabId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "fulfillment", label: "Fulfillment" },
  { id: "financials", label: "Financials" },
  { id: "activity", label: "Activity" },
];

function parseTab(value: string | null | undefined): TabId {
  if (value === "summary" || value === "fulfillment" || value === "financials" || value === "activity") {
    return value;
  }
  return "summary";
}

function poDetailTabUrl(poId: string, tab: TabId): string {
  if (tab === "summary") {
    return `/purchase-orders/${poId}`;
  }
  return `/purchase-orders/${poId}?tab=${tab}`;
}

export function PODetailPageShell({
  po,
  role,
  initialTab,
}: {
  po: PODetail;
  role: Role;
  initialTab?: string | null;
}) {
  const [activeTab, setActiveTab] = React.useState<TabId>(() => parseTab(initialTab));
  const [visitedTabs, setVisitedTabs] = React.useState<Set<TabId>>(
    () => new Set([parseTab(initialTab)]),
  );

  React.useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const tab = parseTab(params.get("tab"));
      setActiveTab(tab);
      setVisitedTabs((prev) => new Set(prev).add(tab));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function setTab(next: string) {
    const tab = parseTab(next);
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set(prev).add(tab));
    window.history.replaceState(null, "", poDetailTabUrl(po.id, tab));
  }

  const breadcrumbs = poDetailBreadcrumbs({ poId: po.id, prId: po.prId });
  const actions = React.useMemo(
    () => getApplicablePOActions(po, role),
    [po, role],
  );

  // Lets PODetailActionBar register a callback the side-panel actions can
  // re-use so both surfaces share the same confirmation flow for mutate
  // actions (mark delivery complete, force close).
  const runMutateActionRef = React.useRef<(id: PONextActionId) => void>(() => {
    /* set by action bar mount */
  });

  const tabPanel = (
    <div className="mt-4 outline-none" role="tabpanel">
      {visitedTabs.has("summary") ? (
        <div hidden={activeTab !== "summary"}>
          <PODetailSummaryTab po={po} role={role} />
        </div>
      ) : null}
      {visitedTabs.has("fulfillment") ? (
        <div hidden={activeTab !== "fulfillment"}>
          <PODetailFulfillmentTab po={po} role={role} />
        </div>
      ) : null}
      {visitedTabs.has("financials") ? (
        <div hidden={activeTab !== "financials"}>
          <PODetailFinancialsTab po={po} role={role} />
        </div>
      ) : null}
      {visitedTabs.has("activity") ? (
        <div hidden={activeTab !== "activity"}>
          <PODetailActivityTab po={po} />
        </div>
      ) : null}
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={setTab}>
      <DetailPageShell
        hero={
          <div className="space-y-4">
            <Breadcrumbs items={breadcrumbs} />
            <PODetailHero po={po} />
          </div>
        }
        tabs={
          <TabsList className="border-b-0">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        }
        body={tabPanel}
        side={
          <>
            <DetailSideCard title="Progress">
              <PODetailProgress po={po} />
            </DetailSideCard>
            <DetailSideCard title="Closure checks">
              <PODetailClosureChecks po={po} />
            </DetailSideCard>
            <DetailSideCard title="Next actions">
              <PODetailNextActions
                actions={actions}
                onAction={(id) => runMutateActionRef.current(id)}
              />
            </DetailSideCard>
          </>
        }
        actionBar={
          actions.length > 0 ? (
            <PODetailActionBar
              poId={po.id}
              actions={actions}
              runMutateActionRef={runMutateActionRef}
            />
          ) : undefined
        }
        defaultSideOpen
      />
    </Tabs>
  );
}
