import { CatalogItemStatus, Role } from "@/lib/prisma-enums";

import { CatalogView } from "@/components/admin/CatalogView";
import { dbParallel } from "@/lib/db-parallel";
import { getCatalogFilterOptions, getCatalogItems } from "@/lib/queries/catalog";
import { prisma } from "@/lib/prisma";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  assertRole(await getRequestSession(), [...ACCESS.admin]);
  const sp = await searchParams;
  const search = str(sp.q);
  const statusRaw = str(sp.status);
  const categoryId = str(sp.categoryId);
  const subcategoryId = str(sp.subcategoryId);
  const disputedVariantsOnly = str(sp.disputed) === "1";
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const includeExactCount = str(sp.exactCount) === "1" || page === 1;

  const status =
    statusRaw && statusRaw in CatalogItemStatus
      ? (statusRaw as CatalogItemStatus)
      : undefined;

  const [filterOptions, rows, pendingCount] = await dbParallel(
    () => getCatalogFilterOptions(),
    () =>
      getCatalogItems({
        search: search || undefined,
        status,
        categoryId: categoryId || undefined,
        subcategoryId: subcategoryId || undefined,
        disputedVariantsOnly: disputedVariantsOnly || undefined,
        page,
        includeExactCount,
      }),
    () =>
      prisma.catalogItem.count({
        where: { status: CatalogItemStatus.PENDING_APPROVAL },
      }),
  );

  return (
    <CatalogView
      initialRows={rows}
      pendingCount={pendingCount}
      filterOptions={filterOptions}
      filters={{
        search,
        status: statusRaw,
        categoryId,
        subcategoryId,
        disputedVariantsOnly,
      }}
    />
  );
}
