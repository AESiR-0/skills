---
name: anti-slop-dashboard
description: >-
  Prevents "AI slop" when building dashboards, admin UIs, and data-dense product
  surfaces. Use whenever creating or restyling a dashboard, KPI/stat cards, charts,
  a sidebar/nav, tables, or any premium glass / soft-SaaS interface. Provides a
  vetted reference library (glass cards, elevation, typography, sidebar+search,
  charts, motion, interaction states, buttons) with copy-pasteable token values,
  CSS, and easing curves — plus a checklist of slop "tells" and the concrete fix
  for each. Read the relevant reference file BEFORE writing dashboard UI.
---

# Anti-Slop Dashboard

A reference library for building dashboards that look **designed**, not **generated**.
"AI slop" is the generic look LLMs default to: even gray shadows, one purple gradient,
Inter at three barely-different sizes, no focus states, every card the same. This skill
encodes the concrete rules and values that avoid it.

> **Provenance.** Values here were assembled by deep research across authoritative
> interaction-design sources (Rauno Freiberg, Emil Kowalski/animations.dev, Vercel Geist,
> shadcn/ui, Apple WWDC25, Inter/rsms, Josh Comeau) plus design blogs. The **load-bearing
> numeric claims were then adversarially re-verified** (3 skeptic votes each, fetching the
> cited sources): **14/16 confirmed, 2 corrected** (shadow per-layer alpha → constant, not
> tapering; motion entrance scale `0.95` is shadcn/Radix, Rauno's value is `~0.8`). Remaining
> numbers are tuned starting points — still sanity-check against your real backgrounds and the
> installed versions of your tools. Each reference file cites its sources.

---

## How to use this skill

1. **Before building any dashboard surface, open the matching reference file.** Don't
   freestyle from memory — that's how slop happens.
2. **Run the [slop checklist](reference/00-anti-slop-rules.md) against your output** before
   declaring done. If you hit a "tell," apply the listed fix.
3. **Map every generic token onto the project's own design system.** Look for a design-system
   doc (`docs/DESIGN_SYSTEM.md`, a tokens file, `globals.css`) or a `<project>-adapter.md`
   placed next to this skill. Bind the generic names (`--state-hover-bg`, `--focus-ring-color`,
   primary button fill/ink) to the project's tokens, and note any deliberate deviations, for
   example dark-only, opaque surfaces instead of glass, or a neutral primary button with the
   accent reserved for links and focus. In charts, use concrete hex: CSS vars do not resolve
   inside SVG presentation attributes.

## Reference library

| File | Covers |
|---|---|
| [`00-anti-slop-rules.md`](reference/00-anti-slop-rules.md) | **The checklist** — every slop "tell" + its one-line fix. Start here. |
| [`01-glass-cards.md`](reference/01-glass-cards.md) | Frosted glass recipe: blur/saturate/tint/border/radius, hover-lift |
| [`02-elevation-shadows.md`](reference/02-elevation-shadows.md) | Layered soft shadows, one light source, HSL tint, elevation scale |
| [`03-typography.md`](reference/03-typography.md) | Premium pairing (serif-italic display + grotesk), scale, OpenType, tabular figures |
| [`04-sidebar-search.md`](reference/04-sidebar-search.md) | Sidebar anatomy, ⌘K search, active states; flat-list vs nav-card-grid |
| [`05-charts-dataviz.md`](reference/05-charts-dataviz.md) | Sparklines, gradient/hatch fills, gauges, delta pills, palette restraint |
| [`06-motion-easing.md`](reference/06-motion-easing.md) | Duration + easing tokens, what to animate, reduced-motion |
| [`07-interaction-states.md`](reference/07-interaction-states.md) | hover/active/focus/disabled per element; focus-ring guidance |
| [`08-buttons.md`](reference/08-buttons.md) | primary/secondary/ghost/destructive, press, loading |

---

## The five anti-slop principles (the throughline)

These cut across every file. If you internalize nothing else:

1. **Restraint with color.** Neutral base; one accent used *like punctuation*, not as
   colorful surfaces. Generic purple/blue gradients are the #1 slop tell.
2. **One light source.** Shadows are physical — vertical offset ≈ 2× horizontal, tinted
   (HSL) not pure black, multi-layered. Flat even `0 0 10px rgba(0,0,0,.1)` reads as slop.
3. **Real hierarchy.** Type differs by *role* (size + weight + color + tracking together),
   not three sizes of the same gray. Numbers are `tabular-nums`. One accent face for soul.
4. **Every interactive thing has four states.** rest / hover / active / focus-visible —
   and disabled. Missing focus states are both slop and an a11y failure.
5. **Motion is fast and physical.** <200ms for interactions, `transform`/`opacity` only,
   never `ease-in`, honor `prefers-reduced-motion`. Slow/linear/janky motion screams slop.
