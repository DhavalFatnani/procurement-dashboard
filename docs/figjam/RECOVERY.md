# FigJam board recovery

The automated “organize” step broke the layout by moving generated diagrams **into section frames without fixing coordinates**. Connectors and nested sections (e.g. SM / OPS_HEAD inside the vendor diagram) ended up clipped, offset, or stacked with annotation stickies on top of shapes.

**The 9 Mermaid diagrams are still valid** — only the wrapper sections, header stickies, and annotation stickies need to go (or the file should be restored from history).

---

## Option A — Fastest (recommended): Version history

1. Open the board: https://www.figma.com/board/cxHq3kvhV1quvkgcNLZric  
2. Click the **file name** (top left) → **Show version history** (or `⌘` + `Option` + `H` on Mac).  
3. Pick a version **before** sections `00 Overview` … `08 Vendor request on PR` were added (today, before “organize”).  
4. **Restore** that version.

You keep the nine generated diagrams in a horizontal row; you lose only the broken sections and extra stickies.

---

## Option B — Manual cleanup (if history is unavailable)

### 1. Delete the nine wrapper sections

In the layers panel, delete these sections (names only — **not** the inner `SM` / `OPS_HEAD` / `Closure checks` groups inside diagram 02/06 if they still appear as separate items on the canvas):

- `00 Overview`
- `01 Entry and auth`
- `02 Vendor happy path`
- `03 Internal print`
- `04 PR status machine`
- `05 Revision loop`
- `06 PO lifecycle`
- `07 Invoice and payment`
- `08 Vendor request on PR`

When FigJam asks, choose to **keep contents on the board** (move children out), not delete contents.

### 2. Delete MCP-added stickies and title (if still present)

Remove stickies/text above the diagrams:

- Title: **KNOT Procurement — App Flow**
- Legend stickies: Ledger only, Two execution types, SM, OPS_HEAD, FINANCE
- Workshop sticky: **45-min walkthrough**
- Small stickies inside sections (routes, guards, “Vendor buying → section 02”, etc.)

### 3. Re-align diagrams

1. Select all diagram shapes (`⌘` + `A` or marquee).  
2. **Arrange** → tidy into one horizontal row (or use **Tidy up** if available).  
3. Zoom to fit (`Shift` + `1`).

### 4. Optional: regenerate a clean board

From repo root, paste each file in `docs/figjam/*.mmd` via **Insert → Diagram** into a **new** FigJam file. Do **not** run the section-wrapper script again until layout is planned with correct local coordinates.

---

## Option C — When Figma MCP limit resets

Ask the agent to run the recovery script (unwrap sections + remove annotation stickies). Script intent:

1. For each wrapper section `13:568` … `13:576`, move children to the page with **absolute** `x/y` (`section.x + child.x`).  
2. Remove wrapper sections.  
3. Remove header/legend stickies and `14:*` / `15:*` annotation stickies.

---

## What went wrong (for next time)

- `appendChild` into a section switches nodes to **section-local** coordinates; the script resized sections before children were repositioned.  
- Annotation stickies were placed at `(16, 16)` inside sections, on top of diagrams.  
- Diagrams already contained **nested sections** (vendor swimlanes); wrapping the whole cluster in another section doubled nesting.

**Safe pattern for later:** leave diagrams on the canvas; add **empty section frames** behind them for labels only, or add stickies in the **margin** (negative local x or below `maxBottom`), never at `(16,16)` over the art.

---

## After recovery

- Source diagrams: `docs/figjam/*.mmd`  
- Board spec (stickies only, no auto-wrap): `knot-procurement-board-spec.md`  
- Live board link: https://www.figma.com/board/cxHq3kvhV1quvkgcNLZric
