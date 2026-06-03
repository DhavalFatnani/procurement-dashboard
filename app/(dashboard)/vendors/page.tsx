import { Suspense } from "react";
import { Role, type VendorStatus } from "@/lib/prisma-enums";

import { VendorsPageHeader } from "@/components/vendors/VendorsPageHeader";
import { VendorsTableSection } from "@/components/vendors/VendorsTableSection";
import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { DEFAULT_PAGE_SIZE, type Paginated } from "@/lib/pagination";
import type { VendorListRow } from "@/lib/queries/vendors";
import { getPendingVendorRequests, getVendors } from "@/lib/queries/vendors";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseStatus(value: string | undefined): VendorStatus | "ALL" {
  if (value === "ACTIVE" || value === "INACTIVE") {
    return value;
  }
  return "ALL";
}

const emptyVendors: Paginated<VendorListRow> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  totalPages: 1,
  hasNextPage: false,
};

export default async function VendorsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = assertRole(await getRequestSession(), [...ACCESS.vendors]);
  const sp = await searchParams;

  const tabRaw = typeof sp.tab === "string" ? sp.tab : "all";
  const tab =
    user.role === Role.OPS_HEAD && tabRaw === "pending" ? "pending" : ("all" as const);

  const q = typeof sp.q === "string" ? sp.q : "";
  const statusFilter = parseStatus(typeof sp.status === "string" ? sp.status : undefined);
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);
  const openAddVendor = sp.addVendor === "1";
  const includeExactCount = sp.exactCount === "1";

  return (
    <div className="space-y-6">
      <VendorsPageHeader role={user.role} />
      <Suspense
        fallback={<PageTableLoading columns={7} rows={10} />}
        key={`${tab}-${q}-${statusFilter}-${page}-${includeExactCount}`}
      >
        <VendorsTableLoader
          role={user.role}
          tab={tab}
          search={q}
          statusFilter={statusFilter}
          page={page}
          openAddVendor={openAddVendor}
          includeExactCount={includeExactCount}
        />
      </Suspense>
    </div>
  );
}

async function VendorsTableLoader({
  role,
  tab,
  search,
  statusFilter,
  page,
  openAddVendor,
  includeExactCount,
}: {
  role: Role;
  tab: "all" | "pending";
  search: string;
  statusFilter: VendorStatus | "ALL";
  page: number;
  openAddVendor: boolean;
  includeExactCount: boolean;
}) {
  const vendors =
    tab === "all"
      ? await getVendors({ search, status: statusFilter, page, includeExactCount })
      : emptyVendors;
  const pendingRequests =
    role === Role.OPS_HEAD && tab === "pending"
      ? await getPendingVendorRequests()
      : [];

  return (
    <VendorsTableSection
      role={role}
      tab={tab}
      initialVendors={vendors}
      pendingRequests={pendingRequests}
      search={search}
      statusFilter={statusFilter}
      openAddVendor={openAddVendor}
    />
  );
}
