import { notFound } from "next/navigation";

import { VendorDetailView } from "@/components/vendors/VendorDetailView";
import { getVendorById } from "@/lib/queries/vendors";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.vendors]);
  const { id } = await params;
  const sp = await searchParams;
  const poPage = Math.max(1, Number(typeof sp.poPage === "string" ? sp.poPage : "1") || 1);

  const vendor = await getVendorById(id, { poPage });
  if (!vendor) {
    notFound();
  }

  return <VendorDetailView vendor={vendor} role={user.role} key={poPage} />;
}
