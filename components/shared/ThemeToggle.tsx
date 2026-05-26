"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { cn } from "@/lib/utils";

type ThemeOption = "light" | "dark" | "system";

const OPTIONS: { id: ThemeOption; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

/**
 * 3-segment theme toggle.
 *
 * Mounted client-side and uses `next-themes`. Renders an inert placeholder
 * with the same dimensions during SSR/first paint so the sidebar layout doesn't
 * shift when hydration completes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const current: ThemeOption = mounted
    ? ((theme as ThemeOption | undefined) ?? "system")
    : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "flex items-center gap-0.5 rounded-md border border-border-subtle bg-background p-0.5",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = current === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            disabled={!mounted}
            onClick={() => setTheme(opt.id)}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded-[6px] transition-colors duration-fast",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
              !mounted && "opacity-50",
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.5} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
