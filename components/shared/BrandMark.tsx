import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-xl bg-accent-gradient font-semibold text-primary-foreground shadow-ds",
          size === "sm" ? "size-7 text-ds-xs" : "size-8 text-ds-sm",
        )}
      >
        K
      </span>
      <div className="leading-tight">
        <p
          className={cn(
            "font-semibold tracking-tight text-foreground",
            size === "sm" ? "text-ds-xs" : "text-ds-sm",
          )}
        >
          KNOT
        </p>
        <p className="text-ds-2xs uppercase tracking-widest text-muted-foreground">
          Procurement
        </p>
      </div>
    </div>
  );
}
