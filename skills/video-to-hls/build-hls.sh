#!/usr/bin/env bash
# Build adaptive HLS (720p + 1080p) for every video under a source root.
# Output mirrors the source tree: SRC/<path>/<name>.<ext> -> OUT/<path>/<name>/master.m3u8
# Orientation-aware: scales on the SHORT edge so vertical (UGC) clips aren't mangled.
# Idempotent: a video whose master.m3u8 already exists is skipped (safe to re-run/resume).
#
# Usage: build-hls.sh [--src public/videos] [--out public/streaming] [--ext mp4,mov,mkv]
set -euo pipefail

SRC_ROOT="public/videos"
OUT_ROOT="public/streaming"
EXTS="mp4"
SEG=6   # HLS segment length (seconds)

while [ $# -gt 0 ]; do
  case "$1" in
    --src) SRC_ROOT="$2"; shift 2 ;;
    --out) OUT_ROOT="$2"; shift 2 ;;
    --ext) EXTS="$2"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v ffmpeg  >/dev/null || { echo "ffmpeg not found on PATH"  >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe not found on PATH" >&2; exit 1; }

# tier -> target short-edge px : maxrate(k) : bufsize(k) : bandwidth(bps for master) : crf
declare -A MAXRATE=( [1080]=5500 [720]=3000 )
declare -A BUFSIZE=( [1080]=11000 [720]=6000 )
declare -A BWIDTH=(  [1080]=5600000 [720]=3100000 )
declare -A CRF=(     [1080]=21 [720]=22 )

shopt -s globstar nullglob nocaseglob
FILES=()
IFS=',' read -ra EXTARR <<< "$EXTS"
for e in "${EXTARR[@]}"; do
  for f in "$SRC_ROOT"/**/*."$e"; do FILES+=( "$f" ); done
done
IFS=$'\n' FILES=($(printf '%s\n' "${FILES[@]}" | sort -u)); unset IFS
total=${#FILES[@]}
echo "Found $total source videos under $SRC_ROOT (ext: $EXTS)."
[ "$total" -eq 0 ] && exit 0

i=0
for src in "${FILES[@]}"; do
  i=$((i+1))
  rel="${src#"$SRC_ROOT"/}"
  rel="${rel%.*}"
  out="$OUT_ROOT/$rel"
  if [ -f "$out/master.m3u8" ]; then
    echo "[$i/$total] SKIP (exists): $rel"
    continue
  fi
  mkdir -p "$out"

  read -r W H < <(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height -of csv=s=x:p=0 "$src" | tr -d '\r' | tr 'x' ' ')
  short=$(( W < H ? W : H ))
  echo "[$i/$total] $rel  (${W}x${H}, short=${short})"

  variants=()
  for tier in 1080 720; do
    if [ "$short" -lt "$tier" ]; then
      echo "    - skip ${tier}p (source short edge ${short} < ${tier})"
      continue
    fi
    if [ "$W" -ge "$H" ]; then vf="scale=-2:${tier}"; else vf="scale=${tier}:-2"; fi
    echo "    - encoding ${tier}p ..."
    ffmpeg -nostdin -y -loglevel error -i "$src" \
      -vf "$vf" \
      -c:v libx264 -profile:v high -preset veryfast \
      -crf "${CRF[$tier]}" -maxrate "${MAXRATE[$tier]}k" -bufsize "${BUFSIZE[$tier]}k" \
      -g 48 -keyint_min 48 -sc_threshold 0 \
      -c:a aac -b:a 128k -ac 2 \
      -hls_time "$SEG" -hls_playlist_type vod \
      -hls_segment_filename "$out/${tier}p_%03d.ts" \
      "$out/${tier}p.m3u8"
    read -r ow oh < <(ffprobe -v error -select_streams v:0 \
      -show_entries stream=width,height -of csv=s=x:p=0 "$out/${tier}p.m3u8" | tr -d '\r' | tr 'x' ' ')
    variants+=( "#EXT-X-STREAM-INF:BANDWIDTH=${BWIDTH[$tier]},RESOLUTION=${ow}x${oh}|${tier}p.m3u8" )
  done

  {
    echo "#EXTM3U"
    echo "#EXT-X-VERSION:3"
    for v in "${variants[@]}"; do
      echo "${v%%|*}"
      echo "${v##*|}"
    done
  } > "$out/master.m3u8"
  echo "    done -> $out/master.m3u8"
done
echo "ALL DONE."
