# KNOT Procurement — UI/UX Design System Prompt
## Paste this into Cursor before building any screen

---

## WHAT THIS IS

This is an internal warehouse procurement and serial governance tool for KNOT, a quick-commerce fashion startup. It is used daily by three roles — Warehouse SM (raises requests, records GRNs, prints labels), Ops Head (approves, governs vendors, full visibility), and Finance (processes payments). All users are on laptop/desktop. No mobile requirement.

This is a serious operational tool. Every screen must be fast, information-dense, and frictionless. Users will spend hours in this system daily. Design for that — not for occasional visitors, not for onboarding, not for impressiveness. Design for sustained, efficient daily work.

---

## DESIGN DIRECTION

**Reference:** Linear + Supabase dashboard. Steal Linear's interaction speed, keyboard philosophy, and information density. Steal Supabase's neutral gray palette, clean data presentation, and developer-grade precision.

**Tone:** Industrial minimal. No gradients on hero sections, no illustrations, no decorative elements that don't carry information. Every pixel either communicates something or creates breathing room for something that does.

**The one thing to remember:** This tool should feel like it was built by engineers who deeply respect the people using it — not designed to impress, designed to disappear so the work can happen.

---

## TYPOGRAPHY

```css
/* Primary font — Geist (Vercel's font, free, crisp at small sizes) */
/* Fallback: DM Sans or IBM Plex Sans */
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap');

/* Monospace — for all IDs, serial numbers, ranges, codes */
/* Geist Mono or JetBrains Mono */
@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap');

font-family:
  --font-sans: 'Geist', 'DM Sans', system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;
```

**Scale (use these sizes only — no in-between values):**
```
10px — timestamp, secondary metadata, table subtext
12px — table cell secondary info, labels, badges
13px — table body text (primary data density size)
14px — form labels, sidebar nav, filter text
15px — page subheadings, card headings, sheet section titles
18px — page titles (h1 equivalent)
24px — metric numbers on dashboard cards
```

**Weights:**
```
400 — body, table cells
500 — column headers, nav items, active states, labels
600 — page titles, metric values, critical highlights
```

**Rules:**
- Monospace font for: all IDs (PR-001, PO-042), serial ranges (1000000001 → 1000000500), batch IDs, transaction references, GST numbers, account number last 4 digits
- Never use font size above 24px on any operational screen
- Line height: 1.4 for body, 1.2 for dense table rows, 1.6 for form fields
- Letter spacing: -0.01em on headings, 0 on body

---

## COLOR SYSTEM

Build on a pure neutral gray base with a single blue accent. No color is decorative — every color carries meaning.

```css
:root {
  /* Base surfaces */
  --bg-app:        #0a0a0a;   /* outermost background — near black */
  --bg-base:       #111111;   /* main content area background */
  --bg-elevated:   #1a1a1a;   /* cards, sheets, modals */
  --bg-hover:      #222222;   /* row hover, nav hover */
  --bg-selected:   #2a2a2a;   /* selected row, active state */
  --bg-input:      #161616;   /* form inputs background */

  /* Borders */
  --border-subtle:  #222222;  /* section dividers, card outlines */
  --border-default: #2e2e2e;  /* table borders, input borders */
  --border-strong:  #3d3d3d;  /* active inputs, focused elements */

  /* Text */
  --text-primary:   #ededed;  /* primary content */
  --text-secondary: #888888;  /* secondary labels, metadata */
  --text-tertiary:  #555555;  /* timestamps, disabled, placeholder */
  --text-disabled:  #333333;  /* truly disabled content */

  /* Accent — single blue, used sparingly */
  --accent:         #3b82f6;  /* links, active nav, primary buttons, focus rings */
  --accent-subtle:  #1e3a5f;  /* accent backgrounds, selected badge fill */
  --accent-hover:   #2563eb;  /* button hover */

  /* Semantic — status colors */
  --status-success:     #22c55e;
  --status-success-bg:  #052e16;
  --status-warning:     #f59e0b;
  --status-warning-bg:  #2d1f00;
  --status-error:       #ef4444;
  --status-error-bg:    #2d0a0a;
  --status-neutral:     #6b7280;
  --status-neutral-bg:  #1a1a1a;
  --status-info:        #3b82f6;
  --status-info-bg:     #1e3a5f;
}
```

