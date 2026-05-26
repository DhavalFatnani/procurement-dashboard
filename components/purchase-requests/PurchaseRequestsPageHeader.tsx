import Link from "next/link";
import { FilePlus } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { listBreadcrumbs } from "@/lib/lineage";

export function PurchaseRequestsPageHeader() {
  return (
    <PageHeader
      variant="hero"
      breadcrumbs={listBreadcrumbs("/purchase-requests")}
      title="Purchase requests"
      subtitle="Raise and track procurement requests through approval and PO conversion."
      action={
        <Button render={<Link href="/purchase-requests/new" />}>
          <FilePlus className="size-3.5" strokeWidth={1.5} aria-hidden />
          Create PR
        </Button>
      }
    />
  );
}
