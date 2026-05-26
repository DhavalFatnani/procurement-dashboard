import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function TableSkeleton({
  columns,
  rows = 8,
}: {
  columns: { id: string; header: string; width?: string }[];
  rows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border-subtle bg-background hover:bg-background">
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className="h-9 px-3 text-ds-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex} className="h-10 border-border-subtle">
              {columns.map((col) => (
                <TableCell key={col.id} className="px-3 py-2">
                  <Skeleton className={cn("h-4", col.width ?? "w-24")} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
