---
name: client-proposal-pack
description: Produce a client-facing proposal for a website or design project, as a branded pitch deck with pricing and a matching agreement, both exported to PDF. Use when the user asks for a proposal, pitch deck, quote, pricing deck, contract, agreement or SOW for a client, or wants a previous client's contract reused for a new one.
---

A proposal pack is a **deck** that sells and a **contract** that protects, telling the same story with the same numbers. The deck is client-friendly and short. The contract is complete and plain. Technical detail goes to neither: put it in a separate `notes.md` if anyone needs it.

`templates/` holds a 16:9 HTML deck and an A4 HTML agreement. `scripts/to-pdf.mjs` prints either one to PDF with headless Chrome or Edge, and also takes page screenshots for the deck.

## 1. Interview

Look for a previous proposal or contract first. If the user names one ("like the one we did for X"), it's the template: same layout, styling and clause structure, with only client and commercial details changed. Then make one AskUserQuestion pass (several calls if needed) for whatever is still open:
- **Client:** legal name, logo file or URL, brand colours and fonts (take them from their site or logo if not given), and contact.
- **Scope:** pages or sections, features, what's explicitly out, and who writes the copy.
- **Price:**
  - a single price or two tiers (e.g. Essential and Complete);
  - any struck-through list price, used only when it's genuinely the standard rate;
  - the full-advance discount, if any (5% off the build fee is common);
  - currency and number format (e.g. ₹1,00,000 or $10,000);
  - the tax line (e.g. "+18% GST" or "excl. VAT").
- **Payment structure:** 50/50, 60/40, 50/30/20, or a custom split. Also hosting or maintenance retainers (monthly or quarterly in advance, notice period).
- **Timeline:** total weeks, and the phases.
- **What the deck shows:** the price only, or price plus payment terms. Ask too whether revision rounds appear in the deck (contracts always state them).
- **Deliverables:** deck, contract or both, and where to save them.

Done when: every `{{...}}` in the templates you'll use has an answer or a confirmed default.

## 2. Deck

Copy `templates/deck.html` into the client's folder and fill it in. Slide order:
1. Cover
2. Brief
3. Audience or direction (optional)
4. Experience
5. Page by section
6. References (optional)
7. What you get
8. Timeline
9. Investment
10. Close

Delete optional slides rather than padding. Eight to ten slides is the target.

- **Brand:** set `--brand`, `--accent`, `--ink`, `--paper` and the fonts from the client's identity. Use their real logo, background removed and sized to fit. Alternate dark and light slides for rhythm.
- **Page by section** shows real visuals:
  - Screenshot each section of the design or a live mockup with `node scripts/to-pdf.mjs <url> --screenshot shots/01-hero.png --size 1440,900`.
  - Crop each to its section, one per frame, numbered.
  - If no design exists yet, use mockups and say so on the slide. Never imply hover states or features that won't be built.
- **Investment:**
  - Show exactly what was agreed and nothing more.
  - If the user wants only the number, show only the number: no split, no terms.
  - Tiers differ by what matters to the client, not by a feature dump.
  - The struck-through list price appears only if the user asked for it.
- **Copy:** client-facing language with no stack names or jargon. Every link must work.

## 3. Contract

Copy `templates/contract.html`, or the previous client's contract if one was named. Keep the clause order:
1. Key terms
2. Parties
3. Objective
4. Scope
5. Timeline and dependencies (a conditional clock)
6. Revisions
7. Fees and payment
8. Hosting (optional)
9. Additional work
10. Ownership
11. Confidentiality
12. Warranty and liability
13. Ending
14. General
15. Then the commercial summary and signatures, with tick-one payment options.

Rules:
- **Same numbers as the deck.** Fee, discount, retainer, timeline and tax line must match character for character.
- **Same scope as the deck.** Nothing the deck includes may appear under "Not included".
- **Stay generic where the user asked.** If they said not to commit to specifics (motion intensity, tier internals), describe outcomes, not implementation.
- **Fix cross-references.** Clauses number themselves. After deleting one, fix any "clause N" references.
- **Not legal advice.** Tell the user once that it's a starting template and should be reviewed for their jurisdiction, then don't repeat it.

## 4. Export and check

```
node "<this skill's folder>/scripts/to-pdf.mjs" deck.html "<YYYY MM DD> <Client> x <Studio> Proposal.pdf"
node "<this skill's folder>/scripts/to-pdf.mjs" contract.html "<YYYY MM DD> <Client> x <Studio> Agreement.pdf"
```

Open both PDFs and check every page:
- no clipped text or overflowing slides, and no leftover `{{`;
- slide count as planned;
- links clickable;
- deck and contract figures identical (grep both HTML files for each amount);
- fonts and colours print correctly.

Done when: both PDFs pass the checks and sit next to their HTML sources in the client's folder. Report the paths.

## 5. Deliver

Give the user the PDF paths. If they want it uploaded to cloud storage, use a connected storage tool if one can take binary files. Otherwise, say so and open the folder for them to drag the files in. Don't email or share anything without explicit approval.

Edits after delivery ("remove slide 7", "no 5% for this one") go into the HTML, then re-export both files if a number changed.
