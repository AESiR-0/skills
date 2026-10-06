#!/usr/bin/env python3
"""
vread.py - token-economical video reading via ffmpeg.

Everything expensive is measured in *numbers* (cheap text) before any pixel is
shipped to the model. Image tokens are a pure function of pixels: tokens ~= w*h/750.
Resolution is the only real lever; tiling is packing, not savings.

Subcommands:
  probe      Tier 0. Metadata, subtitle tracks, scene-change timeline, black/freeze
             events, and an adaptive sampling plan. Text only, zero image cost.
  sheet      Extract given timestamps as timestamp-labelled contact sheet(s).
  crop       Native-resolution crop of a single frame (the cheap way to escalate).
  subs       Dump an embedded subtitle track as text.
  dedupe     mpdecimate pass: how many *distinct* frames exist (for --all-frames).
"""

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

# --- token model -------------------------------------------------------------
PX_PER_TOKEN = 750           # tokens ~= (w * h) / 750
MAX_SHEET_PX = 1_150_000     # ~1530 tokens; past this the API downscales anyway
MAX_SHEET_EDGE = 1560        # long-edge ceiling before downscaling kicks in

# cell width presets -> what you can actually resolve at that size
CELLS = {
    "scan": 256,   # 49 tok/frame  - shot boundaries, light/dark, gross layout
    "low": 384,    # 111 tok/frame - scene identity, is-there-a-person
    "mid": 512,    # 197 tok/frame - layout, motion, large title cards
    "high": 768,   # 442 tok/frame - faces, large UI labels, composition detail
    "max": 1024,   # 786 tok/frame - most UI text, menu items, small captions
}

CUT_THRESHOLD = 0.35   # scene score above this is treated as a hard cut

# Where sampling STARTS for each character. Not a cap - the ladder climbs from
# here to the budget/--max-frames ceiling, adding only frames not yet read.
START_FRAMES = {"static": 3, "low-motion": 6, "dynamic": 8, "fast-cut": 8}


def die(msg, code=1):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def need_tools():
    for t in ("ffmpeg", "ffprobe"):
        if not shutil.which(t):
            die(f"{t} not found on PATH. Install ffmpeg "
                "(winget install Gyan.FFmpeg / brew install ffmpeg / apt install ffmpeg).")


def run(cmd, cwd=None, capture_stderr=False):
    p = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE, text=True, errors="replace")
    return p.stdout, (p.stderr if capture_stderr else ""), p.returncode


def tokens_for(w, h):
    return int(round(w * h / PX_PER_TOKEN))


def cell_width(spec):
    """Accept a preset name or a raw pixel width, identically everywhere."""
    if spec in CELLS:
        return CELLS[spec]
    try:
        w = int(spec)
    except (TypeError, ValueError):
        die(f"--cell must be one of {list(CELLS)} or a pixel width, got {spec!r}")
    if w < 64:
        die("--cell width below 64px carries no usable information")
    return w - (w % 2)  # even widths keep the scaler happy


def hhmmss(t):
    t = float(t)
    return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{t % 60:06.3f}"


def label_for(t):
    """Colon-free on purpose: colons are option separators inside a filtergraph."""
    t = float(t)
    if t >= 3600:
        return f"{int(t//3600)}h{int(t%3600//60):02d}m{int(t%60):02d}s"
    if t >= 60:
        return f"{int(t//60)}m{int(t%60):02d}s"
    return f"{t:.1f}s"


# --- probing -----------------------------------------------------------------

def ffprobe_json(path):
    out, _, rc = run(["ffprobe", "-v", "error", "-print_format", "json",
                      "-show_format", "-show_streams", path])
    if rc != 0 or not out.strip():
        die(f"ffprobe failed on {path}")
    return json.loads(out)


