# 07 · Interaction States

Every interactive element needs **four states + disabled**: rest / hover / active(pressed)
/ focus-visible, and disabled. Missing focus states are both slop *and* an a11y failure.

## State-delta tokens

Build states as *deltas* over a base, so they stay consistent across components.

```css
:root {
  --state-hover-bg:   rgba(17, 24, 39, 0.04); /* subtle darken on light surfaces */
  --state-active-bg:  rgba(17, 24, 39, 0.08); /* pressed = stronger */
  --press-scale:      0.96;                    /* never 0.8 */
  --focus-ring-color: #0d8ef8;                 /* your accent */
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
  --disabled-opacity: 0.5;
  --state-dur:        140ms;
}
[data-theme="dark"] {
  --state-hover-bg:  rgba(255, 255, 255, 0.06);
  --state-active-bg: rgba(255, 255, 255, 0.10);
}
```

## Focus rings — the corrected guidance

Older advice (Rauno) says "use `box-shadow`, not `outline`, because outline ignores
border-radius." **That's now dated.** Modern browsers honor `border-radius` on `outline`,
and `outline`:
- is visible in **forced-colors / high-contrast** mode (box-shadow is not),
- isn't clipped by the element's *own* `overflow: hidden` (an *ancestor's* can still clip it
  — but box-shadow has that same limitation),
- doesn't shift layout.

> Browser support for `outline` honoring `border-radius`: Chrome/Firefox ~2021, Safari ~2023.

**Prefer `outline` + `outline-offset`:**

```css
.interactive:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```

Use `:focus-visible` (not `:focus`) so the ring shows for keyboard nav but not on mouse
click. Only fall back to a `box-shadow` ring when you need a soft/inset glow that `outline`
can't express — and then *also* keep a forced-colors fallback.

## Per-element patterns

### Button (see also [08-buttons.md](08-buttons.md))
```css
.btn {
  transition: background-color var(--state-dur) var(--ease-out),
              transform var(--dur-instant) var(--ease-out),
              box-shadow var(--state-dur) var(--ease-out);
}
.btn:hover            { background-color: /* one step darker/lighter */; }
.btn:active           { transform: scale(var(--press-scale)); }
.btn:focus-visible    { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; }
.btn:disabled         { opacity: var(--disabled-opacity); pointer-events: none; cursor: not-allowed; }
```

### Card (interactive)
- Rest → hover: lift via `transform: translateY(-2px to -4px)` + bump shadow one rung.
- Active: settle back to `translateY(0)` (press registers as "pushing it down").
- Focus-visible: ring on the card if it's a link/button; otherwise focus the inner control.

### Nav item
- Hover: `--state-hover-bg` fill, no movement.
- Active route (selected): see [04-sidebar-search.md](04-sidebar-search.md) — filled pill or
  left-rail indicator, *not* just a hover color (selection must persist without the cursor).
- Focus-visible: ring inset or offset depending on density.

### Input / field
```css
.input            { border: 1px solid var(--outline-rest); transition: border-color var(--state-dur), box-shadow var(--state-dur); }
.input:hover      { border-color: var(--outline-hover); }
.input:focus-visible {
  border-color: var(--focus-ring-color);
  outline: none;                                   /* replace, don't remove */
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-ring-color) 25%, transparent);
}
.input:disabled   { opacity: var(--disabled-opacity); background: var(--surface-muted); }
.input[aria-invalid="true"] { border-color: var(--danger); }
```

## Checklist
- [ ] Does every clickable thing have hover, active, **and** focus-visible?
- [ ] Is the focus ring visible on *every* background it can appear on?
- [ ] Is disabled visually distinct *and* non-interactive (`pointer-events: none`)?
- [ ] Do selected/active states persist without hover?
- [ ] Press scale ≈ 0.96, not a cartoon squash?

### Sources
- Rauno Freiberg: https://github.com/raunofreiberg/interfaces
- shadcn/ui (state implementations): https://ui.shadcn.com/docs/components/radix/button
- MDN `:focus-visible` / `outline` (for the corrected focus-ring guidance)

> ⚠️ Per-component token *values* were thin in the corpus — these are reasoned defaults; verify against shadcn/Radix/Tailwind in this repo.
