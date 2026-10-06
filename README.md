# skills

Agent skills by [AESiR-0](https://github.com/AESiR-0) for Claude Code, Codex, Gemini and any agent that reads `SKILL.md`.

## Install

```bash
npx skills add AESiR-0/skills
```

Or install a single skill:

```bash
npx skills add AESiR-0/skills --skill generate-image
```

Manual: copy a folder from `skills/` into `~/.claude/skills/` (or your agent's skills directory).

## Skills

| Skill | What it does | Needs |
|---|---|---|
| [generate-image](skills/generate-image) | Generates images through the Codex CLI (gpt-image) or the Antigravity CLI `agy` (Gemini image). Interviews you first (backend, reference, style, use), confirms the brief, installs a missing CLI, and recovers the file from each backend's own store. | Node 18+, a Codex or Antigravity login |
| [video-read](skills/video-read) | Understands what is in a video with ffmpeg, using scene-change scoring to sample frames adaptively so token cost stays low. Contact sheets, crops, subtitles, dedupe. | ffmpeg, Python 3 |
| [video-to-hls](skills/video-to-hls) | Batch-converts videos into adaptive HLS (1080p + 720p) for CDN streaming. Orientation-aware, never upscales, safe to re-run. | ffmpeg, bash |
| [anti-slop-dashboard](skills/anti-slop-dashboard) | A verified reference library for dashboards that look designed, not generated: glass cards, elevation, typography, sidebar and search, charts, motion, interaction states, buttons, plus a checklist of slop tells. | none |
