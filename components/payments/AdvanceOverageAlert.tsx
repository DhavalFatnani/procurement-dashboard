import { AlertTriangle } from "lucide-react";

export function AdvanceOverageAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-lg border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] px-3 py-2.5 text-ds-sm text-[var(--status-warning)]"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden />
      <p>{message}</p>
    </div>
  );
}