**Color usage rules:**
- `--bg-app` is the outermost wrapper. Sidebar lives on `--bg-elevated`.
- Main content area is `--bg-base`. Cards and sheets are `--bg-elevated`.
- Never use white backgrounds. This is a dark-first interface.
- `--accent` appears in: active sidebar nav item, primary CTA buttons, focus rings, hyperlinks, progress bars. Nowhere else.
- Semantic colors appear in: status badges only. Not in backgrounds, not in text outside badges.
- Gray text hierarchy: use `--text-primary` for what users need to act on, `--text-secondary` for context, `--text-tertiary` for metadata.

---

## LAYOUT & SPACING

**Grid:** 8px base unit. All spacing is a multiple of 4px minimum, 8px preferred.

```
Sidebar width:        224px (fixed, never collapsible on desktop)
Content max-width:    1280px (centered within remaining space)
Page padding:         24px top, 32px left/right
Section spacing:      24px between major page sections
Card padding:         16px
Table cell padding:   10px vertical, 12px horizontal
Form field height:    36px (compact) — not the bulky 44px default
Input border-radius:  6px
Card border-radius:   8px
Button border-radius: 6px
Badge border-radius:  4px
```

**Layout pattern for all pages:**
```
[Sidebar 224px fixed] [Content area fills rest]
  Content area:
    [PageHeader — title left, actions right — 48px tall]
    [Filter bar — 40px tall — below header, above table]
    [Main content — table or two-column detail]
```

**Two-column detail pages (PR detail, PO detail, Vendor detail):**
```
Left column: 60% — primary content, cards, forms
Right column: 40% — action panel, timeline, status
```

---

## SIDEBAR

```
Width: 224px
Background: --bg-elevated
Border-right: 1px solid --border-subtle
Padding: 16px 12px

Top section:
  App name "KNOT" — 12px, weight 600, --text-tertiary, letter-spacing 0.08em uppercase
  "Procurement" — 13px, weight 500, --text-primary
  Divider

Nav items:
  Height: 32px
  Padding: 0 8px
  Border-radius: 6px
  Font: 13px, weight 400
  Color: --text-secondary
  Icon: 16px, same color as text, 8px gap before label

  Active state:
    Background: --bg-selected
    Text color: --text-primary
    Icon color: --text-primary

  Hover state:
    Background: --bg-hover
    Text color: --text-primary

  Active indicator: 2px left border in --accent (not a dot)

Nav sections (group labels):
  Font: 10px, weight 500, --text-tertiary, letter-spacing 0.06em uppercase
  Margin: 16px 0 4px 8px
  No interactive state

Bottom section (pinned):
  Role badge — user name, role chip
  Logout link
```

**Icons:** Use Lucide icons throughout. 16px in sidebar, 14px in tables, 18px in page headers. Stroke width 1.5 (not the default 2). Never filled icons.

---

## DATA TABLES

Tables are the primary UI of this system. They must be pixel-perfect.

```
Table container:
  Background: --bg-elevated
  Border: 1px solid --border-subtle
  Border-radius: 8px
  Overflow: hidden (so border-radius clips the table)

Table header row:
  Background: --bg-base (slightly darker than table body)
  Border-bottom: 1px solid --border-default
  Height: 36px

  Header cell:
    Font: 12px, weight 500, --text-tertiary, letter-spacing 0.02em uppercase
    Padding: 0 12px
    No background on hover
    Sortable columns: show sort icon (Lucide ChevronsUpDown, 12px) on hover
    Active sort: icon changes to ChevronUp/Down, text color --text-secondary

Table body rows:
  Height: 40px (default), 48px for rows with two-line content
  Border-bottom: 1px solid --border-subtle (NOT --border-default — subtle only)
  Font: 13px, weight 400, --text-primary
  Background: --bg-elevated

  Hover state:
    Background: --bg-hover
    Transition: background 80ms ease — very fast, like Linear

  Selected state (if selectable):
    Background: --bg-selected
    Left border: 2px solid --accent

  Last row: no border-bottom

Column-specific formatting:
  ID columns (PR-001, PO-042):       font-family: --font-mono, font-size: 12px, --text-secondary
  Serial numbers / ranges:            font-family: --font-mono, font-size: 12px
  Quantities:                         font-variant-numeric: tabular-nums, text-align: right
  Amounts / currency:                 font-family: --font-mono, font-size: 13px, text-align: right
  Dates:                              font-size: 12px, --text-secondary
  Status badges:                      see Badge system below
  Action buttons:                     right-aligned, appear only on row hover (opacity 0 → 1)
  Vendor names / user names:          font-size: 13px, --text-primary
  Empty cell (N/A, blank):            —  (em dash, --text-tertiary)

Inline row actions (appear on hover):
  Do not use a dropdown for 2-3 actions — show text buttons directly
  Example: [Approve] [Reject] [Revise] — 12px, accent/error/warning color
  Font weight 500, no background, just text color
  For 4+ actions: use a "..." icon button that opens a small dropdown (8px border-radius, --bg-elevated, 1px border)

Pagination:
  Below table, right-aligned
  "[X–Y of Z results]" — 13px, --text-secondary
  Prev / Next buttons — 32px height, --bg-hover background
  No page number buttons — just Prev/Next + result count
```

