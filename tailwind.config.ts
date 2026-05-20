import type { Config } from "tailwindcss";

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
        "ds-metric": ["24px", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
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
        lg: "var(--radius)",
        md: "6px",
        sm: "4px",
      },
      transitionDuration: {
        fast: "80ms",
        DEFAULT: "100ms",
        sheet: "180ms",
      },
      width: {
        sidebar: "224px",
      },
      maxWidth: {
        content: "1280px",
      },
      keyframes: {
        "ds-shimmer": {
          "0%": { backgroundPosition: "-100% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "ds-shimmer": "ds-shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
