---
name: KNOT Procurement
description: A precise, information-dense procurement operations dashboard for daily warehouse and finance work.
colors:
  brand-indigo: "#4f46e5"
  brand-indigo-hover: "#4338ca"
  brand-indigo-subtle: "#eef2ff"
  role-teal: "#0d9488"
  role-violet: "#7c3aed"
  surface-base: "#f4f4f6"
  surface-content: "#fafafa"
  surface-elevated: "#ffffff"
  surface-hover: "#f1f1f3"
  surface-selected: "#ebebee"
  text-primary: "#18181b"
  text-secondary: "#52525b"
  text-tertiary: "#71717a"
  border-subtle: "#e7e7ea"
  border-default: "#d4d4d8"
  status-success: "#16a34a"
  status-warning: "#b45309"
  status-error: "#b91c1c"
  status-info: "#1d4ed8"
  status-neutral: "#52525b"
typography:
  display:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  mono:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  page: "32px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand-indigo}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.brand-indigo-hover}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "32px"
  input-field:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "36px"
  chip-status:
    backgroundColor: "{colors.brand-indigo-subtle}"
    textColor: "{colors.brand-indigo}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
  nav-item-active:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
---

# Design System: KNOT Procurement

## 1. Overview

**Creative North Star: "The Operations Ledger"**

KNOT Procurement is a daily-use operations console, not a marketing surface. The visual system treats tables, filters, and detail pages as the primary canvas. Every choice serves repeat operators who spend hours moving records through approval, receipt, invoicing, and payment workflows.

The aesthetic sits between Linear's interaction speed and Stripe's dashboard clarity: polished surfaces, restrained motion, and information density without clutter. Light and dark themes share the same indigo accent and role tints (teal for Warehouse SM, indigo for Ops Head, violet for Finance). Subtle shell gradients and frosted sticky bars add depth without decorative noise.

This system explicitly rejects generic SaaS marketing aesthetics, cream body backgrounds, hero-metric templates, onboarding tours, and performative UI feedback. Design for the eighth hour: calm competence over impressiveness.

**Key Characteristics:**

- Information-dense tables and list views as the default layout pattern
- Indigo accent used sparingly for primary actions, active nav, links, and focus rings
- Semantic color confined to status chips, alerts, and toasts
- Geist Sans for UI copy; Geist Mono for IDs, serial ranges, and numeric columns
- Fast micro-motion (120–180ms) with full `prefers-reduced-motion` support
- Fixed 240px sidebar with role-colored left stripe; 1280px max content width

## 2. Colors: The Restrained Indigo Palette

A neutral gray surface stack with one primary accent and role-specific tints. Color carries meaning; nothing is decorative.

### Primary

