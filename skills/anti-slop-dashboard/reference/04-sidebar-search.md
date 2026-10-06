# 04 · Sidebar & Search

Two premium sidebar archetypes. Pick by product type, then make the **search/⌘K** and the
**active state** excellent — those two details carry the "premium" read.

> **Provenance:** Linear's flat-list rationale is research-backed. The nav-card-grid
> dimensions are **authored from the ZIXO reference image + practice** (corpus gap) — treat
> as a reasoned starting point.

## Variant A — Flat grouped list (Linear / Excermol)

Dense, quiet, scales to many items. Linear deliberately uses this to **"reduce visual noise…
increase the hierarchy and density of navigation elements."** Best for tools with lots of
destinations (HRMS modules, issue trackers).

```
┌─────────────────────────┐  width: 240–280px
│  ⌘K  Search…            │  search pinned top
│                         │
│  MAIN                   │  group label (eyebrow: 11px, uppercase, +tracking, gray)
│  ▸ Dashboard            │  item: height 32–36px, padding 0 10px, gap 10px
│  ▸ Employees            │  icon 16–18px + label 13–14px
│  ▸ Attendance           │
│                         │
│  GROWTH                 │
│  ▸ Goals                │
│  ▸ Performance          │
│                         │
│  [ Pro upsell card ]    │  pinned bottom (optional)
└─────────────────────────┘
```

```css
.nav-item {
  display:flex; align-items:center; gap:10px;
  height:34px; padding:0 10px; border-radius:8px;
  font-size:14px; font-weight:500; color: var(--ink-gray-7);
  transition: background-color 140ms var(--ease-out);
}
.nav-item:hover           { background: var(--state-hover-bg); color: var(--ink-gray-9); }
.nav-item[aria-current]   { background: var(--surface-gray-3); color: var(--ink-gray-9); font-weight:600; }
.nav-group-label {
  font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase;
  color: var(--ink-gray-5); padding:0 10px; margin:14px 0 4px;
}
```

### Active-item treatments (pick ONE, use consistently)
- **Soft pill fill** (above) — calm, default for neutral systems.
- **Left-rail indicator** — 2–3px accent bar on the left edge + subtle fill. Good when you
  want the accent to register.
- **Filled accent** — strongest; reserve for app-launcher feel (see Variant B).

> Active state must persist **without** hover — selection ≠ hover. Use `aria-current="page"`.

## Variant B — Nav-card grid (ZIXO)

Soft icon-over-label cards in a 2-column grid, one **dark-filled active** card. App-launcher
/ fintech feel; best with **few** primary destinations (~4–8). Looks premium but doesn't
scale to 20 modules — past ~8, use Variant A.

```
┌──────────────────────────┐  width: 240–260px, padding 16px
│  ⌘K  Search…             │
│  ┌────────┐ ┌────────┐    │  2-col grid, gap 10–12px
│  │  ⌂     │ │  ▦     │    │  card: ~104–112px wide, ~84–96px tall
│  │ Home   │ │ Cards◀─┼──── active = dark-filled
│  └────────┘ └────────┘    │
│  ┌────────┐ ┌────────┐    │
│  │ Stats  │ │Transfers│   │
│  └────────┘ └────────┘    │
│                          │
│  ▸ Freeze Card           │  secondary items = flat list below
│  ▸ Security              │
│  [ Pro 🚀 upsell card ]  │  pinned bottom
└──────────────────────────┘
```

```css
.nav-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.nav-card {
  display:flex; flex-direction:column; gap:10px;
  padding:14px; min-height:88px; border-radius:14px;
  background: var(--surface-gray-2); border:1px solid var(--outline-gray-1);
  color: var(--ink-gray-7);
  transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out);
}
.nav-card .icon { width:20px; height:20px; }
.nav-card .label { font-size:13px; font-weight:500; }
.nav-card:hover  { transform: translateY(-2px); background: var(--surface-gray-3); }
.nav-card[aria-current] {                       /* dark-filled active */
  background: var(--surface-gray-10); color: var(--ink-white); border-color: transparent;
}
.nav-card:focus-visible { outline:2px solid var(--focus-ring-color); outline-offset:2px; }
```

## The search / ⌘K bar (both variants)

The pinned search is a major premium signal. It's a **trigger**, not a live input — clicking
or pressing ⌘K opens a command palette (cmdk/Radix/Supabase CommandMenu pattern).

```html
<button class="sidebar-search" aria-keyshortcuts="Meta+K">
  <svg class="icon">…search…</svg>
  <span>Search…</span>
  <kbd>⌘K</kbd>
</button>
```
```css
.sidebar-search {
  display:flex; align-items:center; gap:8px; width:100%;
  height:36px; padding:0 10px; border-radius:8px;
  background: var(--surface-gray-2); border:1px solid var(--outline-gray-2);
  color: var(--ink-gray-5); font-size:13px;
  transition: border-color 140ms var(--ease-out), background-color 140ms var(--ease-out);
}
.sidebar-search:hover { border-color: var(--outline-gray-3); }
.sidebar-search kbd {
  margin-left:auto; font:500 11px var(--font-mono);
  padding:2px 6px; border-radius:5px; background: var(--surface-gray-3); color: var(--ink-gray-6);
}
```
- Bind a real global `⌘K` / `Ctrl+K` handler; show the `<kbd>` hint.
- Palette: fuzzy search across nav + actions + records; arrow-key nav; recent items on open.

## Which variant?
- **Many destinations, density matters** (HRMS, admin) → **Variant A** (flat list).
- **Few hero destinations, want flair** (consumer fintech, launcher) → **Variant B** (cards).
- Don't force >8 items into the card grid — that's where it tips into slop.

### Sources
- Linear UI redesign (flat-list density rationale): https://linear.app/now/how-we-redesigned-the-linear-ui · https://linear.app/changelog/2024-12-18-personalized-sidebar
- Command menu pattern: https://supabase-design-system.vercel.app/design-system/docs/components/commandmenu
- Sidebar gallery: https://www.navbar.gallery/blog/best-side-bar-navigation-menu-design-examples

> ⚠️ Card-grid dimensions authored from the reference image + practice (corpus gap) — tune to your icon set and item count.