---

## STATUS BADGE SYSTEM

Badges must be immediately readable at a glance. Consistent, small, no visual noise.

```css
/* Base badge */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
  width: fit-content;
  white-space: nowrap;
}

/* Dot variant — small colored dot before text */
.badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
```

**PR Status → Badge mapping:**
```
DRAFT                → neutral    bg: --status-neutral-bg  text: --text-secondary     dot: --status-neutral
PENDING_APPROVAL     → warning    bg: --status-warning-bg  text: --status-warning     dot: --status-warning
APPROVED             → info       bg: --status-info-bg     text: --status-info        dot: --status-info
REVISION_REQUIRED    → warning    bg: --status-warning-bg  text: --status-warning     dot: --status-warning
CONVERTED_TO_PO      → info       bg: --status-info-bg     text: --status-info        dot: --status-info
EXECUTED_PRINT       → success    bg: --status-success-bg  text: --status-success     dot: --status-success
REJECTED             → error      bg: --status-error-bg    text: --status-error       dot: --status-error
CANCELLED            → neutral    bg: --status-neutral-bg  text: --text-tertiary      dot: --status-neutral
FORCE_CANCELLED      → error      bg: --status-error-bg    text: --status-error       dot: --status-error

PO Status:
OPEN                 → neutral
PARTIALLY_RECEIVED   → warning
FULLY_RECEIVED       → info
INVOICED             → info
PAID                 → info
CLOSED               → success
PARTIALLY_CLOSED     → success
FORCE_CLOSED         → neutral

Invoice Match Status:
MATCHED              → success
MISMATCH             → error
PENDING              → neutral
OVERRIDE_ACCEPTED    → warning

Payment Status:
UNPAID               → error
PARTIALLY_PAID       → warning
PAID                 → success

Vendor Status:
ACTIVE               → success
INACTIVE             → neutral
PENDING              → warning
```

---

## FORMS & INPUTS

```
Input height:         36px (not 40px or 44px — keep it compact)
Input background:     --bg-input
Input border:         1px solid --border-default
Input border-radius:  6px
Input font:           13px, --text-primary
Input padding:        0 12px
Placeholder:          --text-tertiary

Focus state:
  Border: 1px solid --accent
  Box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15)  — subtle blue glow

Error state:
  Border: 1px solid --status-error
  Box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12)
  Error message below: 12px, --status-error

Disabled state:
  Background: --bg-base
  Border: 1px solid --border-subtle
  Text: --text-disabled
  Cursor: not-allowed

Labels:
  Font: 12px, weight 500, --text-secondary, letter-spacing 0.01em
  Margin-bottom: 6px
  Required indicator: * in --status-error, no space before

Select / Dropdown:
  Same height and styling as input
  Chevron icon right-aligned, 14px, --text-tertiary

Textarea:
  Min-height: 80px
  Same border and bg as input
  Resize: vertical only

Form layout:
  Single-column for short forms (< 6 fields)
  Two-column grid for longer forms (use sparingly, only for logically paired fields)
  Field group spacing: 16px between fields
  Section spacing: 24px between field groups
  Section label: 11px, weight 600, --text-tertiary, uppercase, letter-spacing 0.06em
    + 1px solid --border-subtle divider below

Mandatory field at decision points (revision comment, edit reason, exception note):
  Add a subtle left border to the textarea: 2px solid --status-warning
  Label in --status-warning color
  Helper text below: "Required before proceeding" — 12px, --text-tertiary
```

---

## BUTTONS

