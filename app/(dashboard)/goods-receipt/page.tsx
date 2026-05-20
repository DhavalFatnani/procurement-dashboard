import { ModulePlaceholder } from "@/components/shared/ModulePlaceholder";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

export default async function GoodsReceiptPage() {
  await checkRole([...ACCESS.goodsReceipt]);

  return (
    <ModulePlaceholder
      title="Goods receipt"
      subtitle="Record GRNs, exceptions, and tie receipts back to open POs."
    />
  );
}
