import { redirect } from "next/navigation";

import { redirectPaymentsLegacyPath } from "@/lib/finance-routes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PaymentsLegacyRedirectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  redirect(redirectPaymentsLegacyPath(sp) ?? "/payments/invoices");
}
