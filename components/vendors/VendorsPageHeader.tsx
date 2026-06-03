import { Role } from "@/lib/prisma-enums";

import { PageHeader } from "@/components/shared/PageHeader";
import { listBreadcrumbs } from "@/lib/lineage";

export function VendorsPageHeader({ role }: { role: Role }) {
  const canManage = role === Role.OPS_HEAD;
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
