import { Role, type VendorStatus } from "@prisma/client";

import { getPendingVendorRequests, getVendors } from "@/app/actions/vendors";
import { VendorsView } from "@/components/vendors/VendorsView";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseStatus(value: string | undefined): VendorStatus | "ALL" {
  if (value === "ACTIVE" || value === "INACTIVE") {
    return value;
  }
  return "ALL";
}

export default async function VendorsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await checkRole([...ACCESS.vendors]);
  const sp = await searchParams;

  const tabRaw = typeof sp.tab === "string" ? sp.tab : "all";
  const tab =
    user.role === Role.OPS_HEAD && tabRaw === "pending" ? "pending" : ("all" as const);

  const q = typeof sp.q === "string" ? sp.q : "";
  const statusFilter = parseStatus(typeof sp.status === "string" ? sp.status : undefined);
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);

  const vendors =
    tab === "all"
      ? await getVendors({ search: q, status: statusFilter, page })
      : { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 };

  const pendingRequests =
    user.role === Role.OPS_HEAD && tab === "pending"
      ? await getPendingVendorRequests()
      : [];

  return (
    <VendorsView
      role={user.role}
      tab={tab}
      vendors={vendors}
      pendingRequests={pendingRequests}
      search={q}
      statusFilter={statusFilter}
    />
  );
}
