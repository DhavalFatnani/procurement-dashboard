import { Role, UserStatus } from "@/lib/prisma-enums";

import { UsersView } from "@/components/admin/UsersView";
import { canDeleteUser } from "@/lib/admin-access";
import { dbParallel } from "@/lib/db-parallel";
import { getUsers } from "@/lib/queries/users";
import { getWarehouseOptions } from "@/lib/queries/warehouses";
import { ACCESS } from "@/lib/route-access";
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
  const user = assertRole(await getRequestSession(), [...ACCESS.adminUsers]);
  const sp = await searchParams;
  const search = str(sp.q);
  const role = str(sp.role) as Role | "";
  const statusRaw = str(sp.status);
  const status: UserStatus =
    statusRaw && statusRaw in UserStatus
      ? (statusRaw as UserStatus)
      : UserStatus.ACTIVE;
  const warehouseId = str(sp.warehouseId);
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const includeExactCount = str(sp.exactCount) === "1";

  const [warehouses, rows] = await dbParallel(
    () => getWarehouseOptions(),
    () =>
      getUsers({
        search: search || undefined,
        role: role && role in Role ? (role as Role) : undefined,
        status,
        warehouseId: warehouseId || undefined,
        page,
        includeExactCount,
      }),
  );

  return (
    <UsersView
      initialRows={rows}
      warehouses={warehouses}
      currentUserId={user.id}
      actorRole={user.role}
      canDeleteUser={canDeleteUser(user.role)}
      filters={{
        search,
        role,
        status,
        warehouseId,
      }}
    />
  );
}
