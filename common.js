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
  const props = () => db()._p || {};
  _demo = KKCore.create(store, {
    adminPhones: CFG.PHONES,
    prop: k => (k === 'ADMIN_PIN' ? (props().ADMIN_PIN || '1234') : props()[k]),
    setProp: (k, v) => { const d = db(); (d._p = d._p || {})[k] = v; save(d); },
    notify: t => console.log('[notify]', t),
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

function toast(msg, ms = 2600) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show';
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