def video_info(path):
    meta = ffprobe_json(path)
    v = next((s for s in meta.get("streams", []) if s.get("codec_type") == "video"), None)
    if not v:
        die("no video stream found")
    a = [s for s in meta.get("streams", []) if s.get("codec_type") == "audio"]
    subs = [s for s in meta.get("streams", []) if s.get("codec_type") == "subtitle"]

    num, _, den = (v.get("r_frame_rate") or "0/1").partition("/")
    try:
        fps = float(num) / float(den or 1)
    except (ValueError, ZeroDivisionError):
        fps = 0.0

    dur = 0.0
    for src in (meta.get("format", {}).get("duration"), v.get("duration")):
        try:
            dur = float(src)
            break
        except (TypeError, ValueError):
            continue

    return {
        "path": path,
        "duration": dur,
        "fps": round(fps, 3),
        "width": int(v.get("width") or 0),
        "height": int(v.get("height") or 0),
        "vcodec": v.get("codec_name"),
        "audio_streams": len(a),
        "acodec": a[0].get("codec_name") if a else None,
        "subtitle_streams": [
            {"index": i, "codec": s.get("codec_name"),
             "lang": (s.get("tags") or {}).get("language")}
            for i, s in enumerate(subs)
        ],
        "size_bytes": int(meta.get("format", {}).get("size") or 0),
    }


def scene_scores(path, duration, src_fps, max_samples=1200):
    """One cheap pass at 160px wide. Returns [(pts_time, scene_score), ...]."""
    rate = src_fps if src_fps > 0 else 25.0
    if duration > 0:
        rate = min(rate, max(1.0, max_samples / duration))
    rate = round(max(0.5, rate), 3)

    work = tempfile.mkdtemp(prefix="vread_")
    try:
        vf = (f"fps={rate},scale=160:-2,select='gte(scene,0)',"
              f"metadata=print:file=scores.txt")
        cmd = ["ffmpeg", "-hide_banner", "-nostats", "-an", "-sn",
               "-i", os.path.abspath(path), "-vf", vf,
               "-f", "null", os.devnull]
        run(cmd, cwd=work)

        fp = os.path.join(work, "scores.txt")
        if not os.path.exists(fp):
            return [], rate
        text = open(fp, "r", errors="replace").read()
    finally:
        shutil.rmtree(work, ignore_errors=True)

    out, t = [], None
    for line in text.splitlines():
        m = re.search(r"pts_time:([\d.]+)", line)
        if m:
            t = float(m.group(1))
            continue
        m = re.search(r"scene_score=([\d.eE+-]+)", line)
        if m and t is not None:
            try:
                out.append((t, float(m.group(1))))
            except ValueError:
                pass
            t = None
    return out, rate


def detect_events(path):
    """Black frames and frozen stretches - both are wasted frame budget."""
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-an", "-sn", "-i", path,
           "-vf", "blackdetect=d=0.3:pix_th=0.10,freezedetect=n=-60dB:d=2",
           "-f", "null", os.devnull]
    _, err, _ = run(cmd, capture_stderr=True)
    black, freeze = [], []
    for m in re.finditer(r"black_start:([\d.]+)\s+black_end:([\d.]+)", err):
        black.append([float(m.group(1)), float(m.group(2))])
    starts = [float(m.group(1)) for m in re.finditer(r"freeze_start:\s*([\d.]+)", err)]
    ends = [float(m.group(1)) for m in re.finditer(r"freeze_end:\s*([\d.]+)", err)]
    for i, s in enumerate(starts):
        freeze.append([s, ends[i] if i < len(ends) else None])
    return black, freeze


# --- adaptive planning -------------------------------------------------------

def _place(weights, k):
    """k timestamps at equal increments of cumulative weight over `weights`."""
    if k <= 0 or not weights:
        return []
    total = sum(w for _, w in weights)
    if total <= 0:  # no change at all -> spread evenly by index
        return [weights[min(int((i + 0.5) * len(weights) / k), len(weights) - 1)][0]
                for i in range(k)]
    out, acc, step = [], 0.0, total / k
    target = step / 2.0
    for t, w in weights:
        acc += w
        while acc >= target and len(out) < k:
            out.append(t)
            target += step
    return out


