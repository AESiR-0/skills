#!/usr/bin/env node
// Image generation through the Codex CLI (gpt-image) or the Antigravity CLI `agy` (Gemini image).
// Zero dependencies. Every command prints one JSON object on its last stdout line.
//
//   node imagegen.mjs check
//   node imagegen.mjs install <codex|agy>
//   node imagegen.mjs run --backend <codex|agy> --prompt "<brief>" --out <file.png>
//                         [--count N] [--aspect 16:9] [--ref <img>]... [--timeout <sec>]

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WIN = process.platform === 'win32';
const HOME = os.homedir();
const CODEX_IMAGES = path.join(process.env.CODEX_HOME || path.join(HOME, '.codex'), 'generated_images');
const AGY_BRAIN = path.join(HOME, '.gemini', 'antigravity-cli', 'brain');
const IMG_EXT = /\.(png|jpe?g|webp|gif)$/i;

const out = (obj) => { console.log(JSON.stringify(obj)); process.exit(obj.ok === false ? 1 : 0); };

// ---------- binary resolution ----------

function which(name) {
  const r = spawnSync(WIN ? 'where' : 'which', [name], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const hits = r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  // On Windows prefer a directly executable shim over .ps1 (spawn can't run .ps1).
  return hits.find((h) => /\.(exe|cmd|bat)$/i.test(h)) || (WIN ? null : hits[0]) || null;
}

function resolveBin(backend) {
  const found = which(backend);
  if (found) return found;
  if (backend === 'agy' && WIN) {
    // winget installs don't refresh PATH for the running shell; look where it puts things.
    const local = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
    const link = path.join(local, 'Microsoft', 'WinGet', 'Links', 'agy.exe');
    if (fs.existsSync(link)) return link;
    const pkgs = path.join(local, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(pkgs)) {
      for (const d of fs.readdirSync(pkgs)) {
        if (!d.startsWith('Google.AntigravityCLI')) continue;
        const exe = path.join(pkgs, d, 'agy.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  if (backend === 'codex' && WIN) {
    const shim = path.join(process.env.APPDATA || '', 'npm', 'codex.cmd');
    if (fs.existsSync(shim)) return shim;
  }
  return null;
}

// .cmd/.bat shims need a shell on Windows; quote every arg ourselves in that case.
function spawnBin(bin, args, opts = {}) {
  const needsShell = WIN && /\.(cmd|bat)$/i.test(bin);
  if (!needsShell) return spawn(bin, args, opts);
  const q = (s) => (/[\s"&|<>^()]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);
  return spawn([q(bin), ...args.map(q)].join(' '), { ...opts, shell: true });
}

function runSync(bin, args) {
  return new Promise((resolve) => {
    let text = '';
    const p = spawnBin(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (d) => (text += d));
    p.stderr.on('data', (d) => (text += d));
    p.on('error', (e) => resolve({ code: -1, text: String(e) }));
    p.on('close', (code) => resolve({ code, text: text.trim() }));
  });
}

// ---------- check ----------

async function check() {
  const report = {};
  for (const b of ['codex', 'agy']) {
    const bin = resolveBin(b);
    if (!bin) { report[b] = { installed: false }; continue; }
    const v = await runSync(bin, ['--version']);
    report[b] = { installed: true, bin, version: v.text.split(/\r?\n/).pop() };
  }
  if (report.codex.installed) {
    const s = await runSync(report.codex.bin, ['login', 'status']);
    report.codex.auth = /logged in/i.test(s.text) && !/not logged in/i.test(s.text) ? 'ok' : 'missing';
    report.codex.authDetail = s.text;
  }
  // agy has no status command; a missing login surfaces as an auth error on the first run.
  if (report.agy.installed) report.agy.auth = 'unknown';
  report.npm = !!which('npm');
  report.winget = WIN && !!which('winget');
  out({ ok: true, ...report });
}

// ---------- install ----------

async function install(backend) {
  if (resolveBin(backend)) return out({ ok: true, backend, already: true, bin: resolveBin(backend) });
  let cmd, args;
  if (backend === 'codex') {
    const npm = which('npm');
    if (!npm) return out({ ok: false, reason: 'no_npm', message: 'Node.js/npm not found. Install Node.js first.' });
    [cmd, args] = [npm, ['install', '-g', '@openai/codex']];
  } else if (backend === 'agy') {
    if (WIN && which('winget')) {
      [cmd, args] = [which('winget'), ['install', '-e', '--id', 'Google.AntigravityCLI',
        '--accept-source-agreements', '--accept-package-agreements', '--silent']];
    } else {
      return out({ ok: false, reason: 'manual_install',
        message: 'Automatic agy install is only wired for Windows (winget). Install the Antigravity CLI from https://antigravity.google and re-run.' });
    }
  } else {
    return out({ ok: false, reason: 'bad_backend', message: `Unknown backend: ${backend}` });
  }
  const r = await runSync(cmd, args);
  const bin = resolveBin(backend);
  if (!bin) return out({ ok: false, reason: 'install_failed', message: r.text.slice(-1500) });
  out({ ok: true, backend, installed: true, bin, next: backend === 'codex' ? 'codex login' : 'agy (first run signs in with Google)' });
}

// ---------- run ----------

function parseArgs(argv) {
  const a = { ref: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--backend') a.backend = v();
    else if (k === '--prompt') a.prompt = v();
    else if (k === '--prompt-file') a.prompt = fs.readFileSync(v(), 'utf8');
    else if (k === '--out') a.out = v();
    else if (k === '--count') a.count = parseInt(v(), 10);
    else if (k === '--aspect') a.aspect = v();
    else if (k === '--ref') a.ref.push(path.resolve(v()));
    else if (k === '--timeout') a.timeout = parseInt(v(), 10);
  }
  return a;
}

function targets(outPath, count) {
  const abs = path.resolve(outPath);
  if (count <= 1) return [abs];
  const ext = path.extname(abs) || '.png';
  const base = abs.slice(0, abs.length - path.extname(abs).length);
  return Array.from({ length: count }, (_, i) => `${base}-${i + 1}${ext}`);
}

function sniff(file) {
  try {
    const b = Buffer.alloc(12);
    const fd = fs.openSync(file, 'r');
    fs.readSync(fd, b, 0, 12, 0);
    fs.closeSync(fd);
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
    if (b[0] === 0xff && b[1] === 0xd8) return 'jpg';
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
    if (b.toString('ascii', 0, 3) === 'GIF') return 'gif';
  } catch {}
  return null;
}

function buildPrompt(a, files) {
  const lines = [
    'Generate an image using your built-in image generation tool. Do not draw it with code, SVG, canvas, HTML or Python.',
    '',
    'Brief:',
    a.prompt.trim(),
    '',
  ];
  if (a.aspect) lines.push(`Aspect ratio: ${a.aspect}.`);
  if (a.ref.length) {
    lines.push(a.backend === 'codex'
      ? 'Reference image(s) are attached to this message. Use them as the brief describes.'
      : `Reference image(s), view them first and use them as the brief describes: ${a.ref.join(', ')}`);
  }
  lines.push(files.length > 1
    ? `Produce ${files.length} distinct variations. Save them exactly as:\n${files.join('\n')}`
    : `Save the result exactly as: ${files[0]}`);
  lines.push('Do not create, edit or delete any other files. When finished, reply with only the absolute path(s) of the saved file(s), one per line.');
  return lines.join('\n');
}

function classify(text) {
  if (/usage limit|rate limit|quota|too many requests|\b429\b|resource.?exhausted/i.test(text)) return 'limit';
  if (/not logged in|please log ?in|unauthori[sz]ed|\b401\b|sign in|authenticat/i.test(text)) return 'auth';
  return 'failed';
}

function newestImages(dir, since) {
  if (!dir || !fs.existsSync(dir)) return [];
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (IMG_EXT.test(e.name)) {
        const st = fs.statSync(p);
        if (st.mtimeMs >= since) found.push({ p, t: st.mtimeMs });
      }
    }
  };
  walk(dir);
  return found.sort((x, y) => x.t - y.t).map((x) => x.p);
}

async function run(argv) {
  const a = parseArgs(argv);
  if (!['codex', 'agy'].includes(a.backend)) return out({ ok: false, reason: 'bad_backend', message: '--backend codex|agy required' });
  if (!a.prompt) return out({ ok: false, reason: 'no_prompt', message: '--prompt required' });
  if (!a.out) return out({ ok: false, reason: 'no_out', message: '--out required' });
  const bin = resolveBin(a.backend);
  if (!bin) return out({ ok: false, reason: 'not_installed', message: `${a.backend} not found. Run: node imagegen.mjs install ${a.backend}` });

  const files = targets(a.out, a.count || 1);
  const dir = path.dirname(files[0]);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) if (fs.existsSync(f)) fs.renameSync(f, `${f}.bak-${Date.now()}`);

  const prompt = buildPrompt(a, files);
  const started = Date.now() - 2000;
  let args, stdin = null;

  if (a.backend === 'codex') {
    args = ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', dir,
      '-c', 'model_reasoning_effort=low', '--color', 'never'];
    for (const r of a.ref) args.push('-i', r);
    args.push('-');            // prompt via stdin: no shell-quoting hazards
    stdin = prompt;
  } else {
    args = ['-p', prompt, '--dangerously-skip-permissions', '--add-dir', dir, '--output-format', 'json'];
    for (const r of a.ref) if (path.dirname(r) !== dir) args.push('--add-dir', path.dirname(r));
  }

  const timeoutMs = (a.timeout || 600) * 1000;
  const res = await new Promise((resolve) => {
    let text = '';
    const p = spawnBin(bin, args, { cwd: dir, stdio: [stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { p.kill(); text += '\n[imagegen] timed out'; }, timeoutMs);
    p.stdout.on('data', (d) => (text += d));
    p.stderr.on('data', (d) => (text += d));
    if (stdin) { p.stdin.write(stdin); p.stdin.end(); }
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, text: String(e) }); });
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, text }); });
  });

  // Where did the backend keep its own copy? Used to recover files it didn't save where asked.
  let session = null, store = null;
  if (a.backend === 'codex') {
    session = (res.text.match(/session id:\s*([0-9a-f-]{36})/i) || [])[1] || null;
    store = session ? path.join(CODEX_IMAGES, session) : CODEX_IMAGES;
  } else {
    const json = res.text.split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'));
    try { session = JSON.parse(json).conversation_id || null; } catch {}
    store = session ? path.join(AGY_BRAIN, session) : AGY_BRAIN;
  }

  const saved = [];
  const recovered = newestImages(store, started).filter((p) => !files.includes(p));
  for (const f of files) {
    if (!sniff(f)) {
      const src = recovered.shift();
      if (!src) continue;
      fs.copyFileSync(src, f);
    }
    // Fix the extension if the bytes disagree with it (e.g. JPEG saved as .png).
    const kind = sniff(f);
    if (!kind) continue;
    const want = kind === 'jpg' ? /\.jpe?g$/i : new RegExp(`\\.${kind}$`, 'i');
    let final = f;
    if (!want.test(f)) {
      final = f.replace(/\.[^.\\/]+$/, '') + `.${kind}`;
      fs.renameSync(f, final);
    }
    saved.push({ path: final, format: kind, bytes: fs.statSync(final).size });
  }

  const tail = res.text.trim().split(/\r?\n/).slice(-15).join('\n');
  if (!saved.length) {
    return out({ ok: false, backend: a.backend, reason: classify(res.text), exitCode: res.code, session, message: tail });
  }
  out({ ok: true, backend: a.backend, session, files: saved, missing: files.length - saved.length,
    seconds: Math.round((Date.now() - started) / 1000) });
}

// ---------- main ----------

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'check') await check();
else if (cmd === 'install') await install(rest[0]);
else if (cmd === 'run') await run(rest);
else out({ ok: false, reason: 'usage', message: 'commands: check | install <codex|agy> | run --backend ... --prompt ... --out ...' });
