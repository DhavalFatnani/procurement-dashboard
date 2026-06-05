# Product

## Register

product

## Users

KNOT Procurement serves three internal roles at a quick-commerce fashion startup, all on laptop or desktop (no mobile requirement):

- **Warehouse Store Manager (SM):** Raises purchase requests, records goods receipts (GRNs), prints barcode labels, and resolves receiving exceptions. Spends long stretches in list and detail views, often under time pressure during inbound operations.
- **Ops Head:** Approves requests, governs vendors and catalog, and needs full visibility across procurement, serial governance, and fulfillment. Switches between oversight dashboards and deep detail pages.
- **Finance:** Processes payables: invoice settlement, vendor advances, payment register, and read-only PO financials. Lands on Invoice settlement by default; works through approval and allocation workflows.

All users are repeat operators, not occasional visitors. They use the system for hours daily, typically in warehouse offices or corporate environments with normal ambient lighting.

## Product Purpose

KNOT Procurement is an internal warehouse procurement and serial governance tool. It coordinates the full lifecycle from purchase request through PO, goods receipt, invoicing, and payment, with strict serial-number tracking for fashion inventory.

Success means operators can complete routine tasks with minimal friction: find the right record fast, act with confidence, and move to the next item without hunting for context. The interface should feel as fast and keyboard-friendly as tools like Linear, while carrying the information density needed for serious operational work.

## Brand Personality

**Three words:** Precise, efficient, trustworthy.

**Voice:** Direct and factual. No cheerleading, no exclamation marks, no onboarding fluff. Copy states what happened or what to do next. Empty states are dry and specific ("No vendors found."), not encouraging ("Let's get started!").

**Emotional goal:** Calm competence. Users should feel the system is reliable, responsive, and built for sustained daily work, not for impressing a demo audience.

**References (what to borrow):**
- **Linear:** Interaction speed, keyboard philosophy, fast table row hover, minimal animation latency.
- **Notion / Stripe dashboard:** Clear hierarchy, airy but dense layouts, polished surfaces without decorative noise.
- **Role-aware accents:** Subtle role tints (teal SM, indigo Ops, violet Finance) to orient users without overwhelming the UI.

## Anti-references

Explicitly avoid:

- Generic SaaS marketing aesthetics: hero metrics with gradient accents, identical icon-card grids, cream/sand body backgrounds, tiny uppercase eyebrows on every section.
- Decorative UI: gradient text, gradient backgrounds as default, glassmorphism for its own sake, box shadows on cards where borders suffice, rounded corners above 10px on operational elements.
- Onboarding patterns: product tours, feature callouts, tooltip overload on already-labeled controls.
- Performative feedback: "Success!" modals, emoji, exclamation marks, illustrations in empty states.
- Layout anti-patterns: centered page layouts, full-page loading spinners, more than one primary button per screen.
- Font defaults: Inter or system-ui as primary; decorative fonts; sizes above 24px on operational screens.
- Copy anti-patterns: generic placeholders ("Enter value here"), restated headings, marketing buzzwords (streamline, empower, seamless).

The original design spec (`docs/knot_procurement_ui_ux.md`) also documents additional component-level bans; treat those as binding for implementation.

## Design Principles

1. **Design for the eighth hour.** Every screen assumes a user who has been working since morning and needs to finish one more task before moving on. Density, speed, and clarity beat novelty.
2. **Tables are the product.** List and detail views are the primary UI. Tables, filters, and row actions must be pixel-accurate, fast to scan, and keyboard-accessible.
3. **Friction only where governance requires it.** Approval gates, serial validation, and financial controls stay explicit; everything else should be one or two clicks.
4. **Show, don't decorate.** Color carries meaning (status, role, accent). Motion confirms action (hover, press, route change) and never blocks work. Respect `prefers-reduced-motion`.
5. **Would Linear ship this?** If a pattern adds neither information nor reduced friction, remove it. Prefer the simplest implementation that communicates clearly.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA** for contrast on text and interactive controls in both light and dark themes.
- Honor **`prefers-reduced-motion`**: replace animations with instant state changes or subtle crossfades.
- Desktop-only scope: no mobile layout requirement, but responsive behavior within laptop viewports (1280px content max, fixed sidebar) should remain usable.
- Disabled controls must expose a visible reason (helper text or tooltip), not silent disable states.
- Monospace formatting for IDs, serial ranges, GST numbers, and numeric columns aids scannability for all users.
- Keyboard shortcuts are a first-class affordance for power users (implement after core flows work).
