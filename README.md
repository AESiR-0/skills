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
| [client-proposal-pack](skills/client-proposal-pack) | A branded 16:9 pitch deck with pricing and a matching agreement, both exported to PDF. Tiered pricing, struck-through list price, full-advance discount, payment splits and retainers; deck and contract numbers and scope must match. | Chrome or Edge, Node 18+ |
| [design-options-switcher](skills/design-options-switcher) | Shows design options as visuals for approval before building, then ships a temporary client-facing switcher panel (data attributes, saved picks, no flash, hidden on production) and bakes in the winners. | none |
| [client-feedback-round](skills/client-feedback-round) | Turns a feedback PDF, screenshots or a transcript into a ledger of every item, asks open questions in one batch, executes within scope, verifies desktop and phone, and hands back per-item status plus a to-do doc. | none |
| [sheets-form-backend](skills/sheets-form-backend) | Website forms into Google Sheets via Apps Script: server proxy, honest success only, shared secret, duplicate blocking with a lock, spam guards, formula-injection safety, optional password gate. | A Google account |
| [image-prompt-manifest](skills/image-prompt-manifest) | Inventories every image slot and writes a ready-to-paste prompt manifest with exact paths and sizes, then checks generated files against disk and code and wires them in. | Node 18+ |
| [anti-slop-dashboard](skills/anti-slop-dashboard) | A verified reference library for dashboards that look designed, not generated: glass cards, elevation, typography, sidebar and search, charts, motion, interaction states, buttons, plus a checklist of slop tells. | none |
