# 00 · Anti-Slop Checklist — the tells and their fixes

Run this against any dashboard surface before calling it done. Each row is a **tell**
(what AI defaults to) and the **fix** (what designed UI does). Sources at bottom.

## Color & surface

| Tell (slop) | Fix |
|---|---|
| One purple/indigo→blue gradient as the hero/brand surface | Neutral base; a **single** accent used sparingly "like punctuation" (Geist). Gradients, if any, are subtle and tonal — not the rainbow default. |
| Saturated colored cards everywhere | Color carries *meaning* (status, deltas), not decoration. Most surfaces are neutral. |
| Accent color on every button, badge, icon, and link at once | One primary action per view. Everything else is neutral/ghost. |
| Pure-black text `#000` on pure-white `#fff` | Off-black ink (`~#171717`) on off-white; reserve max contrast for true emphasis. |

## Depth & shadow

| Tell | Fix |
|---|---|
| Flat even shadow `0 0 10px rgba(0,0,0,.1)` (glow, no direction) | Directional, **one light source**: vertical offset ≈ 2× horizontal. See [02](02-elevation-shadows.md). |
| Pure-black shadows | Tint with HSL (hue+sat of the bg), low per-layer alpha. |
| Single huge blurry shadow for "elevation" | **Layer** 2–8 shadows; more layers = higher elevation (penumbra). |
| Same shadow on a resting card and a modal | Elevation is a *scale* — rest < hover < popover < modal. |

## Layout & spacing

| Tell | Fix |
|---|---|
| Every card identical size, evenly tiled, no rhythm | Vary by importance; use a real grid with intentional spans. A hero metric ≠ a list item. |
| Uniform padding everywhere, no density logic | Dense data (tables) gets compact rhythm; marketing/hero gets air. |
| Everything center-aligned | Left-align text and numbers; center only genuinely symmetric content. Numbers right-align in tables. |
| Borders on everything (boxes in boxes) | Prefer whitespace + subtle fills to separate; 1px hairlines only where needed. |

## Typography

| Tell | Fix |
|---|---|
| Inter (or default sans) at 3 near-identical gray sizes | Role-based scale; **one display/accent face** for soul. See [03](03-typography.md). |
| Proportional figures in metrics/tables (digits jitter) | `font-variant-numeric: tabular-nums` on all numeric data. |
| Hierarchy by size only | Hierarchy = size **+** weight **+** color **+** tracking, together. |
| Default letter-spacing on big display text | Tighten tracking as size grows (negative tracking on display). |
| 5+ font weights, faux-bold | 2–4 real weights from a variable font. |

## State & interaction

| Tell | Fix |
|---|---|
| No `:focus-visible` styles (or `outline: none` with no replacement) | Always a visible focus ring. Modern `outline` + `outline-offset` respects radius and works in forced-colors. See [07](07-interaction-states.md). |
| Only `:hover` styled; no active/disabled | Four states: rest / hover / active / focus-visible, plus disabled. |
| Buttons scale `1 → 0.8` on press (cartoonish) | Subtle `~0.96` press scale; proportional to size. |
| Hover with no transition (instant jump) | 120–160ms transition on hover/active. |

## Charts & data-viz

| Tell | Fix |
|---|---|
| Default Chart.js/Recharts look, rainbow categorical colors | Single-hue ramp for sequential; ≤ a few categoricals; mute the rest. See [05](05-charts-dataviz.md). |
| Heavy gridlines, 3D bars, dual axes, drop-shadowed pie | Restrained axes, flat 2D, single axis, direct labels. |
| No empty / loading / zero state | Design all three; never a bare blank chart. |
| Numbers formatted inconsistently (`$1200` vs `1,200.00`) | One number-format system; tabular figures. |

## Motion

| Tell | Fix |
|---|---|
| Slow (>300ms) or `linear`/`ease-in` everything | <200ms interactions; `ease-out`/custom curves; never `ease-in`. See [06](06-motion-easing.md). |
| Animating `width`/`height`/`margin`/`top` | `transform` + `opacity` only (GPU). |
| Entrances from `scale(0)` / fly across screen | Start `scale(0.95)` + fade; small travel. |
| Motion ignores `prefers-reduced-motion` | Gate non-essential motion behind the query. |

## Iconography & detail

| Tell | Fix |
|---|---|
| Emoji as UI icons | A real icon set, consistent grid/stroke. (e.g. `lucide-react` at one stroke width throughout.) |
| Mismatched icon weights/styles mixed | One family, one stroke width, one corner style. |
| Placeholder "Lorem ipsum" / fake-perfect data | Realistic, region-aware data with varied lengths and edge cases. |

---

### Sources
- Vercel Geist — neutral palette, accent "like punctuation": https://www.designsystems.one/design-systems/vercel-geist · https://vercel.com/geist/typography
- Josh Comeau — shadows/one light source: https://www.joshwcomeau.com/css/designing-shadows/
- Rauno Freiberg — interaction details: https://github.com/raunofreiberg/interfaces
- Emil Kowalski — motion: https://github.com/emilkowalski/skill
- Anti-slop essays: https://impeccable.style/slop/ · https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website · https://trilogyai.substack.com/p/fixing-visual-ai-slop · https://andrew.ooo/posts/taste-skill-anti-slop-ai-frontend-review/

> ⚠️ Unverified per research caveats — treat as strong defaults, not settled law.