- **Operations Indigo** (#4f46e5): Primary buttons, active nav icon tint, links, focus rings, progress indicators. The single brand voice on any screen.
- **Indigo Hover** (#4338ca): Button hover and pressed states in light mode.
- **Indigo Whisper** (#eef2ff): Soft accent surfaces for tinted chips and secondary emphasis backgrounds.

### Secondary

- **Role Teal** (#0d9488): Warehouse SM sidebar stripe and role-specific UI accents.
- **Role Violet** (#7c3aed): Finance sidebar stripe and role-specific UI accents.

### Tertiary

- **Role Indigo** (#4f46e5 / #6366f1 dark): Ops Head role accent; same hue family as primary, applied only to role orientation (sidebar stripe, avatar ring).

### Neutral

- **Shell Gray** (#f4f4f6): Outermost app background (`--surface-base`).
- **Content Gray** (#fafafa): Main content area (`--surface-1`).
- **Elevated White** (#ffffff): Cards, sheets, modals (`--surface-2`).
- **Hover Wash** (#f1f1f3): Row hover, nav hover (`--surface-hover`).
- **Selected Wash** (#ebebee): Selected rows, active secondary surfaces (`--surface-selected`).
- **Ink Primary** (#18181b): Body text, table cell content, headings.
- **Ink Secondary** (#52525b): Labels, column headers, secondary metadata.
- **Ink Tertiary** (#71717a): Timestamps, placeholders, disabled-adjacent text.
- **Border Subtle** (#e7e7ea): Card outlines, table row dividers, sidebar border.
- **Border Default** (#d4d4d8): Input borders, table container borders.

### Named Rules

**The One Voice Rule.** Brand indigo appears on ≤10% of any screen: one primary CTA, active nav indicator, focus ring, or link cluster. Its rarity signals actionability.

**The Semantic-Only Rule.** Success, warning, error, and info colors appear in status chips, inline alerts, and toast left-bars only. Never as decorative backgrounds or body text outside badges.

## 3. Typography

**Display Font:** Geist Sans (local variable font, `--font-geist-sans`)
**Body Font:** Geist Sans
**Label/Mono Font:** Geist Mono (`--font-geist-mono`) for IDs, serials, GSTINs, and tabular numerics

**Character:** Crisp and compact at small sizes. Geist was chosen for legibility in dense 13px table cells. Hierarchy comes from size and weight contrast, not decorative type.

### Hierarchy

- **Display** (600, 28px / `ds-metric`, 1.1): Dashboard metric values only. Never above 28px on operational screens.
- **Headline** (600, 18px / `ds-lg`, 1.2, -0.01em): Page titles (h1 equivalent), section headers.
- **Title** (600, 15px / `ds-md`, 1.4): Card headings, sheet section titles, subheadings.
- **Body** (400, 13px / `ds-sm`, 1.4): Table cells, form content, toast text. Primary data density size.
- **Label** (500, 12px / `ds-xs`, 1.4, 0.02em tracking): Column headers (often uppercase), badges, nav group labels, filter chips.
- **Mono** (400, 13px, 1.4): PR-001, PO-042, serial ranges, batch IDs, GST numbers. Always `font-variant-numeric: tabular-nums` for quantities.

### Named Rules

**The Monospace ID Rule.** Every system identifier, serial range, and right-aligned quantity uses Geist Mono. If it could be copied into a spreadsheet, it is monospace.

**The 28px Ceiling Rule.** No operational screen uses type above 28px. This is a tool, not a landing page.

## 4. Elevation

A hybrid system: tonal surface layering is the default depth model; shadows appear on interactive elevation (cards, dropdowns, toasts, active nav pills) and focus states.

Light mode surfaces step from `#f4f4f6` (shell) → `#fafafa` (content) → `#ffffff` (elevated). Dark mode inverts to near-black violets (`#0b0b10` → `#111118` → `#161620`). Shell backgrounds carry a faint radial gradient mesh tinted by brand indigo and finance violet at 5–10% opacity.

### Shadow Vocabulary

- **Resting** (`--shadow-1`: 0 1px 2px rgba(15,23,42,0.05)): Default card shadow, button resting state.
- **Lifted** (`--shadow-2`: 0 4px 8px rgba(15,23,42,0.08)): Hover cards, toasts, active nav pills.
- **Overlay** (`--shadow-3`: 0 16px 48px rgba(15,23,42,0.18)): Modals, sheets, popovers.
- **Focus** (`--shadow-focus`: 0 0 0 3px indigo at 28% mix): All `:focus-visible` rings.

### Named Rules

**The Border-First Rule.** Cards and tables use 1px `--border-subtle` borders at rest. Shadows signal interactivity or elevation, not decoration. Flat data tables have borders only, no shadow.

**The Glass Sparingly Rule.** `surface-glass` (16px backdrop blur) is reserved for sticky filter bars and drawer headers. Never as a default card treatment.

## 5. Components

### Buttons

- **Shape:** Gently rounded (6px / `rounded-md`), compact height 32px default.
- **Primary:** Indigo fill (`--brand-accent`), white label, subtle `shadow-ds`. One per screen maximum.
- **Hover / Focus:** Darker indigo hover, `shadow-ds-2` lift, `shadow-ds-focus` ring. Active state: 1px translate-y press.
- **Secondary / Ghost:** Secondary uses `--surface-selected` fill; ghost is transparent with muted hover wash. Destructive uses error-tinted backgrounds, never solid red unless confirming deletion.
- **Soft / Gradient:** Soft variant for secondary accent actions; gradient variant for rare hero CTAs only.

### Chips

- **Style:** Pill shape (`rounded-full`), 22px height, soft tinted background matching semantic tone.
- **State:** Leading dot (4px circle) for status badges; outline variant for filter chips; solid variant for high-emphasis only.
- **Tones:** neutral, info, success, warning, error, accent. Mapped to `--status-*` token families.

### Cards / Containers

- **Corner Style:** 16px (`rounded-2xl`) for dashboard cards; 8px for compact/sm variant.
- **Background:** `--surface-2` (elevated white).
- **Shadow Strategy:** `shadow-ds` at rest; `shadow-ds-2` + 1px lift on interactive cards.
- **Border:** 1px `--border-subtle`.
- **Internal Padding:** 16px default; 12px for sm size.

### Inputs / Fields

- **Style:** 36px height, 6px radius, 1px `--border-default` stroke, white/`--surface-input` background.
- **Focus:** Border shifts to `--brand-accent`, `shadow-ds-focus` ring.
- **Error:** Destructive border + error-tinted focus ring. Disabled: muted border, reduced opacity, no pointer events.
- **Placeholder:** `--text-tertiary` at 70% opacity. Specific examples, never generic ("e.g. GSTIN 22AAAAA0000A1Z5").

### Navigation

- **Style:** Fixed 240px sidebar with gradient background and 2px role-colored left stripe.
- **Typography:** 13px (`ds-sm`) nav labels; 12px uppercase group labels at `--text-tertiary`.
- **Default:** Muted foreground, Lucide icon 16px stroke 1.5.
- **Hover:** Muted background wash, slight translate-x nudge, foreground text.
- **Active:** Selected background (`--surface-selected`), medium weight, accent-colored icon, `shadow-ds` pill.

### Data Tables (signature component)

- **Container:** Elevated surface, 1px border, 8px radius, overflow hidden.
- **Header row:** 40px height, 12px uppercase labels at `--text-tertiary`, weight 500.
- **Body rows:** 40px default, 13px body text, `--border-subtle` row dividers.
- **Hover:** `--surface-hover` background, 120ms transition (Linear-fast).
- **Selected:** `--surface-selected` background; accent left border only when row is selectable.
- **Formatting:** IDs and references in mono; quantities right-aligned tabular nums.

## 6. Do's and Don'ts

Concrete guardrails derived from PRODUCT.md and `docs/knot_procurement_ui_ux.md`.

### Do:

- **Do** use Geist Sans and Geist Mono as the only font families.
- **Do** keep table hover transitions at 120ms (`--duration-fast`) for Linear-grade responsiveness.
- **Do** render skeleton layouts matching real table column widths (8 rows) instead of spinners.
- **Do** use dry, factual empty state copy ("No vendors found.") without illustrations or emoji.
- **Do** honor `prefers-reduced-motion` by collapsing all durations to instant.
- **Do** show a visible reason when a button is disabled (tooltip or helper text).
- **Do** limit each screen to one primary (indigo) button.

### Don't:

- **Don't** use generic SaaS marketing aesthetics: hero metrics with gradient accents, identical icon-card grids, cream/sand body backgrounds, tiny uppercase eyebrows on every section.
- **Don't** use gradient text, gradient backgrounds as default, or glassmorphism for its own sake.
- **Don't** add product tours, feature callouts, or tooltip overload on already-labeled controls.
- **Don't** show "Success!" modals, emoji, exclamation marks, or illustrations in empty states.
- **Don't** use centered page layouts or full-page loading spinners.
- **Don't** use Inter or system-ui as the primary font, or sizes above 28px on operational screens.
- **Don't** use generic placeholders ("Enter value here") or marketing buzzwords (streamline, empower, seamless).
- **Don't** use border-left greater than 1px as a colored accent stripe on cards or list items (role sidebar stripe excepted).
- **Don't** animate longer than 280ms or use bounce/elastic easing.
- **Don't** put semantic status colors on table row backgrounds beyond hover/selected washes.
