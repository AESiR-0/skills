/*!
 * REVIEW ONLY. A floating panel that lets a client flip between design options live.
 * Delete this file, its <script> tag and the [data-*] option CSS once the client has chosen.
 *
 * Load it as a plain, non-deferred script in <head> so saved picks are applied before first
 * paint (no flash of the old option):
 *   <script src="/option-switcher.js"></script>
 *
 * Every pick is written to <html> as a data attribute: data-<group>="<option>". Style options
 * with :root[data-<group>="<option>"] { ... }. JS-driven options read
 * document.documentElement.dataset.<group> or listen for the "options:change" event.
 * The option id "current" removes the attribute, i.e. the site as built.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- config (edit this)
  var CONFIG = {
    key: 'review', // localStorage prefix
    title: 'Design options',
    groups: [
      {
        id: 'ground',
        label: 'Background',
        options: [
          { id: 'current', label: 'Current' },
          { id: 'ink', label: 'Ink', swatch: '#07090f' },
          { id: 'navy', label: 'Deep navy', swatch: '#0f1a2e' },
        ],
      },
      // Page-specific group: shown only on paths starting with one of `pages`.
      // { id: 'gallery', label: 'Gallery layout', pages: ['/work'], options: [...] },
    ],
  };

  // Shown on localhost, preview deploys and any URL with ?review. ?review=0 hides it again.
  // Never on the production domain unless ?review is used.
  function enabled() {
    var q = new URLSearchParams(location.search).get('review');
    try {
      if (q === '0') sessionStorage.removeItem(CONFIG.key + ':on');
      else if (q !== null) sessionStorage.setItem(CONFIG.key + ':on', '1');
      if (sessionStorage.getItem(CONFIG.key + ':on')) return true;
    } catch (e) {}
    var h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || /\.(vercel\.app|netlify\.app|pages\.dev|local|test)$/.test(h);
  }

  // ---------------------------------------------------------------- storage
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) {} }
  var storeKey = function (gid) { return CONFIG.key + ':' + gid; };
  var root = document.documentElement;

  function valid(group, id) {
    return group.options.some(function (o) { return o.id === id; });
  }

  function apply(group, id) {
    var attr = 'data-' + group.id;
    if (!id || id === 'current') root.removeAttribute(attr);
    else root.setAttribute(attr, id);
  }

  function current(group) {
    var saved = read(storeKey(group.id));
    return saved && valid(group, saved) ? saved : 'current';
  }

  if (!enabled()) return;

  // Before paint: restore every saved pick, and clear keys left by removed groups.
  CONFIG.groups.forEach(function (g) { apply(g, current(g)); });
  try {
    var known = CONFIG.groups.map(function (g) { return storeKey(g.id); });
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.indexOf(CONFIG.key + ':') === 0 && known.indexOf(k) < 0 && !/:(pos|folded)$/.test(k)) drop(k);
    }
  } catch (e) {}

  // ---------------------------------------------------------------- panel
  function pick(group, id) {
    write(storeKey(group.id), id);
    apply(group, id);
    root.dispatchEvent(new CustomEvent('options:change', { detail: { group: group.id, option: id } }));
    render();
  }

  function onPage(group) {
    if (!group.pages) return true;
    return group.pages.some(function (p) { return location.pathname === p || location.pathname.indexOf(p.replace(/\/$/, '') + '/') === 0; });
  }

  var host, shadow, panel, body;

  var CSS = [
    ':host{all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483000;font:13px/1.4 system-ui,sans-serif;color:#111}',
    '@media print{:host{display:none}}',
    '.p{width:280px;max-height:min(70vh,560px);display:flex;flex-direction:column;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.08),0 12px 32px rgba(0,0,0,.18);overflow:hidden}',
    '.h{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:grab;user-select:none;border-bottom:1px solid rgba(0,0,0,.08);touch-action:none}',
    '.p[data-dragging] .h{cursor:grabbing}',
    '.t{flex:1;font-weight:600}',
    '.b{overflow:auto;padding:4px 12px 12px}',
    '.p[data-folded] .b,.p[data-folded] .f{display:none}',
    '.g{margin-top:10px}',
    '.gl{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#666;margin-bottom:6px}',
    '.o{display:flex;flex-wrap:wrap;gap:6px}',
    'button{font:inherit;color:inherit;cursor:pointer;border:1px solid rgba(0,0,0,.15);background:#fff;border-radius:8px;padding:5px 9px;display:inline-flex;align-items:center;gap:6px}',
    'button:hover{background:#f4f4f4}',
    'button:focus-visible{outline:2px solid #2563eb;outline-offset:1px}',
    'button[aria-pressed="true"]{background:#111;color:#fff;border-color:#111}',
    '.s{width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,0,0,.2)}',
    '.i{border:0;padding:4px 6px;background:none}',
    '.f{display:flex;gap:6px;padding:8px 12px;border-top:1px solid rgba(0,0,0,.08)}',
    '.f button{flex:1;justify-content:center}',
    '.n{color:#666;font-size:12px;padding:8px 0}',
  ].join('');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function render() {
    if (!body) return;
    body.textContent = '';
    var shown = CONFIG.groups.filter(onPage);
    if (!shown.length) body.appendChild(el('div', 'n', 'No options on this page.'));
    shown.forEach(function (g) {
      var wrap = el('div', 'g');
      wrap.appendChild(el('div', 'gl', g.label));
      var row = el('div', 'o');
      var now = current(g);
      g.options.forEach(function (o) {
        var btn = el('button');
        btn.type = 'button';
        btn.setAttribute('aria-pressed', String(o.id === now));
        if (o.note) btn.title = o.note;
        if (o.swatch) {
          var sw = el('span', 's');
          sw.style.background = o.swatch;
          btn.appendChild(sw);
        }
        btn.appendChild(document.createTextNode(o.label));
        btn.addEventListener('click', function () { pick(g, o.id); });
        row.appendChild(btn);
      });
      wrap.appendChild(row);
      body.appendChild(wrap);
    });
  }

  function picks() {
    var out = {};
    CONFIG.groups.forEach(function (g) {
      var id = current(g);
      var o = g.options.filter(function (x) { return x.id === id; })[0];
      out[g.label] = o ? o.label + ' (' + id + ')' : id;
    });
    return out;
  }

  function build() {
    host = document.createElement('option-switcher');
    host.setAttribute('data-review', '');
    shadow = host.attachShadow({ mode: 'open' });
    var style = el('style');
    style.textContent = CSS;
    panel = el('div', 'p');
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', CONFIG.title);

    var head = el('div', 'h');
    head.appendChild(el('span', 't', CONFIG.title));
    var fold = el('button', 'i', '−');
    fold.type = 'button';
    fold.setAttribute('aria-label', 'Fold');
    head.appendChild(fold);

    body = el('div', 'b');
    var foot = el('div', 'f');
    var copy = el('button', null, 'Copy picks');
    copy.type = 'button';
    var reset = el('button', null, 'Reset');
    reset.type = 'button';
    foot.appendChild(copy);
    foot.appendChild(reset);

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(foot);
    shadow.appendChild(style);
    shadow.appendChild(panel);
    document.body.appendChild(host);

    // Folded state: remembered; starts folded on small screens.
    var folded = read(CONFIG.key + ':folded');
    setFolded(folded === null ? window.innerWidth < 700 : folded === '1');
    function setFolded(on) {
      if (on) panel.setAttribute('data-folded', ''); else panel.removeAttribute('data-folded');
      fold.textContent = on ? '+' : '−';
      fold.setAttribute('aria-label', on ? 'Unfold' : 'Fold');
      fold.setAttribute('aria-expanded', String(!on));
    }
    fold.addEventListener('click', function () {
      var on = !panel.hasAttribute('data-folded');
      setFolded(on);
      write(CONFIG.key + ':folded', on ? '1' : '0');
    });
    // Esc folds it, but only when focus is inside: it must never steal Esc from the site.
    host.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setFolded(true); write(CONFIG.key + ':folded', '1'); }
    });

    copy.addEventListener('click', function () {
      var text = JSON.stringify(picks(), null, 2);
      var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy picks'; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { prompt('Picks', text); });
      else prompt('Picks', text);
    });
    reset.addEventListener('click', function () {
      CONFIG.groups.forEach(function (g) { drop(storeKey(g.id)); apply(g, 'current'); });
      root.dispatchEvent(new CustomEvent('options:change', { detail: { reset: true } }));
      render();
    });

    // Drag by the title bar; position remembered and clamped on screen.
    var pos = { x: 0, y: 0 }, drag = null;
    function place(x, y) {
      var r = host.getBoundingClientRect();
      var baseX = r.left - pos.x, baseY = r.top - pos.y;
      pos.x = Math.min(window.innerWidth - baseX - 80, Math.max(-baseX - r.width + 80, x));
      pos.y = Math.min(window.innerHeight - baseY - 40, Math.max(-baseY, y));
      host.style.translate = pos.x + 'px ' + pos.y + 'px';
    }
    head.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button')) return;
      drag = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
      head.setPointerCapture(e.pointerId);
      panel.setAttribute('data-dragging', '');
    });
    head.addEventListener('pointermove', function (e) {
      if (drag) place(drag.x + e.clientX - drag.px, drag.y + e.clientY - drag.py);
    });
    function endDrag() {
      if (!drag) return;
      drag = null;
      panel.removeAttribute('data-dragging');
      write(CONFIG.key + ':pos', JSON.stringify(pos));
    }
    head.addEventListener('pointerup', endDrag);
    head.addEventListener('pointercancel', endDrag);
    try {
      var saved = JSON.parse(read(CONFIG.key + ':pos') || 'null');
      if (saved && isFinite(saved.x) && isFinite(saved.y)) place(saved.x, saved.y);
    } catch (e) {}

    render();
  }

  // Client-side routers change the path without a reload: re-render page-specific groups.
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    history[m] = function () { var r = orig.apply(this, arguments); setTimeout(render, 0); return r; };
  });
  window.addEventListener('popstate', render);

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
