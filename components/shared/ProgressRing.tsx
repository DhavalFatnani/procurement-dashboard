import { cn } from "@/lib/utils";

/**
 * Circular progress ring (paid / total). Renders an SVG with a backing track
 * and a foreground arc clamped to [0, 1].
 *
 * Use for payments / GRN reception summaries.
 */
export function ProgressRing({
  value,
  total,
  size = 56,
  strokeWidth = 5,
  label,
  tone = "accent",
  className,
}: {
  value: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  label?: React.ReactNode;
  tone?: "accent" | "success" | "warning";
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const dash = circumference * progress;

  const colour =
    tone === "success"
      ? "var(--status-success)"
      : tone === "warning"
        ? "var(--status-warning)"
        : "var(--brand-accent)";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(progress * 100)}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-hover)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: "stroke-dasharray var(--duration-slow) var(--ease-out)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center font-medium leading-tight text-foreground">
        {label}
      </div>
    </div>
  );
}
