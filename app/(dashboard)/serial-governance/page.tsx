import { ModulePlaceholder } from "@/components/shared/ModulePlaceholder";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

export default async function SerialGovernancePage() {
  await checkRole([...ACCESS.serialGovernance]);

  return (
    <ModulePlaceholder
      title="Serial governance"
      subtitle="Series overview, reservations, print history, and ceiling configuration."
    />
  );
}
