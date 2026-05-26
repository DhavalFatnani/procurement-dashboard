import { ReportsView } from "@/components/reports/ReportsView";
import { PageHeader } from "@/components/shared/PageHeader";
import { checkRole } from "@/lib/auth";
import { listBreadcrumbs } from "@/lib/lineage";
import { getReports } from "@/lib/queries/reports";
import { ACCESS } from "@/lib/route-access";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await checkRole([...ACCESS.reports]);
  const data = await getReports();

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
