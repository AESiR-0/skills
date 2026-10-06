---
name: video-to-hls
description: Convert video files into adaptive-bitrate HLS (720p + 1080p) for CDN streaming using ffmpeg. Use when the user wants to transcode/convert videos to HLS, prepare videos for a CDN or streaming, generate .m3u8 playlists, or build an adaptive-bitrate ladder. Orientation-aware (handles vertical/UGC and horizontal clips), mirrors the source folder tree, and is safe to re-run.
---

# Video → HLS (adaptive streaming)

Batch-convert every `.mp4` (and other ffmpeg-readable video) under a source folder into
adaptive HLS with a `master.m3u8` per video, ready to upload to a CDN.

## Prerequisites

`ffmpeg` and `ffprobe` must be on PATH. Check with `ffmpeg -version`. If missing, tell the
user to install it (e.g. `winget install Gyan.FFmpeg`, `brew install ffmpeg`, or
`apt install ffmpeg`) — do not attempt the conversion without it.

## Usage

The bundled `build-hls.sh` lives next to this file. Run it with bash:

```bash
bash "<skill-dir>/build-hls.sh" --src public/videos --out public/streaming
```

- `--src` (default `public/videos`) — root scanned recursively for video files.
- `--out` (default `public/streaming`) — HLS output root; the source tree is mirrored here.
- `--ext` (default `mp4`) — comma-separated extensions to scan (e.g. `mp4,mov,mkv`).

For each `SRC/<path>/<name>.<ext>` it writes `OUT/<path>/<name>/` containing:
`master.m3u8`, `1080p.m3u8` + `720p.m3u8`, and their `.ts` segments.

## Key behaviors

- **Adaptive ladder:** 1080p (~5.5 Mbit cap) + 720p (~3 Mbit cap), H.264 high profile, AAC stereo audio, 6 s segments, VOD playlists, aligned GOPs for clean rendition switching.
- **Orientation-aware:** scales on the **short edge**, so vertical/UGC clips stay vertical and aren't squashed.
- **No upscaling:** a tier is skipped when the source's short edge is smaller than it (e.g. a 720p source yields only the 720p rendition).
- **Idempotent:** a video whose `master.m3u8` already exists is skipped, so the run is safe to resume after an interruption.
- **Heavy job:** this transcodes every source video. For large batches run it in the background and monitor the log rather than blocking.

## Tuning

Edit the `MAXRATE` / `BUFSIZE` / `BWIDTH` / `CRF` maps near the top of `build-hls.sh` to change
quality/bitrate, or add tiers (e.g. `480`) to the maps and the tier loop.

## Notes

- HLS output and large source media are usually **gitignored** — they belong on the CDN, not in the repo.
- In Next.js / static-host projects, keep heavy media out of the bundle; serve HLS from the CDN.
