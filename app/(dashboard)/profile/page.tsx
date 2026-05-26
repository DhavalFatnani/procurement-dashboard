import { notFound } from "next/navigation";

import { ProfileView } from "@/components/profile/ProfileView";
import { getCurrentUserProfile } from "@/lib/queries/profile";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.profile]);
  const profile = await getCurrentUserProfile(user.id);

  if (!profile) {
    notFound();
  }

  return <ProfileView profile={profile} />;
}
