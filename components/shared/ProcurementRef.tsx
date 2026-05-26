import Link from "next/link";

import { formatProcurementRef, procurementRefPath } from "@/lib/display-ref";
import { cn } from "@/lib/utils";

export function ProcurementRefText({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  return (
    <span className={cn("font-mono text-ds-xs", className)}>{formatProcurementRef(id)}</span>
  );
}

export function ProcurementRefLink({
  id,
  href,
  className,
}: {
  id: string;
  href?: string;
  className?: string;
}) {
  const path = href ?? procurementRefPath(id);
  const label = formatProcurementRef(id);
  if (!path) {
    return <ProcurementRefText id={id} className={className} />;
  }
  return (
    <Link href={path} className={cn("font-mono text-ds-xs text-primary hover:underline", className)}>
      {label}
    </Link>
  );
}
