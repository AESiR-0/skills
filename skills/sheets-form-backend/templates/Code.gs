/**
 * Form submissions into a Google Sheet, via an Apps Script web app.
 *
 * The sheet is the database. This script is the only thing that writes to it, and it also
 * answers "is this person already on it?" so duplicates are refused at the source.
 *
 * Deploying (one time):
 *  1. Open the Google Sheet that will hold the rows: Extensions > Apps Script.
 *  2. Paste this file in, replacing Code.gs. Edit CONFIG below.
 *  3. Project Settings > Script properties > add TOKEN: a long random string
 *     (e.g. `openssl rand -hex 32`). Optional: NOTIFY_EMAIL (comma-separated).
 *  4. Run `setup` once from the editor and approve the permissions prompt
 *     ("unverified app" > Advanced > Go to project).
 *  5. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *     "Anyone" lets the site reach it; TOKEN is what stops everyone else.
 *  6. Copy the /exec URL (not /dev) into the site's server env, with the token.
 *
 * After ANY edit: Deploy > Manage deployments > pencil > Version: New version.
 * A "New deployment" gets a different URL and the old one keeps serving old code.
 * Bump VERSION each time; GET /exec returns it, so you can confirm the edit is live.
 *
 * Contract:
 *  GET                                   -> { ok: true, service, version }
 *  POST { token, action: 'check', ...unique fields }
 *                                        -> { ok: true, taken: { <field>: bool } }
 *  POST { token, action: 'submit', ...fields, source }
 *                                        -> { ok: true, row } | { ok: false, reason, taken? }
 *  Apps Script always answers HTTP 200, so callers must check `ok === true`, never the status.
 */

var VERSION = 1;

var CONFIG = {
  SERVICE: 'site-form',
  SHEET_NAME: 'Submissions',
  // id: key in the JSON body. label: column header. type: text | email | phone | bool.
  FIELDS: [
    { id: 'name', label: 'Name', required: true },
    { id: 'email', label: 'Email', required: true, type: 'email' },
    { id: 'phone', label: 'Phone', type: 'phone' },
    { id: 'message', label: 'Message' },
  ],
  // Field ids that must never repeat. Their normalised values live in hidden key columns.
  // Use [] to accept duplicates.
  UNIQUE: ['email'],
  MAX_CELL: 2000,
};

// ---------- layout ----------
// Columns: Received | ...FIELDS | Source | ...key:<unique id>

function headers_() {
  var h = ['Received'];
  CONFIG.FIELDS.forEach(function (f) { h.push(f.label); });
  h.push('Source');
  CONFIG.UNIQUE.forEach(function (id) { h.push('key:' + id); });
  return h;
}

function fieldOf_(id) {
  for (var i = 0; i < CONFIG.FIELDS.length; i++) if (CONFIG.FIELDS[i].id === id) return CONFIG.FIELDS[i];
  return null;
}

function firstKeyCol_() {
  return CONFIG.FIELDS.length + 3;
}

function getSheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  return book.getSheetByName(CONFIG.SHEET_NAME) || book.insertSheet(CONFIG.SHEET_NAME);
}

/**
 * Runs on every request, not only in setup. Without a header row the first submission lands
 * in row 1, where the duplicate check (which reads from row 2) cannot see it.
 */
