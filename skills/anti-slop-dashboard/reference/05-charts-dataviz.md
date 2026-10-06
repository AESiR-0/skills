# 05 · Charts & Data-Viz

Best-sourced area of the research (Datawrapper, FT). The throughline: **restraint with
color, match chart to data relationship, restrain the chrome.**

## Color discipline (the anti-rainbow rules)

| Rule | Why | Source |
|---|---|---|
| **Cap categorical palettes at ~6 colors** (5–7 sweet spot). Past 7, switch chart type or group categories. Readability breaks down past ~8–10. | More hues = the eye can't match color→category | Datawrapper + Claus Wilke (high) |
| **Gray is the de-emphasis tool**, not a category. Color pops *against* gray. | "Against gray elements, colored ones stick out." | Datawrapper (high) |
| **Don't emphasize everything.** If every series is saturated, none reads as important. | "If everything is important, nothing is." | Datawrapper (med) |
| **Never use a single-hue sequential ramp for *categorical* data** — implies false ranking. Distinct hues for categories; ramps only for ordered/sequential. | "dark = more, light = less" → fake order | Datawrapper (high) |
| **Vary shape, not hue.** Premium guides (McKinsey) restrict to one hue family and change chart shape. | Distinction without rainbow | Datawrapper (med) |

```css
:root {
  --chart-1: #0d8ef8;  /* primary series — the one that matters */
  --chart-ink: #525252; /* gray for de-emphasized/context series */
  --chart-grid: #ededed; /* faint gridlines — barely there */
  --chart-axis: #999999; /* axis labels */
  --pos: #268c5c;  --neg: #e03434; /* delta semantics */
}
```

## Match chart to the data relationship (FT Visual Vocabulary)

Pick by *relationship*, not looks. The nine FT categories: **Deviation, Correlation, Ranking,
Distribution, Change-over-time, Magnitude, Part-to-whole, Spatial, Flow.**

| You want to show… | Use | Not |
|---|---|---|
| Change over time | line / area | pie |
| Magnitude comparison | column / bar | 3D bar, radar |
| Part-to-whole (few parts) | **segmented horizontal bar** | pie with 8 slices |
| Single progress to target | **arc/gauge ring** | gauge with 5 needles |
| Trend inside a KPI card | **sparkline** | full chart with axes |

## KPI sparklines (in stat cards)

Compact area chart, **48–64px tall** (Tremor `h-12`=48px; shadcn `h-16`=64px), no axes,
trend-keyed color, gradient fill fading to transparent:

```jsx
// Recharts/shadcn pattern
<defs>
  <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"  stopColor="var(--chart-1)" stopOpacity={0.30} />
    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
  </linearGradient>
</defs>
<Area dataKey="v" stroke="var(--chart-1)" strokeWidth={2}
      fill="url(#spark)" dot={false} />
```
- **One `var(--chart-N)` token per card**, keyed to trend (green up / red down) — a two-state
  semantic scheme, *not* a categorical rainbow.
- Solid → **near-transparent** vertical gradient (the standard shadcn build fades to ~`0.1`,
  not literally `0`; `linearGradient` in `<defs>`, referenced via `url(#id)`).
- Pair the headline figure (`tabular-nums`) with an inline **delta pill**.

## Delta pills

```html
<span class="delta delta--up">▲ 12.4%</span>
```
```css
.delta { display:inline-flex; align-items:center; gap:4px; font-variant-numeric: tabular-nums;
         font-size:12px; font-weight:500; padding:2px 8px; border-radius:999px; }
.delta--up   { color: var(--pos); background: color-mix(in srgb, var(--pos) 12%, transparent); }
.delta--down { color: var(--neg); background: color-mix(in srgb, var(--neg) 12%, transparent); }
```
Direction by **icon + color**, never color alone (colorblind-safe). Up isn't always "good"
(e.g. churn ↑ is bad) — key semantics to *meaning*, not direction.

## Gradient + diagonal-hatch fills (the Finexa look)

```svg
<pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-1)" stroke-width="2" opacity="0.5"/>
</pattern>
<!-- fill bars/areas with url(#hatch) over a faint gradient base for texture -->
```
Texture adds richness *without* adding colors — a way to differentiate series while obeying
the ≤6-hue rule.

## Restrain the chrome
- **Gridlines:** faint (`--chart-grid`), horizontal only, or none. No heavy boxes.
- **Axes:** thin, gray labels, `tabular-nums`. Drop the axis line if ticks imply it.
- **No 3D, no drop-shadowed pie, no dual y-axes** (misleading). Flat 2D.
- **Direct-label** the important series instead of forcing a legend lookup.
- **Number formatting is consistent**: one system (`$1,200` / `1.2k` / `12.4%`), tabular.

## Required states (never skip)
- **Empty:** a real "no data yet" state with guidance — not a blank canvas.
- **Loading:** skeleton matching the chart's footprint (no layout jump).
- **Zero / single point:** handle gracefully (a 1-point "line" shouldn't crash or look broken).

### Sources
- Datawrapper Academy & blog (color, line charts): https://www.datawrapper.de/academy/what-to-consider-when-choosing-colors-for-data-visualization · /blog/emphasize-with-color-in-data-visualizations · /blog/colors-for-data-vis-style-guides · /blog/10-ways-to-use-fewer-colors-in-your-data-visualizations
- FT Visual Vocabulary: https://github.com/Financial-Times/chart-doctor/blob/main/visual-vocabulary/README.md
- Sparkline dims/gradient: https://www.tremor.so/docs/visualizations/spark-chart · https://www.shadcn.io/blocks/stats-sparkline-gradient-trend
- Numerals: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric

> ⚠️ Color/selection rules well-sourced (unverified). Sparkline px values are library-version-dependent — confirm against current Tremor/shadcn.
