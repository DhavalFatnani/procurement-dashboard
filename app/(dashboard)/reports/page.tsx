import { ReportsView } from "@/components/reports/ReportsView";
import { PageHeader } from "@/components/shared/PageHeader";
import { listBreadcrumbs } from "@/lib/lineage";
import { getReports } from "@/lib/queries/reports";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.reports]);
  const data = await getReports(assignedWarehouseIds(user));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={listBreadcrumbs("/reports")}
        title="Reports"
        subtitle="Cycle time, exceptions, payment ageing, and vendor exposure."
      />
      <ReportsView data={data} />
    </div>
  );
}