```
Primary button:
  Background: --accent
  Text: white, 13px, weight 500
  Height: 32px
  Padding: 0 14px
  Border-radius: 6px
  Hover: background --accent-hover
  Transition: background 100ms ease
  Icon (optional): 14px, 6px gap

Secondary button (default for most actions):
  Background: --bg-elevated
  Border: 1px solid --border-default
  Text: --text-primary, 13px, weight 400
  Height: 32px
  Padding: 0 14px
  Border-radius: 6px
  Hover: background --bg-hover, border --border-strong

Ghost button (table inline actions):
  Background: transparent
  Text: --text-secondary, 13px, weight 400
  Height: 28px
  Padding: 0 8px
  Border-radius: 4px
  Hover: background --bg-hover, text --text-primary

Destructive button:
  Background: transparent
  Border: 1px solid --status-error
  Text: --status-error, 13px, weight 500
  Height: 32px
  Hover: background --status-error-bg

Icon button (square, no label):
  Width = Height = 32px
  Background: --bg-elevated
  Border: 1px solid --border-default
  Hover: --bg-hover

Button groups (Approve / Reject / Revise inline):
  No container
  Buttons sit flush with 8px gap between them
  Each button uses appropriate variant above

Disabled state (all buttons):
  Opacity: 0.4
  Cursor: not-allowed
  No hover effect
```

---

## METRIC CARDS (Dashboard)

```
Card:
  Background: --bg-elevated
  Border: 1px solid --border-subtle
  Border-radius: 8px
  Padding: 20px
  No drop shadow

Layout inside card:
  Top row: label (12px, weight 500, --text-tertiary) + optional icon right-aligned (16px, --text-tertiary)
  Middle: metric value (24px, weight 600, --text-primary, font-variant-numeric: tabular-nums)
  Bottom: context line (12px, --text-secondary) — e.g. "3 need action", "+2 from yesterday"

Status-colored left border variant (for alert metrics):
  Add 3px left border in the relevant semantic color
  Do not change card background — border carries the signal

Clickable cards:
  Cursor: pointer
  Hover: border-color --border-strong
  Transition: border-color 100ms ease
  No scale transform — too playful for this tool
```

---

## SHEETS, MODALS & DRAWERS

**Right-side Sheets (for add/edit forms and detail panels):**
```
Width: 480px (forms) or 560px (detail panels with tables)
Background: --bg-elevated
Border-left: 1px solid --border-default
No drop shadow — clean edge is sufficient
Overlay: rgba(0,0,0,0.6) — dark enough to focus, not full black

Sheet header:
  Height: 56px
  Padding: 0 20px
  Title: 15px, weight 600, --text-primary
  Close button: X icon, 32x32px, ghost variant, right-aligned
  Border-bottom: 1px solid --border-subtle

Sheet body:
  Padding: 24px 20px
  Overflow-y: auto

Sheet footer (actions):
  Height: 60px
  Padding: 0 20px
  Border-top: 1px solid --border-subtle
  Background: --bg-elevated (sticky)
  Right-aligned: Cancel (secondary) + Primary action button
```

**Confirm Dialogs:**
```
Width: 400px
Background: --bg-elevated
Border: 1px solid --border-default
Border-radius: 10px
Padding: 24px
No header bar — just content

Icon (optional): 18px Lucide icon, colored per semantic meaning
Title: 15px, weight 600, --text-primary
Description: 13px, --text-secondary, margin-top 8px
Actions: right-aligned, margin-top 20px
  Cancel (secondary) + Confirm (primary or destructive)
  Button height: 32px

For destructive confirms:
  Add a thin red banner at top: 3px solid --status-error
```

**Confirmation Modals (serial print, large actions):**
```
Width: 480px
Same base as Confirm Dialog
Content uses a data summary table inside:
  Two-column key-value rows
  Keys: 12px, --text-secondary
  Values: 13px, --text-primary, monospace for numbers/ranges
  Row padding: 10px 0
  Row divider: 1px solid --border-subtle
```

---

## PAGE HEADER PATTERN

Every page uses an identical header structure:

```
Height: 48px (not a full hero section — just a header bar)
Layout: flex, align-items center, justify-content space-between
Border-bottom: 1px solid --border-subtle
Margin-bottom: 0 (filter bar sits directly below, also separated by border)
Padding: 0 32px

Left side:
  Page title: 18px, weight 600, --text-primary
  Optional subtitle: 13px, --text-secondary, margin-left 12px, weight 400

Right side:
  Primary action button (e.g. "Create PR", "Add Vendor")
  Optional secondary icon buttons (export, filter toggle)
```

