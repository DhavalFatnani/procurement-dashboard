import { CreateGRNForm } from "@/components/goods-receipt/CreateGRNForm";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{ poId?: string }>;

export default async function NewGoodsReceiptPage({ searchParams }: { searchParams: SearchParams }) {
  const user = assertRole(await getRequestSession(), [...ACCESS.goodsReceipt]);
  const { poId: initialPoId } = await searchParams;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true },
  });

  const receivedByName =
    dbUser?.name ??
    (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null) ??
    user.email ??
    "User";

  return (
    <CreateGRNForm
      receivedByName={receivedByName}
      initialPoId={initialPoId?.trim() || undefined}
    />
  );
}
