import { isCentralOpsOrAbove } from "@/lib/admin-access";
import { Role } from "@/lib/prisma-enums";

import { PageHeader } from "@/components/shared/PageHeader";
import { listBreadcrumbs } from "@/lib/lineage";

export function VendorsPageHeader({ role }: { role: Role }) {
  const canManage = isCentralOpsOrAbove(role);
  return (
    <PageHeader
      breadcrumbs={listBreadcrumbs("/vendors")}
      title="Vendors"
      subtitle={
        canManage
          ? "Manage vendor master data, bank details, and pending activation requests."
          : "View-only directory of approved vendors."
      }
    />
  );
}
