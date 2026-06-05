import Link from "next/link";
import { Role } from "@/lib/prisma-enums";
import { Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FINANCE_ROUTES } from "@/lib/finance-routes";

const SUBTITLES: Record<Role, string> = {
  [Role.SM]:
    "Your warehouse — drafts, goods receipt, and invoice uploads in one place.",
  [Role.OPS_HEAD]:
    "Governance queue — approvals, vendor onboarding, PO setup, and exception resolution.",
  [Role.FINANCE]:
    "Payables overview — settlement queue, advances, and payment ageing.",
  [Role.ADMIN]:
    "Platform-wide control — procurement, payables, master data, and serial governance.",
};

const INBOX_HREF: Partial<Record<Role, string>> = {
  [Role.FINANCE]: FINANCE_ROUTES.invoiceSettlement,
};

export function DashboardPageHeader({ role }: { role: Role }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-ds-lg font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-ds-sm text-muted-foreground">{SUBTITLES[role]}</p>
      </div>
      <Button
        variant="soft"
        size="sm"
        render={<Link href={INBOX_HREF[role] ?? "/inbox"} />}
      >
        <Inbox className="size-3.5" strokeWidth={1.5} aria-hidden />
        {role === Role.FINANCE ? "Open settlement queue" : "Open inbox"}
      </Button>
    </div>
  );
}
