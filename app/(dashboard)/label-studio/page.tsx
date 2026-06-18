import { Suspense } from "react";

import { LabelStudioPage } from "@/components/label-studio/LabelStudioPage";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { isAdminRole, isCentralOpsOrAbove } from "@/lib/admin-access";

export default async function LabelStudioRoutePage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.labelStudio]);

  return (
    <Suspense fallback={<p className="text-ds-sm text-muted-foreground">Loading Label Studio…</p>}>
      <LabelStudioPage
        isAdmin={isAdminRole(user.role)}
        canManageSeries={isCentralOpsOrAbove(user.role)}
      />
    </Suspense>
  );
}
