import { ModulePlaceholder } from "@/components/shared/ModulePlaceholder";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

export default async function InvoicesPage() {
  await checkRole([...ACCESS.invoices]);

  return (
    <ModulePlaceholder
      title="Invoices"
      subtitle="Upload invoices, GRN linkage, and three-way match status."
    />
  );
}