function ensureHeader_(sheet) {
  var h = headers_();
  var first = sheet.getLastRow() === 0 ? '' : sheet.getRange(1, 1).getValue();
  if (first !== h[0]) {
    if (sheet.getLastRow() > 0) sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  // Phones are text: "+91 ..." would otherwise be parsed as a formula.
  CONFIG.FIELDS.forEach(function (f, i) {
    if (f.type === 'phone') sheet.getRange(1, i + 2, sheet.getMaxRows(), 1).setNumberFormat('@');
  });
}

function setup() {
  var sheet = getSheet_();
  ensureHeader_(sheet);
  if (CONFIG.UNIQUE.length) sheet.hideColumns(firstKeyCol_(), CONFIG.UNIQUE.length);
  return 'ready';
}

// ---------- normalising ----------

/** "A@X.com" and "a@x.com" are one person; so are "+91 92053 86992" and "09205386992". */
function key_(id, raw) {
  var f = fieldOf_(id);
  var s = String(raw == null ? '' : raw).trim();
  if (f && f.type === 'phone') {
    var d = s.replace(/\D/g, '');
    return d.length >= 10 ? d.slice(-10) : (d.length >= 7 ? d : '');
  }
  return s.toLowerCase();
}

/** Blocks formula injection (=, +, -, @ at the start) and caps cell length. */
function sanitize_(value) {
  var text = value == null ? '' : String(value).slice(0, CONFIG.MAX_CELL);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function cell_(f, value) {
  if (f.type === 'bool') return value ? 'Yes' : 'No';
  var s = sanitize_(value);
  if (f.type === 'phone' && s && s.charAt(0) !== "'") return "'" + s;
  return s;
}

// ---------- duplicate check ----------

/** One read of the key columns, as a lookup per unique field. */
function readKeys_(sheet) {
  var out = {};
  CONFIG.UNIQUE.forEach(function (id) { out[id] = {}; });
  var rows = sheet.getLastRow() - 1;
  if (rows < 1 || !CONFIG.UNIQUE.length) return out;
  var values = sheet.getRange(2, firstKeyCol_(), rows, CONFIG.UNIQUE.length).getValues();
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < CONFIG.UNIQUE.length; c++) {
      if (values[r][c] !== '') out[CONFIG.UNIQUE[c]][String(values[r][c])] = true;
    }
  }
  return out;
}

function lookup_(sheet, body) {
  var keys = readKeys_(sheet);
  var taken = {};
  CONFIG.UNIQUE.forEach(function (id) {
    var k = key_(id, body[id]);
    taken[id] = Boolean(k) && Boolean(keys[id][k]);
  });
  return taken;
}

function anyTaken_(taken) {
  for (var id in taken) if (taken[id]) return true;
  return false;
}

// ---------- validation ----------

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function invalid_(body) {
  for (var i = 0; i < CONFIG.FIELDS.length; i++) {
    var f = CONFIG.FIELDS[i];
    var v = body[f.id];
    var empty = v == null || String(v).trim() === '';
    if (f.required && empty) return f.id;
    if (empty) continue;
    if (f.type === 'email' && !EMAIL_RE.test(String(v).trim())) return f.id;
    if (f.type === 'phone' && key_(f.id, v) === '') return f.id;
  }
  return null;
}

// ---------- auth ----------

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function reply_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- entry points ----------

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ ok: false, reason: 'unreadable' });
  }

  // Fail closed: no TOKEN configured means nothing gets in.
  var expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!expected || !safeEqual_(String(body.token || ''), expected)) {
    return reply_({ ok: false, reason: 'unauthorised' });
  }

  var sheet = getSheet_();
  ensureHeader_(sheet);

  if (body.action === 'check') {
    return reply_({ ok: true, taken: lookup_(sheet, body) });
  }
  if (body.action !== 'submit') {
    return reply_({ ok: false, reason: 'unknown-action' });
  }

  var bad = invalid_(body);
  if (bad) return reply_({ ok: false, reason: 'invalid', field: bad });

  // Check and append inside one lock, or two simultaneous submissions both pass the check.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return reply_({ ok: false, reason: 'busy' });
  }

  try {
    var taken = lookup_(sheet, body);
    if (anyTaken_(taken)) return reply_({ ok: false, reason: 'taken', taken: taken });

    var row = [new Date()];
    CONFIG.FIELDS.forEach(function (f) { row.push(cell_(f, body[f.id])); });
    row.push(sanitize_(body.source || 'site'));
    CONFIG.UNIQUE.forEach(function (id) { row.push(key_(id, body[id])); });
    sheet.appendRow(row);
    var at = sheet.getLastRow();
    notify_(body);
    return reply_({ ok: true, row: at });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return reply_({ ok: true, service: CONFIG.SERVICE, version: VERSION });
}

/** Optional email per submission. Set the NOTIFY_EMAIL script property to enable it. */
function notify_(body) {
  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  var lines = CONFIG.FIELDS.map(function (f) { return f.label + ': ' + String(body[f.id] == null ? '' : body[f.id]); });
  try {
    MailApp.sendEmail(to, 'New ' + CONFIG.SERVICE + ' submission', lines.join('\n'));
  } catch (err) {
    console.error('notify failed', err); // the row is already saved; never fail the request on mail
  }
}
