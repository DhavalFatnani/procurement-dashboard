import { Role } from "@prisma/client";

import { InboxView } from "@/components/inbox/InboxView";
import { getInboxForSession } from "@/lib/queries/inbox";
import { assertRole, getRequestSession } from "@/lib/session";

export default async function InboxPage() {
  const user = assertRole(await getRequestSession(), [
    Role.SM,
    Role.OPS_HEAD,
    Role.FINANCE,
  ]);

  const data = await getInboxForSession(user);

  return <InboxView role={user.role} data={data} />;
}
