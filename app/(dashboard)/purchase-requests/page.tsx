import { PurchaseRequestsPageContent } from "@/components/purchase-requests/PurchaseRequestsPageContent";
import { parsePurchaseRequestPageParams } from "@/lib/list-search-params";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseRequests]);
  const sp = await searchParams;
  const parsed = parsePurchaseRequestPageParams(sp);

  const dataKey = [
    parsed.statuses.join(","),
    parsed.categoryId,
    parsed.subcategoryId,
    parsed.executionType,
    parsed.warehouseId,
    parsed.createdById,
    parsed.dateFrom,
    parsed.dateTo,
    parsed.page,
  ].join("|");

  return (
    <div className="space-y-6">
      <PurchaseRequestsPageContent user={user} parsed={parsed} dataKey={dataKey} />
    </div>
  );
}