---

## FILTER BAR PATTERN

Sits directly below the page header, above the table:

```
Height: 48px
Background: --bg-base
Border-bottom: 1px solid --border-subtle
Padding: 0 32px
Display: flex, gap 8px, align-items center

Components (left to right):
  Search input — 240px wide, 32px height, Lucide Search icon inside left
  Filter dropdowns — 32px height each, labeled (e.g. "Status", "Category")
  Date range picker — if needed

Right side of filter bar:
  Result count: "[N] results" — 13px, --text-secondary
  View toggle (if applicable): icon buttons for table/list view
  Export CSV button: ghost variant with Download icon
```

---

## COMMAND PALETTE

Implement a keyboard-accessible command palette. This is the single most important interaction pattern borrowed from Linear.

```
Trigger: Cmd+K (Mac) / Ctrl+K (Windows)
Library: use cmdk (npm install cmdk) — Linear and Vercel both use this

Appearance:
  Overlay: rgba(0,0,0,0.7)
  Panel: 560px wide, centered, --bg-elevated, border 1px solid --border-strong, border-radius 10px
  Box-shadow: 0 16px 48px rgba(0,0,0,0.5)

Search input inside palette:
  Height: 48px
  Font: 15px, --text-primary
  Placeholder: "Type a command or navigate..."
  Border-bottom: 1px solid --border-subtle
  Lucide Search icon left, 18px

Results list:
  Max-height: 360px, overflow-y auto
  Item height: 36px
  Item padding: 0 12px
  Font: 13px, --text-primary
  Icon: 14px, --text-secondary, 10px gap
  Keyboard shortcut hint: right-aligned, 11px, --text-tertiary, monospace

  Hover/selected: background --bg-selected

Command categories (group labels):
  Font: 11px, weight 600, --text-tertiary, uppercase
  Padding: 8px 12px 4px
  Not interactive

Commands to include:
  Navigation:
    Go to Dashboard           → /dashboard
    Go to Vendors             → /vendors
    Go to Purchase Requests   → /purchase-requests
    Go to Purchase Orders     → /purchase-orders
    Go to Goods Receipt       → /goods-receipt
    Go to Invoices            → /invoices
    Go to Payments            → /payments
    Go to Serial Governance   → /serial-governance
    Go to Reports             → /reports

  Actions (role-filtered):
    Create Purchase Request   → /purchase-requests/new     [SM, OPS_HEAD]
    Record Goods Receipt      → /goods-receipt/new         [SM, OPS_HEAD]
    Upload Invoice            → /invoices/new              [SM, OPS_HEAD]
    Add Vendor                → /vendors (opens Add sheet) [OPS_HEAD]

  Search (future):
    Search PRs by ID...
    Search serial number...
    Search vendor...
```

---

## EMPTY STATES

```
Container: centered vertically and horizontally in the table body area
Max-width: 320px

Icon: 32px Lucide icon, --text-tertiary (not colored — neutral always)
Title: 14px, weight 500, --text-secondary, margin-top 16px
Description: 13px, --text-tertiary, margin-top 4px, line-height 1.5
CTA button (optional): secondary variant, margin-top 16px

Never use:
  Illustrations or SVG art
  Emoji
  Exclamation marks or overly encouraging copy ("Nothing here yet! Let's get started!")

Use instead:
  Direct, dry, factual copy
  "No vendors found." — not "You haven't added any vendors yet!"
  "No purchase requests match these filters." — not "Looks like nothing here!"
```

---

## ALERT & NOTIFICATION PATTERNS

**Inline page alerts (banner alerts within a page — not toasts):**
```
Positioned below filter bar, above table
Height: 40px (single line) or auto (multi-line)
Padding: 0 32px (matches page padding)
Display: flex, align-items center, gap 10px
Border-bottom: 1px solid [semantic border color at 40% opacity]

Variants:
  Warning: background --status-warning-bg, icon --status-warning, text --text-primary
  Error:   background --status-error-bg,   icon --status-error,   text --text-primary
  Info:    background --status-info-bg,    icon --status-info,    text --text-primary

Icon: Lucide AlertTriangle (warning), XCircle (error), Info (info) — 16px
Text: 13px, --text-primary
Dismiss button: X icon, 16px, right-aligned, ghost
```

