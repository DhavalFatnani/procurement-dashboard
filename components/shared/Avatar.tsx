import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-ds-2xs",
  md: "size-7 text-ds-xs",
  lg: "size-9 text-ds-sm",
} as const;

function initials(name: string): string {
  const parts = name
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]!.toUpperCase()).join("");
}

/**
 * Hash a string into a stable tone palette index.
 *
 * Used to assign deterministic colour to vendor/initials avatars across
 * sessions.
 */
function hashTone(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const TONE_STYLES = [
  "bg-[var(--accent-subtle)] text-[var(--brand-accent)]",
  "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  "bg-[var(--status-neutral-bg)] text-[var(--text-secondary)]",
];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const init = initials(name);
  const tone = TONE_STYLES[hashTone(name) % TONE_STYLES.length];
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase",
        SIZE_CLASSES[size],
        tone,
        className,
      )}
    >
      {init}
    </span>
  );
}
