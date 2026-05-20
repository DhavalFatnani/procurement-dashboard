import { ExecutionType } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const labels: Record<ExecutionType, string> = {
  [ExecutionType.VENDOR_PURCHASE]: "Vendor purchase",
  [ExecutionType.INTERNAL_PRINT]: "Internal print",
};

export function ExecutionTypeBadge({ type }: { type: ExecutionType }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        type === ExecutionType.INTERNAL_PRINT &&
          "border-violet-500/40 text-violet-800 dark:text-violet-300",
      )}
    >
      {labels[type]}
    </Badge>
  );
}
