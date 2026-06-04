import { FinanceReportsView } from "@/components/reports/FinanceReportsView";
import { ReportsView } from "@/components/reports/ReportsView";
import { PageHeader } from "@/components/shared/PageHeader";
import { listBreadcrumbs } from "@/lib/lineage";
import { Role } from "@/lib/prisma-enums";
import { getFinanceReports } from "@/lib/queries/finance-reports";
import { getReports } from "@/lib/queries/reports";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.reports]);
  const scopeWarehouseIds = assignedWarehouseIds(user);

  if (user.role === Role.FINANCE) {
    const data = await getFinanceReports(scopeWarehouseIds);

    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={listBreadcrumbs("/reports")}
          title="Finance reports"
          subtitle="Payment ageing, vendor exposure, advance ledger, and settlement activity."
        />
        <FinanceReportsView data={data} />
      </div>
    );
  }

  const data = await getReports(scopeWarehouseIds);

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
