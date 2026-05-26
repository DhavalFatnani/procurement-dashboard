import { redirect } from "next/navigation";

import { defaultLandingFor } from "@/lib/navigation";
import { getSessionUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  redirect(defaultLandingFor(user.role));
}
