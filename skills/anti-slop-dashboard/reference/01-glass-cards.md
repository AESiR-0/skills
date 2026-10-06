# 01 · Glass Cards

Frosted-glass surface (the reference look from Finexa/ZIXO/Liam). Three independent
sources converged on this recipe.

## Base recipe

```css
.glass-card {
  /* fill: 10–15% white tint — NOT a solid color */
  background: rgba(255, 255, 255, 0.12);

  /* blur sweet spot 12px (range 4–25px); saturate keeps colors from going gray */
  -webkit-backdrop-filter: blur(12px) saturate(160%); /* Safari REQUIRES -webkit- */
  backdrop-filter: blur(12px) saturate(160%);

  /* 1px hairline at 20–25% white = the inner-highlight edge that sells "glass" */
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 16px;

  /* soft drop shadow grounds the floating pane */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}
```

### Why each value
- **Tint 10–15% alpha** — opaque enough to read text on, transparent enough to see through.
- **`saturate(160–180%)`** — backdrop blur desaturates; this restores life. Without it,
  glass looks gray/dead.
- **Border 20–25% white** — simulates the bright refractive edge of real glass. This single
  line is the difference between "glass" and "blurry box."
- **`-webkit-backdrop-filter`** — without it, Safari renders a flat tinted box, no blur.

## Extra polish: top inner highlight

Real glass catches light on its top edge. Add a gradient sheen:

```css
.glass-card {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 40%),
    rgba(255, 255, 255, 0.12);
}
/* or an inset highlight */
box-shadow: 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.30);
```

## Hover-lift

```css
.glass-card {
  transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1),
              box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1),
              backdrop-filter 200ms ease-out;
}
.glass-card:hover {
  transform: translateY(-4px);            /* -8px exists in the wild but feels large; -4px is safer */
  box-shadow: 0 4px 12px rgba(0,0,0,0.10), 0 16px 40px rgba(0,0,0,0.14);
  -webkit-backdrop-filter: blur(16px) saturate(170%); /* deepen blur slightly on hover */
  backdrop-filter: blur(16px) saturate(170%);
}
```

## Dark mode

On dark backgrounds, the tint flips toward a *lighter* translucent white at lower alpha,
and the border stays white but fainter:

```css
[data-theme="dark"] .glass-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.10);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}
```

## Gotchas (don't make these slop)
- **Glass needs something behind it.** Over a flat solid bg, blur does nothing — you just
  get a tinted box. Use it over imagery, gradients, or other content.
- **Don't put dense tables on glass** — legibility tanks. Glass is for hero panels,
  stat cards, overlays. Dense data wants opaque surfaces.
- **Performance:** `backdrop-filter` is expensive; avoid dozens on screen or animating it
  on scroll. Apple's Liquid Glass *lensing/refraction* is a native material CSS can only
  approximate — don't promise that look from `backdrop-filter` alone.
- **Contrast:** verify text contrast over the *worst-case* background the glass can sit on.

### Sources
- https://www.superdesign.dev/styles/glassmorphism · https://dev.to/nickbenksim/glassmorphism-effect-with-backdrop-filter-16jh · https://codefronts.com/motion/css-card-hover-effects/
- Apple Liquid Glass (native, for context): https://developer.apple.com/videos/play/wwdc2025/219/

> ⚠️ Blog-sourced numbers — tune blur/alpha/saturate to your actual backgrounds and test on real Safari.
