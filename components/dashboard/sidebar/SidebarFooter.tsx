import { LogoutBlock } from "@/components/dashboard/LogoutBlock";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { cn } from "@/lib/utils";

export function SidebarFooter({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mt-auto flex flex-col gap-1 border-t border-border-subtle p-3",
        className,
      )}
    >
      <ThemeToggle />
      <LogoutBlock embedded />
    </div>
  );
}
