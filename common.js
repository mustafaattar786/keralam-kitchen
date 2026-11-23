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
function upiLink(amount, note) {
  return 'upi://pay?pa=' + encodeURIComponent(CFG.UPI_ID) + '&pn=' + encodeURIComponent(CFG.UPI_NAME) + '&am=' + amount + '&cu=INR&tn=' + encodeURIComponent(note);
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
