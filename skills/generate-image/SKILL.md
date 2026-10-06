---
name: generate-image
description: Generate raster images (illustrations, hero art, textures, icons, mockups, photos, variations of a reference image) by delegating to the Codex CLI (OpenAI gpt-image) or the Antigravity CLI `agy` (Gemini image). Use when the user asks to generate, create, make or render an image or picture, or says "imagegen", "codex image", "agy image" or "nano banana".
---

All work goes through one helper. `$H` below means `node "<this skill's folder>/scripts/imagegen.mjs"`. Every command prints a single JSON line, and only that line matters.

## 1. Preflight

Run `$H check`. For each backend it reports `installed`, `version` and `auth`.

If a backend is **not installed**, install it now without asking: `$H install codex` or `$H install agy`. Codex installs through npm and agy through winget. If agy is missing on a system other than Windows, the helper returns `manual_install`. In that case relay the message and carry on with Codex only.

Auth is the user's to do. Never enter credentials yourself.
- If `codex.auth` is `missing`, ask the user to run `codex login` in their own terminal.
- agy reports `auth: unknown`. A run that fails with `reason: "auth"` means the user should run `agy` once in a terminal and sign in with Google.

Done when: each backend is either installed or reported as impossible to install, and you know its auth state.

## 2. Interview

Nothing gets generated until the user has answered. Ask with AskUserQuestion even when the request looks complete. The questions don't fit in one call, so make two in a row:

**Call 1, the setup:**
- **Backend** (skip only if the user named one in this request):
  - `Codex (gpt-image)`: sharp typography and text in images, precise edits to reference images.
  - `Antigravity (Gemini image)`: photographic and painterly results.
  Put "(Recommended)" on a backend that is installed and signed in. If only one is usable, still ask, and say in the option description why the other one isn't.
- **Reference**: `No reference`, `I'll give a path or URL` (they type it in Other), `Use an asset from this project` (then find candidates and confirm which one). Also ask what the reference is for: match its style, edit or extend it, keep the product or person identical, or match its composition.
- **Aspect** (skip if the request states a size or ratio): `1:1`, `16:9`, `9:16`, `4:3`.
- **Variations**: `1`, `2`, `4`.

**Call 2, the details.** Offer 3 or 4 concrete options built from the request, not generic ones. The user can always answer through Other.
- **Style / medium**: e.g. editorial photo, flat illustration, 3D render, painterly.
- **Mood / palette**: offer the project's brand palette as an option when one exists.
- **Text in the image**: none, or the exact wording.
- **Use / placement**: hero, background texture, social card, icon. This decides framing, empty space and the output folder.

Done when: backend, reference (path and purpose, or none), aspect, count, style, mood, text and use are all answered.

## 3. Brief and confirm

Turn the answers into a concrete visual brief. Cover subject, composition, framing, lighting, palette, medium or style, and mood. Add any text that must appear, in quotes, spelled exactly. When the image is for a project that has a brand book or design tokens, pull its colours and tone into the brief. Say what to avoid, for example "no watermark, no extra text".

Choose `--out`. Put it inside the project's asset folder if one is obvious (`public/`, `src/assets/`, `brand/`). Otherwise use `./generated/<slug>.png`. Never overwrite an existing file without asking, although the helper backs up anything it would replace.

Show the brief, backend, references, aspect, count and output path in chat. Then ask one more AskUserQuestion: `Generate`, `Edit the brief`. Loop until the answer is Generate.

Done when: the user has picked Generate on the brief shown.

## 4. Generate

```
$H run --backend <codex|agy> --prompt "<brief>" --out <path.png> [--aspect 16:9] [--count N] [--ref <image>]...
```

- For briefs with quotes or newlines, use `--prompt-file <tmp.txt>` instead of `--prompt`.
- Use `--ref` for each reference image the user supplied, such as an edit, a style match or a product shot.
- A run takes 1 to 4 minutes, so launch it with `run_in_background` and say what's running.
- **One run at a time.** Never start a second generation while one is running, whether it's another backend, another brief, or a retry. Run things in parallel only when the user explicitly asks for parallel runs or a side-by-side of both backends. If they want to compare without asking for parallel runs, run Codex, then agy, one after the other.

On failure, act on `reason`:
- `limit`: that backend's plan quota is exhausted (the message gives the reset date). Offer the other backend.
- `auth`: follow the login guidance from step 1.
- `not_installed`: go back to step 1.
- `failed`: show the message tail and retry once with a simplified brief.

## 5. Deliver

Open every path in `files` with Read and look at the result. If it clearly misses the brief, for example wrong subject, garbled text or the wrong ratio, rerun once with a corrected brief before reporting. If the helper changed the extension to match the real format, say so.

Done when: the user has every final path. Send the images with SendUserFile when that tool is available. Include a one-line note on which backend made each image.
