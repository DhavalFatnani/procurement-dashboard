import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  context,
  className,
}: {
  label: string;
  value: string | number;
  context?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-card px-4 py-4",
        className,
      )}
    >
      <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-ds-metric font-semibold font-tabular text-foreground">{value}</p>
      {context ? <p className="mt-1.5 text-ds-xs text-muted-foreground">{context}</p> : null}
    </div>
  );
}
