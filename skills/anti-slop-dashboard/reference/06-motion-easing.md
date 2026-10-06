# 06 · Motion & Easing

Fast, physical, restrained. Slow/linear/`ease-in` motion is an instant slop tell.

## Duration tokens

```css
:root {
  --dur-instant: 100ms; /* button press, tiny state flips */
  --dur-fast:    160ms; /* hover, toggles, most interactions */
  --dur-base:    200ms; /* default; the "feels immediate" ceiling */
  --dur-slow:    250ms; /* dropdowns, selects, popovers */
  --dur-modal:   320ms; /* modals, drawers, sheets (200–500ms range) */
}
```

Per-component guidance (Emil Kowalski, refining Rauno's blanket "<200ms"):

| Element | Duration |
|---|---|
| Button press feedback | 100–160ms |
| Tooltips, small popovers | 125–200ms |
| Dropdowns, selects | 150–250ms |
| Modals, drawers | 200–500ms |
| **General UI rule** | **stay under ~300ms** |

## Easing tokens

```css
:root {
  --ease-out:    cubic-bezier(0.23, 1, 0.32, 1);   /* strong ease-out — default for entrances/hover */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* strong, for moves that start & end on-screen */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* iOS-style drawer/sheet */
  --ease-spring: linear(0, 0.5 12%, 0.9 24%, 1.06 38%, 1 50%, 0.99 72%, 1); /* subtle overshoot */
}
```

**Never use `ease-in` for UI.** It starts slow → feels sluggish/unresponsive. Entrances and
hovers should be `ease-out` (fast start, gentle settle). Use `ease-in-out` only for things
that both enter and exit the viewport.

## What to animate

- **Only `transform` and `opacity`** — they're GPU-composited and don't trigger layout.
- **Never animate** `width`, `height`, `padding`, `margin`, `top/left` — they cause reflow
  and jank. (Animate a `transform: scale()`/`translate()` instead.)
- **Entrances:** scale up from a near-1 start + fade `opacity: 0→1` — *never* `scale(0)` or
  big flights. **Subtle:** `scale(0.95)` (shadcn/Radix/Emil convention). **More pronounced:**
  `~0.8` (Rauno's actual value for dialogs). Pick by how much the element should "pop."
- **Press:** scale to `~0.96` (or `~0.9` for tiny triggers) — *not* `1 → 0.8`.

```css
@keyframes pop-in {
  from { opacity: 0; transform: scale(0.95) translateY(4px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}
.menu { animation: pop-in var(--dur-slow) var(--ease-out); transform-origin: top; }
```

## Reduced motion (required)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
Keep *opacity* fades (they don't cause vestibular issues); kill *movement/scale*. Ensure the
end state is fully usable without the animation.

### Sources
- Emil Kowalski (animations.dev): https://github.com/emilkowalski/skill
- Rauno Freiberg: https://github.com/raunofreiberg/interfaces
- Josh Comeau, CSS transitions: https://www.joshwcomeau.com/animation/css-transitions/

> ⚠️ Practitioner-sourced; widely corroborated but unverified here. Curves are tasteful defaults.
