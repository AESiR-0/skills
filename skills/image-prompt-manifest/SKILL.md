---
name: image-prompt-manifest
description: Inventory every image slot on a site and write a ready-to-paste prompt manifest (one entry per file, exact path, size, shared house style), then, once the images are generated elsewhere, verify and wire them back in. Use when the user wants image prompts for placeholders or thumbnails, wants to "bulk generate images later", or says generated images are added or not showing up.
---

Two branches: **write** the manifest, or **wire** the images back in after the user has generated them. If the user says files have landed ("images are generated", "added the images", "still not used?"), go straight to Wire.

The **path is the contract**. Every entry names one file at one exact path the code already points to, so dropping the file in needs no code change.

## Write

### 1. Inventory

Walk the code for every image slot: placeholder frames, thumbnails, posters, hero and background images, cutouts, OG images. For each slot, record:
- the path the code expects;
- the rendered aspect ratio and pixel size;
- where it appears;
- what overlays it;
- how it gets cropped at other breakpoints.

Then list what must **not** be generated, with the reason. Typical cases:
- real people, real client logos or products, real buildings;
- slots that should hold a frame from an existing video (generating a poster there makes a visible jump);
- places where the user has real assets.

Done when: every image reference in the code is either a slot or on the do-not-generate list.

### 2. Ask

One AskUserQuestion call, covering:
- the generator they'll use;
- house style direction (offer 3 concrete directions drawn from the site, plus their brand palette if one exists);
- reference images to anchor on (screenshots, moodboard);
- export format and size cap;
- whether to wire placeholders now.

### 3. Manifest

Copy `templates/IMAGE-PROMPTS.md` to `docs/IMAGE-PROMPTS.md` (or wherever the user wants it) and fill it in:
- **One entry per file.** Variants (laptop and phone, -01 and -02) are separate entries, never "generate both".
- **Entry line**, exactly: ``**Path** `public/x/y.jpg` · **16:9** · **1600 × 900** ``. The checker parses it.
- **Aspect ratio** is stated both on the entry line and in words inside the prompt.
- **One house style block and one negative prompt**, shared by every entry. A dozen independent styles reads as a clipart pile.
- **Exact hex values** for brand colours.
- **No text, lettering, logos or real people** in any image. The site sets live copy, and generators garble lettering.
- **Composition notes** come from the layout: keep the subject centred with safe margins when the file is cropped to several shapes, and keep the region under any overlaid text quiet.
- **Cutouts:** generate on a flat key colour (#00B140, or magenta for green subjects) and key to alpha afterwards. Don't ask the generator for transparency.
- **Device mockups:** attach the real screenshot and tell the model to keep the screen pixel-exact, or it invents the website.

If asked, put a labelled placeholder at every promised path so the build works today.

Done when: every slot from the inventory has an entry and a checklist line, and the user has the manifest path. Suggest they generate and approve one image before the rest.

## Wire

1. **Check.** Run:
   ```
   node "<this skill's folder>/scripts/manifest-check.mjs" <manifest.md> --root <project>
   ```
   It reports every slot as one of:
   - `MISSING`
   - `CHECK`: wrong size or aspect, an extension that doesn't match the bytes, or not referenced in code
   - `OK`
2. **Fix each `CHECK` row.**
   - Resize or crop to the declared size, without stretching.
   - Fix extension mismatches.
   - Compress to the cap.
   - Key out cutouts.
   - Wire unreferenced files into the component or data file that owns the slot.
   - Remove placeholders.
   - For `MISSING` rows, ask whether the file was saved under another name. List the image files modified since the manifest was written to find it.
3. **See it.** Load each affected page at laptop and phone widths and confirm the images render. A stale dev cache or build can hide files that are wired correctly, so restart the server or clear the cache before concluding anything is missing.

Done when: the checker exits 0 (or every remaining row is explained). Then tell the user exactly which pages and paths you checked, and list any slot still waiting on a file.
