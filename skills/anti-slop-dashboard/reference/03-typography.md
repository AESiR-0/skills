# 03 · Typography

The biggest slop tell after shadows: one sans at three near-identical gray sizes. Premium
typography = **one expressive display/accent face + one clean workhorse grotesk + tabular
figures**, with hierarchy built from size **+ weight + color + tracking** together.

> **Provenance:** numeral/OpenType mechanics are research-backed (MDN). The pairings and the
> modular scale are **authored from established practice + the project's reference images**
> (Finexa's serif-italic "Good Morning, *Name*"; ZIXO's elegant numerals) — they were a
> documented gap in the corpus, so sanity-check against live specimens.

## The pairing (the "soul" move)

A clean grotesk does 95% of the UI; a **serif-italic display accent** appears in 2–3 high-
value spots (greeting name, hero metric label, section eyebrow) to give the product a voice.
This is the Finexa "Good Morning, *Oripio*" effect.

Recommended open-license pairings (pick one — all self-hostable):

| Display / accent | Body / UI | Feel |
|---|---|---|
| **Instrument Serif** (italic) | **Geist** | Editorial-premium, "expensive magazine" (recommended default) |
| **Instrument Serif** (italic) | **General Sans** | Warmer, more product-y |
| **Cabinet Grotesk** (bold) | **General Sans** | Characterful, agency |
| **Schibsted Grotesk** | **Inter** | Friendly; keeps Inter for dense tables (lowest risk) |

```css
:root {
  --font-display: "Instrument Serif", ui-serif, Georgia, serif;
  --font-ui:      "Geist", "Inter", system-ui, sans-serif;
  --font-mono:    "Geist Mono", ui-monospace, monospace;
}
```

**Use the serif-italic for accents, not paragraphs.** Names in greetings, a hero figure's
label, a quote, a section eyebrow. Never body copy, never table data.

```html
<h1 class="greeting">Good morning, <em>Oripio</em></h1>
```
```css
.greeting { font-family: var(--font-ui); font-weight: 600; font-size: 40px; letter-spacing: -0.02em; }
.greeting em { font-family: var(--font-display); font-style: italic; font-weight: 400; }
```

## Modular scale

Use one ratio so sizes relate. **1.25 (major third)** for marketing-leaning dashboards,
**1.2 (minor third)** for dense ones. Role-based, not just sizes:

| Role | Size / line-height | Weight | Tracking | Notes |
|---|---|---|---|---|
| Display (serif-italic accent) | 40–56 / 1.05 | 400 | −0.02em | sparingly; the voice |
| Hero metric | 32–44 / 1.0 | 600 | −0.02em | **tabular-nums** |
| Page title | 24–28 / 1.15 | 600 | −0.015em | |
| Card title | 16–18 / 1.25 | 600 | −0.01em | |
| Body | 14 / 1.5 | 420–500 | 0 | base; dense dashboards run 14px |
| Label / control | 13 / 1.2 | 500 | 0 | |
| Eyebrow / overline | 11–12 / 1.2 | 600 | **+0.06em**, UPPERCASE | section kickers |
| Caption / meta | 12 / 1.4 | 420 | 0 | `ink-gray-5/6` |

**Tracking rule:** tighten as size grows (display negative), loosen for small uppercase
(eyebrows positive). Default tracking on 40px display text is a slop tell.

## Numerals & OpenType (research-backed — MDN)

All metric figures, axis labels, and table numbers use **tabular lining** figures so digits
align and don't jitter on update:

```css
.numeric, .metric, table td.num, .axis-label {
  font-variant-numeric: tabular-nums lining-nums;
  /* low-level equivalent: font-feature-settings: "tnum" 1, "lnum" 1; */
}
```
- `tabular-nums` (`tnum`) — fixed-width digits, align in columns.
- `lining-nums` (`lnum`) — all sit on the baseline (vs oldstyle `onum` with descenders).
- Stylistic sets (`ss01`, `cv01`…) vary by font — e.g. a single-story `a`/`g`. Enable via
  `font-feature-settings: "cv01" 1;` only after checking the specimen.

```css
body {
  font-optical-sizing: auto;        /* variable fonts: optical sizing on */
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { text-wrap: balance; }  /* even heading line lengths */
p { text-wrap: pretty; }            /* avoid orphans/ragged last lines */
```

## Color hierarchy (not just size)

Hierarchy comes as much from ink color as size. Use the ramp, don't muddy it:

- Primary heading → `ink-gray-9`
- Body → `ink-gray-8`
- Secondary → `ink-gray-6`
- Muted / caption → `ink-gray-5`

Three grays that are all ~`#555` is the "muddy hierarchy" slop tell — make the steps obvious.

## Anti-slop type rules
- [ ] One display/accent face used sparingly — not the whole UI in a serif.
- [ ] `tabular-nums lining-nums` on **every** figure (metrics, tables, axes, deltas).
- [ ] Hierarchy = size + weight + color + tracking, not size alone.
- [ ] Negative tracking on large display; positive on small uppercase eyebrows.
- [ ] ≤ 4 real weights (no faux-bold — load the actual weight).
- [ ] Body left-aligned, ~`1.5` line-height, ~60–75ch measure; not centered.
- [ ] `text-wrap: balance` on headings, `pretty` on paragraphs.

### Sources
- MDN `font-variant-numeric` (tnum/lnum/onum): https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- Modular scale: https://imperavi.com/books/ui-typography/principles/modular-scale/ · https://www.ux-republic.com/en/practical-guide-to-creating-a-modular-scale-type-for-your-interfaces/
- Geist type system: https://vercel.com/geist/typography · Inter: https://rsms.me/inter/
- Instrument Serif context: https://fonts.google.com/specimen/Instrument+Serif

> ⚠️ Pairings/scale authored from practice (corpus gap) — confirm specimens & licenses before shipping.
