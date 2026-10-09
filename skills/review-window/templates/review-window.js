/*!
 * review-window.js — REVIEW ONLY.
 *
 * One floating window holding every design option the client is choosing between, with a tab
 * for each page. The tab follows you as you move around the site, and it stays the same window:
 * open, where you dragged it, scrolled where you left it, across page loads and client-side
 * route changes alike.
 *
 * Load it as a plain, non-deferred script in <head>, so saved picks land before first paint:
 *   <script src="/review-window.js"></script>
 *
 * Every pick is written to <html>:
 *   choice groups  data-<id>="<option>"   style with :root[data-<id>="<option>"] { ... }
 *   range groups   --<id>: <value>        use as var(--<id>, <default>)
 * The default option writes nothing, so the server-rendered page IS the default and no-JS,
 * print and production all show it. JS-driven options read window.review.get('<id>') or
 * listen for the "review:change" event on window.
 *
 * Delete this file, its <script> tag and every REVIEW ONLY block once the client has chosen.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ config (edit this)
  var CONFIG = {
    key: 'review',          // storage prefix. Bump it (review-v2) when a default changes.
    title: 'Review options',
    button: 'Review',
    hosts: [],              // extra hostnames that show the window, e.g. a custom preview domain
    theme: {},              // overrides for the window's tokens: paper, ink, muted, line, edge,
                            // accent, onAccent, hover, font, mono, serif

    // One tab per page. `match` decides which tab is "here": '/exact', '/prefix/*' (anything
    // below it, not the prefix itself), '*' (everything) or a RegExp tested on the pathname.
    // The first page that matches wins, so put catch-alls last.
    // `views` split one tab by route, so the window shows only what changes the page in view.
    // A group with `views` shows only on those; off every view it shows everything.
    pages: [
      {
        id: 'landing', label: 'Coming soon', href: '/', match: ['/'],
        groups: [
          {
            id: 'night', label: 'Ground', type: 'swatch',
            options: [
              { id: 'midnight', label: 'Midnight', swatch: '#0B1220' },
              { id: 'ink', label: 'Ink', swatch: '#07090F' },
              { id: 'obsidian', label: 'Obsidian', swatch: '#0A0A0C' },
            ],
          },
          {
            id: 'fx', label: 'Ambient motion', replay: 'review:replay-fx',
            options: [
              { id: 'orbit', label: 'Orbit', note: 'Dust circling the mark' },
              { id: 'mist', label: 'Mist', note: 'Soft light drifting behind everything' },
              { id: 'none', label: 'Still', note: 'No ambient motion' },
            ],
          },
          {
            id: 'glow', label: 'Light on the mark',
            options: [
              { id: 'spot', label: 'Spotlight', note: 'A source off the mark and the shadow it casts' },
              { id: 'halo', label: 'Soft halo', note: 'A breathing bloom behind it' },
            ],
          },
          {
            // shown only while the light it depends on is picked
            id: 'light', label: 'Direction of the source', when: { glow: ['spot'] },
            options: [
              { id: 'top-left', label: 'Top left', note: 'The shadow falls right' },
              { id: 'above', label: 'From above', note: 'Straight down' },
            ],
          },
        ],
      },
      {
        id: 'signup', label: 'Sign-up', href: '/signup', match: ['/signup', '/signup/*'],
        groups: [
          {
            id: 'done', label: 'Completion', replay: 'review:replay-done',
            note: 'Plays on the confirmation. Replay shows it without sending the form.',
            options: [
              { id: 'seal', label: 'Seal', note: 'The mark is stamped' },
              { id: 'ink', label: 'Ink bloom', note: 'The mark surfaces through ink' },
            ],
          },
        ],
      },
      {
        id: 'site', label: 'The site', href: '/home', match: ['*'],
        views: { home: ['/home'], shop: ['/shop'], product: ['/shop/*'] },
        groups: [
          {
            id: 'ground', label: 'Ground', type: 'swatch',
            options: [
              { id: 'ivory', label: 'Ivory', swatch: '#FBF7F1' },
              { id: 'bone', label: 'Bone', swatch: '#F3EEE4' },
            ],
          },
          { id: 'grain', label: 'Grain strength', type: 'range', min: 0, max: 100, step: 1, value: 8, unit: '%' },
          {
            id: 'hero', label: 'Homepage hero', views: ['home'],
            options: [
              { id: 'film', label: 'Film', note: 'Full-bleed video' },
              { id: 'still', label: 'Still', note: 'One photograph' },
            ],
          },
          {
            id: 'engine', label: 'Renderer', type: 'chips', views: ['home'],
            options: [{ id: 'webgl', label: 'WebGL' }, { id: 'css', label: 'CSS' }],
          },
          {
            id: 'layout', label: 'Shop layout', views: ['shop'],
            options: [
              { id: 'split', label: 'Split', note: 'Two portraits side by side' },
              { id: 'grid', label: 'Grid', note: 'Cards on the paper' },
            ],
          },
        ],
      },
    ],

    // How the "Go there" link navigates. Default: a normal page load (the window restores
    // itself on the next page). For a client-side router, e.g. (href) => router.push(href).
    navigate: null,
  };

  // ------------------------------------------------------------------ gate
  var K = CONFIG.key;
  var root = document.documentElement;

  function store(name) {
    try { var s = window[name]; s.getItem(K); return s; } catch (e) { return null; }
  }
  var local = store('localStorage'), session = store('sessionStorage');
  function read(s, k) { if (!s) return null; try { return s.getItem(k); } catch (e) { return null; } }
  function write(s, k, v) { if (!s) return; try { s.setItem(k, v); } catch (e) { /* keep going */ } }
  function drop(s, k) { if (!s) return; try { s.removeItem(k); } catch (e) { /* fine */ } }

  // Shown on local hosts, preview deploys, `hosts` and any URL with ?review (sticky for the
  // session). ?review=0 hides it for the session, even on localhost — the production look.
  function enabled() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('review'); } catch (e) { /* old browser */ }
    if (q === '0') write(session, K + ':ui:on', '0');
    else if (q !== null) write(session, K + ':ui:on', '1');
    var flag = read(session, K + ':ui:on');
    if (flag === '1') return true;
    if (flag === '0') return false;
    var h = location.hostname;
    return location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
      || /\.(localhost|test|local)$/.test(h)
      || /\.(vercel\.app|netlify\.app|pages\.dev)$/.test(h)
      || CONFIG.hosts.indexOf(h) >= 0;
  }
  if (!enabled()) return;

  // ------------------------------------------------------------------ values
  // A group id is one setting wherever it appears: list the same group under two tabs and it
  // is shown twice, stored once.
  var GROUPS = {};
  CONFIG.pages.forEach(function (p) {
    (p.groups || []).forEach(function (g) { if (!GROUPS[g.id]) GROUPS[g.id] = g; });
  });

  var keyOf = function (id) { return K + ':' + id; };
  function def(g) {
    if (g.type === 'range') return g.value != null ? g.value : (g.min || 0);
    return g.default != null ? g.default : g.options[0].id;
  }
  function value(g) {
    var saved = read(local, keyOf(g.id));
    if (g.type === 'range') {
      // Number(null) is 0, a legal value — so a missing key has to be caught before parsing
      var n = saved === null ? NaN : Number(saved);
      var min = g.min != null ? g.min : 0, max = g.max != null ? g.max : 100;
      return isFinite(n) && n >= min && n <= max ? n : def(g);
    }
    return saved !== null && g.options.some(function (o) { return o.id === saved; }) ? saved : def(g);
  }
  function apply(g, v) {
    if (g.type === 'range') {
      var name = g.var || '--' + g.id;
      if (v === def(g)) root.style.removeProperty(name);
      else root.style.setProperty(name, v + (g.cssUnit || ''));
      return;
    }
    if (v === def(g)) root.removeAttribute('data-' + g.id);
    else root.setAttribute('data-' + g.id, v);
  }
  function announce(id, v) {
    window.dispatchEvent(new CustomEvent('review:change', { detail: { id: id, value: v } }));
  }

  // Before first paint: every saved pick, and the keys of groups that no longer exist cleared.
  Object.keys(GROUPS).forEach(function (id) { apply(GROUPS[id], value(GROUPS[id])); });
  if (local) {
    try {
      for (var i = local.length - 1; i >= 0; i--) {
        var k = local.key(i);
        if (!k || k.indexOf(K + ':') !== 0) continue;
        var rest = k.slice(K.length + 1);
        if (rest.indexOf('ui:') !== 0 && !GROUPS[rest]) local.removeItem(k);
      }
    } catch (e) { /* fine */ }
  }

  function pick(id, v) {
    var g = GROUPS[id];
    if (!g) return;
    if (g.type === 'range') v = Number(v);
    else if (!g.options.some(function (o) { return o.id === v; })) return;
    write(local, keyOf(id), String(v));
    apply(g, v);
    announce(id, v);
    if (ui) ui.refresh(g.type === 'range');
  }

  // ------------------------------------------------------------------ routes
  function path() {
    var p = location.pathname;
    return p.length > 1 ? p.replace(/\/+$/, '') : p;
  }
  function hit(m, p) {
    if (m instanceof RegExp) return m.test(p);
    if (m === '*') return true;
    if (m.slice(-2) === '/*') return p.indexOf(m.slice(0, -2) + '/') === 0;
    return p === m;
  }
  function matches(list, p) { return (list || []).some(function (m) { return hit(m, p); }); }
  function pageHere() {
    var p = path();
    for (var i = 0; i < CONFIG.pages.length; i++) if (matches(CONFIG.pages[i].match, p)) return CONFIG.pages[i];
    return null;
  }
  function viewOf(page) {
    if (!page.views) return null;
    var p = path();
    for (var v in page.views) if (matches(page.views[v], p)) return v;
    return null;
  }
  function pageById(id) {
    for (var i = 0; i < CONFIG.pages.length; i++) if (CONFIG.pages[i].id === id) return CONFIG.pages[i];
    return CONFIG.pages[0];
  }
  // What a tab shows: off its own page, everything; on it, only the groups for the view in
  // sight; always minus any group whose `when` is not met.
  function shown(page, here) {
    var view = here && here.id === page.id ? viewOf(page) : null;
    return (page.groups || []).filter(function (g) {
      if (g.views && view && g.views.indexOf(view) < 0) return false;
      if (g.when) {
        for (var dep in g.when) {
          var dg = GROUPS[dep];
          if (dg && g.when[dep].indexOf(value(dg)) < 0) return false;
        }
      }
      return true;
    });
  }

  // ------------------------------------------------------------------ public API
  window.review = {
    get: function (id) { var g = GROUPS[id]; return g ? value(g) : undefined; },
    set: pick,
    open: function () { if (ui) ui.open(false); },
    close: function () { if (ui) ui.close(); },
  };

  // ------------------------------------------------------------------ the window
  var ui = null;

  var CSS = [
    ':host{all:initial;position:fixed;inset:0;z-index:2147483000;pointer-events:none;',
    '--rw-paper:#FBFAF7;--rw-ink:#17181C;--rw-muted:#5A5852;--rw-line:#E5E1D8;--rw-edge:#8F887B;',
    '--rw-accent:#17181C;--rw-on-accent:#FBFAF7;--rw-hover:#F1EEE7;',
    '--rw-font:system-ui,-apple-system,"Segoe UI",sans-serif;',
    '--rw-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--rw-serif:var(--rw-font);',
    '--rw-ease:cubic-bezier(0,0,.2,1);',
    /* its own layer in a view transition, so a page transition never carries it */
    'view-transition-name:review-window;',
    'font:13px/1.4 var(--rw-font);color:var(--rw-ink)}',
    '@media print{:host{display:none}}',
    '*{box-sizing:border-box}',
    'button,a{font:inherit;color:inherit}',
    'button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--rw-accent);outline-offset:2px}',

    /* the button, bottom right */
    '.toggle{pointer-events:auto;position:fixed;right:16px;bottom:16px;display:flex;align-items:center;gap:9px;cursor:pointer;',
    'background:var(--rw-accent);color:var(--rw-on-accent);border:1px solid var(--rw-edge);border-radius:2px;',
    'font:10px/1 var(--rw-mono);letter-spacing:.14em;text-transform:uppercase;padding:9px 14px 9px 10px;',
    'transition:transform 150ms var(--rw-ease)}',
    '.toggle:active{transform:scale(.97)}',
    '.dot{width:14px;height:14px;border-radius:50%;border:1px solid var(--rw-edge);flex:none;background:var(--rw-on-accent)}',
    '@media (max-width:640px){.toggle{min-width:44px;min-height:44px;justify-content:center;padding:0}.toggle .lbl{display:none}}',

    /* the window: non-modal, so the page stays live behind it. The drag writes `translate`,
       the entrance animates `scale`, so the two never fight over one transform. */
    '.win{pointer-events:auto;position:fixed;inset:auto 16px 64px auto;margin:0;padding:0;',
    /* one size whatever the tab holds, so switching tabs or pages never moves the title bar */
    'width:min(560px,calc(100vw - 24px));height:min(640px,calc(100svh - 96px));flex-direction:column;',
    'background:var(--rw-paper);color:var(--rw-ink);border:1px solid var(--rw-edge);border-radius:2px;',
    'box-shadow:0 24px 60px rgba(8,10,16,.32),0 2px 8px rgba(8,10,16,.12);',
    'transform-origin:100% 100%;opacity:0;scale:.96;',
    'transition:opacity 250ms var(--rw-ease),scale 250ms var(--rw-ease),display 250ms allow-discrete,overlay 250ms allow-discrete}',
    '.win[open]{display:flex;opacity:1;scale:1}',
    '@starting-style{.win[open]{opacity:0;scale:.96}}',
    /* restored after a page load: it was already open, so it does not arrive again */
    '.win[data-instant]{transition:none}',
    '.win[data-dragging]{box-shadow:0 32px 80px rgba(8,10,16,.4),0 2px 8px rgba(8,10,16,.12)}',
    '@media (prefers-reduced-motion:reduce){.win,.win[open]{scale:1}}',

    '.head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;',
    'padding:14px 18px 12px;border-bottom:1px solid var(--rw-line);cursor:grab;user-select:none;touch-action:none}',
    '.win[data-dragging] .head{cursor:grabbing}',
    '.title{margin:0;display:flex;align-items:center;gap:12px;font:400 20px/1.2 var(--rw-serif)}',
    '.grip{width:14px;height:5px;border-top:1px solid var(--rw-edge);border-bottom:1px solid var(--rw-edge);flex:none}',
    '.btn{background:none;border:1px solid var(--rw-edge);cursor:pointer;border-radius:2px;',
    'font:10px/1 var(--rw-mono);letter-spacing:.16em;text-transform:uppercase;padding:7px 12px;text-decoration:none;',
    'transition:background-color 200ms var(--rw-ease)}',

    '.tabs{flex:none;display:flex;flex-wrap:wrap;gap:6px;padding:12px 18px;border-bottom:1px solid var(--rw-line)}',
    '.tab{background:none;border:1px solid var(--rw-line);color:var(--rw-muted);cursor:pointer;border-radius:2px;',
    'font-size:12px;letter-spacing:.04em;padding:7px 12px;',
    'transition:border-color 200ms var(--rw-ease),color 200ms var(--rw-ease),background-color 200ms var(--rw-ease)}',
    '.tab[aria-pressed="true"]{background:var(--rw-accent);border-color:var(--rw-accent);color:var(--rw-on-accent)}',
    /* the page you are on, marked even when another tab is open */
    '.tab[data-here]:not([aria-pressed="true"])::after{content:"";display:inline-block;width:5px;height:5px;margin-left:8px;border-radius:50%;background:var(--rw-accent);vertical-align:middle}',

    '.body{flex:1 1 auto;min-height:0;overflow:auto;padding:14px 18px 4px;overscroll-behavior:contain}',
    '.sec{margin:0 0 18px}',
    '.sub{margin-top:-6px;padding-left:12px;border-left:1px solid var(--rw-line)}',
    '.legend{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px;',
    'font:9.5px/1.4 var(--rw-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--rw-muted)}',
    '.mini{background:none;border:1px solid var(--rw-line);color:var(--rw-muted);cursor:pointer;border-radius:2px;',
    'font:9px/1 var(--rw-mono);letter-spacing:.12em;text-transform:uppercase;padding:4px 8px}',
    '.mini[aria-pressed="true"]{border-color:var(--rw-edge);color:var(--rw-ink);background:var(--rw-hover)}',
    '.chips{display:flex;flex-wrap:wrap;gap:4px}',
    '.grid{display:grid;gap:4px}',
    '.grid.sws{grid-template-columns:repeat(auto-fit,minmax(176px,1fr))}',
    '.opt{display:grid;align-items:center;gap:10px;text-align:left;cursor:pointer;background:none;',
    'border:1px solid transparent;border-radius:2px;padding:7px 8px;',
    'transition:border-color 200ms var(--rw-ease),background-color 200ms var(--rw-ease)}',
    '.opt.sw{grid-template-columns:30px 1fr auto}',
    '.opt.row{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr)}',
    '.opt.row.has-thumb{grid-template-columns:56px minmax(0,1fr) minmax(0,1.5fr)}',
    '.opt[aria-pressed="true"]{border-color:var(--rw-accent)}',
    /* near-identical darks differ by a few points of luminance: a tile with a hairline, and
       the hex printed beside it, because a small dot cannot show the difference */
    '.chip{width:30px;height:30px;border-radius:2px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),0 0 0 1px var(--rw-edge)}',
    '.thumb{width:56px;height:36px;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px var(--rw-line)}',
    '.name{font-size:13px}',
    '.meta{font:9.5px/1.4 var(--rw-mono);letter-spacing:.04em;color:var(--rw-muted)}',
    '.note{margin:8px 0 0}',
    '.empty{margin:4px 0 18px;color:var(--rw-muted)}',
    '.slider{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px}',
    '.slider input{width:100%;accent-color:var(--rw-accent)}',
    '@media (hover:hover) and (pointer:fine){.opt:hover,.btn:hover{background:var(--rw-hover)}.tab:hover{border-color:var(--rw-edge)}}',

    '.foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;',
    'padding:12px 18px 16px;border-top:1px solid var(--rw-line)}',
    '.hint{margin:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.acts{display:flex;gap:6px;flex:none}',
  ].join('');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(cls, text) {
    var b = el('button', cls, text);
    b.type = 'button';
    return b;
  }

  function build() {
    var host = el('review-window');
    host.setAttribute('data-review', '');
    var t = CONFIG.theme || {};
    Object.keys(t).forEach(function (name) {
      host.style.setProperty('--rw-' + name.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }), t[name]);
    });
    var shadow = host.attachShadow({ mode: 'open' });
    var style = el('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    // a page transition animates the root; this keeps the window's own layer perfectly still
    var vt = el('style');
    vt.setAttribute('data-review', '');
    vt.textContent = '::view-transition-group(review-window),::view-transition-old(review-window),::view-transition-new(review-window){animation:none}';
    document.head.appendChild(vt);

    var toggle = button('toggle');
    toggle.setAttribute('aria-haspopup', 'dialog');
    toggle.setAttribute('aria-expanded', 'false');
    var dot = el('span', 'dot');
    dot.setAttribute('aria-hidden', 'true');
    var lbl = el('span', 'lbl', CONFIG.button);
    lbl.setAttribute('aria-hidden', 'true');
    toggle.appendChild(dot);
    toggle.appendChild(lbl);

    var win = el('dialog', 'win');
    win.setAttribute('aria-labelledby', 'rw-title');
    var head = el('header', 'head');
    var title = el('h2', 'title');
    title.id = 'rw-title';
    var grip = el('span', 'grip');
    grip.setAttribute('aria-hidden', 'true');
    title.appendChild(grip);
    title.appendChild(document.createTextNode(CONFIG.title));
    var close = button('btn', 'Close');
    head.appendChild(title);
    head.appendChild(close);

    var tabs = el('div', 'tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Page');
    if (CONFIG.pages.length < 2) tabs.hidden = true;

    var body = el('div', 'body');
    var foot = el('footer', 'foot');
    var hint = el('p', 'hint meta');
    var acts = el('div', 'acts');
    var copy = button('btn', 'Copy picks');
    var reset = button('btn', 'Reset');
    acts.appendChild(copy);
    acts.appendChild(reset);
    foot.appendChild(hint);
    foot.appendChild(acts);

    win.appendChild(head);
    win.appendChild(tabs);
    win.appendChild(body);
    win.appendChild(foot);
    shadow.appendChild(toggle);
    shadow.appendChild(win);

    // ---------------------------------------------------------------- state
    var here = pageHere();
    var tab = (here || pageById(read(session, K + ':ui:tab'))).id;
    var lastPath = path();

    // ---------------------------------------------------------------- render
    function option(g, o, now) {
      var b;
      if (g.type === 'swatch') {
        b = button('opt sw');
        var chip = el('span', 'chip');
        chip.style.background = o.swatch || 'transparent';
        chip.setAttribute('aria-hidden', 'true');
        b.appendChild(chip);
        b.appendChild(el('span', 'name', o.label));
        b.appendChild(el('span', 'meta', o.meta || (/^#/.test(o.swatch || '') ? o.swatch : '')));
        if (o.note) b.title = o.note;
      } else if (g.type === 'chips') {
        b = button('mini', o.label);
        if (o.note) b.title = o.note;
      } else {
        b = button('opt row' + (o.thumb ? ' has-thumb' : ''));
        if (o.thumb) {
          var img = el('img', 'thumb');
          img.src = o.thumb;
          img.alt = '';
          b.appendChild(img);
        }
        b.appendChild(el('span', 'name', o.label));
        b.appendChild(el('span', 'meta', o.note || ''));
      }
      b.setAttribute('aria-pressed', String(o.id === now));
      b.setAttribute('data-k', 'o:' + g.id + ':' + o.id);
      b.addEventListener('click', function () { pick(g.id, o.id); });
      return b;
    }

    function section(g) {
      var sec = el('section', 'sec' + (g.when ? ' sub' : ''));
      var legend = el('p', 'legend');
      legend.appendChild(el('span', null, g.label));
      if (g.replay) {
        var r = button('mini', 'Replay');
        r.setAttribute('data-k', 'r:' + g.id);
        r.addEventListener('click', function () { window.dispatchEvent(new CustomEvent(g.replay)); });
        legend.appendChild(r);
      }
      sec.appendChild(legend);

      var now = value(g);
      if (g.type === 'range') {
        var wrap = el('label', 'slider');
        var input = el('input');
        input.type = 'range';
        input.min = g.min != null ? g.min : 0;
        input.max = g.max != null ? g.max : 100;
        input.step = g.step || 1;
        input.value = now;
        input.setAttribute('aria-label', g.label);
        var out = el('span', 'meta', now + (g.unit || ''));
        input.addEventListener('input', function () {
          out.textContent = input.value + (g.unit || '');
          pick(g.id, input.value);
        });
        wrap.appendChild(input);
        wrap.appendChild(out);
        sec.appendChild(wrap);
      } else {
        var list = el('div', g.type === 'chips' ? 'chips' : 'grid' + (g.type === 'swatch' ? ' sws' : ''));
        g.options.forEach(function (o) { list.appendChild(option(g, o, now)); });
        sec.appendChild(list);
      }
      if (g.note) sec.appendChild(el('p', 'meta note', g.note));
      return sec;
    }

    function renderTabs() {
      tabs.textContent = '';
      CONFIG.pages.forEach(function (p) {
        var b = button('tab', p.label);
        b.setAttribute('aria-pressed', String(p.id === tab));
        b.setAttribute('data-k', 't:' + p.id);
        if (here && here.id === p.id) b.setAttribute('data-here', '');
        b.addEventListener('click', function () {
          saveScroll();
          tab = p.id;
          write(session, K + ':ui:tab', tab);
          render();
          restoreScroll();
        });
        tabs.appendChild(b);
      });
    }

    function renderBody() {
      var page = pageById(tab);
      var top = body.scrollTop;
      body.textContent = '';
      var list = shown(page, here);
      if (!list.length) body.appendChild(el('p', 'empty', 'Nothing to choose on this page.'));
      list.forEach(function (g) { body.appendChild(section(g)); });
      body.scrollTop = top;
    }

    function renderHint() {
      hint.textContent = '';
      var page = pageById(tab);
      if (here && here.id === tab) {
        hint.appendChild(document.createTextNode('Changes show on this page as you pick.'));
        return;
      }
      hint.appendChild(document.createTextNode('Open ' + page.label + ' to see these.'));
      if (page.href) {
        var go = el('a', 'btn', 'Go there');
        go.href = page.href;
        go.addEventListener('click', function (e) {
          if (typeof CONFIG.navigate === 'function') { e.preventDefault(); CONFIG.navigate(page.href); }
        });
        hint.appendChild(go);
      }
    }

    // the button's dot: the ground picked for the page you are on
    function renderDot() {
      var page = here || pageById(tab);
      var g = (page.groups || []).filter(function (x) { return x.type === 'swatch'; })[0];
      var o = g && g.options.filter(function (x) { return x.id === value(g); })[0];
      dot.style.background = o && o.swatch ? o.swatch : '';
      toggle.setAttribute('aria-label', CONFIG.title + (o ? ' — ' + o.label : ''));
    }

    // a pick rebuilds the body, so focus is handed back to the same control afterwards
    function render() {
      var a = shadow.activeElement;
      var k = a && a.getAttribute && a.getAttribute('data-k');
      renderTabs();
      renderBody();
      renderHint();
      renderDot();
      if (k) {
        var back = shadow.querySelector('[data-k="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
        if (back) back.focus({ preventScroll: true });
      }
    }

    // ---------------------------------------------------------------- open, close, scroll
    function saveScroll() { write(session, K + ':ui:scroll:' + tab, String(body.scrollTop)); }
    function restoreScroll() {
      var y = Number(read(session, K + ':ui:scroll:' + tab));
      body.scrollTop = isFinite(y) ? y : 0;
    }
    var pending = false;
    body.addEventListener('scroll', function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; saveScroll(); });
    }, { passive: true });

    function open(instant) {
      if (win.open) return;
      var before = document.activeElement;
      if (instant) win.setAttribute('data-instant', '');
      win.show();
      // a restored window must not take focus from the page it reappeared on
      if (instant) {
        if (before && before !== document.body && before.focus) before.focus({ preventScroll: true });
        else if (shadow.activeElement) shadow.activeElement.blur();
      }
      var w = want;
      place(w.x, w.y);
      want = w;
      restoreScroll();
      write(session, K + ':ui:open', '1');
      toggle.setAttribute('aria-expanded', 'true');
      if (instant) requestAnimationFrame(function () { requestAnimationFrame(function () { win.removeAttribute('data-instant'); }); });
    }
    function shut() {
      if (!win.open) return;
      saveScroll();
      win.close();
      // the close event comes a task later; a page load in between must not reopen it
      write(session, K + ':ui:open', '0');
    }
    win.addEventListener('close', function () {
      write(session, K + ':ui:open', '0');
      toggle.setAttribute('aria-expanded', 'false');
    });
    toggle.addEventListener('click', function () { if (win.open) shut(); else open(false); });
    close.addEventListener('click', function () { shut(); toggle.focus(); });
    // Esc closes it only when focus is inside: it must never take Esc from the site
    shadow.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && win.open && win.contains(shadow.activeElement)) { e.stopPropagation(); shut(); toggle.focus(); }
    });

    // ---------------------------------------------------------------- drag
    // `pos` is the translate actually applied; `want` is where the window was left
    var pos = { x: 0, y: 0 }, want = { x: 0, y: 0 }, drag = null;
    try {
      var saved = JSON.parse(read(local, K + ':ui:pos') || 'null');
      if (saved && isFinite(saved.x) && isFinite(saved.y)) want = { x: saved.x, y: saved.y };
    } catch (e) { /* first open: the corner */ }
    function place(x, y) {
      want = { x: x, y: y };
      if (!win.open) return;
      var r = win.getBoundingClientRect();
      var baseX = r.left - pos.x, baseY = r.top - pos.y;
      // On a wide screen it can be tucked aside with 120px of title bar left to grab; once it
      // takes most of the width (a phone), all of it stays on screen.
      var keep = r.width > window.innerWidth * 0.6 ? r.width : 120;
      var gut = keep === r.width ? Math.max(0, Math.min(12, (window.innerWidth - r.width) / 2)) : 0;
      var cx = Math.min(window.innerWidth - baseX - keep - gut, Math.max(-baseX - r.width + keep + gut, x));
      var cy = Math.min(window.innerHeight - baseY - 48, Math.max(-baseY, y));
      pos = { x: cx, y: cy };
      if (drag) want = pos;
      win.style.translate = cx + 'px ' + cy + 'px';
    }
    head.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button')) return;
      drag = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
      head.setPointerCapture(e.pointerId);
      win.setAttribute('data-dragging', '');
    });
    head.addEventListener('pointermove', function (e) {
      if (drag) place(drag.x + e.clientX - drag.px, drag.y + e.clientY - drag.py);
    });
    function endDrag() {
      if (!drag) return;
      drag = null;
      win.removeAttribute('data-dragging');
      want = pos;
      write(local, K + ':ui:pos', JSON.stringify(pos));
    }
    head.addEventListener('pointerup', endDrag);
    head.addEventListener('pointercancel', endDrag);
    // a narrower window re-clamps it; widening again brings it back to where it was left
    window.addEventListener('resize', function () { var w = want; place(w.x, w.y); want = w; });

    // ---------------------------------------------------------------- copy, reset
    function picks() {
      var out = {};
      CONFIG.pages.forEach(function (p) {
        var o = {};
        (p.groups || []).forEach(function (g) {
          var v = value(g);
          if (g.type === 'range') { o[g.label] = v + (g.unit || ''); return; }
          var opt = g.options.filter(function (x) { return x.id === v; })[0];
          o[g.label] = opt ? opt.label + ' (' + v + ')' : v;
        });
        out[p.label] = o;
      });
      return out;
    }
    copy.addEventListener('click', function () {
      var text = JSON.stringify(picks(), null, 2);
      var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy picks'; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Picks', text); });
      else window.prompt('Picks', text);
    });
    reset.addEventListener('click', function () {
      Object.keys(GROUPS).forEach(function (id) {
        var g = GROUPS[id];
        drop(local, keyOf(id));
        apply(g, def(g));
        announce(id, def(g));
      });
      render();
    });

    // ---------------------------------------------------------------- route changes
    // Client-side routers change the path without a page load: the tab follows, the views
    // re-filter, and the window itself does not move or close.
    function onRoute() {
      var p = path();
      if (p === lastPath) return;
      lastPath = p;
      saveScroll();
      here = pageHere();
      if (here) { tab = here.id; write(session, K + ':ui:tab', tab); }
      render();
      restoreScroll();
    }
    ['pushState', 'replaceState'].forEach(function (m) {
      var orig = history[m];
      history[m] = function () { var r = orig.apply(this, arguments); setTimeout(onRoute, 0); return r; };
    });
    window.addEventListener('popstate', onRoute);
    if (window.navigation && window.navigation.addEventListener) window.navigation.addEventListener('navigatesuccess', onRoute);

    // Some frameworks replace <body> or its children on navigation (Turbo, Swup, a re-render):
    // put the same element back, with its state, and reopen it if it was open.
    var watched = document.body;
    var keep = new MutationObserver(function () {
      if (document.body && document.body !== watched) { watched = document.body; keep.observe(watched, { childList: true }); }
      if (!host.isConnected && document.body) {
        document.body.appendChild(host);
        if (read(session, K + ':ui:open') === '1' && !win.open) open(true);
        onRoute();
      }
    });
    keep.observe(root, { childList: true });
    keep.observe(watched, { childList: true });

    ui = {
      open: open,
      close: shut,
      // a range drag must not rebuild the slider under the pointer; only the dot can change
      refresh: function (rangeOnly) { if (rangeOnly) renderDot(); else render(); },
    };

    document.body.appendChild(host);
    render();
    if (read(session, K + ':ui:open') === '1') open(true);
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