def _thin(picks, have=(), min_gap=0.25):
    """Drop picks that collide with each other or with already-sampled times."""
    keep = []
    for p in sorted(set(round(x, 3) for x in picks if x >= 0)):
        if any(abs(p - q) < min_gap for q in have):
            continue
        if keep and p - keep[-1] < min_gap:
            continue
        keep.append(p)
    return keep


def plan_timestamps(scores, duration, n, uniformity=0.02):
    """
    Place n samples at equal increments of *cumulative visual change*, not equal
    time. Static stretches get few samples; busy stretches get many. `uniformity`
    is a per-sample floor so a wholly static video degrades to uniform sampling.
    Hard cuts always get a sample just after the cut.
    """
    if n <= 0:
        return []
    if not scores:
        if duration <= 0:
            return [0.0]
        step = duration / (n + 1)
        return [round(step * (i + 1), 3) for i in range(n)]

    weights = [(t, s + uniformity) for t, s in scores]
    picks = _place(weights, n)
    # hard cuts are the most information-dense moments; force-include them
    for c in (t for t, s in scores if s >= CUT_THRESHOLD):
        if not any(abs(c - p) < 0.4 for p in picks):
            picks.append(c)
    return _thin(picks)


def plan_more(scores, duration, add, have, uniformity=0.02):
    """
    Return `add` NEW timestamps, placed where the most *unsampled* change sits.

    This is the escalation step: it never re-proposes a moment already read, and
    it concentrates new samples in the intervals carrying the most change that
    the existing picks failed to explain — so climbing the ladder costs only the
    frames you actually add.
    """
    if add <= 0:
        return []
    have = sorted(float(h) for h in have)
    if not scores:
        if duration <= 0:
            return []
        step = duration / (add + 1)
        return _thin([step * (i + 1) for i in range(add)], have)

    weights = [(t, s + uniformity) for t, s in scores]

    # split the timeline into the gaps between already-sampled moments
    segments, cur, bi = [], [], 0
    for t, w in weights:
        while bi < len(have) and t > have[bi]:
            segments.append(cur)
            cur = []
            bi += 1
        cur.append((t, w))
    segments.append(cur)

    seg_w = [sum(w for _, w in s) for s in segments]
    total = sum(seg_w)
    if total <= 0:
        return []

    # largest-remainder allocation of new samples across gaps, by unsampled change
    raw = [add * x / total for x in seg_w]
    alloc = [int(math.floor(r)) for r in raw]
    for i in sorted(range(len(raw)), key=lambda j: raw[j] - alloc[j],
                    reverse=True)[:add - sum(alloc)]:
        alloc[i] += 1

    picks = []
    for seg, k in zip(segments, alloc):
        picks.extend(_place(seg, k))
    return _thin(picks, have)[:add]


