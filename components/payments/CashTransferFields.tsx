"use client";

import { Field } from "@/components/shared/Field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SheetSection } from "@/components/shared/SheetSection";

const PAYMENT_METHOD_OPTIONS = [
  { value: "NEFT", label: "NEFT" },
  { value: "RTGS", label: "RTGS" },
  { value: "IMPS", label: "IMPS" },
  { value: "UPI", label: "UPI" },
  { value: "Cheque", label: "Cheque" },
  { value: "Cash", label: "Cash" },
  { value: "Other", label: "Other" },
] as const;

export function CashTransferFields({
  method,
  transactionRef,
  paidAt,
  disabled,
  onMethodChange,
  onTransactionRefChange,
  onPaidAtChange,
  onProofFileChange,
}: {
  method: string;
  transactionRef: string;
  paidAt: string;
  proofFile: File | null;
  disabled?: boolean;
  onMethodChange: (value: string) => void;
  onTransactionRefChange: (value: string) => void;
  onPaidAtChange: (value: string) => void;
  onProofFileChange: (file: File | null) => void;
}) {
  return (
    <SheetSection
      title="Bank transfer"
      description="Required for the cash portion of this settlement."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Payment method" htmlFor="payment-method" required>
          <Select value={method} onValueChange={onMethodChange} disabled={disabled}>
            <SelectTrigger id="payment-method" aria-label="Payment method">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Paid date" htmlFor="payment-paid-at" required>
          <Input
            id="payment-paid-at"
            type="date"
            value={paidAt}
            onChange={(e) => onPaidAtChange(e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field
          label="Transaction reference"
          htmlFor="payment-txn"
          className="sm:col-span-2"
          required
        >
          <Input
            id="payment-txn"
            placeholder="Reference number from the bank"
            value={transactionRef}
            onChange={(e) => onTransactionRefChange(e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field label="Proof" htmlFor="payment-proof" hint="PDF or image (optional)">
          <Input
            id="payment-proof"
            type="file"
            accept=".pdf,image/*"
            disabled={disabled}
            onChange={(e) => onProofFileChange(e.target.files?.[0] ?? null)}
          />
        </Field>
      </div>
    </SheetSection>
  );
}
