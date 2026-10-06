#!/usr/bin/env node
// Print an HTML file (or URL) to PDF, or screenshot a page, with headless Chrome or Edge.
// Zero dependencies.
//
//   node to-pdf.mjs <file.html|url> [out.pdf]
//   node to-pdf.mjs <file.html|url> --screenshot out.png [--size 1440,900]
//
// Set CHROME_PATH to override browser discovery.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
if (!input) {
  console.error('usage: to-pdf.mjs <file.html|url> [out.pdf] | --screenshot out.png [--size W,H]');
  process.exit(2);
}
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const pf = process.env.PROGRAMFILES || 'C:\\Program Files';
  const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const candidates = {
    win32: [
      path.join(pf, 'Google/Chrome/Application/chrome.exe'),
      path.join(pf86, 'Google/Chrome/Application/chrome.exe'),
      path.join(local, 'Google/Chrome/Application/chrome.exe'),
      path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'),
      path.join(pf, 'Microsoft/Edge/Application/msedge.exe'),
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
  }[process.platform] || [];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    const r = spawnSync('which', [name], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

const browser = findBrowser();
if (!browser) {
  console.error('No Chrome, Chromium or Edge found. Install one or set CHROME_PATH.');
  process.exit(1);
}

const url = /^https?:|^file:/.test(input) ? input : pathToFileURL(path.resolve(input)).href;
const base = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--virtual-time-budget=15000'];

const shot = flag('--screenshot');
let out, extra;
if (shot) {
  out = path.resolve(shot);
  const size = (flag('--size') || '1440,900').replace('x', ',');
  extra = [`--screenshot=${out}`, `--window-size=${size}`];
} else {
  const named = args.filter((a) => !a.startsWith('--'))[1];
  out = path.resolve(named || (fs.existsSync(input) ? input.replace(/\.html?$/i, '') + '.pdf' : 'out.pdf'));
  extra = ['--no-pdf-header-footer', `--print-to-pdf=${out}`];
}

const before = fs.existsSync(out) ? fs.statSync(out).mtimeMs : 0;
const r = spawnSync(browser, [...base, ...extra, url], { encoding: 'utf8', timeout: 120000 });
const ok = fs.existsSync(out) && fs.statSync(out).mtimeMs > before && fs.statSync(out).size > 0;
if (!ok) {
  console.error(`Failed to write ${out}\n${(r.stderr || '').trim().split('\n').slice(-5).join('\n')}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, out, bytes: fs.statSync(out).size, browser: path.basename(browser) }));