def grid_for(count, cw, ch):
    """Pick cols x rows so the sheet stays under the pixel and edge ceilings."""
    per_sheet = max(1, int(MAX_SHEET_PX // (cw * ch)))
    n = min(count, per_sheet)
    cols = max(1, int(round(math.sqrt(n * ch / cw))))
    while cols > 1 and cols * cw > MAX_SHEET_EDGE:
        cols -= 1
    rows = max(1, math.ceil(n / cols))
    while rows * ch > MAX_SHEET_EDGE and rows > 1:
        rows -= 1
        n = cols * rows
    return cols, rows, cols * rows


# --- frame extraction --------------------------------------------------------

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\consola.ttf", r"C:\Windows\Fonts\arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
]


def prepare_font(workdir):
    """
    Copy a font into the ffmpeg working directory and reference it by bare
    filename. Absolute paths can't be used: a Windows drive colon collides with
    the filtergraph option separator, and this build ships no fontconfig, so
    font-name lookup fails too. A cwd-relative filename sidesteps both.
    Returns the drawtext fontfile fragment, or "" if no usable font exists.
    """
    for c in FONT_CANDIDATES:
        if os.path.exists(c):
            try:
                shutil.copyfile(c, os.path.join(workdir, "f.ttf"))
                return "fontfile=f.ttf:"
            except OSError:
                continue
    return ""


def extract_frame(path, t, out, cw, ch, fontopt=None, cwd=None):
    """`path` and `out` must be absolute: ffmpeg runs with cwd set to the workdir."""
    fs = max(11, cw // 22)
    vf = (f"scale={cw}:{ch}:force_original_aspect_ratio=decrease,"
          f"pad={cw}:{ch}:(ow-iw)/2:(oh-ih)/2:black")
    if fontopt is not None and fontopt != "":
        vf += (f",drawtext={fontopt}text='{label_for(t)}':x=6:y=6:"
               f"fontsize={fs}:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4")
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", path,
           "-frames:v", "1", "-vf", vf, "-q:v", "6", out]
    _, _, rc = run(cmd, cwd=cwd)
    if rc != 0 and fontopt:  # label failed for some reason -> keep the frame
        return extract_frame(path, t, out, cw, ch, fontopt="", cwd=cwd)
    return rc == 0 and os.path.exists(out)


def build_sheets(path, times, cell, outdir, label=True):
    info = video_info(path)
    if info["width"] <= 0:
        die("could not read source dimensions")
    cw = cell_width(cell)
    ch = int(round(cw * info["height"] / info["width"] / 2)) * 2
    if ch <= 0:
        die("computed cell height is zero")

    os.makedirs(outdir, exist_ok=True)
    src = os.path.abspath(path)
    cols, rows, per = grid_for(len(times), cw, ch)

    sheets, idx, labelled = [], 0, None
    for start in range(0, len(times), per):
        batch = times[start:start + per]
        work = tempfile.mkdtemp(prefix="vread_sheet_")
        try:
            fontopt = prepare_font(work) if label else ""
            if labelled is None:
                labelled = bool(fontopt)
            kept = []
            for t in batch:
                fp = os.path.join(work, f"f_{len(kept) + 1:03d}.jpg")
                if extract_frame(src, t, fp, cw, ch, fontopt, cwd=work):
                    kept.append(round(t, 3))
            # the image2 demuxer needs contiguous numbering, so only kept frames exist
            files = sorted(f for f in os.listdir(work) if f.startswith("f_"))
            for i, f in enumerate(files):
                os.rename(os.path.join(work, f), os.path.join(work, f"g_{i + 1:03d}.jpg"))
            n = len(files)
            if n == 0:
                continue
            c, r, _ = grid_for(n, cw, ch)
            # pad to a full grid so the tile filter emits a frame
            if n < c * r:
                blank = os.path.join(work, "blank.jpg")
                run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                     f"color=c=0x151515:s={cw}x{ch}", "-frames:v", "1", blank])
                for k in range(n, c * r):
                    if os.path.exists(blank):
                        shutil.copyfile(blank, os.path.join(work, f"g_{k + 1:03d}.jpg"))
                if os.path.exists(blank):
                    os.remove(blank)

            idx += 1
            sheet = os.path.abspath(os.path.join(outdir, f"sheet_{idx:02d}.jpg"))
            _, _, rc = run(["ffmpeg", "-v", "error", "-y", "-i",
                            os.path.join(work, "g_%03d.jpg"),
                            "-vf", f"tile={c}x{r}:margin=6:padding=4:color=0x151515",
                            "-frames:v", "1", "-q:v", "4", sheet])
            if rc == 0 and os.path.exists(sheet):
                sw, sh = c * cw, r * ch
                sheets.append({"file": sheet, "grid": f"{c}x{r}",
                               "frames": kept, "cell": [cw, ch],
                               "approx_tokens": tokens_for(sw, sh)})
        finally:
            shutil.rmtree(work, ignore_errors=True)
    return sheets, cw, ch, bool(labelled)


