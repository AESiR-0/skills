---
name: video-read
description: Read, watch, analyze or understand the *content* of a video file using ffmpeg — what happens in it, what's on screen, finding a moment, describing shots, QA-ing a screen recording, or summarizing footage. Uses adaptive frame sampling driven by scene-change scores so token cost stays low, escalating resolution only where needed. Use whenever the user points at a .mp4/.mov/.webm/.mkv and asks what's in it, to find a timestamp, to check a recording, or to describe/summarize it. Not for transcoding or format conversion (see video-to-hls for that).
---

# Video → understanding (token-economical)

Read what is *in* a video without spending a fortune on frames.

## Prerequisites

`ffmpeg` and `ffprobe` on PATH, plus `python3`. Check with `ffmpeg -version`. If missing,
tell the user to install it (`winget install Gyan.FFmpeg`, `brew install ffmpeg`,
`apt install ffmpeg`) — do not attempt analysis without it.

The bundled `vread.py` lives next to this file. Refer to it as `<skill-dir>/vread.py`.

## The one thing that governs every decision

**Image tokens ≈ (width × height) / 750.** Tokens are a pure function of pixels shipped.

- Tiling frames into a contact sheet is **packing, not savings** — 16 individual 364px
  frames and one 4×4 sheet of them cost the same. Sheets are for legibility and fewer
  round-trips, not economy.
- Grayscale, JPEG quality, and bitrate change **nothing**. Only pixel dimensions matter.
- Halving the long edge **quarters** the cost (area scales quadratically).

| Cell preset | Size | Tokens/frame | What is actually resolvable |
|---|---|---|---|
| `scan` | 256×144 | 49 | Shot boundaries, light/dark, gross layout |
| `low` | 384×216 | 111 | Scene identity, is-there-a-person, rough composition |
| `mid` *(default)* | 512×288 | 197 | Layout, motion, large title cards, mid-size labels |
| `high` | 768×432 | 442 | Faces, UI labels, composition detail |
| `max` | 1024×576 | 786 | Most UI text, menu items, small captions |

Same 30 moments cost 1.5k tokens at `scan` and 23.6k at `max`. Nothing else in this
workflow comes close to that lever.

**Frames are not a one-time cost.** They stay in context and are re-sent on every later
turn. Default budget is **15k tokens** of frames per video. After reading sheets, write
conclusions out as text so the findings outlive the images.

## Procedure

### 1. Always start with Tier 0 — it is free

```bash
python "<skill-dir>/vread.py" probe VIDEO --budget 15000 --cell mid
```

Returns metadata, subtitle tracks, a scene-change timeline, hard-cut times, black/freeze
events, a `character` classification, and an adaptive `plan` of timestamps — **all as
text, zero image cost.** The deviation measurement your sampling depends on happens here,
in ffmpeg, before any pixel is shipped. Never sample frames to decide how to sample frames.

`character` sets where sampling **starts** — never where it may end:

| Character | Starts at | Meaning |
|---|---|---|
| `static` | 3 frames | Frames say little; go to subtitles/audio first |
| `low-motion` | 6 frames | A sparse survey usually covers it |
| `dynamic` | 8 frames | Real motion; samples cluster on busy stretches |
| `fast-cut` | 8 frames | Dense cuts; climb using `cut_times` as a guide |

There is **no cap.** `ceiling_frames` is the budget (or `--max-frames`), `headroom_frames`
is what remains, and `ladder` lists the rungs between with the exact cost of each. Start
low, read, and climb only if the question is still open.

If `subtitle_streams` is non-empty, **always** pull them first — pure text, often the
whole answer:

```bash
python "<skill-dir>/vread.py" subs VIDEO
```

### 2. Ask before you spend — required

**If the user has not said whether they need to read on-screen text, ask.** This single
answer swings cost ~5× and cannot be guessed reliably. Offer roughly:

- *Rarely* → `--cell low` survey (~111/frame)
- *Sometimes* → `--cell mid` survey, escalate where text appears (~197/frame)
- *Screen recordings / code / captions* → `--cell high` minimum (~442/frame)

