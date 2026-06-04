import { CreateGRNForm } from "@/components/goods-receipt/CreateGRNForm";
import { getPOForGRNById } from "@/lib/queries/grn";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { assertSessionPurchaseOrderAccess } from "@/lib/warehouse-access";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

type SearchParams = Promise<{ poId?: string }>;

function receivedByNameFromSession(user: Awaited<ReturnType<typeof getRequestSession>>) {
  if (!user) {
    return "User";
  }
  const metaName = user.user_metadata?.name;
  if (typeof metaName === "string" && metaName.trim()) {
    return metaName.trim();
  }
  return user.email ?? "User";
}

export default async function NewGoodsReceiptPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.goodsReceipt]);
  const { poId: initialPoIdRaw } = await searchParams;
  const initialPoId = initialPoIdRaw?.trim() || undefined;

  let initialPo: Awaited<ReturnType<typeof getPOForGRNById>> | undefined;
  if (initialPoId) {
    const access = await assertSessionPurchaseOrderAccess(user, initialPoId);
    initialPo = access.ok
      ? await getPOForGRNById(initialPoId, assignedWarehouseIds(user))
      : null;
  }

  return (
    <CreateGRNForm
      receivedByName={receivedByNameFromSession(user)}
      initialPoId={initialPoId}
      initialPo={initialPo}
      initialPoPrefetched={initialPoId != null}
    />
  );
}
