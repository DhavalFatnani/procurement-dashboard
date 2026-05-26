"use client";

import { Role } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import {
  DetailPageShell,
  DetailSideCard,
} from "@/components/shared/DetailPageShell";
import {
  Tabs,
  TabsContent,
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

function parseTab(value: string | null): TabId {
  if (value === "summary" || value === "fulfillment" || value === "financials" || value === "activity") {
    return value;
  }
  return "summary";
}

export function PODetailPageShell({
  po,
  role,
}: {
  po: PODetail;
  role: Role;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "summary") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(
      qs ? `/purchase-orders/${po.id}?${qs}` : `/purchase-orders/${po.id}`,
      { scroll: false },
    );
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
        body={
          <>
            <TabsContent value="summary">
              <PODetailSummaryTab po={po} role={role} />
            </TabsContent>
            <TabsContent value="fulfillment">
              <PODetailFulfillmentTab po={po} role={role} />
            </TabsContent>
            <TabsContent value="financials">
              <PODetailFinancialsTab po={po} role={role} />
            </TabsContent>
            <TabsContent value="activity">
              <PODetailActivityTab po={po} />
            </TabsContent>
          </>
        }
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
