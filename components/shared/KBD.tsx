import { cn } from "@/lib/utils";

/** Inline keyboard chord renderer (⌘K, ↩, ⇧A, etc.). */
export function KBD({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border-subtle bg-muted px-1.5 font-mono text-ds-2xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