# --- subcommands -------------------------------------------------------------

def cmd_probe(a):
    info = video_info(a.video)
    scores, rate = scene_scores(a.video, info["duration"], info["fps"])
    black, freeze = ([], []) if a.no_events else detect_events(a.video)

    vals = [s for _, s in scores]
    cuts = [round(t, 2) for t, s in scores if s >= CUT_THRESHOLD]
    mean = sum(vals) / len(vals) if vals else 0.0
    peak = max(vals) if vals else 0.0
    static_frac = (sum(1 for v in vals if v < 0.01) / len(vals)) if vals else 1.0

    if static_frac > 0.9 and peak < 0.1:
        character, hint = "static", "Visually near-static. Frames add little; check audio/subtitles."
    elif len(cuts) > max(8, info["duration"] / 4):
        character, hint = "fast-cut", "Dense cuts. Sample per shot, not per second; cap the budget."
    elif mean < 0.02:
        character, hint = "low-motion", "Slow. A sparse survey will cover it."
    else:
        character, hint = "dynamic", "Real motion. Adaptive sampling will cluster on the busy stretches."

    cw = cell_width(a.cell)
    ch = int(round(cw * info["height"] / max(1, info["width"]) / 2)) * 2 if info["width"] else 288
    per_frame = tokens_for(cw, ch)
    # Character sets where sampling STARTS, never where it may end. The ceiling is
    # the budget (or an explicit --max-frames); everything between is reachable by
    # climbing the ladder with `more`, paying only for the frames actually added.
    ceiling = max(1, a.budget // per_frame) if a.budget else None
    ceiling_source = "budget"
    if a.max_frames and (ceiling is None or int(a.max_frames) < ceiling):
        ceiling, ceiling_source = int(a.max_frames), "--max-frames"
    if ceiling is None:
        ceiling, ceiling_source = 64, "fallback (no --budget and no --max-frames)"

    start = int(a.start) if a.start else START_FRAMES[character]
    start = max(1, min(start, ceiling))

    rungs, k = [], start
    while k < ceiling:
        rungs.append(k)
        k *= 2
    rungs.append(ceiling)
    rungs = sorted(set(r for r in rungs if r <= ceiling))

    plan = plan_timestamps(scores, info["duration"], start, a.uniformity)

    ladder, prev = [], 0
    for r in rungs:
        ladder.append({"frames": r, "add": r - prev, "cum_tokens": r * per_frame})
        prev = r

    print(json.dumps({
        "info": info,
        "duration_hms": hhmmss(info["duration"]),
        "scoring": {"sampled_at_fps": rate, "samples": len(scores),
                    "mean_change": round(mean, 4), "peak_change": round(peak, 4),
                    "static_fraction": round(static_frac, 3),
                    "hard_cuts": len(cuts), "cut_times": cuts[:80]},
        "events": {"black": black[:20], "freeze": freeze[:20]},
        "character": character,
        "hint": hint,
        "cost_model": {"cell": [cw, ch], "tokens_per_frame": per_frame,
                       "start_frames": len(plan),
                       "start_tokens": per_frame * len(plan),
                       "ceiling_frames": ceiling,
                       "ceiling_source": ceiling_source,
                       "ceiling_tokens": per_frame * ceiling,
                       "headroom_frames": max(0, ceiling - len(plan)),
                       "ladder": ladder},
        "plan": plan,
        "escalate": ("read the start set first, then add only what it did not answer: "
                     "vread.py more VIDEO --have <times already read> --add <n>"),
    }, indent=2))


def cmd_more(a):
    """Climb one rung: new timestamps only, priced as a delta."""
    info = video_info(a.video)
    scores, _ = scene_scores(a.video, info["duration"], info["fps"])
    have = [float(x) for x in a.have.replace(" ", "").split(",") if x] if a.have else []
    new = plan_more(scores, info["duration"], a.add, have, a.uniformity)

    cw = cell_width(a.cell)
    ch = int(round(cw * info["height"] / max(1, info["width"]) / 2)) * 2
    per_frame = tokens_for(cw, ch)
    ceiling = max(1, a.budget // per_frame) if a.budget else None
    total_frames = len(have) + len(new)

    out = {
        "already_sampled": len(have),
        "new_frames": len(new),
        "cell": [cw, ch],
        "tokens_per_frame": per_frame,
        "added_tokens": per_frame * len(new),
        "cumulative_frames": total_frames,
        "cumulative_tokens": per_frame * total_frames,
        "times": new,
    }
    if ceiling is not None:
        out["ceiling_frames"] = ceiling
        out["headroom_frames"] = max(0, ceiling - total_frames)
        if total_frames > ceiling:
            out["warning"] = (f"this rung puts you {total_frames - ceiling} frames past the "
                              f"{a.budget}-token budget ({per_frame * total_frames} tokens). "
                              "Raise --budget deliberately or drop --add.")
    if len(new) < a.add:
        out["note"] = (f"only {len(new)} of {a.add} requested frames are distinct from what "
                       "you already have - the remaining change is already covered.")
    print(json.dumps(out, indent=2))


def cmd_sheet(a):
    if a.times:
        times = [float(x) for x in a.times.replace(" ", "").split(",") if x]
    else:
        info = video_info(a.video)
        scores, _ = scene_scores(a.video, info["duration"], info["fps"])
        times = plan_timestamps(scores, info["duration"], a.frames, a.uniformity)
    if not times:
        die("no timestamps to extract")
    sheets, cw, ch, labelled = build_sheets(a.video, times, a.cell, a.out,
                                            label=not a.no_label)
    total = sum(s["approx_tokens"] for s in sheets)
    out = {"cell": [cw, ch], "frames": len(times), "timestamps_burned_in": labelled,
           "sheets": sheets, "approx_total_tokens": total}
    if not a.no_label and not labelled:
        out["warning"] = ("no usable font found - cells are UNLABELLED. Map cells to "
                          "times by reading each sheet's `frames` list in row-major order.")
    print(json.dumps(out, indent=2))


def cmd_crop(a):
    os.makedirs(a.out, exist_ok=True)
    x, y, w, h = [int(v) for v in a.rect.split(",")]
    dest = os.path.abspath(os.path.join(a.out, f"crop_{a.time:.2f}".replace(".", "_") + ".jpg"))
    _, _, rc = run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a.time:.3f}", "-i", a.video,
                    "-frames:v", "1", "-vf", f"crop={w}:{h}:{x}:{y}", "-q:v", "2", dest])
    if rc != 0:
        die("crop failed - check the rect fits inside the frame")
    print(json.dumps({"file": dest, "rect": [x, y, w, h],
                      "approx_tokens": tokens_for(w, h)}, indent=2))


