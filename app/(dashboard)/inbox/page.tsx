import { InboxView } from "@/components/inbox/InboxView";
import { getInboxForSession } from "@/lib/queries/inbox";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

export default async function InboxPage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.inbox]);

  const data = await getInboxForSession(user);

  return <InboxView role={user.role} data={data} />;
}
