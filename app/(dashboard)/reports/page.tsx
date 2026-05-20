import { ModulePlaceholder } from "@/components/shared/ModulePlaceholder";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

export default async function ReportsPage() {
  await checkRole([...ACCESS.reports]);

  return (
    <ModulePlaceholder
      title="Reports"
      subtitle="Role-filtered exports for PR history, PO history, payments, and serial usage."
    />
  );
}
