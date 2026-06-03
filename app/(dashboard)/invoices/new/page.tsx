import { CreateInvoiceForm } from "@/components/invoices/CreateInvoiceForm";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { Role } from "@/lib/prisma-enums";
import { redirect } from "next/navigation";

export default async function NewInvoicePage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.invoices]);
  if (user.role === Role.FINANCE) {
    redirect("/invoices");
  }

  return <CreateInvoiceForm />;
}
