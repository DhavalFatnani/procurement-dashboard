import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "ds-2xs": ["10px", { lineHeight: "1.4" }],
        "ds-xs": ["12px", { lineHeight: "1.4" }],
        "ds-sm": ["13px", { lineHeight: "1.4" }],
        "ds-base": ["14px", { lineHeight: "1.4" }],
        "ds-md": ["15px", { lineHeight: "1.4" }],
        "ds-lg": ["18px", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "ds-xl": ["22px", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        "ds-metric": ["28px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        destructive: "var(--destructive)",
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",
        input: "var(--input)",
        ring: "var(--ring)",
        "status-success": "var(--status-success)",
        "status-warning": "var(--status-warning)",
        "status-error": "var(--status-error)",
        "status-info": "var(--status-info)",
        "status-neutral": "var(--status-neutral)",
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        DEFAULT: "var(--radius)",
      },
      spacing: {
        page: "var(--space-page)",
        section: "var(--space-section)",
      },
      boxShadow: {
        ds: "var(--shadow-1)",
        "ds-2": "var(--shadow-2)",
        "ds-3": "var(--shadow-3)",
        "ds-focus": "var(--shadow-focus)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        DEFAULT: "var(--duration)",
        slow: "var(--duration-slow)",
        sheet: "240ms",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        emphasized: "var(--ease-emphasized)",
      },
      width: {
        sidebar: "240px",
      },
      maxWidth: {
        content: "1280px",
      },
      keyframes: {
        "ds-shimmer": {
          "0%": { backgroundPosition: "-100% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "ds-fade-rise": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "ds-pop-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "ds-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "ds-shimmer": "ds-shimmer 1.5s ease-in-out infinite",
        "ds-fade-rise":
          "ds-fade-rise var(--duration) var(--ease-out) both",
        "ds-pop-in": "ds-pop-in var(--duration) var(--ease-out) both",
        "ds-pulse": "ds-pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
