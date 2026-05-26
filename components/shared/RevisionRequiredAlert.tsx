import { formatDateTimeMedium } from "@/lib/format-datetime";

export function RevisionRequiredAlert({
  byName,
  at,
  comment,
}: {
  byName: string;
  at: string;
  comment: string;
}) {
  return (
    <div className="border-b border-status-warning/30 border-l-[3px] border-l-status-warning bg-[var(--status-warning-bg)] px-4 py-3.5 md:px-8">
      <p className="text-ds-xs text-status-warning">
        Revision requested by {byName} · {formatDateTimeMedium(at)}
      </p>
      <p className="mt-1 text-ds-base font-medium text-foreground">{comment}</p>
    </div>
  );
}