**Toast notifications (Sonner):**
```
Position: bottom-right
Width: 360px
Background: --bg-elevated
Border: 1px solid --border-default
Border-radius: 8px
Box-shadow: 0 8px 24px rgba(0,0,0,0.4)
Font: 13px, --text-primary
Duration: 4000ms

Left accent bar:
  Success:  3px solid --status-success
  Error:    3px solid --status-error
  Warning:  3px solid --status-warning

No icons — color bar carries the signal
```

**Revision Required alert (PR detail page):**
```
This is the most prominent alert in the system — SM must see it immediately.

Position: top of page, full width, below filter bar
Background: --status-warning-bg
Border-bottom: 1px solid --status-warning at 30% opacity
Padding: 14px 32px
Layout: two rows

Row 1: "Revision requested by [Name] · [date]" — 12px, --status-warning
Row 2: "[revision comment text]" — 14px, --text-primary, weight 500

Left border: 3px solid --status-warning
```

---

## LOADING STATES

```
Skeleton shimmer animation:
  Use a CSS animation sweeping a subtle gradient from left to right
  Colors: from --bg-elevated to slightly lighter (#2a2a2a) and back
  Duration: 1.5s, ease-in-out, infinite

  @keyframes shimmer {
    0%   { background-position: -100% 0; }
    100% { background-position: 200% 0; }
  }
  .skeleton {
    background: linear-gradient(90deg, --bg-elevated 25%, #252525 50%, --bg-elevated 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border-radius: 4px;
  }

Table skeleton:
  Render 8 skeleton rows matching the column widths of the real table
  Each cell: skeleton div matching the expected content width and height
  Header row is real (not skeleton) — shows column names immediately

Metric card skeleton:
  Label skeleton: 60px wide, 12px tall
  Value skeleton: 80px wide, 24px tall, margin-top 8px
  Context skeleton: 100px wide, 12px tall, margin-top 6px

Full page skeleton:
  Never show a spinning loader on a full page — always use skeleton layout
  Spinning loaders only for: button loading states, small inline actions
```

---

## MICRO-INTERACTIONS & TRANSITIONS

Keep all transitions fast and functional — not decorative.

```
Standard transition: 100ms ease (not 200ms, not 300ms — 100ms feels instant but smooth)

Apply transitions to:
  Background color changes (hover, active): 80ms
  Border color changes (focus, error): 100ms
  Opacity changes (hover reveal of row actions): 120ms
  Sheet slide-in from right: 180ms ease-out (translateX from 480px to 0)
  Dialog fade-in: 120ms ease-out (opacity 0→1, scale 0.97→1)
  Command palette: 120ms ease-out (opacity + scale from 0.96)
  Badge status changes: 200ms ease (color only)

Do NOT animate:
  Page transitions (instant navigation, like Linear)
  Table sort (instant re-render)
  Filter changes (instant re-render)
  Anything that would make the tool feel slower than it is

Row action reveal:
  .row-actions { opacity: 0; transition: opacity 80ms ease; }
  tr:hover .row-actions { opacity: 1; }
```

---

## KEYBOARD SHORTCUTS

Beyond the command palette, implement these keyboard behaviors throughout:

```
Cmd/Ctrl + K        Command palette
Escape              Close any open sheet, modal, or dialog. Collapse command palette.
Enter               Confirm focused dialog or submit focused form
Tab / Shift+Tab     Standard form navigation
Arrow Up/Down       Navigate table rows when table is focused
R                   (on PR list, OPS_HEAD only) Open Reject popover for selected row
A                   (on PR list, OPS_HEAD only) Approve selected row
/                   Focus the search input on the current page

On forms:
  Cmd/Ctrl + Enter  Submit the form (alternative to clicking Save)
```

Implement keyboard shortcuts using a global event listener pattern — not hardcoded to individual components. Create `/lib/keyboard.ts` with a `useKeyboardShortcut(key, callback, deps)` hook.

---

## PRINT EXECUTION SCREEN — SPECIAL TREATMENT

This screen is reached after a serial range is reserved. The SM will use it to physically print labels. It needs special treatment.

