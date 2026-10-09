---
name: review-window
description: Ship a temporary client-facing review window on a preview site. One floating window holds every design option the client is choosing between (grounds, textures, layouts, motion, type), with a tab per page. The tab follows the reader around the site, and it stays the same window across page loads and client-side navigation, open and wherever it was dragged. Use when the user asks for a review modal, review panel or review window, an options switcher that spans several pages, "a tabbed modal for different pages", or a way to show a client options live on the real site before they decide.
---

A client deciding between options needs to see them on the real pages, at real scale, while moving through the site. A panel that only knows the current page makes them hunt. A modal hides the page they are judging. A window that resets on every navigation loses their place.

The **review window** does three things:
- **Tabs are pages.** It opens on the page you are on, and any other page's options are one click away.
- **It is one window.** It stays open and in place while the site moves underneath it.
- **It is temporary.** Nothing in it ships: production renders the defaults, and the whole window is deleted once the client picks.

If the options haven't been approved yet, run Gate 1 of `design-options-switcher` first (show them as visuals, get the user's yes). This skill replaces that skill's single-page panel in Gate 2 whenever options span pages.

## What the template does

`templates/review-window.js` is dependency-free and works in any stack. All of this is built in, so keep it when you adapt the template:

- **The tab follows the route.** The page you are on is marked even while another tab is open. A tab for somewhere else says so and offers **Go there**.
- **Same window across navigation.**
  - Open or closed, position and each tab's scroll survive full page loads.
  - On load it reappears with no entrance animation and without taking focus from the page.
  - On client-side routes (pushState, popstate, the Navigation API) the element never leaves.
  - If a framework swaps `<body>`, it puts the same element back.
- **One frame size.** The height is fixed and only the body scrolls, so switching tabs or pages never moves the title bar.
- **Floating, not modal.** It opens with `dialog.show()`, so the page behind stays live: scroll it, click it, watch a pick land.
- **Dragging.**
  - The drag writes `translate` and the entrance animates `scale`, so the two never fight over `transform`.
  - On a wide screen it can be tucked aside with 120px of title bar left to grab. On a phone it stays fully on screen.
  - The position is remembered and re-clamped on resize.
- **Esc** closes it only when focus is inside it. It never takes Esc from the site.
- **Views.** A tab can be split by route. On a product page, the site tab then shows only the groups that change a product page. Off every view, it shows everything.
- **Dependent groups.** `when` shows a group only while another holds certain values, e.g. a light's direction only for the lit options.
- **Replay.** A button on a group dispatches an event, so one-shot motion (an entrance, a completion) can be re-run without redoing the flow.
- **Swatches print their hex.** Near-black grounds differ by a few points of luminance, and a dot can't show that.
- **No flash.** Picks are applied to `<html>` before first paint. The **default writes nothing**, so the server-rendered page is the default.
- **Hidden on production.** It shows on localhost, `*.test`/`*.local`, `file:`, `*.vercel.app`, `*.netlify.app`, `*.pages.dev`, any hostname in `hosts`, and any URL with `?review`. `?review=0` hides it for the session, even on localhost, to show the production look.
- **Copy picks** copies a JSON summary for the client to send back. **Reset** returns every group to its default.
- **Kept off the page's motion.**
  - Page transitions: it is its own view-transition layer (`review-window`), with its animation turned off, so a transition never carries it.
  - Print: it is hidden.
  - Reduced motion: it skips the scale.

## 1. Install

1. Copy `templates/review-window.js` to the site's static folder (`public/review-window.js`).
2. Load it as a **plain, non-deferred script in `<head>`**, so saved picks apply before first paint:
   - **Next.js App Router:** add `<script src="/review-window.js" />` inside `<head>` in `app/layout.tsx`. Don't use `next/script`, because it defers. If the lint rule `no-sync-scripts` fires, disable it for that line: the sync load is the point.
   - **Astro, Vite, plain HTML:** a normal `<script src>` in the head of every page, or of the shared layout.
3. Mark the tag `REVIEW ONLY`.

## 2. Configure

Edit `CONFIG` at the top of the file. The example config in it shows every feature.

**Pages, one per tab.**

| Field | Meaning |
|---|---|
| `id`, `label` | The tab. Label it in the client's words ("Coming soon", not "landing") |
| `match` | Which paths make this tab "here": `'/exact'`, `'/prefix/*'` (below it), `'*'`, or a RegExp. The first page that matches wins, so catch-alls go last |
| `href` | Where **Go there** goes |
| `views` | Optional, `{ name: [patterns] }`, to split one tab by route |
| `groups` | The options on this tab, in order |

**Groups.** A group id is one setting site-wide. List the same group under two tabs and it is shown twice but stored once.

