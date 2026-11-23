/* Shared helpers for customer + admin pages */
const CFG = window.KK_CONFIG;
const DEMO = !CFG.API_URL;

function lsGet(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = n => '₹' + (Math.round((+n || 0) * 100) / 100).toLocaleString('en-IN');
const fmtTime = t => KKCore.fmtTime(t);

/* ---- Demo backend: same logic as the real one, stored in localStorage ---- */
let _demo;
function demoHandler() {
  if (_demo) return _demo;
  const KEY = 'kk_demo_db';
  const db = () => lsGet(KEY, {});
  const save = d => lsSet(KEY, d);
  const store = {
    all: t => Object.values(db()[t] || {}),
    get: (t, id) => (db()[t] || {})[id] || null,
    put: (t, o) => { const d = db(); (d[t] = d[t] || {})[o.id] = o; save(d); },
    del: (t, id) => { const d = db(); if (d[t]) { delete d[t][id]; save(d); } }
  };
  store.append = store.put;
  const revs = {};
  const props = () => db()._p || {};
  _demo = KKCore.create(store, {
    adminPhones: CFG.PHONES,
    prop: k => (k === 'ADMIN_PIN' ? (props().ADMIN_PIN || '1234') : props()[k]),
    setProp: (k, v) => { const d = db(); (d._p = d._p || {})[k] = v; save(d); },
    notify: t => console.log('[notify]', t),
    bump: k => { revs[k] = Date.now(); }, rev: k => revs[k] || 0,
    ai: p => p.split('Text:\n').pop().replace(/\bi\b/g, 'I').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase()) + (/[.!?]$/.test(p.trim()) ? '' : '.'),
    saveImage: dataUrl => dataUrl
  });
  return _demo;
}

async function api(action, d = {}) {
  if (DEMO) {
    await new Promise(r => setTimeout(r, 150));
    try { return demoHandler()(action, JSON.parse(JSON.stringify(d))); }
    catch (e) { throw Object.assign(new Error(e.message), { server: true }); }
  }
  let res;
  try {
    res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, d }) });
  } catch (e) { throw Object.assign(new Error('offline'), { offline: true }); }
  let j; try { j = await res.json(); } catch (e) { throw Object.assign(new Error('Server error, please try again'), { offline: true }); }
  if (!j.ok) throw Object.assign(new Error(j.error || 'Error'), { server: true });
  return j.data;
}

function waLink(num, text) { return 'https://wa.me/91' + KKCore.digits(num) + '?text=' + encodeURIComponent(text); }
function telLink(num) { return 'tel:+91' + KKCore.digits(num); }
/* UPI ID can be changed from the admin dashboard -> Settings (falls back to config.js) */
window.KK_SET = lsGet('kk_settings', {});
function upiId() { return (window.KK_SET && window.KK_SET.upiId) || CFG.UPI_ID || ''; }
function upiName() { return (window.KK_SET && window.KK_SET.upiName) || CFG.UPI_NAME || 'Keralam Kitchen'; }
function setSettings(s) { if (s) { window.KK_SET = s; lsSet('kk_settings', s); } }
function upiLink(amount, note) {
  return 'upi://pay?pa=' + encodeURIComponent(upiId()) + '&pn=' + encodeURIComponent(upiName()) + '&am=' + amount + '&cu=INR&tn=' + encodeURIComponent(note);
}
function siteUrl() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }

/* Shrink photos before upload (keeps it fast + free storage) */
function fileToDataUrl(file, max = 900) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const im = new Image();
      im.onerror = reject;
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function deviceName() {
  const u = navigator.userAgent;
  const os = /iPhone|iPad/.test(u) ? 'iPhone/iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Other';
  const br = /Edg\//.test(u) ? 'Edge' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /Firefox/.test(u) ? 'Firefox' : 'Browser';
  return os + ' / ' + br;
}

/* Confetti - tiny, no library */
function confetti(n = 120, origin) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'), x = c.getContext('2d');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:300';
  const W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
  document.body.appendChild(c);
  const cols = ['#0f5132', '#1f7a4a', '#f4b91e', '#ff9f1c', '#46e07a', '#e9572b', '#ffffff'];
  const ox = origin ? origin.x * devicePixelRatio : W / 2, oy = origin ? origin.y * devicePixelRatio : H * 0.35;
  const P = Array.from({ length: n }, () => ({ x: ox, y: oy, vx: (Math.random() - .5) * 26, vy: -Math.random() * 26 - 6, r: Math.random() * 7 + 5,
    c: cols[Math.random() * cols.length | 0], a: Math.random() * 6, va: (Math.random() - .5) * .4, leaf: Math.random() < .25 }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, W, H);
    P.forEach(p => { p.vy += .9; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va;
      x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c;
      if (p.leaf) { x.font = (p.r * 3.2) + 'px serif'; x.fillText('\u{1F33F}', 0, 0); } else x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      x.restore(); });
    if (++f < 110) requestAnimationFrame(tick); else c.remove();
  })();
}

/* Minimal line icons (one consistent green set) */
const IC_PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.3.3 3.8 2 4.5 4.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.3-7 8-7s7 2.5 8 7"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  menu: '<path d="M7 3v8a3 3 0 0 0 3 3v7M10 3v8M4 3v8a3 3 0 0 0 3 3"/><path d="M18 21V3c-2 0-3.5 2.5-3.5 6s1 4 3.5 4"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/><path d="M6 6V4h11v2"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 19z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9a5 5 0 0 1-2.4-2.4l.9-1-1-2z"/>',
  calc: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8M8 11h.01M12 11h.01M16 11h.01M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="M4 12.5 9.5 18 20 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h11"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  cart: '<path d="M3 4h2l2.5 11h11L21 7H6.5"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7z"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'
};
function ic(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC_PATHS[name] || ''}</svg>`;
}

function toast(msg, ms = 2600, undo) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show';
  if (undo) { const b = document.createElement('button'); b.className = 'toast-undo'; b.innerHTML = ic('undo', 16) + ' Undo'; b.onclick = () => { t.className = ''; undo(); }; t.appendChild(b); ms = Math.max(ms, 7000); }
  clearTimeout(t._h); t._h = setTimeout(() => (t.className = ''), ms);
}

function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach(d => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.25, a.currentTime + d); o.start(a.currentTime + d); o.stop(a.currentTime + d + 0.18); });
  } catch (e) {}
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
