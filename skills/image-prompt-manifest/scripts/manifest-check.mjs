#!/usr/bin/env node
// Diff an image-prompt manifest against the disk and the code.
//
//   node manifest-check.mjs <manifest.md> [--root <project dir>] [--json]
//
// Reads every entry line of the form
//   **Path** `public/work/foo.jpg` · **16:9** · **1600 × 900**
// and reports, per slot: missing on disk, wrong size or aspect, not referenced in code, or ok.
// Zero dependencies. Reads PNG, JPEG, WebP, GIF and AVIF headers for dimensions.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const manifest = args.find((a) => !a.startsWith('--'));
const rootIdx = args.indexOf('--root');
const root = path.resolve(rootIdx >= 0 ? args[rootIdx + 1] : process.cwd());
const asJson = args.includes('--json');
if (!manifest) {
  console.error('usage: manifest-check.mjs <manifest.md> [--root <dir>] [--json]');
  process.exit(2);
}

// ---------- parse ----------

const text = fs.readFileSync(manifest, 'utf8');
const slots = [];
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/\*\*Path\*\*\s*`([^`]+)`(.*)$/i);
  if (!m || /[<{]/.test(m[1])) continue; // unfilled template entries
  const rest = m[2];
  const size = rest.match(/(\d{2,5})\s*[×xX]\s*(\d{2,5})/);
  const aspect = rest.match(/\b(\d{1,2})\s*:\s*(\d{1,2})\b/);
  slots.push({
    path: m[1].trim(),
    width: size ? +size[1] : null,
    height: size ? +size[2] : null,
    aspect: aspect ? +aspect[1] / +aspect[2] : null,
    aspectLabel: aspect ? `${aspect[1]}:${aspect[2]}` : null,
  });
}
if (!slots.length) {
  console.error('No **Path** `...` lines found. See the entry format in SKILL.md.');
  process.exit(2);
}

// ---------- image dimensions ----------

function dims(file) {
  const b = fs.readFileSync(file);
  if (b.length < 30) return null;
  if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), fmt: 'png' };
  if (b.toString('ascii', 0, 3) === 'GIF') return { w: b.readUInt16LE(6), h: b.readUInt16LE(8), fmt: 'gif' };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), fmt: 'webp' };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1, fmt: 'webp' };
    }
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, fmt: 'webp' };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5), fmt: 'jpg' };
      }
      i += 2 + len;
    }
    return null;
  }
  const ispe = b.indexOf('ispe');
  if (b.toString('ascii', 4, 8) === 'ftyp' && ispe > 0) {
    return { w: b.readUInt32BE(ispe + 8), h: b.readUInt32BE(ispe + 12), fmt: 'avif' };
  }
  return null;
}

// ---------- code references ----------

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.astro', '.vercel', '.turbo', 'coverage']);
const CODE = /\.(tsx?|jsx?|mjs|cjs|astro|vue|svelte|html|css|scss|mdx?|json|ya?ml)$/i;
const MAX_FILE = 512 * 1024; // skip bundles, lottie files and data dumps

// Per slot: needles that count as an exact reference, and the bare stem (a slug + extension
// assembled in code). Files are scanned one at a time, so memory stays flat on big repos.
const refs = slots.map((s) => {
  const base = path.basename(s.path);
  const stem = base.replace(/\.[^.]+$/, '');
  return { exact: [s.path.replace(/^public\//, ''), base], stem: stem.length > 3 ? stem : null, found: null };
});
const manifestAbs = path.resolve(manifest);
(function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!CODE.test(e.name) || path.resolve(p) === manifestAbs) continue;
    if (/(^|[\\/])(docs?|notes?)[\\/]/i.test(path.relative(root, p)) && /\.mdx?$/i.test(e.name)) continue; // prompt docs aren't wiring
    let body;
    try {
      if (fs.statSync(p).size > MAX_FILE) continue;
      body = fs.readFileSync(p, 'utf8');
    } catch { continue; }
    for (const r of refs) {
      if (r.found === 'exact') continue;
      if (r.exact.some((n) => body.includes(n))) r.found = 'exact';
      else if (!r.found && r.stem && body.includes(r.stem)) r.found = 'stem';
    }
  }
})(root);

const referenced = (i) => refs[i].found;

// ---------- report ----------

const rows = slots.map((s, i) => {
  const abs = path.resolve(root, s.path);
  const out = { ...s, status: 'ok', notes: [] };
  if (!fs.existsSync(abs)) {
    out.status = 'missing';
    return out;
  }
  const d = dims(abs);
  if (!d) out.notes.push('could not read dimensions');
  else {
    out.actual = `${d.w}x${d.h}`;
    const ext = path.extname(abs).slice(1).toLowerCase().replace('jpeg', 'jpg');
    if (ext && d.fmt !== ext) out.notes.push(`bytes are ${d.fmt}, extension is .${ext}`);
    if (s.width && (d.w !== s.width || d.h !== s.height)) {
      out.notes.push(`size ${d.w}x${d.h}, manifest says ${s.width}x${s.height}`);
    }
    if (s.aspect && Math.abs(d.w / d.h - s.aspect) / s.aspect > 0.02) {
      out.notes.push(`aspect ${(d.w / d.h).toFixed(3)}, manifest says ${s.aspectLabel}`);
    }
    out.kb = Math.round(fs.statSync(abs).size / 1024);
  }
  const ref = referenced(i);
  if (!ref) out.notes.push('not referenced in code');
  else if (ref === 'stem') out.notes.push('only the file stem appears in code (check it is wired)');
  if (out.notes.length) out.status = 'check';
  return out;
});

if (asJson) {
  console.log(JSON.stringify({ root, manifest, slots: rows }, null, 2));
} else {
  const n = (st) => rows.filter((r) => r.status === st).length;
  for (const r of rows) {
    const mark = r.status === 'ok' ? 'OK     ' : r.status === 'missing' ? 'MISSING' : 'CHECK  ';
    const extra = r.status === 'missing' ? '' : `  ${r.actual ?? ''}${r.kb != null ? ` ${r.kb}KB` : ''}`;
    console.log(`${mark} ${r.path}${extra}${r.notes.length ? '\n          ' + r.notes.join('; ') : ''}`);
  }
  console.log(`\n${rows.length} slots: ${n('ok')} ok, ${n('check')} to check, ${n('missing')} missing`);
}
process.exit(rows.every((r) => r.status === 'ok') ? 0 : 1);