def cmd_subs(a):
    info = video_info(a.video)
    if not info["subtitle_streams"]:
        print(json.dumps({"subtitle_streams": [], "text": None,
                          "note": "no embedded subtitle track"}, indent=2))
        return
    out, _, rc = run(["ffmpeg", "-v", "error", "-i", a.video,
                      "-map", f"0:s:{a.index}", "-f", "srt", "-"])
    if rc != 0:
        die("subtitle extraction failed")
    print(out)


def cmd_dedupe(a):
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-an", "-sn", "-i", a.video,
           "-vf", f"mpdecimate=hi={a.hi}:lo={a.lo}:frac={a.frac},showinfo",
           "-vsync", "vfr", "-f", "null", os.devnull]
    _, err, _ = run(cmd, capture_stderr=True)
    times = [round(float(m.group(1)), 3)
             for m in re.finditer(r"pts_time:([\d.]+)", err)]
    info = video_info(a.video)
    total = int(info["duration"] * info["fps"]) if info["fps"] else 0
    cw = cell_width(a.cell)
    ch = int(round(cw * info["height"] / max(1, info["width"]) / 2)) * 2
    print(json.dumps({
        "total_frames_approx": total,
        "distinct_frames": len(times),
        "reduction": f"{100 * (1 - len(times) / total):.1f}%" if total else "n/a",
        "tokens_per_frame_at_{}".format(a.cell): tokens_for(cw, ch),
        "approx_tokens_if_all_shipped": tokens_for(cw, ch) * len(times),
        "times": times if a.emit_times else times[:50],
    }, indent=2))


