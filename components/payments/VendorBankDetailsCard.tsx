"use client";

import { SheetSection } from "@/components/shared/SheetSection";
import { formatInr } from "@/lib/format-datetime";

export type VendorBankDetails = {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
};

export function VendorBankDetailsCard({
  vendorName,
  bank,
  transferAmount,
  description = "Confirm these details match the invoice before initiating a bank transfer.",
}: {
  vendorName?: string;
  bank: VendorBankDetails;
  /** When set, highlights the amount Finance should transfer. */
  transferAmount?: number;
  description?: string;
}) {
  return (
    <SheetSection title="Bank details for payment" description={description}>
      {transferAmount != null && transferAmount > 0 ? (
        <p className="mb-3 rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2 text-ds-sm">
          Transfer{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatInr(transferAmount)}
          </span>{" "}
          to the account below.
        </p>
      ) : null}
      <dl className="grid grid-cols-1 gap-3 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm sm:grid-cols-2">
        {vendorName ? (
          <div className="sm:col-span-2">
            <dt className="text-ds-xs text-muted-foreground">Vendor</dt>
            <dd className="font-medium">{vendorName}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-ds-xs text-muted-foreground">Account name</dt>
          <dd className="font-medium">{bank.accountName}</dd>
        </div>
        <div>
          <dt className="text-ds-xs text-muted-foreground">Account number</dt>
          <dd className="font-mono text-[13px] tracking-wide">{bank.accountNumber}</dd>
        </div>
        <div>
          <dt className="text-ds-xs text-muted-foreground">IFSC</dt>
          <dd className="font-mono text-[13px] tracking-wide">{bank.ifsc}</dd>
        </div>
        <div>
          <dt className="text-ds-xs text-muted-foreground">Bank</dt>
          <dd>{bank.bankName}</dd>
        </div>
      </dl>
    </SheetSection>
  );
}