| Field | Meaning |
|---|---|
| `id` | Written as `data-<id>` on `<html>` (a range writes `--<id>` instead) |
| `label`, `note` | The legend, and one optional line under the options |
| `type` | `list` (default: name and note rows, optional `thumb` image), `swatch` (tiles with hex), `chips` (small inline buttons), `range` (a slider) |
| `options` | `{ id, label, note?, swatch?, thumb?, meta? }`. **The first is the default**: the site as built. It writes nothing. Override it with `default` |
| `views` | Show only on these views of the tab |
| `when` | `{ otherGroupId: ['value', ...] }`. Show only while that group holds one of these |
| `replay` | An event name. Adds a **Replay** button that dispatches it on `window` |
| range only | `min`, `max`, `step`, `value` (the default), `unit` (display only), `cssUnit` (appended to the variable), `var` (custom property name) |

**Also in `CONFIG`:**
- `key` is the storage prefix. **Bump it (`review-v2`) whenever you change a default**, or saved picks from the old default override the new one.
- `theme` restyles the window: `paper`, `ink`, `muted`, `line`, `edge`, `accent`, `onAccent`, `hover`, `font`, `mono`, `serif`. The default theme measures 6.8:1 for muted text and 3.4:1 for the edge hairline. Keep any brand theme above 4.5:1 for text and 3:1 for the hairline.
- `hosts` adds a custom preview domain.
- `navigate(href)` hands **Go there** to a client-side router. Without it, Go there does a normal page load and the window restores itself on the next page.

Default to 5 to 8 options per axis. Always include the site as built, first. Give each option a name and a one-line note, and no codes.

## 3. Wire each option into the site

Mark every block below with a `REVIEW ONLY` comment so the bake step can find them.

- **Colour, texture, type:** redefine a few tokens under the attribute. Never fork a component for a colour.
  ```css
  /* REVIEW ONLY */
  :root[data-ground="bone"] { --ground: #F3EEE4; }
  ```
- **Range:** read the variable with the group's default as the fallback, e.g. `opacity: calc(var(--grain, 8) / 100)`. That fallback must equal the group's `value`, because the default writes nothing.
- **Layout or motion in JS:** read `window.review?.get('hero') ?? 'film'`, or listen for `review:change` on `window` (detail `{ id, value }`). The `?? fallback` is required: production has no `window.review`.
- **React:** `templates/use-review.ts` gives `useReview('hero', 'film')`. It is hydration-safe: the server and first render see the fallback, then it switches.
  - Prefer variants that differ only in CSS (both variants in the markup, the attribute picks one). A markup-level variant swaps once after hydration.
- **Replay:** listen for the event named in `replay` and restart the timeline.

## 4. Verify

Check all of this in a visible browser, at desktop and at 375px. A hidden or background tab reports a 0×0 viewport, pauses transitions and skips view transitions, so results there are false.

- Every option visibly changes its page, and the default looks exactly like the site as built.
- Reload: the pick holds and nothing flashes.
- Navigate by full page load **and** by a client-side link. The window must:
  - stay open, at the same place, on the new page's tab;
  - not replay its entrance or move focus off the page.
- Switching tabs doesn't move the title bar.
- Views show only what changes the page in sight. A `when` group appears and disappears with its dependency.
- A slider writes its variable, and at its default the variable is removed.
- Esc on the page does nothing. Esc inside the window closes it and returns focus to the button.
- Dragged hard into a corner, the title bar stays grabbable. At 375px the whole window is on screen and the page doesn't scroll sideways.
- `?review=0` hides it. The production host doesn't show it.

Tell the user the link to send the client: the preview URL, with `?review` if the preview is on a custom domain.

**While the client decides:**
- When a verdict comes in, remove the decided groups from `CONFIG`. Their stored keys are cleared on the next load.
- Add new axes to this same window. Never open a second one.
- Ask the client to use **Copy picks** and send the JSON.

## 5. Bake

When everything is picked:

1. Make the winners the real defaults in the tokens and components, with no attribute needed.
2. Delete:
   - every `REVIEW ONLY` block;
   - the script tag;
   - `review-window.js`;
   - `use-review.ts` and its imports.
3. Grep until it comes back clean: `REVIEW ONLY`, `review-window`, `window.review`, `review:change`, `useReview`, and each removed `data-*` attribute.
4. Build. Load the main pages and confirm they match the chosen options with no window.

## Gotchas

- `Number(null)` is `0`, a legal slider value. A missing stored key must be caught before parsing, or every slider starts at zero. The template does this, so keep it if you rewrite `value()`.
- `dialog.close()` fires `close` a task later. Write the closed state synchronously, or a page load in that gap reopens the window.
- A window anchored by its bottom edge with a `max-height` jumps whenever a tab holds less. The fixed height is what keeps it in place.
- Production on Vercel also answers on `<project>.vercel.app`, so the window shows there too. If that matters, drop `vercel.app` from `enabled()` and list the preview hostnames in `hosts`.
