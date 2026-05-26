# KNOT Procurement — FigJam export

Paste-ready diagrams and a board layout spec for building a FigJam board the team can edit, comment on, and share.

**Source of truth:** current Next.js app (`app/`, `app/actions/`, `lib/prStatus.ts`, `lib/poAutoClose.ts`).

## Live board (generated)

**Open in FigJam:** [KNOT Procurement app flow board](https://www.figma.com/board/cxHq3kvhV1quvkgcNLZric)

**File key** (for `generate_diagram` follow-ups): `cxHq3kvhV1quvkgcNLZric`

Diagrams on the board (left → right, add FigJam sections to organize):

| # | Title |
|---|--------|
| 00 | Case picker |
| 01 | Entry and auth |
| 02 | Vendor happy path |
| 03 | Internal print |
| 04 | PR status machine |
| 05 | Revision loop |
| 06 | PO lifecycle and auto-close |
| 07 | Invoice match and payment gate |
| 08 | Vendor request on PR |

**Board organization:** An automated pass wrapped diagrams inside sections and broke layout (offset/clipped art, stickies on top of shapes). **Recover via version history** — see [`RECOVERY.md`](./RECOVERY.md). The nine generated diagrams are fine; only undo the wrapper sections and extra stickies.

**Do not re-run section `appendChild` on generated diagrams** without repositioning children to section-local coordinates.

---

## Quick start (5 minutes)

1. In Figma, create a **new FigJam file** (or duplicate an existing team template).
2. Rename the file: **KNOT Procurement — App Flow (current implementation)**.
3. Open [`knot-procurement-board-spec.md`](./knot-procurement-board-spec.md) and create **Sections** (FigJam sections) in left-to-right order: `00` through `08`.
4. For each section, use **Insert → Diagram** (or the Mermaid / diagram plugin your workspace uses) and paste the matching `.mmd` file from this folder.
5. Drop the **Role legend** and **Case picker** stickies from the board spec into `00 Overview`.
6. Link sections with FigJam connectors using the **connector labels** in the spec.

If your workspace has the Figma MCP `generate_diagram` tool, run it once per `.mmd` file instead of manual paste — output lands as editable shapes on the board.

---

## Diagram files

| File | Section | Use when explaining |
|------|---------|---------------------|
| [`00-case-picker.mmd`](./00-case-picker.mmd) | 00 Overview | "Which flow am I in?" |
| [`01-entry-auth.mmd`](./01-entry-auth.mmd) | 01 Entry | Login and role routing |
| [`02-vendor-happy-path.mmd`](./02-vendor-happy-path.mmd) | 02 Vendor purchase | End-to-end vendor procurement |
| [`03-internal-print.mmd`](./03-internal-print.mmd) | 03 Internal print | Barcode / label print (no PO) |
| [`04-pr-status.mmd`](./04-pr-status.mmd) | 04 PR states | Purchase request lifecycle |
| [`05-revision-loop.mmd`](./05-revision-loop.mmd) | 05 Revisions | Send back / resubmit / cap |
| [`06-po-lifecycle.mmd`](./06-po-lifecycle.mmd) | 06 PO + close | GRN → invoice → payment → close |
| [`07-invoice-payment.mmd`](./07-invoice-payment.mmd) | 07 Match + pay | 3-way match and payment gate |
| [`08-vendor-on-pr.mmd`](./08-vendor-on-pr.mmd) | 08 Vendor request | New vendor during PR create |

---

## FigJam styling (recommended)

Apply these sticky / shape colors so swimlanes stay consistent across frames:

| Color | Hex (sticky) | Meaning |
|-------|----------------|---------|
| Blue | `#DAE8FC` | **SM** — store manager actions |
| Purple | `#E8DAFF` | **OPS_HEAD** — operations head |
| Green | `#D5F5E3` | **FINANCE** — finance |
| Gray | `#F0F0F0` | System / auto (closure, match engine) |
| Yellow | `#FFF9C4` | Decision or gate |
| Red tint | `#FFCDC2` | Terminal / blocked |

Add a fixed **Role legend** frame (copy text from board spec) so new teammates do not infer roles from diagram color alone.

---

## Maintenance

When flows change in code, update in this order:

1. `lib/prStatus.ts` / `lib/poAutoClose.ts` / relevant `app/actions/*`
2. Matching `.mmd` in `docs/figjam/`
3. Sticky copy in `knot-procurement-board-spec.md` if labels or actors changed

---

## Related docs

- [`../knot_procurement_ui_ux.md`](../knot_procurement_ui_ux.md) — screen-level UX
- [`../performance_fiix.md`](../performance_fiix.md) — performance notes
