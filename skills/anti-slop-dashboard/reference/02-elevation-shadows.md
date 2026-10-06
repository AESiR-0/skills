# 02 · Elevation & Shadows

The single biggest "is this designed or generated" signal. Slop = one flat even glow.
Designed = layered, directional, tinted shadows from a consistent light source.

## The three rules

1. **One light source.** Light comes from above, so shadows fall *below*. The **vertical
   offset is always ~2× the horizontal offset** (light from top → mostly-downward shadow).
2. **Layer, don't blur.** Real elevation is many soft shadows stacked (penumbra), not one
   big blur. More layers + larger offsets = higher off the page.
3. **Tint, don't blacken.** Pure black shadows look muddy. Tint with the background's hue
   and a little saturation; keep per-layer alpha low.

## Elevation scale (copy-paste)

Neutral, near-black tint. Use the rung that matches the element's height off the page.

```css
:root {
  /* resting / subtle (cards at rest) — 2 layers */
  --shadow-1:
    0 1px 2px rgba(17, 24, 39, 0.06),
    0 1px 3px rgba(17, 24, 39, 0.10);

  /* raised (hovered card, small popover) — 3 layers */
  --shadow-2:
    0 2px 4px rgba(17, 24, 39, 0.06),
    0 4px 8px rgba(17, 24, 39, 0.08),
    0 8px 16px rgba(17, 24, 39, 0.08);

  /* floating (dropdown, menu) — 4 layers */
  --shadow-3:
    0 2px 4px rgba(17, 24, 39, 0.05),
    0 6px 12px rgba(17, 24, 39, 0.08),
    0 12px 24px rgba(17, 24, 39, 0.10),
    0 24px 40px rgba(17, 24, 39, 0.10);

  /* modal / dialog — 5+ layers, biggest spread */
  --shadow-4:
    0 4px 8px rgba(17, 24, 39, 0.05),
    0 12px 24px rgba(17, 24, 39, 0.08),
    0 24px 48px rgba(17, 24, 39, 0.12),
    0 48px 80px rgba(17, 24, 39, 0.14);
}
```

Note the pattern as you go up the scale: **more layers, offset ↑, blur ↑, and a growing
negative spread** (which keeps the larger blurs from ballooning). Per-layer **alpha stays
roughly constant** — in Comeau's shadow-palette generator every layer uses ~`0.34`, across
all tiers; it does *not* taper per layer. (Decreasing alpha outward is a separate, optional
style — Tobias Ahlin — not a function of elevation.) Layer counts: **low 3 · medium 4 · high
up to 8**. That's the physics of moving an object away from a surface.

> ✅ Verified (3-vote, against the live Comeau generator). The earlier "per-layer alpha ↓"
> phrasing was refuted — corrected above.

## Tinted shadows (premium feel)

Instead of gray, derive the shadow from a hue so it harmonizes with the surface:

```css
:root { --shadow-color: 220deg 40% 20%; }   /* cool slate; pick from your palette */
.card {
  box-shadow:
    0 1px 2px  hsl(var(--shadow-color) / 0.08),
    0 4px 8px  hsl(var(--shadow-color) / 0.08),
    0 8px 16px hsl(var(--shadow-color) / 0.08);
}
```

Josh Comeau's generator builds these "shadow palettes" (3 layers low → 8 high) automatically.

## Dark mode

Shadows barely read on dark UIs — switch to **deeper alpha + a top highlight border** to
convey elevation instead of relying on the shadow alone:

```css
[data-theme="dark"] .card {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.40),
    0 8px 24px rgba(0, 0, 0, 0.45);
  border-top: 1px solid rgba(255, 255, 255, 0.06); /* catch-light edge */
}
```

## Performance
8-layer shadows are gorgeous but cost paint time. Reserve the tall stacks for a few
high-elevation elements (modals, key cards); use 2–3 layers for the bulk.

### Sources
- Josh Comeau, "Designing Beautiful Shadows in CSS": https://www.joshwcomeau.com/css/designing-shadows/
- Josh Comeau, Shadow Palette Generator: https://www.joshwcomeau.com/shadow-palette/

> ⚠️ Single-author (excellent but opinionated) — values are starting points; tune alpha to your bg lightness.
