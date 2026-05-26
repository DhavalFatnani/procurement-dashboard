import { Role } from "@prisma/client";

import { UsersView } from "@/components/admin/UsersView";
import { dbParallel } from "@/lib/db-parallel";
import { getUsers } from "@/lib/queries/users";
import { getWarehouseOptions } from "@/lib/queries/warehouses";
import { assertRole, getRequestSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  assertRole(await getRequestSession(), [Role.OPS_HEAD]);
  const sp = await searchParams;
  const search = str(sp.q);
  const role = str(sp.role) as Role | "";
  const warehouseId = str(sp.warehouseId);
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const includeExactCount = str(sp.exactCount) === "1" || page === 1;

  const [warehouses, rows] = await dbParallel(
    () => getWarehouseOptions(),
    () =>
      getUsers({
        search: search || undefined,
        role: role && role in Role ? (role as Role) : undefined,
        warehouseId: warehouseId || undefined,
        page,
        includeExactCount,
      }),
  );

  return (
    <UsersView
      initialRows={rows}
      warehouses={warehouses}
      filters={{
        search,
        role,
        warehouseId,
      }}
    />
  );
}