def main():
    need_tools()
    p = argparse.ArgumentParser(prog="vread.py", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    pr = sub.add_parser("probe", help="Tier 0: metadata + change timeline + plan (text only)")
    pr.add_argument("video")
    pr.add_argument("--budget", type=int, default=15000,
                    help="token ceiling for frames (0 = no budget ceiling)")
    pr.add_argument("--start", type=int, default=0,
                    help="starting frame count; default is chosen from video character")
    pr.add_argument("--max-frames", type=int, default=0,
                    help="absolute frame ceiling; default is derived from --budget")
    pr.add_argument("--cell", default="mid", help=f"cell preset {list(CELLS)} or px width")
    pr.add_argument("--uniformity", type=float, default=0.02)
    pr.add_argument("--no-events", action="store_true", help="skip black/freeze pass")
    pr.set_defaults(func=cmd_probe)

    mo = sub.add_parser("more", help="climb the ladder: NEW timestamps only, priced as a delta")
    mo.add_argument("video")
    mo.add_argument("--have", default="",
                    help="comma-separated timestamps already read; omit for none")
    mo.add_argument("--add", type=int, default=8, help="how many new frames to add")
    mo.add_argument("--budget", type=int, default=15000, help="0 to disable the check")
    mo.add_argument("--cell", default="mid")
    mo.add_argument("--uniformity", type=float, default=0.02)
    mo.set_defaults(func=cmd_more)

    sh = sub.add_parser("sheet", help="build timestamp-labelled contact sheet(s)")
    sh.add_argument("video")
    sh.add_argument("--times", help="comma-separated seconds; omit to auto-plan")
    sh.add_argument("--frames", type=int, default=12, help="frames when auto-planning")
    sh.add_argument("--cell", default="mid", help=f"cell preset {list(CELLS)} or px width")
    sh.add_argument("--out", default="./_vread", help="output directory")
    sh.add_argument("--uniformity", type=float, default=0.02)
    sh.add_argument("--no-label", action="store_true")
    sh.set_defaults(func=cmd_sheet)

    cr = sub.add_parser("crop", help="native-res crop of one frame (cheapest escalation)")
    cr.add_argument("video")
    cr.add_argument("--time", type=float, required=True)
    cr.add_argument("--rect", required=True, help="x,y,w,h in source pixels")
    cr.add_argument("--out", default="./_vread")
    cr.set_defaults(func=cmd_crop)

    su = sub.add_parser("subs", help="dump an embedded subtitle track as text")
    su.add_argument("video")
    su.add_argument("--index", type=int, default=0)
    su.set_defaults(func=cmd_subs)

    dd = sub.add_parser("dedupe", help="count distinct frames via mpdecimate")
    dd.add_argument("video")
    dd.add_argument("--hi", default="768")
    dd.add_argument("--lo", default="320")
    dd.add_argument("--frac", default="0.33")
    dd.add_argument("--cell", default="mid")
    dd.add_argument("--emit-times", action="store_true")
    dd.set_defaults(func=cmd_dedupe)

    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
