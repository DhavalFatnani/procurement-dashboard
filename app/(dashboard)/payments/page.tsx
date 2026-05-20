import { ModulePlaceholder } from "@/components/shared/ModulePlaceholder";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

export default async function PaymentsPage() {
  await checkRole([...ACCESS.payments]);

  return (
    <ModulePlaceholder
      title="Payments"
      subtitle="Finance payment updates with match gates and vendor bank verification."
    />
  );
}
