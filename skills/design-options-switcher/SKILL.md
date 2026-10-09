---
name: design-options-switcher
description: Present design choices (colours, textures, layouts, motion, type) as visual options for approval before building anything, then ship a temporary client-facing switcher panel on the preview site so the client can flip between them live, and remove it once they pick. Use when the user asks for options, variants or alternatives to choose from, wants to show a client several directions, or says "give me options in widgets" or "a toggle to switch between options".
---

Approval-gated design exploration. Nothing gets built into the real site until the user has seen the options, and nothing ships to production until the client has picked. Three **gates**:

1. **Show** options as visuals in the conversation. The user approves which ones go forward.
2. **Switch.** The approved set goes into a small panel on the preview site for the client.
3. **Bake.** The winners go into the real code and the switcher is deleted.

## Gate 1: show

1. **Ask first** with AskUserQuestion about anything the brief leaves open: which axes to explore, references the client likes, constraints (brand colours, things the client rejected before), and how many options. Default to 5 to 8 per axis. The user has asked for 5 to 10 before; fewer than 4 isn't a choice.
2. **Draw every option as a visual**, not a description:
   - Use the inline widget tool if the client has one (e.g. `show_widget`).
   - Otherwise use an HTML artifact, or a single static HTML page with all options side by side, opened in the browser.
   - Each option gets:
     - a short plain name in the client's vocabulary ("Temple black", not "Option C");
     - a swatch or mini-render;
     - one line on its character.
   - Always include **current** (as built) as one choice. Mark your **recommendation** and say why in one line.
3. **Wait.** Ask the user which options to keep and which to drop. Don't touch the site's code before they answer.

Done when: the user has named the options that go forward for each axis.

## Gate 2: switch

**Options on more than one page?** Use the `review-window` skill instead: one window with a tab per page, which stays open and in place as the client moves through the site. The panel below is for a single page.

Use `templates/option-switcher.js`. It's dependency-free and works in any stack.

1. Copy it to the site's static folder (`public/option-switcher.js`), and load it as a **plain, non-deferred script in `<head>`** so saved picks apply before first paint (no flash):
   - **Next.js:** `<script src="/option-switcher.js" />` inside `<head>` in the root layout. Don't use `next/script`, because it defers.
   - **Astro, Vite or plain HTML:** a normal `<script src>` in the head.
2. **Fill in `CONFIG.groups`**:
   - one group per axis, with the approved options and swatches;
   - `pages: ['/path']` for options that only exist on some pages;
   - keep `current` first.
3. **Implement each option** keyed on the attribute the script writes to `<html>`:
   - **Colour, texture or type:** `:root[data-<group>="<id>"] { --token: ...; }`, redefining a few tokens only. Never fork components for a colour.
   - **Layout or motion:** read `document.documentElement.dataset.<group>`, or listen for the `options:change` event, and render the variant. Keep each variant behind one clearly named switch.
   - Mark every option block and variant branch with a `REVIEW ONLY` comment so Gate 3 can find them.
4. **Production stays clean.** The panel only appears on localhost, preview hosts (`*.vercel.app`, `*.netlify.app`, `*.pages.dev`) and on any URL with `?review`. Adjust `enabled()` if the preview runs on a custom domain. Tell the user the link to send: the preview URL with `?review`.
5. **Verify** in the browser:
   - each option visibly changes the page;
   - the choice survives a reload with no flash;
   - page-specific groups show only on their pages;
   - the panel is draggable and stays on screen;
   - it starts folded on phones;
   - it's absent on the production host without `?review`.

Done when: every approved option is selectable live on the preview, and the checks above pass.

**While the client decides:** when the user relays a verdict ("drop the textures, keep the red options for the signs"), remove the decided groups from `CONFIG`. The script clears their stored keys on the next load. Add new axes to the same panel rather than creating a second one. The **Copy picks** button gives the client a JSON summary of their choices to send back.

## Gate 3: bake

When the client has picked everything:
1. Write the winning values into the real tokens and components as the default, with no attribute needed.
2. Delete every `REVIEW ONLY` block: the `[data-*]` option CSS, the variant branches, the script tag and the `option-switcher.js` file.
3. Grep to confirm that nothing reads the removed `data-*` attributes and that no `REVIEW ONLY` markers remain.
4. Build, then load the main pages to confirm they look identical to the chosen options.

Done when: the grep comes back clean, the build passes, and the site renders the picked options with no switcher.