```
Full-width banner at top:
  Background: --status-success-bg
  Border-bottom: 1px solid --status-success at 30% opacity
  Padding: 16px 32px
  Icon: Lucide CheckCircle2, 20px, --status-success
  Title: "Serial range reserved" — 15px, weight 600, --text-primary
  Subtitle: "Batch [ID] · [series] · [qty] labels" — 13px, --text-secondary

Range display card (monospace, prominent):
  Background: --bg-elevated
  Border: 1px solid --border-default
  Border-radius: 8px
  Padding: 24px
  Max-width: 480px, centered

  Label: "Reserved Range" — 11px, --text-tertiary, uppercase
  Range: "[start] → [end]" — 28px, weight 600, font-mono, --text-primary
  Quantity: "[N] labels" — 14px, --text-secondary, margin-top 4px

Export buttons (below the card):
  Four buttons in a row, secondary variant, each with a Lucide icon:
  [Download CSV]  [Download PDF]  [Download Label Format]  [Copy Range]
  Width: equal, gap: 8px

Copy Range feedback:
  On click: button text changes to "Copied!" for 1500ms, then resets
  No toast — inline feedback is faster

Done link:
  Below export buttons, 24px margin-top
  "← Back to Purchase Requests" — 13px, --accent, no underline, hover underline
  Not a button — a plain text link
```

---

## RECONCILIATION PANEL (PO Detail)

This is the most data-critical element in the system. Four columns showing procurement progress.

```
Container:
  Background: --bg-elevated
  Border: 1px solid --border-subtle
  Border-radius: 8px
  Padding: 20px 24px
  Display: grid, 4 columns equal width

Each column:
  Label: 11px, weight 500, --text-tertiary, uppercase, letter-spacing 0.05em
  Value: 22px, weight 600, font-variant-numeric tabular-nums, --text-primary
  Context: 12px, --text-secondary, margin-top 2px

  Ordered    → --text-primary (always base reference)
  Received   → color based on received/ordered ratio:
               100%: --status-success
               1-99%: --status-warning
               0%: --text-tertiary
  Invoiced   → --text-primary
  Paid       → color based on paid/invoiced ratio (same logic as received)

Closure conditions checklist (below the 4 columns):
  Divider: 1px solid --border-subtle, margin 16px 0
  Four items in a 2×2 grid:
    Each item: Lucide CheckCircle (green) or Circle (gray, --text-tertiary) + 13px label
    Checked: --status-success icon + --text-primary label
    Unchecked: --text-tertiary icon + --text-tertiary label
```

---

## THINGS TO NEVER DO

This is as important as the positive direction above.

```
NEVER:
  Gradient backgrounds or gradient text
  Box shadows on cards (use borders instead)
  Rounded corners above 10px on any element
  Animations longer than 200ms
  Full-page loading spinners
  Color fills on table rows (hover is --bg-hover, nothing else)
  More than one primary button on a screen at the same time
  Centered page layouts (everything is left-aligned and flush)
  Emoji in UI copy
  Exclamation marks in UI copy
  "Success!" modals after actions — use toasts instead
  Onboarding tooltips, feature callouts, or product tour elements
  Font sizes above 24px on any operational screen
  Icon labels that say what the icon already shows ("Delete" next to a trash icon is fine, a trash icon next to "Delete" and a tooltip that says "Delete" is not)
  Hover tooltips on things that already have visible labels
  Disabled buttons without a visible reason why they're disabled (show a tooltip or helper text)
  Generic placeholder text like "Enter value here" — be specific: "e.g. GSTIN 22AAAAA0000A1Z5"
```

---

## COMPONENT CHECKLIST — BUILD ORDER

When building each screen, implement components in this order:

```
1. Data fetching and server action (get the data right first)
2. Empty state (always handle the zero case)
3. Loading skeleton (never show raw loading)
4. Table or form layout (the main content)
5. Status badges (visual accuracy matters)
6. Inline row actions (hover reveal)
7. Sheet or modal for add/edit (secondary interactions)
8. Toast notifications (confirmation feedback)
9. Error states (network failure handling)
10. Keyboard shortcuts (last, after everything works)
```

---

## FINAL INSTRUCTION TO CURSOR

When building any screen for KNOT Procurement, apply every specification in this document without exception. Do not default to shadcn's out-of-the-box styling — override it to match this system. Do not use light mode. Do not use Inter or system-ui as the primary font — use Geist. Do not add decorative elements that aren't specified here.

If a component or pattern isn't covered above, derive the decision from these principles:
  1. Would Linear ship this? If yes, proceed.
  2. Does it add information or remove friction? If neither, remove it.
  3. Is it the simplest implementation that communicates clearly? If not, simplify.

Every screen in this system is used by someone who has been at work since 8am and needs to get something done fast. Design for them.