import { PlatformControlView } from "@/components/admin/PlatformControlView";
import { getRecentAdminAuditLogs } from "@/lib/admin-audit";
import { getSerialRepairQueue } from "@/lib/serial-admin";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPlatformPage() {
  assertRole(await getRequestSession(), [...ACCESS.adminPlatform]);

  const [auditLogs, repairQueue] = await Promise.all([
    getRecentAdminAuditLogs(30),
    getSerialRepairQueue(50),
  ]);

  return <PlatformControlView auditLogs={auditLogs} repairCount={repairQueue.length} />;
}