State the estimated token cost from `probe`'s `cost_model` when you ask. Skip the question
only when the user already specified fidelity, named a cell preset, or the video is
`static` (frames aren't the answer anyway).

### 3. Survey with a contact sheet

```bash
python "<skill-dir>/vread.py" sheet VIDEO --frames 12 --cell mid --out ./_vread
```

Or pass the exact plan from Tier 0: `--times 0.5,3.2,7.8,...`

Timestamps are burned into each cell, so you can name a moment precisely afterwards. If
the output reports `"timestamps_burned_in": false`, no usable font was found — map cells
to times using each sheet's `frames` list in **row-major order** instead.

### 4. Climb the ladder when the start set didn't answer it

Never re-plan from scratch — that re-proposes moments already in context and charges for
them twice. Ask for the **delta**:

```bash
python "<skill-dir>/vread.py" more VIDEO --have 0.458,1.458,2.75,4.458 --add 6
```

Returns only timestamps distinct from `--have`, concentrated in the intervals carrying the
most change the existing samples failed to explain, and prices them as an increment
(`added_tokens`) plus a running total (`cumulative_tokens`, `headroom_frames`). Feed the
result straight to `sheet --times`.

It self-limits honestly in both directions: if the video has no more distinct moments to
give, `note` says how many of the requested frames actually exist; if a rung would cross
the budget, `warning` says by how much rather than quietly spending it.

Climb while the answer is still open. Doubling is a reasonable default (6 → 12 → 24 → …),
but there is no ceiling short of the budget.

### 5. Escalate resolution only after asking — required

When a frame needs more detail, **ask the user before escalating.** Say what you saw, the
timestamp, and the cost. Then prefer the cheap escalation:

```bash
python "<skill-dir>/vread.py" crop VIDEO --time 12.4 --rect 300,600,700,300 --out ./_vread
```

A 700×300 native-resolution crop costs **280 tokens** and is perfectly sharp. Re-pulling
the whole frame at 1280×720 costs **1229** for detail you mostly don't need. Crop first;
re-pull the full frame larger only when you don't know where in the frame the answer is.

### 6. Audio

Audio carries most of the meaning in talking-head and demo footage, and no amount of
frame sampling recovers it. If there are no embedded subtitles, say so plainly rather
than implying visual coverage was complete.

`whisper` is not installed. On the first video where audio clearly matters, offer once:

```bash
pip install openai-whisper
```

Transcripts are text — cheap per minute, and often replace dozens of frames outright.
Do not install it without asking.

## `--all-frames` requests

Taken literally this is impossible: 10 minutes at 30fps is 18,000 frames ≈ 3.5M tokens at
`mid`. When the user asks for "all frames":

```bash
python "<skill-dir>/vread.py" dedupe VIDEO --cell mid
```

This runs `mpdecimate` and reports how many **distinct** frames exist plus the true cost.
Screen recordings and talking heads often shed 90%+; continuous camera motion sheds
almost nothing (expect ~2%).

If the deduped cost still exceeds budget, **stop and ask for a time range** rather than
silently sampling — the word "all" must not become approximate without the user knowing.
Then run `sheet` with `--times` limited to that window.

## Key behaviors

- **Adaptive by cumulative change, not by clock.** Samples are placed at equal increments
  of summed scene-change score, so static stretches get few frames and busy stretches get
  many. Hard cuts (score ≥ 0.35) are always force-included.
- **Start low, climb freely.** Character picks the opening rung; the only ceiling is the
  token budget or an explicit `--max-frames`. `more` makes each rung cost only its delta,
  so escalating is never a reason to re-pay for frames already read.
- **Scoring pass is cheap.** Runs at 160px wide and ≤ ~1200 sampled frames regardless of
  length, so a 2-hour video still scores in one quick pass.
- **Sheets stay under the API ceiling.** Grid is chosen so no sheet exceeds ~1.15M pixels
  or a 1560px edge; past that the API downscales and the extra pixels are wasted spend.
- **Every command reports `approx_tokens`** before you commit to reading anything.

## Notes

- Output defaults to `./_vread` — a scratch directory. Put it in the scratchpad rather
  than the user's repo, and don't commit it.
- Don't re-read a sheet you've already read; it's already in context.
- `--uniformity` (default 0.02) is the per-sample time floor. Raise it toward uniform
  sampling, lower it to cluster harder on motion.
- This skill *reads* video. For transcoding to HLS/streaming formats, use `video-to-hls`.
