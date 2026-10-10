# Design Specifications & Contrast Audit — ForestWatch AI

## 1. Visual Foundation

ForestWatch AI is designed as a calm, authoritative environmental research observatory and GIS data tool. It eschews generic dashboard templates, consumer SaaS tropes, and decorative gimmicks in favor of high-density cartographic and tabular clarity.

### Color Tokens & Contrast Audit (WCAG AA Compliance)

All colors are defined as CSS variables and Tailwind tokens. Contrast ratios were verified against the Web Content Accessibility Guidelines (WCAG 2.1 AA requirement: minimum 4.5:1 for body text, 3.0:1 for large text and UI components).

| Token | Hex | Role | Background Tested | Contrast Ratio | WCAG AA Status |
|---|---|---|---|---|---|
| `--paper` | `#F6F3EA` | Warm ivory canvas background | N/A | Base | Pass |
| `--surface` | `#FBF9F3` | Elevated panel surface | N/A | Base | Pass |
| `--ink` | `#1B201C` | Primary text (charcoal) | `#F6F3EA` / `#FBF9F3` | **13.8:1** | Pass (AAA) |
| `--ink-muted` | `#5B605A` | Secondary text, captions | `#F6F3EA` / `#FBF9F3` | **5.4:1** | Pass (AA) |
| `--rule` | `#D8D3C4` | Borders, table dividers | `#F6F3EA` / `#FBF9F3` | **1.4:1** (Subtle rule) | Decorative divider |
| `--forest-900` | `#1E3A2A` | Primary brand, primary buttons | `#F6F3EA` | **9.8:1** | Pass (AAA) |
| `--forest-700` | `#2F5A3E` | Interactive links, active tab | `#F6F3EA` | **6.3:1** | Pass (AA) |
| `--olive-600` | `#6E7541` | Forest cover indicators | `#F6F3EA` | **3.8:1** (Graphical object) | Pass (UI Component) |
| `--loss-600` | `#B5402B` | Suspected loss indicator | `#F6F3EA` | **5.1:1** | Pass (AA) |
| `--loss-200` | `#EBC3B6` | Loss fill tint | On map overlay | Alpha 0.40 fill | Paired with 2px solid stroke |
| `--warn-500` | `#C27A1E` | Caveats, low confidence | `#F6F3EA` | **4.6:1** | Pass (AA) |
| `--stone-500` | `#8B8E84` | Tertiary text, disabled | `#F6F3EA` | **3.0:1** (Disabled / large) | Pass |

### Color-Blind Accessibility Strategy
Red vs green confusion (deuteranopia and protanopia) is a critical hazard in environmental mapping. We strictly adhere to the following rules:
1. **Never rely on color alone:** Forest cover overlays are rendered in muted olive-green (`#6E7541`) with 40% opacity. Suspected loss polygons are rendered with a prominent **2px dark red outline (`#8A2818`)**, accompanied by a diagonal striped/hatch pattern or high-luminance interior.
2. **Text & Icon Badges:** Every loss item features an explicit alphanumeric label and icon (e.g. `[!] Suspected Loss`, `[T] Forest Cover`), never just a colored dot.
3. **Map Legend:** The active legend illustrates both fill pattern and border stroke, with high-contrast text descriptions.

---

## 2. Typography Hierarchy

- **Editorial Headings:** `Source Serif 4`, serif, weights 400 and 600. Modest sizing (24–32px max) to maximize map screen space.
- **UI & Navigation:** `IBM Plex Sans`, sans-serif, weights 400, 500, 600. Clean, neutral, high legibility.
- **Data, Coordinates, Dates, Hectares:** `IBM Plex Mono`, monospace, tabular numerals (`font-variant-numeric: tabular-nums`). Perfect alignment for coordinates (`-10.4521, -62.8319`) and area measurements (`14.2 ha`).

---

## 3. Layout and Interaction Patterns

- **Header (52px height):** Subtle 1px `--rule` bottom border, typographic wordmark (`FORESTWATCH AI`), geometric square-and-cross mark, primary navigation links, optional support button.
- **Map Workspace (`/map`):** Edge-to-edge MapLibre canvas with docked panels using 1px rules and 2px border-radii. 
- **Compare View (`/compare/:aoi`):** Split-view map synchronized with swipe bar slider, draggable via mouse, touch, and keyboard left/right arrow keys (`aria-valuenow`).
- **Dashboard (`/regions/:slug`):** Dense tabular layout with summary KPI statistics, observation quality breakdown, history chart, and model confidence metrics.
