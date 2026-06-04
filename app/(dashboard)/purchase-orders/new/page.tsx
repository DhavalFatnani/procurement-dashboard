import { redirect } from "next/navigation";

type SearchParams = Promise<{ prId?: string }>;

/** Legacy route — redirects to /purchase-orders/configure. */
export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { prId: prIdRaw } = await searchParams;
  const prId = prIdRaw?.trim();
  if (prId) {
    redirect(`/purchase-orders/configure/${encodeURIComponent(prId)}`);
  }
  redirect("/purchase-orders/configure");
}
