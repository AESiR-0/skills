# 08 · Buttons

## The variant taxonomy (shadcn/ui — de-facto standard)

Six named variants. Most dashboards need the first four.

| Variant | Use | Look |
|---|---|---|
| **default / primary** | The *one* main action per view | Solid filled (accent or near-black ink), white text |
| **secondary** | Secondary action next to primary | Muted fill (`surface-gray-2/3`), ink text |
| **outline** | Tertiary / toolbar | Transparent + 1px border, ink text |
| **ghost** | Low-emphasis, icon buttons, nav | Transparent; fill appears only on hover |
| **destructive** | Delete / irreversible | Red fill (or red outline for less weight) |
| **link** | Inline navigation | No padding/fill; underline on hover |

> One primary per view. If everything is primary, nothing is. A strong pattern: make the
> *primary* button **neutral inverted** (off-white fill on dark ink, or the reverse), never the
> accent colour. Keep the accent for links, active states, and focus rings.

## Anatomy & sizing

```css
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  height: 36px;            /* md. sm=32, lg=40 */
  padding: 0 14px;
  border-radius: 8px;
  font: 500 14px/1 var(--font-ui);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 140ms var(--ease-out),
              transform 100ms var(--ease-out),
              box-shadow 140ms var(--ease-out);
}
```
- **Icon + label gap:** 8px. **Icon-only:** square (`width: height`), centered.
- **Touch target:** ≥ 44px tappable area on touch (pad the hit area if the visual is smaller).

## States (all variants)

```css
.btn:hover         { /* shift fill ONE step (darker for solids, add fill for ghost) */ }
.btn:active        { transform: scale(0.96); }      /* subtle press */
.btn:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; }
.btn:disabled      { opacity: 0.5; pointer-events: none; cursor: not-allowed; }
```

## Loading state

Disable + swap the leading icon (or label) for a spinner; **keep the button's width fixed**
so layout doesn't jump. Announce to assistive tech.

```html
<button class="btn" disabled aria-busy="true">
  <span class="spinner" aria-hidden="true"></span>
  <span>Saving…</span>
</button>
```
- Preserve width: render the spinner in place of the icon, not appended.
- Don't also show a hover state while loading.
- For destructive/irreversible actions, prefer a confirm step over a bare loading button.

## Anti-slop notes
- **Press scale `0.96`**, not `0.8` (cartoonish) and not nothing (dead).
- **One transition** covering bg + transform + shadow; no instant jumps.
- **Don't** put a gradient + glow + border + shadow on one button. Pick a lane per variant.
- Primary buttons can carry a *subtle* shadow to lift them; ghost/outline should not.

### Sources
- shadcn/ui Button: https://ui.shadcn.com/docs/components/radix/button
- Rauno Freiberg (press scale): https://github.com/raunofreiberg/interfaces

> ⚠️ Variant API is well-established; exact per-variant token values come from your installed shadcn/Tailwind.
