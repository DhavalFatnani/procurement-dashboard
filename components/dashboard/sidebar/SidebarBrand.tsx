import { BrandMark } from "@/components/shared/BrandMark";
import { cn } from "@/lib/utils";

export function SidebarBrand({ className }: { className?: string }) {
  return (
    <div className={cn("border-b border-border-subtle px-4 py-4", className)}>
      <BrandMark />
    </div>
  );
}
