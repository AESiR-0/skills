---
name: client-feedback-round
description: Execute a round of client feedback on a website or app end to end. Turn a PDF, screenshots, a meeting transcript or pasted notes into a numbered ledger of every item, ask all open questions in one grouped batch, do everything doable in code, verify it, and hand back a per-item status plus a doc of what is left. Use when the user hands over client feedback, a changes list, "pointers", a second round of revisions, or asks to "do the feedback".
---

A feedback round fails in predictable ways: an item gets missed, a vague word gets built wrong, work outside the brief gets "improved", or something that worked before breaks on mobile. The **ledger** prevents all four. Every item from the source gets a row, and nothing is reported done without its row saying so.

## 1. Intake

- Read the whole source. If a PDF won't extract as text, render the pages to images and read every page. Annotations and arrows on screenshots are items too.
- Read the project's memory, notes and any earlier round docs. They hold client rules from earlier rounds ("never a numbered eyebrow", "not playful") that still apply.
- Read the code the items touch, so questions are grounded in what exists.

## 2. Ledger

Write `docs/round-<n>.md` from `templates/ROUND.md` (or the project's existing round doc format). Fill in one row per item, in source order:
- the page or slide reference;
- the client's words (short);
- where in the site it lands;
- a status.

Split items that bundle several asks. Include the small ones: spelling, link behaviour, ordering.

Sort every row into one of three groups:
- **doable now** in code;
- **needs the user**: assets, copy, links, accounts, hosting;
- **needs a decision**: ambiguous, conflicting, or a design choice.

Done when: the row count matches a recount of the source, page by page.

## 3. Ask once, in bulk

Put every "needs a decision" item in **one** AskUserQuestion batch (several calls back to back if there are more than four). Each question names the item number, offers concrete options, and marks a **recommended** default, so the user can answer "all recommended". Also cover:
- **Jargon:** confirm what vague words mean before building. "Wiggle" might mean an entrance warp, not hover physics.
- **Conflicts:** flag items that fight each other or an earlier rule, e.g. "more motion everywhere" against "the site feels laggy".
- **Visual choices:** for anything with several plausible directions, show options visually before asking (see the design-options-switcher skill if installed).

End with "anything else on this round?" Large rounds (15+ items, or structural changes) get a short phased plan for approval before any code.

## 4. Do

- **Scope is the item.** Restate each item as a one-line change before doing it, and touch only that. "More space between sections" means spacing, not new layouts. Improvements you notice go in the report as suggestions, not into the code.
- **Snapshot first.** Make sure the work tree is committed or stashed, so any single item can be reverted.
- **Never invent client content**: testimonials, stats, names, logos. Leave a clearly marked slot and list it under Part 1.
- **Missing assets:** add a placeholder at the final path and write the generation prompt (path, size, prompt) into Part 1 so the user can bulk-generate. Don't build new media for items still under discussion.
- Update each row's status as you go, not at the end.

## 5. Verify

- Typecheck and build.
- In a real browser at desktop (~1440px) and phone (~390px) widths, check:
  - every changed section;
  - the first paint before any scroll;
  - the console for errors.
- Re-check anything the round could have regressed, especially mobile-only elements.
- Walk the ledger against the source one last time, page by page.

## 6. Report

- Reply with the ledger summary:
  - counts of done, you, asked and declined;
  - then each item that isn't done, with its reason.
- Part 1 of the doc is the user's to-do list. Each task gets a Why, Steps and Check.
- Part 3 records new client rules and declined ideas, so later rounds don't re-propose them. Mirror lasting client rules into the project's memory or notes.
- **Don't commit or push** unless the user asks. When they say "push", commit the round with a message naming the round.

Done when: every ledger row has a final status, the build passes, and the user has the doc path.
