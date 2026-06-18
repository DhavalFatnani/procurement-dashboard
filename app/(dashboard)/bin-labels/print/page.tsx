import { BinLabelPrintPage } from "@/components/bin-labels/BinLabelPrintPage";
import { getResolvedBinLabelTemplate } from "@/app/actions/label-templates";
import { getWarehousesAssignedToUser } from "@/lib/queries/warehouses";
import { warehouseOptionsFromRows } from "@/lib/format-warehouse";
import { normalizeLabelTemplate } from "@/lib/label-template-types";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BinLabelsPrintRoutePage() {
  const session = assertRole(await getRequestSession(), [...ACCESS.binLabelPrint]);

  const [warehouses, resolved] = await Promise.all([
    getWarehousesAssignedToUser(session.id),
    getResolvedBinLabelTemplate(),
  ]);

  return (
    <BinLabelPrintPage
      warehouses={warehouseOptionsFromRows(warehouses)}
      initialTemplate={normalizeLabelTemplate(resolved.template)}
      resolved={resolved}
    />
  );
}
