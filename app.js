/* Keralam Kitchen — customer app */
const S = {
  lang: lsGet('kk_lang', null),
  menu: lsGet('kk_menu', KKCore.DEFAULT_MENU),
  reviews: lsGet('kk_reviews', []),
  adminOnline: false,
  cart: lsGet('kk_cart', []),
  profile: lsGet('kk_profile', {}),
  agreed: lsGet('kk_agreed', false),
  orders: lsGet('kk_orders', []),
  queue: lsGet('kk_queue', []),
  modifying: lsGet('kk_modifying', null),
  tab: 'menu',
  sel: {},
  chat: [],
  pickLang: null,
  auth: lsGet('kk_auth', null),
  me: lsGet('kk_me', null)
};
if (S.me) S.profile = { name: S.me.name, flat: S.me.flat, phone: S.me.phone };
Object.assign(I18N.en, {
  login_t: 'Login to your account', signup_t: 'Create your account', pin: 'PIN (4–6 digits)', pin2: 'Choose a 4–6 digit PIN',
  login: 'Login', signup: 'Create account', forgot: 'Forgot PIN?', have_acc: 'Already have an account? Login', no_acc: 'New here? Create account',
  my_acc: 'My account', logout: 'Logout', edit_profile: 'Edit profile', new_pin: 'New PIN (leave empty to keep)', save: 'Save',
  profile_photo: 'Profile photo (optional)', remove_photo: 'Remove photo', notif_on: 'Notifications are ON', notif_btn: 'Notify me about my orders',
  login_to_order: 'Log in or create an account to place your order', wa_order: 'Order on WhatsApp without an account', wa_order_s: 'No account needed — your order goes straight to our WhatsApp. Name and number are required.',
  send_to: 'Send my order to', login_needed: 'Please log in to see this', asap: 'As early as possible today', call_us: 'Call us',
  sorry_t: 'Sorry to see you go…', sorry_s: 'Your order is cancelled. We hope to cook for you again soon! 🌿', exit_back: 'Press back again to exit'
});
const msgOf = e => String((e && e.message) || e).replace(/^[A-Z]+: /, '');
async function capi(action, d = {}) {
  try { return await api(action, { ...d, cauth: S.auth }); }
  catch (e) {
    if (/^LOGIN:/.test(e.message)) { doLogout(true); }
    if (/^BLOCKED:/.test(e.message)) { renderBlocked(); }
    throw e;
  }
}
function setMe(c) {
  if (!c) return;
  S.me = c; lsSet('kk_me', c);
  S.profile = { name: c.name, flat: c.flat, phone: c.phone }; lsSet('kk_profile', S.profile);
}
function doLogout(expired) {
  if (S.auth && !expired) capi('track', { type: 'logout', text: 'Logged out' }).catch(() => {});
  S.auth = null; S.me = null; S.orders = []; S.chat = [];
  lsSet('kk_auth', null); lsSet('kk_me', null); lsSet('kk_orders', []);
  closeSheet(true); S.tab = 'menu'; render(); if (expired) openAuth('login', 'Please log in again.');
}
const avatar = (c, size = 36) => c && c.photo
  ? `<img class="avatar" src="${esc(c.photo)}" alt="" style="width:${size}px;height:${size}px">`
  : `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .45)}px">${esc(((c && c.name) || '?').trim().charAt(0).toUpperCase())}</span>`;
const MIN = 60000;
const t = k => (I18N[S.lang] && I18N[S.lang][k]) || (I18N[LANG_FALLBACK[S.lang]] && I18N[LANG_FALLBACK[S.lang]][k]) || I18N.en[k] || k;
const menuItem = id => S.menu.find(m => m.id === id);
const saveCart = () => lsSet('kk_cart', S.cart);
const app = $('#app');

/* ---------------- Language ---------------- */
function applyDir() { document.documentElement.lang = S.lang || 'en'; document.documentElement.dir = RTL.includes(S.lang) ? 'rtl' : 'ltr'; }
function renderLang(fromSettings) {
  const cur = S.pickLang || S.lang || 'en';
  const langName = c => (LANGS.find(l => l[0] === c) || [])[1];
  app.innerHTML = `
  <div class="lang-screen">
    <div style="font-size:44px">🌿</div>
    <h1 style="color:var(--green);margin:0">Keralam Kitchen</h1>
    <p class="muted" style="margin:4px 0 14px">Homemade • Fresh • Hygienic</p>
    <h2 style="font-size:20px">${esc((I18N[cur] || I18N[LANG_FALLBACK[cur]] || I18N.en).lang_title)}</h2>
    <p class="muted small">Choose language • भाषा चुनें • ഭാഷ • மொழி • భాష • ಭಾಷೆ • زبان</p>
    <div class="lang-grid">
      ${TOP_LANGS.map(c => { const l = LANGS.find(x => x[0] === c); return `<button class="lang-btn ${c === cur ? 'on' : ''}" data-a="pickLang" data-l="${c}"><b>${l[1]}</b><small>${l[2]}</small></button>`; }).join('')}
    </div>
    <select class="in" id="langSel" aria-label="All Indian languages" style="min-height:56px;font-size:18px">
      ${LANGS.map(l => `<option value="${l[0]}" ${l[0] === cur ? 'selected' : ''}>${l[1]} — ${l[2]}</option>`).join('')}
    </select>
    <div style="height:96px"></div>
    <div class="lang-done"><button class="btn primary big" data-a="langDone" data-s="${fromSettings ? 1 : ''}">✓ ${esc((I18N[cur] || I18N[LANG_FALLBACK[cur]] || I18N.en).done)} — ${esc(langName(cur))}</button></div>
  </div>`;
  $('#langSel').onchange = e => { S.pickLang = e.target.value; renderLang(fromSettings); };
}

/* ---------------- Loader (3 s Kerala kitchen animation) ---------------- */
function showLoader(ms = 3000) {
  const el = document.createElement('div');
  el.className = 'loader';
  el.innerHTML = `
  <svg viewBox="0 0 320 240" aria-hidden="true">
    <g class="palm">
      <path d="M40 235 C 46 180, 52 120, 70 70" stroke="#8b5a2b" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M70 70 C 40 50, 15 60, 5 85 C 30 70, 50 70, 70 72Z" fill="#3fa34d"/>
      <path d="M70 70 C 90 40, 120 40, 135 60 C 110 55, 90 60, 70 72Z" fill="#4cbb5a"/>
      <path d="M70 70 C 60 35, 40 20, 20 25 C 45 35, 58 50, 70 72Z" fill="#2f8a3e"/>
      <path d="M70 70 C 100 65, 120 85, 120 110 C 105 90, 90 80, 70 72Z" fill="#2f8a3e"/>
      <circle cx="66" cy="78" r="6" fill="#6b4423"/><circle cx="76" cy="80" r="6" fill="#6b4423"/>
    </g>
    <g class="steam" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="5" stroke-linecap="round">
      <path d="M180 100 c -8 -10, 8 -18, 0 -30"/><path d="M200 98 c -8 -10, 8 -18, 0 -30"/><path d="M220 100 c -8 -10, 8 -18, 0 -30"/>
    </g>
    <g class="ladle"><rect x="196" y="40" width="6" height="80" rx="3" fill="#c9a26b" transform="rotate(20 199 80)"/></g>
    <ellipse cx="200" cy="112" rx="62" ry="12" fill="#5a2b16"/>
    <ellipse cx="200" cy="112" rx="54" ry="8" fill="#f3e6c4"/>
    <g fill="#fff"><circle class="bub" cx="185" cy="111" r="3"/><circle class="bub" cx="205" cy="113" r="2.5"/><circle class="bub" cx="220" cy="110" r="3"/></g>
    <path d="M138 112 C 140 165, 170 185, 200 185 C 230 185, 260 165, 262 112 Z" fill="#a0461f"/>
    <path d="M150 130 C 175 140, 225 140, 250 130" stroke="#7a3214" stroke-width="4" fill="none"/>
    <g><path class="flame" d="M165 215 C 160 200, 175 195, 172 182 C 185 195, 182 205, 178 215Z" fill="#ff9f1c"/>
       <path class="flame" d="M192 218 C 186 198, 205 192, 200 176 C 216 194, 212 206, 208 218Z" fill="#ffbf3c"/>
       <path class="flame" d="M222 215 C 218 200, 232 195, 229 182 C 242 195, 239 205, 235 215Z" fill="#ff9f1c"/></g>
    <rect x="140" y="214" width="120" height="10" rx="5" fill="#6b4423"/>
    <ellipse cx="150" cy="226" rx="16" ry="7" fill="#8d8d8d"/><ellipse cx="200" cy="228" rx="16" ry="7" fill="#9a9a9a"/><ellipse cx="250" cy="226" rx="16" ry="7" fill="#8d8d8d"/>
  </svg>
  <h2 style="font-family:Georgia,serif;margin:10px 0 0">Keralam Kitchen</h2>
  <div style="opacity:.9">🥥 Cooking fresh for you… 🌿</div>
  <div class="bar"><i></i></div>`;
  document.body.appendChild(el);
  return new Promise(r => setTimeout(() => { el.style.transition = 'opacity .35s'; el.style.opacity = 0; setTimeout(() => { el.remove(); r(); }, 350); }, ms));
}

/* ---------------- Pickup time logic ---------------- */
function leadOf(m) { return (!m.inStock && !m.alwaysAvailable) ? 'tomorrow' : (+m.leadMins || 0); }
function isOpenDay(d) { return !(CFG.CLOSED_DAYS || []).includes(d.getDay()); }
function earliestPickup(items) {
  const now = Date.now(); let tm = now + 15 * MIN, tomorrow = false;
  items.forEach(c => { const m = menuItem(c.id); if (!m) return; const l = leadOf(m); if (l === 'tomorrow') tomorrow = true; else tm = Math.max(tm, now + l * MIN); });
  if (tomorrow) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(CFG.OPEN_HOUR, 0, 0, 0); tm = Math.max(tm, d.getTime()); }
  return Math.ceil(tm / (15 * MIN)) * 15 * MIN;
}
function dayLabel(d) {
  const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(d); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 864e5);
  return diff === 0 ? t('today') : diff === 1 ? t('tomorrow') : b.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
function pickupSlots(items) {
  const earliest = earliestPickup(items), out = [];
  const start = new Date(earliest); start.setHours(0, 0, 0, 0);
  for (let day = 0; day < 4; day++) {
    const d = new Date(start); d.setDate(d.getDate() + day);
    if (!isOpenDay(d)) continue;
    for (let mins = CFG.OPEN_HOUR * 60; mins <= CFG.CLOSE_HOUR * 60; mins += 30) {
      const s = new Date(d); s.setHours(0, mins, 0, 0);
      if (s.getTime() >= earliest) out.push(s.getTime());
    }
    if (day === 0) {
      const e = new Date(earliest), em = e.getHours() * 60 + e.getMinutes();
      if (em >= CFG.OPEN_HOUR * 60 && em <= CFG.CLOSE_HOUR * 60 && !out.includes(earliest) && isOpenDay(e)) out.unshift(earliest);
    }
  }
  return out.sort((a, b) => a - b);
}
const fmtClock = ts => new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/* ---------------- Cart helpers ---------------- */
function lineCalc(c) {
  const m = menuItem(c.id); if (!m) return null;
  const v = m.variants[c.v] || m.variants[0];
  const adds = (c.addons || []).map(i => m.addons[i]).filter(Boolean);
  const unit = v.price + adds.reduce((s, a) => s + (+a.price || 0), 0);
  return { m, v, adds, unit, amount: unit * c.qty };
}
const cartTotal = () => S.cart.reduce((s, c) => s + ((lineCalc(c) || {}).amount || 0), 0);
const cartCount = () => S.cart.reduce((s, c) => s + c.qty, 0);
function selOf(id) { return S.sel[id] || (S.sel[id] = { v: 0, addons: [], qty: 1 }); }

/* ---------------- Main shell ---------------- */
function render() {
  applyDir();
  const orderBadge = S.orders.filter(o => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status)).length + S.queue.length;
  app.innerHTML = `
  ${DEMO ? '<div class="demo">Demo mode — orders stay on this device until the Google Sheet backend is connected.</div>' : ''}
  <header class="top"><div class="wrap">
    <button class="logo logo-btn" data-a="home" aria-label="Menu">${(window.KK_SET || {}).logo ? `<img class="logo-img" src="${esc(KK_SET.logo)}" alt="">` : '🌿'} <span>Keralam Kitchen<small>${esc(t('tagline'))}</small></span></button>
    <div class="sp"></div>
    <a class="iconbtn" href="${telLink(CFG.PHONES[0])}" aria-label="${esc(t('call_us'))}">${ic('phone', 18)}</a>
    <button class="iconbtn" data-a="openLang" aria-label="Language">${ic('globe', 18)} ${esc((LANGS.find(l => l[0] === S.lang) || [, 'EN'])[1])}</button>
    ${S.me ? `<button class="iconbtn avbtn" data-a="tab" data-t="info" aria-label="${esc(t('my_acc'))}">${avatar(S.me, 32)}</button>` : `<button class="iconbtn" data-a="login">${ic('user', 18)} ${esc(t('login'))}</button>`}
  </div></header>
  <main class="wrap" id="main">${renderTab()}</main>
  ${S.tab === 'menu' && S.cart.length ? `<div class="cartbar"><button class="btn gold" data-a="openCart"><span>🛒 ${cartCount()} · ${S.modifying ? '✏️ ' + esc(S.modifying) + ' · ' : ''}${esc(t('go_cart'))}</span><span>${money(cartTotal())} ›</span></button></div>` : ''}
  <nav class="nav">
    ${[['menu', 'menu', t('menu')], ['orders', 'receipt', t('orders')], ['help', 'chat', t('help')], ['info', 'user', t('info')]].map(([k, i, l]) =>
      `<button class="${S.tab === k ? 'on' : ''}" data-a="tab" data-t="${k}"><b>${ic(i, 22)}</b>${esc(l)}${k === 'orders' && orderBadge ? `<span class="badge">${orderBadge}</span>` : ''}</button>`).join('')}
  </nav>`;
  if (S.tab === 'help') scrollChat();
}
function renderTab() {
  if (S.tab === 'orders') return renderOrders();
  if (S.tab === 'help') return renderHelp();
  if (S.tab === 'info') return renderInfo();
  return renderMenu();
}

function ratingFor(id) {
  const rs = S.reviews.filter(r => r.itemId === id);
  if (!rs.length) return '';
  const avg = rs.reduce((s, r) => s + r.stars, 0) / rs.length;
  return `<span class="tag g">★ ${avg.toFixed(1)} (${rs.length})</span>`;
}
function availText(m) {
  const l = leadOf(m);
  if (l === 'tomorrow') return `<div class="avail tomorrow">${esc(t('fresh'))}</div>`;
  if (l >= 1440) return `<div class="avail">🕑 ${esc(t('nextday'))}</div>`;
  if (l > 0) return `<div class="avail">⏱️ ${esc(t('ready_in').replace('{n}', l))}</div>`;
  return `<div class="avail">✅ ${esc(t('anytime'))}</div>`;
}
function renderMenu() {
  const items = S.menu.filter(m => !m.hidden).map(m => {
    const s = selOf(m.id), v = m.variants[s.v] || m.variants[0];
    const unit = v.price + s.addons.reduce((a, i) => a + (+(m.addons[i] || {}).price || 0), 0);
    return `
    <div class="card item">
      <div class="item-img">${m.img ? `<img src="${esc(m.img)}" alt="${esc(m.name)}" loading="lazy" onerror="this.replaceWith(document.createTextNode('${esc(m.emoji || '🍽️')}'))">` : esc(m.emoji || '🍽️')}</div>
      <div>
        <div>${(m.tags || []).map(tg => `<span class="tag">${esc(tg)}</span>`).join('')}${ratingFor(m.id)}</div>
        <h3>${esc(m.name)}</h3>
        <p>${esc(m.desc || '')}</p>
        ${availText(m)}
        <div class="variants">${m.variants.map((vv, i) => `<button class="chip ${s.v === i ? 'on' : ''}" data-a="variant" data-id="${m.id}" data-i="${i}">${esc(vv.label)} · ₹${vv.price}</button>`).join('')}</div>
        ${m.addons && m.addons.length ? `<div class="addons">${m.addons.map((a, i) => `<button class="chip ${s.addons.includes(i) ? 'on' : ''}" data-a="addon" data-id="${m.id}" data-i="${i}">${s.addons.includes(i) ? '✓ ' : '+ '}${esc(a.label)} ₹${a.price}</button>`).join('')}</div>` : ''}
        <div class="row" style="margin-top:8px">
          <div class="stepper"><button data-a="qty" data-id="${m.id}" data-d="-1" aria-label="less">−</button><span>${s.qty}</span><button data-a="qty" data-id="${m.id}" data-d="1" aria-label="more">+</button></div>
          <button class="btn primary" style="flex:1" data-a="add" data-id="${m.id}">${esc(t('add'))} · ${money(unit * s.qty)}</button>
        </div>
      </div>
    </div>`;
  }).join('');
  const avg = S.reviews.length ? (S.reviews.reduce((s, r) => s + r.stars, 0) / S.reviews.length).toFixed(1) : null;
  return `
  <div class="banner">🗓️ <span>${esc(t('advance'))}</span></div>
  ${items}
  <div class="card" id="customCard">
    <h3>✨ ${esc(t('custom_title'))}</h3>
    <p class="muted small" style="margin-top:0">${esc(t('custom_sub'))}</p>
    <textarea class="in" id="customText" placeholder="${esc(t('custom_ph'))}"></textarea>
    <div class="row" style="margin-top:10px">
      <label class="btn ghost sm" style="cursor:pointer">📷 ${esc(t('photo'))}<input type="file" accept="image/*" id="customPhoto" hidden></label>
      <img id="customPrev" class="photo-prev hidden" alt="">
    </div>
    ${detailFields('c')}
    <button class="btn primary big" style="margin-top:12px" data-a="sendCustom">${esc(t('send'))} ✨</button>
  </div>
  <div class="card">
    <div class="row between"><h3 style="margin:0">⭐ ${esc(t('reviews'))} ${avg ? `<span class="stars">${avg}★</span> <span class="muted small">(${S.reviews.length})</span>` : ''}</h3>
    <button class="btn sm" data-a="openReview">${esc(t('write_review'))}</button></div>
    ${S.reviews.slice(0, 12).map(reviewHtml).join('') || '<p class="muted small">Be the first to review! 😊</p>'}
  </div>
  <div class="contact-row">${CFG.PHONES.map(p => `<div class="contact-chip"><b>${p}</b><a class="btn sm" href="${telLink(p)}">${ic('phone', 16)} ${esc(t('call'))}</a><a class="btn sm wa" href="${waLink(p, 'Hi Keralam Kitchen 🌿')}" target="_blank" rel="noopener">${ic('wa', 16)} WhatsApp</a></div>`).join('')}</div>`;
}
function reviewHtml(r) {
  return `<div class="review"><div class="row between"><b>${esc(r.name)}</b><span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span></div>
  <div class="muted small">${esc(r.itemName || '')} · ${new Date(r.at).toLocaleDateString('en-IN')}</div>
  ${r.text ? `<div>${esc(r.text)}</div>` : ''}${r.photo ? `<img src="${esc(r.photo)}" alt="review photo" loading="lazy">` : ''}</div>`;
}
function detailFields(p) {
  const pr = (p === 'cart' && S.draft) || S.profile;
  if (!S.me && (p === 'cart' || p === 'c' || p === 'r')) return '';
  if (S.me) return `<div class="me-line">${avatar(S.me, 34)}<div style="flex:1"><b>${esc(S.me.name)}</b><div class="small muted">Flat ${esc(S.me.flat)} · ${esc(S.me.phone)}</div></div><button class="btn sm ghost" data-a="editAccount">✏️</button></div>`;
  if (pr.name && pr.flat && pr.phone && p !== 'cart' && !S.editingProfile) return `<p class="small muted" style="margin:10px 0 0">👤 ${esc(pr.name)} · ${esc(pr.flat)} · ${esc(pr.phone)} <a href="#" data-a="editProfile">✏️</a></p>`;
  return `
  <label class="f">${esc(t('name'))} *</label><input class="in" id="${p}Name" autocomplete="name" value="${esc(pr.name || '')}">
  <div class="row" style="gap:10px;align-items:flex-start">
    <div style="flex:1"><label class="f">${esc(t('flat'))} *</label><input class="in" id="${p}Flat" value="${esc(pr.flat || '')}" placeholder="A-504"></div>
    <div style="flex:1.3"><label class="f">${esc(t('phone'))} *</label><input class="in" id="${p}Phone" inputmode="numeric" autocomplete="tel" maxlength="14" value="${esc(pr.phone || '')}" placeholder="98XXXXXXXX"></div>
  </div>`;
}
function readDetails(p) {
  const n = $('#' + p + 'Name'); if (!n) return S.profile;
  const d = { name: n.value.trim(), flat: $('#' + p + 'Flat').value.trim(), phone: KKCore.digits($('#' + p + 'Phone').value) };
  return d;
}
function validDetails(d) { return d.name && d.flat && KKCore.digits(d.phone).length === 10; }
function saveProfile(d) { S.profile = d; S.editingProfile = false; S.draft = null; lsSet('kk_profile', d); }

/* ---------------- Cart sheet ---------------- */
function openSheet(html, center) {
  const had = $('#overlay'); if (had) had.remove(); else history.pushState({ tab: S.tab, sheet: 1 }, '');
  const o = document.createElement('div'); o.className = 'overlay' + (center ? ' center' : ''); o.id = 'overlay';
  o.innerHTML = `<div class="sheet" role="dialog">${center ? '' : '<div class="grab"></div>'}${html}</div>`;
  o.addEventListener('click', e => { if (e.target === o) closeSheet(); });
  document.body.appendChild(o); document.body.style.overflow = 'hidden';
  return o;
}
function closeSheet(fromPop) {
  const o = $('#overlay'); if (o) o.remove(); document.body.style.overflow = '';
  if (o && !fromPop && history.state && history.state.sheet) { S._skipPop = true; history.back(); }
}

function renderCart() {
  if (!S.cart.length) return openSheet(`<h2>${esc(t('cart'))}</h2><p class="muted">${esc(t('empty_cart'))}</p><button class="btn big" data-a="close">OK</button>`);
  const slots = pickupSlots(S.cart);
  const earliest = earliestPickup(S.cart), asapOk = new Date(earliest).toDateString() === new Date().toDateString() && new Date(earliest).getHours() < CFG.CLOSE_HOUR;
  const groups = {}; slots.forEach(s => { const k = dayLabel(s); (groups[k] = groups[k] || []).push(s); });
  const prevPick = ($('#pickup') && $('#pickup').value) || (S.cartDraft && S.cartDraft.pick) || '';
  const prevNotes = $('#notes') ? $('#notes').value : S.cartDraft ? S.cartDraft.notes : null;
  if ($('#cartName')) S.draft = readDetails('cart');
  const mod = S.modifying && S.orders.find(o => o.id === S.modifying);
  const pay = (mod && mod.pay) || lsGet('kk_pay', 'spot');
  openSheet(`
    <div class="row between"><h2 style="margin:0">🛒 ${esc(t('cart'))}</h2><button class="btn sm ghost" data-a="close">✕</button></div>
    ${S.modifying ? `<div class="banner">✏️ ${esc(t('modify'))}: ${esc(S.modifying)} <a href="#" data-a="stopModify" style="margin-left:auto">✕</a></div>` : ''}
    ${S.cart.map((c, i) => { const l = lineCalc(c); if (!l) return ''; return `
      <div class="line"><div style="font-size:28px">${esc(l.m.emoji || '🍽️')}</div>
        <div class="grow"><b>${esc(l.m.name)}</b><div class="small muted">${esc(l.v.label)}${l.adds.length ? ' + ' + esc(l.adds.map(a => a.label).join(', ')) : ''} · ${money(l.unit)}</div>
        ${leadOf(l.m) === 'tomorrow' ? `<div class="small" style="color:#8a5a00">${esc(t('fresh'))}</div>` : ''}</div>
        <div class="stepper"><button data-a="cartQty" data-i="${i}" data-d="-1">−</button><span>${c.qty}</span><button data-a="cartQty" data-i="${i}" data-d="1">+</button></div>
        <b style="min-width:52px;text-align:right">${money(l.amount)}</b></div>`; }).join('')}
    <div class="total"><span>${esc(t('total'))}</span><span>${money(cartTotal())}</span></div>
    <label class="f">🕑 ${esc(t('pickup'))}</label>
    <select class="in" id="pickup">${asapOk ? `<option value="asap:${earliest}" ${!prevPick || prevPick.startsWith('asap') ? 'selected' : ''}>⚡ ${esc(t('asap'))} (${esc(t('today'))} · ${fmtClock(earliest)}+)</option>` : ''}${Object.keys(groups).map(g => `<optgroup label="${esc(g)}">${groups[g].map(s => `<option value="${s}" ${String(s) === prevPick || (mod && mod.pickupAt === s) ? 'selected' : ''}>${esc(g)} · ${fmtClock(s)}</option>`).join('')}</optgroup>`).join('')}</select>
    <label class="f">📝 ${esc(t('notes'))}</label>
    <textarea class="in" id="notes" placeholder="${esc(t('notes_ph'))}">${esc(prevNotes != null ? prevNotes : (mod && mod.notes) || '')}</textarea>
    ${S.me ? `<h3 style="margin-top:16px">👤 ${esc(t('details'))}</h3>${detailFields('cart')}` : ''}
    <h3 style="margin-top:16px">💳</h3>
    ${upiId() ? `<label class="radio"><input type="radio" name="pay" value="now" ${pay === 'now' ? 'checked' : ''}> ${esc(t('pay_now'))}</label>` : ''}
    <label class="radio"><input type="radio" name="pay" value="spot" ${pay !== 'now' || !upiId() ? 'checked' : ''}> ${esc(t('pay_spot'))}</label>
    <label class="check"><input type="checkbox" id="agree" ${S.agreed ? 'checked' : ''}><span>${esc(t('agree'))} — <a href="#" data-a="showDisclaimer">${esc(t('disclaimer_t'))}</a></span></label>
    ${S.auth ? '' : `<p class="small muted" style="margin:6px 0">${ic('lock', 14)} ${esc(t('login_to_order'))}</p>`}
    <button class="btn primary big" data-a="placeOrder">✓ ${esc(t('confirm'))} · ${money(cartTotal())}</button>
    ${S.modifying ? '' : `<div class="or-line"><span>or</span></div>
    <button class="btn wa big" data-a="waOrder">${ic('wa', 20)} ${esc(t('wa_order'))}</button>`}
    <p class="note">${esc(t('lock_note'))}</p>`);
}

function pickupVal() { const v = ($('#pickup') || {}).value || ''; return v.startsWith('asap:') ? { pickupAt: +v.slice(5), asap: true } : { pickupAt: +v, asap: false }; }
async function placeOrder(btn) {
  if (!$('#agree').checked) return toast('✓ ' + t('agree'));
  S.cartDraft = { pick: $('#pickup').value, notes: $('#notes').value };
  if (!S.auth) return openAuth(S.profile.phone ? 'login' : 'signup', t('login_to_order'), () => renderCart());
  const d = readDetails('cart');
  if (!validDetails(d)) return toast(t('required'));
  S.agreed = true; lsSet('kk_agreed', true); saveProfile(d);
  const pay = ($('input[name=pay]:checked') || {}).value || 'spot'; lsSet('kk_pay', pay);
  const payload = { items: S.cart.map(c => ({ id: c.id, v: c.v, addons: c.addons, qty: c.qty })), notes: $('#notes').value.trim(), ...pickupVal(), pay, customer: d };
  btn.disabled = true; btn.textContent = '⏳ …';
  try {
    let order;
    if (S.modifying) {
      order = (await capi('modifyOrder', { ...payload, id: S.modifying })).order;
    } else {
      payload.id = KKCore.newOrderId();
      try { order = (await capi('placeOrder', payload)).order; }
      catch (e) {
        if (!e.offline) throw e;
        S.queue.push(payload); lsSet('kk_queue', S.queue);
        order = localOrder(payload); order.queued = true;
        toast(t('offline'), 5000);
      }
    }
    upsertLocalOrder(order);
    S.cart = []; saveCart(); S.modifying = null; lsSet('kk_modifying', null);
    closeSheet(); render(); showConfirmation(order); confetti(220); beep();
  } catch (e) { toast(msgOf(e), 4000); btn.disabled = false; btn.textContent = t('confirm'); }
}
function localOrder(p) {
  const pr = KKCore.priceItems(S.menu, p.items, p.type === 'custom');
  return { id: p.id, type: p.type || 'regular', name: p.customer.name, flat: p.customer.flat, phone: p.customer.phone, items: pr.lines, total: pr.total,
    notes: p.notes || '', pickupAt: p.pickupAt || 0, pay: p.pay || 'spot', status: 'placed', createdAt: Date.now(), customText: p.customText || '' };
}
function upsertLocalOrder(o) {
  const i = S.orders.findIndex(x => x.id === o.id);
  if (i >= 0) S.orders[i] = { ...S.orders[i], ...o, queued: o.queued || false }; else S.orders.unshift(o);
  S.orders = S.orders.slice(0, 40); lsSet('kk_orders', S.orders);
}
async function flushQueue() {
  if (!S.queue.length || DEMO || !S.auth) return;
  const left = [];
  for (const p of S.queue) {
    try { const { order } = await capi('placeOrder', p); upsertLocalOrder(order); toast('✅ ' + order.id + ' sent'); }
    catch (e) { if (e.offline) left.push(p); }
  }
  S.queue = left; lsSet('kk_queue', left); render();
}

/* ---------------- Confirmation + order cards ---------------- */
function orderActions(o) {
  const can = KKCore.canChange(o) && !o.queued;
  const wa = waLink(CFG.WHATSAPP_ORDERS_TO, KKCore.orderText(o));
  return `
  <div class="row" style="gap:8px"><a class="btn wa big" style="flex:2" href="${wa}" target="_blank" rel="noopener">${ic('wa', 20)} ${esc(t('send_wa'))}</a><a class="btn big" style="flex:1" href="${telLink(CFG.PHONES[0])}">${ic('phone', 18)} ${esc(t('call'))}</a></div>
  ${o.pay === 'now' && upiId() && o.total && o.status !== 'cancelled' && o.payStatus !== 'paid' ? `<a class="btn gold big" style="margin-top:10px" href="${upiLink(o.total, o.id)}">💳 ${esc(t('pay_upi'))} · ${money(o.total)}</a>` : ''}
  ${o.pay === 'now' && (window.KK_SET || {}).upiQr && o.status !== 'cancelled' && o.payStatus !== 'paid' ? `<div class="qr-box"><img src="${esc(KK_SET.upiQr)}" alt="UPI QR code"><small>Scan to pay ${money(o.total)}</small></div>` : ''}
  ${['cancelled', 'collected'].includes(o.status) || o.type === 'custom' ? '' : `
  <div class="row" style="margin-top:10px">
    <button class="btn danger" style="flex:1" data-a="cancelOrder" data-id="${o.id}" ${can ? '' : 'disabled'}>✕ ${esc(t('cancel'))}</button>
    <button class="btn" style="flex:1" data-a="modifyOrder" data-id="${o.id}" ${can ? '' : 'disabled'}>✏️ ${esc(t('modify'))}</button>
  </div>
  <div class="small" style="margin-top:6px;text-align:center" data-timer="${o.createdAt}"></div>
  <p class="note">${esc(t('lock_note'))}</p>`}`;
}
function showConfirmation(o) {
  openSheet(`
    <div class="success"><div class="tick">✓</div>
      <h2 style="margin:0">${esc(o.type === 'custom' ? t('custom_done') : t('confirmed'))}</h2>
      <p class="muted" style="margin:6px 0">${esc(t('confirmed_sub'))}</p>
      <div style="font-size:22px;font-weight:800;letter-spacing:1px">${esc(o.id)}</div>
      <div class="muted small">${fmtTime(o.createdAt)}${o.pickupAt ? ' · 🕑 ' + esc(t('pickup')) + ': ' + fmtTime(o.pickupAt) : ''}</div>
      ${o.queued ? `<div class="banner">📶 ${esc(t('offline'))}</div>` : ''}
    </div>
    <div class="card" style="margin:10px 0">${(o.items || []).map(l => `<div class="row between"><span>${esc(l.name)} (${esc(l.variant)}${l.addons && l.addons.length ? ' + ' + esc(l.addons.join(', ')) : ''}) × ${l.qty}</span><b>${money(l.amount)}</b></div>`).join('')}
      ${o.total ? `<div class="total"><span>${esc(t('total'))}</span><span>${money(o.total)}</span></div>` : ''}</div>
    ${orderActions(o)}
    ${notifState() === 'default' ? `<button class="btn ghost big" style="margin-top:10px" data-a="enableNotif">🔔 ${esc(t('notif_btn'))}</button>` : ''}
    <button class="btn ghost big" style="margin-top:10px" data-a="goOrders">🧾 ${esc(t('orders'))}</button>`, true);
  tickTimers();
}
function loginCard() { return `<div class="card" style="text-align:center"><div class="big-ic">${ic('lock', 40)}</div><p>${esc(t('login_needed'))}</p><button class="btn primary big" data-a="login">${esc(t('login'))} / ${esc(t('signup'))}</button></div>`; }
function renderOrders() {
  if (!S.auth) return loginCard();
  if (!S.orders.length) return `<div class="card" style="text-align:center"><div style="font-size:48px">🧾</div><p>${esc(t('empty_orders'))}</p><button class="btn primary" data-a="tab" data-t="menu">🍽️ ${esc(t('menu'))}</button></div>`;
  const list = S.orders.length ? S.orders.map(o => {
    const reviewAt = KKCore.reviewOpensAt(o);
    return `<div class="card">
      <div class="row between"><b style="font-size:18px">${esc(o.id)}</b><span class="status s-${o.status}">${o.queued ? '⏳ offline' : esc(t('st_' + o.status))}</span></div>
      <div class="muted small">${fmtTime(o.createdAt)}${o.pickupAt ? ' · 🕑 ' + fmtTime(o.pickupAt) : ''}</div>
      <div style="margin:8px 0">${o.type === 'custom' ? '✨ ' + esc(o.customText) : (o.items || []).map(l => `${esc(l.emoji || '')} ${esc(l.name)} (${esc(l.variant)}${l.addons && l.addons.length ? ' + ' + esc(l.addons.join(', ')) : ''}) × ${l.qty}`).join('<br>')}</div>
      ${o.total ? `<div class="row between"><b>${esc(t('total'))}</b><b>${money(o.total)}</b></div>` : ''}
      ${o.status === 'collected' ? (o.reviewed ? '<p class="small muted">⭐ Thank you for your review!</p>' :
        Date.now() >= reviewAt ? `<button class="btn gold big" style="margin-top:10px" data-a="openReview" data-order="${o.id}">⭐ ${esc(t('write_review'))}</button>` :
        `<p class="small muted">⭐ ${esc(t('review_wait'))} (${fmtClock(reviewAt)})</p>`) : ''}
      ${o.status === 'collected' ? '' : orderActions(o)}
    </div>`;
  }).join('') : `<div class="card"><p>${esc(t('empty_orders'))}</p></div>`;
  return list;
}
function tickTimers() {
  $$('[data-timer]').forEach(el => {
    const left = +el.dataset.timer + KKCore.CANCEL_WINDOW - Date.now();
    if (left <= 0) { el.innerHTML = `<span class="muted">🔒 ${esc(t('locked'))}</span>`; const card = el.closest('.card, .sheet'); if (card) $$('[data-a=cancelOrder],[data-a=modifyOrder]', card).forEach(b => (b.disabled = true)); return; }
    const h = Math.floor(left / 3600000), m = Math.floor(left % 3600000 / 60000), s = Math.floor(left % 60000 / 1000);
    el.innerHTML = `⏳ <span class="timer">${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</span> ${esc(t('left'))}`;
  });
}
async function refreshOrders(silent) {
  if (!S.auth) return;
  try {
    const r = await capi('myOrders');
    setMe(r.customer); setSettings(r.settings);
    const before = Object.fromEntries(S.orders.map(o => [o.id, o.status]));
    const queuedIds = S.queue.map(q => q.id);
    S.orders = [...r.orders, ...S.orders.filter(o => queuedIds.includes(o.id))];
    lsSet('kk_orders', S.orders);
    S.adminOnline = r.adminOnline;
    r.orders.forEach(o => {
      if (before[o.id] && before[o.id] !== o.status) {
        const txt = o.id + ' — ' + t('st_' + o.status);
        toast('🔔 ' + txt, 6000); beep();
        if (o.status === 'ready') confetti(140);
        pushNotify('Keralam Kitchen 🌿', txt);
      }
    });
    if (!$('#overlay') && !(document.activeElement && document.activeElement.matches('input,textarea,select'))) render();
  } catch (e) {}
}

/* ---------------- Help / chat / info ---------------- */
function renderHelp() {
  const pr = S.profile;
  return `
  <div class="card">
    <div class="row"><span class="dot ${S.adminOnline ? 'on' : ''}"></span><b>${esc(S.adminOnline ? t('admin_on') : t('admin_off'))}</b></div>
    ${S.auth ? `
      <div class="chat" id="chat">${S.chat.map(m => `<div class="msg ${m.from === 'customer' ? 'me' : 'them'}">${esc(m.text)}<small>${fmtClock(m.at)}</small></div>`).join('') || '<p class="muted small">👋 Hi! How can we help you?</p>'}</div>
      <div class="row" style="margin-top:8px"><input class="in" id="chatIn" style="flex:1" placeholder="${esc(t('chat_ph'))}"><button class="btn primary" data-a="chatSend">➤</button></div>`
    : `<p class="muted">${esc(t('login_needed'))}</p><button class="btn primary big" data-a="login">${esc(t('login'))} / ${esc(t('signup'))}</button>`}
  </div>
  <div class="card">
    <h3>📞 ${esc(t('contact'))}</h3>
    ${CFG.PHONES.map(p => `<div class="row" style="margin:8px 0"><b style="flex:1;font-size:18px">${p}</b>
      <a class="btn sm" href="${telLink(p)}">${ic('phone', 16)} ${esc(t('call'))}</a>
      <a class="btn sm wa" href="${waLink(p, 'Hi Keralam Kitchen 🌿')}" target="_blank" rel="noopener">${ic('wa', 16)} WhatsApp</a></div>`).join('')}
    <p class="small muted" style="margin:6px 0 0">Tap a number's WhatsApp button to chat with us directly.</p>
  </div>`;
}
function scrollChat() { const c = $('#chat'); if (c) c.scrollTop = c.scrollHeight; }
async function loadChat() {
  if (!S.auth) return;
  try { const r = await capi('chatList'); const changed = r.messages.length !== S.chat.length; S.chat = r.messages; S.adminOnline = r.adminOnline; if (S.tab === 'help' && changed && !$('#overlay')) { const v = ($('#chatIn') || {}).value; render(); if (v && $('#chatIn')) $('#chatIn').value = v; } } catch (e) {}
}
function renderInfo() {
  return `
  <div class="card"><h3>🔒 ${esc(t('disclaimer_t'))}</h3><p>${esc(t('disclaimer'))}</p>
    ${S.lang !== 'en' ? `<p class="small muted">${esc(I18N.en.disclaimer)}</p>` : ''}</div>
  <div class="card"><h3>🌿 Keralam Kitchen</h3>
    <p>We are beginning a new journey with fresh, hygienically prepared homemade food. Thank you for supporting our new beginning! ❤️</p>
    <p>🗓️ ${esc(t('advance'))}</p>
    <img src="img/menu-poster.jpg" alt="Menu poster" style="border-radius:14px;margin-top:8px" loading="lazy">
  </div>
  ${S.me ? `<div class="card acct">
    <div class="row">${avatar(S.me, 64)}<div style="flex:1"><h3 style="margin:0">${esc(S.me.name)}</h3><div class="muted small">Flat ${esc(S.me.flat)} · ${esc(S.me.phone)}</div>
      <div class="muted small">${S.me.createdAt ? 'Member since ' + new Date(S.me.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''}</div></div></div>
    <button class="btn big" style="margin-top:12px" data-a="editAccount">✏️ ${esc(t('edit_profile'))}</button>
    ${notifState() === 'granted' ? `<div class="banner">🔔 ${esc(t('notif_on'))}</div>` : notifState() === 'unsupported' ? '' : `<button class="btn ghost big" style="margin-top:10px" data-a="enableNotif">🔔 ${esc(t('notif_btn'))}</button>`}
    <button class="btn ghost big" style="margin-top:10px" data-a="logout">⎋ ${esc(t('logout'))}</button>
  </div>` : ''}
  <div class="card"><button class="btn big" data-a="openLang">🌐 ${esc(t('change_lang'))}</button></div>
  <p class="small muted" style="text-align:center"><a href="admin.html">Kitchen login</a></p>`;
}

/* ---------------- Reviews ---------------- */
let reviewState = { stars: 5, photo: '', orderId: '' };
function openReview(orderId) {
  if (!S.auth) return openAuth('login', t('login_needed'), () => openReview(orderId));
  reviewState = { stars: 5, photo: '', orderId: orderId || '' };
  const o = orderId && S.orders.find(x => x.id === orderId);
  const itemOpts = o ? (o.items || []).map(l => menuItem(l.id)).filter(Boolean) : S.menu;
  openSheet(`
    <div class="row between"><h2 style="margin:0">⭐ ${esc(t('write_review'))}</h2><button class="btn sm ghost" data-a="close">✕</button></div>
    ${o ? `<p class="muted small">${esc(o.id)}</p>` : ''}
    <select class="in" id="rvItem" style="margin-top:10px">${itemOpts.map(m => `<option value="${m.id}">${esc(m.emoji || '')} ${esc(m.name)}</option>`).join('')}<option value="">🌿 Overall</option></select>
    <div class="bigstars" id="rvStars" style="text-align:center;margin:10px 0">${[1, 2, 3, 4, 5].map(i => `<button data-a="star" data-i="${i}" class="on">★</button>`).join('')}</div>
    <textarea class="in" id="rvText" placeholder="😋 …"></textarea>
    <div class="row" style="margin-top:10px"><label class="btn ghost sm">📷 ${esc(t('photo'))}<input type="file" accept="image/*" id="rvPhoto" hidden></label><img id="rvPrev" class="photo-prev hidden" alt=""></div>
    ${detailFields('r')}
    <button class="btn primary big" style="margin-top:12px" data-a="submitReview">${esc(t('send'))} ⭐</button>`);
  $('#rvPhoto').onchange = async e => { const f = e.target.files[0]; if (!f) return; reviewState.photo = await fileToDataUrl(f); $('#rvPrev').src = reviewState.photo; $('#rvPrev').classList.remove('hidden'); };
}
async function submitReview(btn) {
  const d = readDetails('r');
  if (!d.name) return toast(t('required'));
  if (d.flat) saveProfile({ ...S.profile, ...d });
  btn.disabled = true;
  try {
    await capi('addReview', { orderId: reviewState.orderId, name: d.name, itemId: $('#rvItem').value, stars: reviewState.stars, text: $('#rvText').value.trim(), photo: reviewState.photo });
    closeSheet(); toast('⭐ Thank you! 🙏'); await loadMenu(); refreshOrders(true);
  } catch (e) { toast(e.offline ? t('offline') : msgOf(e), 4000); btn.disabled = false; }
}

/* ---------------- Custom order ---------------- */
let customPhoto = '';
async function sendCustom(btn) {
  const text = $('#customText').value.trim();
  if (!text && !customPhoto) return toast(t('custom_ph'));
  if (!S.auth) return openAuth('login', t('login_to_order'));
  const d = readDetails('c'); if (!validDetails(d)) return toast(t('required'));
  saveProfile(d);
  btn.disabled = true;
  const payload = { id: KKCore.newOrderId(), type: 'custom', customText: text, customPhoto, items: [], customer: d, notes: '' };
  try {
    let order;
    try { order = (await capi('placeOrder', payload)).order; }
    catch (e) { if (!e.offline) throw e; S.queue.push(payload); lsSet('kk_queue', S.queue); order = localOrder(payload); order.queued = true; }
    upsertLocalOrder(order); customPhoto = '';
    render(); confetti(160);
    openSheet(`<div class="success"><div class="tick">💚</div><h2>${esc(t('custom_done'))}</h2><p class="muted">${esc(order.id)}</p>
      <a class="btn wa big" href="${waLink(CFG.WHATSAPP_ORDERS_TO, KKCore.orderText(order))}" target="_blank" rel="noopener">🟢 ${esc(t('send_wa'))}</a>
      <button class="btn ghost big" style="margin-top:10px" data-a="close">OK</button></div>`, true);
  } catch (e) { toast(msgOf(e), 4000); btn.disabled = false; }
}

/* ---------------- Data loading ---------------- */
async function loadMenu() {
  try {
    const r = await api('menu');
    S.menu = r.menu; S.reviews = r.reviews; S.adminOnline = r.adminOnline; setSettings(r.settings);
    lsSet('kk_menu', S.menu); lsSet('kk_reviews', S.reviews);
    S.cart = S.cart.filter(c => menuItem(c.id)); saveCart();
    if (!$('#overlay') && S.lang && !$('.lang-screen') && !document.activeElement.matches('input,textarea')) render();
  } catch (e) {}
}

/* ---------------- Actions ---------------- */
const ACTIONS = {
  pickLang: el => { S.pickLang = el.dataset.l; renderLang(); },
  langDone: async el => {
    const first = !S.lang;
    S.lang = S.pickLang || S.lang || 'en'; lsSet('kk_lang', S.lang); S.pickLang = null;
    applyDir();
    S.tab = 'menu'; render();
    if (first) await showLoader(1400);
  },
  home: () => { closeSheet(); if (S.tab !== 'menu') go('menu'); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  openLang: () => { closeSheet(); S.pickLang = S.lang; renderLang(true); },
  tab: el => go(el.dataset.t),
  variant: el => { selOf(el.dataset.id).v = +el.dataset.i; render(); },
  addon: el => { const s = selOf(el.dataset.id), i = +el.dataset.i; s.addons = s.addons.includes(i) ? s.addons.filter(x => x !== i) : [...s.addons, i].sort(); render(); },
  qty: el => { const s = selOf(el.dataset.id); s.qty = Math.max(1, Math.min(99, s.qty + +el.dataset.d)); render(); },
  add: el => {
    const id = el.dataset.id, s = selOf(id), key = [id, s.v, s.addons.join('.')].join('|');
    const ex = S.cart.find(c => c.key === key);
    if (ex) ex.qty += s.qty; else S.cart.push({ key, id, v: s.v, addons: [...s.addons], qty: s.qty });
    saveCart(); S.sel[id] = { v: s.v, addons: [], qty: 1 };
    const r = el.getBoundingClientRect();
    render(); toast('✓ ' + menuItem(id).name); confetti(70, { x: r.left + r.width / 2, y: r.top });
    capi('track', { type: 'cart', text: 'Added to cart: ' + menuItem(id).name + ' × ' + s.qty }).catch(() => {});
  },
  openCart: () => { renderCart(); capi('track', { type: 'checkout', text: 'Opened cart · ' + money(cartTotal()) }).catch(() => {}); },
  cartQty: el => { const c = S.cart[+el.dataset.i]; c.qty += +el.dataset.d; if (c.qty <= 0) S.cart.splice(+el.dataset.i, 1); saveCart(); if (S.cart.length) renderCart(); else { closeSheet(); } render(); },
  close: () => closeSheet(),
  placeOrder: el => placeOrder(el),
  showDisclaimer: () => alert(t('disclaimer')),
  stopModify: () => { S.modifying = null; lsSet('kk_modifying', null); S.cart = []; saveCart(); closeSheet(); render(); },
  goOrders: () => { closeSheet(); setTimeout(() => go('orders'), 30); },
  cancelOrder: async el => {
    if (!confirm(t('cancel') + ' ' + el.dataset.id + '?')) return;
    el.disabled = true;
    try { const { order } = await capi('cancelOrder', { id: el.dataset.id }); upsertLocalOrder(order); closeSheet(); render(); sadPopup(order); }
    catch (e) { toast(e.offline ? t('offline') : msgOf(e), 4000); el.disabled = false; }
  },
  modifyOrder: el => {
    const o = S.orders.find(x => x.id === el.dataset.id); if (!o) return;
    S.modifying = o.id; lsSet('kk_modifying', o.id);
    S.cart = o.items.map(l => ({ key: [l.id, l.v, (l.addonIdx || []).join('.')].join('|'), id: l.id, v: l.v, addons: l.addonIdx || [], qty: l.qty }));
    saveCart(); closeSheet(); S.tab = 'menu'; render(); renderCart();
  },
  editProfile: () => { S.editingProfile = true; S.tab = S.tab === 'info' ? 'help' : S.tab; render(); },
  saveHelpProfile: () => { const d = readDetails('h'); if (!validDetails(d)) return toast(t('required')); saveProfile(d); render(); loadChat(); },
  chatSend: async el => {
    const inp = $('#chatIn'), text = inp.value.trim(); if (!text) return;
    const tmp = { id: 'tmp' + Date.now(), from: 'customer', text, at: Date.now(), pending: true };
    S.chat.push(tmp); inp.value = ''; render(); setTimeout(() => { const i = $('#chatIn'); if (i) i.focus(); }, 0);
    try { const r = await capi('chatSend', { text }); S.chat = r.messages; S.adminOnline = r.adminOnline; S.rev = 0; if (S.tab === 'help') render(); }
    catch (e) { S.chat = S.chat.filter(m => m !== tmp); render(); const i = $('#chatIn'); if (i) i.value = text; toast(e.offline ? t('offline') : msgOf(e)); }
  },
  openReview: el => openReview(el.dataset.order),
  star: el => { reviewState.stars = +el.dataset.i; $$('#rvStars button').forEach((b, i) => b.classList.toggle('on', i < reviewState.stars)); },
  submitReview: el => submitReview(el),
  sendCustom: el => sendCustom(el),
  enableNotif: async () => {
    try {
      const p = await Notification.requestPermission();
      if (p === 'granted') { toast('🔔 ' + t('notif_on')); pushNotify('Keralam Kitchen 🌿', 'You will be notified about your orders here.'); capi('track', { type: 'notify_on', text: 'Turned on notifications' }).catch(() => {}); }
      else toast('🔕 Notifications blocked — allow them in your browser settings');
      if ($('#overlay')) closeSheet(); render();
    } catch (e) { toast('🔕 Not supported on this browser'); }
  },
  logout: () => { if (confirm(t('logout') + '?')) doLogout(); },
  editAccount: () => openAccount(),
  authMode: el => openAuth(el.dataset.m),
  login: () => openAuth(S.profile.phone ? 'login' : 'signup'),
  waOrder: () => waOrderSheet(),
  waSend: el => waSend(el),
  authGo: el => authGo(el),
  forgot: el => forgotPin(el),
  saveAccount: el => saveAccount(el),
  removePhoto: () => { acctPhoto = null; const p = $('#acPrev'); if (p) { p.outerHTML = avatar({ name: S.me.name }, 72).replace('class="avatar"', 'id="acPrev" class="avatar"'); } }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || !ACTIONS[el.dataset.a]) return;
  if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
  ACTIONS[el.dataset.a](el, e);
});
document.addEventListener('change', async e => {
  if (e.target.id === 'customPhoto') {
    const f = e.target.files[0]; if (!f) return;
    customPhoto = await fileToDataUrl(f); const p = $('#customPrev'); p.src = customPhoto; p.classList.remove('hidden');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'chatIn') ACTIONS.chatSend($('[data-a=chatSend]'));
  if (e.key === 'Enter' && (e.target.id === 'auPin' || e.target.id === 'auPhone')) { const b = $('[data-a=authGo]'); if (b) authGo(b); }
});
/* digits-only for PIN/phone boxes */
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.digits) e.target.value = e.target.value.replace(/\D/g, '').slice(0, +e.target.dataset.digits); });

/* ---------------- Navigation (phone back button stays inside the app) ---------------- */
function go(tab, replace) {
  S.tab = tab; render(); window.scrollTo(0, 0);
  if (!replace) history.pushState({ tab }, '');
  if (tab === 'orders') refreshOrders(); if (tab === 'help') loadChat();
}
let lastBack = 0;
window.addEventListener('popstate', e => {
  if (S._skipPop) { S._skipPop = false; return; }
  const st = e.state || {};
  if ($('#overlay')) { closeSheet(true); return; }
  if (!S.lang) { history.pushState({ tab: 'menu' }, ''); return; }
  if ($('.lang-screen')) { history.pushState({ tab: S.tab }, ''); render(); return; }
  if (st.root) {
    if (S.tab !== 'menu') { history.pushState({ tab: 'menu' }, ''); go('menu', true); return; }
    if (Date.now() - lastBack < 2500) { history.back(); return; }
    lastBack = Date.now(); toast(t('exit_back')); history.pushState({ tab: 'menu' }, ''); return;
  }
  go(st.tab || 'menu', true);
});

/* ---------------- Login / signup ---------------- */
let authPhoto = '';
function renderAuth(mode, msg) { openAuth(mode, msg); }
function openAuth(mode = 'login', msg = '', then) {
  if (then !== undefined) S.afterAuth = then;
  const pr = S.profile || {};
  const su = mode === 'signup';
  openSheet(`
  <div class="auth-sheet">
    <div class="row between"><div class="auth-hero-s">🌿 <b>Keralam Kitchen</b></div><button class="btn sm ghost" data-a="close">✕</button></div>
    <div class="auth-card">
      <div class="seg"><button class="${!su ? 'on' : ''}" data-a="authMode" data-m="login">${esc(t('login'))}</button><button class="${su ? 'on' : ''}" data-a="authMode" data-m="signup">${esc(t('signup'))}</button></div>
      <h2 style="margin:14px 0 4px">${esc(su ? t('signup_t') : t('login_t'))}</h2>
      ${msg ? `<div class="banner warn">${esc(msg)}</div>` : ''}
      <label class="f">📱 ${esc(t('phone'))} *</label>
      <input class="in" id="auPhone" inputmode="numeric" autocomplete="tel" data-digits="10" maxlength="10" placeholder="98XXXXXXXX" value="${esc(pr.phone || '')}">
      ${su ? `
      <label class="f">👤 ${esc(t('name'))} *</label><input class="in" id="auName" autocomplete="name" value="${esc(pr.name || '')}">
      <label class="f">🏠 ${esc(t('flat'))} *</label><input class="in" id="auFlat" placeholder="A-504" value="${esc(pr.flat || '')}">` : ''}
      <label class="f">🔒 ${esc(su ? t('pin2') : t('pin'))} *</label>
      <input class="in pin-in" id="auPin" type="password" inputmode="numeric" autocomplete="${su ? 'new-password' : 'current-password'}" data-digits="6" maxlength="6" placeholder="••••">
      ${su ? `
      <label class="f">📷 ${esc(t('profile_photo'))}</label>
      <div class="row"><label class="btn ghost sm">📷 ${esc(t('photo'))}<input type="file" accept="image/*" id="auPhoto" hidden></label><img id="auPrev" class="avatar hidden" style="width:56px;height:56px" alt=""></div>
      <label class="check"><input type="checkbox" id="auAgree" checked><span>${esc(t('agree'))} — <a href="#" data-a="showDisclaimer">${esc(t('disclaimer_t'))}</a></span></label>` : ''}
      <button class="btn primary big" style="margin-top:14px" data-a="authGo" data-m="${mode}">${esc(su ? t('signup') : t('login'))} ›</button>
      ${!su ? `<button class="btn ghost big" style="margin-top:10px" data-a="forgot">🔑 ${esc(t('forgot'))}</button>` : ''}
      <p class="small" style="text-align:center;margin-top:14px"><a href="#" data-a="authMode" data-m="${su ? 'login' : 'signup'}">${esc(su ? t('have_acc') : t('no_acc'))}</a></p>
    </div>
    <p class="small muted" style="text-align:center">One account per mobile number. Your PIN keeps your orders private.<br>${CFG.PHONES.map(p => `<a class="phone-link" href="${waLink(p, 'Hi Keralam Kitchen 🌿 I need help logging in')}" target="_blank" rel="noopener">🟢 ${p}</a>`).join(' ')}</p>
  </div>`);
  authPhoto = '';
  const f = $('#auPhoto');
  if (f) f.onchange = async e => { const file = e.target.files[0]; if (!file) return; authPhoto = await fileToDataUrl(file, 400); const p = $('#auPrev'); p.src = authPhoto; p.classList.remove('hidden'); };
  setTimeout(() => { const el = $(pr.phone ? '#auPin' : '#auPhone'); if (el && !su) el.focus(); }, 50);
}
async function authGo(btn) {
  const su = btn.dataset.m === 'signup';
  const phone = KKCore.digits($('#auPhone').value), pin = $('#auPin').value.trim();
  if (phone.length !== 10) return toast('Enter your 10-digit mobile number');
  if (!/^\d{4,6}$/.test(pin)) return toast('PIN must be 4 to 6 digits');
  const d = { phone, pin, device: deviceName() };
  if (su) {
    d.name = $('#auName').value.trim(); d.flat = $('#auFlat').value.trim(); d.photo = authPhoto;
    if (!d.name || !d.flat) return toast(t('required'));
    if (!$('#auAgree').checked) return toast('✓ ' + t('agree'));
  }
  btn.disabled = true; const old = btn.textContent; btn.textContent = '⏳ …';
  try {
    const r = await api(su ? 'register' : 'login', d);
    S.auth = { phone, pin }; lsSet('kk_auth', S.auth); setMe(r.customer);
    if (su) { S.agreed = true; lsSet('kk_agreed', true); }
    try { sessionStorage.setItem('kk_visit', 1); } catch (e) {}
    const after = S.afterAuth; S.afterAuth = null;
    closeSheet(); render(); handleHash();
    if (after) setTimeout(after, 60);
    confetti(su ? 220 : 90);
    toast(su ? '🎉 Welcome to Keralam Kitchen, ' + r.customer.name.split(' ')[0] + '!' : '👋 Welcome back, ' + r.customer.name.split(' ')[0] + '!', 3500);
    refreshOrders(true); flushQueue();
  } catch (e) {
    btn.disabled = false; btn.textContent = old;
    if (e.offline) return toast(t('offline'), 4000);
    if (/^EXISTS:/.test(e.message)) return openAuth('login', msgOf(e));
    if (/^NOACCOUNT:/.test(e.message)) return openAuth('signup', msgOf(e));
    if (/^BLOCKED:/.test(e.message)) return renderBlocked();
    toast(msgOf(e), 4500);
  }
}
async function forgotPin(btn) {
  const phone = KKCore.digits($('#auPhone').value);
  if (phone.length !== 10) return toast('Enter your 10-digit mobile number first');
  btn.disabled = true;
  try {
    await api('forgotPin', { phone });
    openSheet(`<div class="success"><div class="tick">🔑</div><h2>We've told the kitchen</h2>
      <p class="muted">The Keralam Kitchen team will confirm it's you and send your PIN on WhatsApp. You can also message us now:</p></div>
      ${CFG.PHONES.map(p => `<a class="btn wa big" style="margin-top:8px" href="${waLink(p, 'Hi Keralam Kitchen 🌿 I forgot my PIN. My number is ' + phone)}" target="_blank" rel="noopener">🟢 WhatsApp ${p}</a>`).join('')}
      <button class="btn ghost big" style="margin-top:10px" data-a="close">OK</button>`, true);
  } catch (e) { toast(e.offline ? t('offline') : msgOf(e), 4500); if (/^NOACCOUNT:/.test(e.message)) openAuth('signup', msgOf(e)); }
  btn.disabled = false;
}
function renderBlocked() {
  S.auth = null; lsSet('kk_auth', null);
  app.innerHTML = `<div class="auth-screen"><div class="card auth-card" style="text-align:center"><div style="font-size:56px">🙏</div>
    <h2>Your account is on hold</h2><p class="muted">Please contact Keralam Kitchen to sort this out.</p>
    ${CFG.PHONES.map(p => `<a class="btn wa big" style="margin-top:8px" href="${waLink(p, 'Hi Keralam Kitchen 🌿 my account is on hold, please help')}" target="_blank" rel="noopener">🟢 WhatsApp ${p}</a>`).join('')}
    <button class="btn ghost big" style="margin-top:10px" data-a="home">← ${esc(t('menu'))}</button></div></div>`;
}

/* ---------------- My account ---------------- */
let acctPhoto;
function openAccount() {
  if (!S.me) return;
  acctPhoto = undefined;
  openSheet(`
    <div class="row between"><h2 style="margin:0">👤 ${esc(t('my_acc'))}</h2><button class="btn sm ghost" data-a="close">✕</button></div>
    <div class="row" style="margin-top:12px">${avatar(S.me, 72).replace('class="avatar"', 'id="acPrev" class="avatar"')}
      <div class="row" style="gap:6px"><label class="btn sm">📷 ${esc(t('photo'))}<input type="file" accept="image/*" id="acPhoto" hidden></label>
      ${S.me.photo ? `<button class="btn sm ghost" data-a="removePhoto">${esc(t('remove_photo'))}</button>` : ''}</div></div>
    <label class="f">${esc(t('name'))}</label><input class="in" id="acName" value="${esc(S.me.name)}">
    <label class="f">${esc(t('flat'))}</label><input class="in" id="acFlat" value="${esc(S.me.flat)}">
    <label class="f">${esc(t('phone'))}</label><input class="in" value="${esc(S.me.phone)}" disabled>
    <p class="small muted" style="margin:4px 0 0">To change your mobile number, please contact the kitchen.</p>
    <label class="f">🔒 ${esc(t('new_pin'))}</label><input class="in" id="acPin" type="password" inputmode="numeric" data-digits="6" maxlength="6" autocomplete="new-password">
    <button class="btn primary big" style="margin-top:14px" data-a="saveAccount">✓ ${esc(t('save'))}</button>
    <button class="btn ghost big" style="margin-top:10px" data-a="logout">⎋ ${esc(t('logout'))}</button>`);
  $('#acPhoto').onchange = async e => { const f = e.target.files[0]; if (!f) return; acctPhoto = await fileToDataUrl(f, 400); const p = $('#acPrev'); p.outerHTML = `<img id="acPrev" class="avatar" src="${acctPhoto}" style="width:72px;height:72px" alt="">`; };
}
async function saveAccount(btn) {
  const d = { name: $('#acName').value.trim(), flat: $('#acFlat').value.trim() };
  if (!d.name || !d.flat) return toast(t('required'));
  const np = $('#acPin').value.trim();
  if (np) { if (!/^\d{4,6}$/.test(np)) return toast('PIN must be 4 to 6 digits'); d.newPin = np; }
  if (acctPhoto !== undefined) d.photo = acctPhoto || '';
  btn.disabled = true;
  try {
    const r = await capi('updateProfile', d);
    if (np) { S.auth = { ...S.auth, pin: np }; lsSet('kk_auth', S.auth); }
    setMe(r.customer); closeSheet(); render(); toast('✓ ' + t('save'));
  } catch (e) { toast(e.offline ? t('offline') : msgOf(e), 4000); btn.disabled = false; }
}

/* ---------------- Notifications + cancel popup ---------------- */
function notifState() { return 'Notification' in window ? Notification.permission : 'unsupported'; }
async function pushNotify(title, body) {
  if (notifState() !== 'granted') return;
  try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) return reg.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [120, 60, 120] }); } catch (e) {}
  try { new Notification(title, { body, icon: 'icon-192.png' }); } catch (e) {}
}
function sadPopup(o) {
  openSheet(`<div class="success"><div class="sad">😢</div>
    <h2 style="margin:0">${esc(t('sorry_t'))}</h2>
    <p class="muted">${esc(t('sorry_s'))}</p>
    <p class="small muted">${esc(o.id)}</p></div>
    <button class="btn primary big" data-a="home">🍽️ ${esc(t('menu'))}</button>
    <button class="btn ghost big" style="margin-top:10px" data-a="close">OK</button>`, true);
}

/* ---------------- Boot ---------------- */
function handleHash() {
  const m = location.hash.match(/review=([\w-]+)/);
  if (m) { S.tab = 'orders'; render(); refreshOrders().then(() => openReview(m[1])); history.replaceState(null, '', location.pathname); }
}
(function boot() {
  history.replaceState({ root: 1 }, '');
  history.pushState({ tab: 'menu' }, '');
  if (!S.lang) { renderLang(); }
  else { render(); handleHash(); }
  loadMenu(); refreshOrders(true); flushQueue();
  try { if (!sessionStorage.getItem('kk_visit')) { sessionStorage.setItem('kk_visit', 1); capi('visit', { device: deviceName() }).then(r => { setMe(r.customer); setSettings(r.settings); }).catch(() => {}); } } catch (e) {}
  window.addEventListener('online', () => { flushQueue(); loadMenu(); });
  setInterval(tickTimers, 1000);
  // fast "anything new?" check every 8 s (tiny request), full refresh only when something changed
  setInterval(async () => {
    if (document.hidden || !S.lang || !S.auth) return;
    try { const r = await capi('ping'); S.adminOnline = r.adminOnline; if (r.rev && r.rev !== S.rev) { const first = !S.rev; S.rev = r.rev; if (!first || S.tab === 'help') { refreshOrders(true); loadChat(); } } } catch (e) {}
  }, 8000);
  setInterval(() => { if (!document.hidden && S.auth) refreshOrders(true); }, 90000);
  setInterval(() => { if (!document.hidden && S.lang) loadMenu(); }, 120000);
})();

/* ---------------- WhatsApp order without an account ---------------- */
function waOrderSheet() {
  const pr = S.me || S.profile || {};
  const pick = $('#pickup') ? $('#pickup').value : '', notes = $('#notes') ? $('#notes').value : '';
  S.waDraft = { pick, notes };
  openSheet(`
    <div class="row between"><h2 style="margin:0">${ic('wa', 22)} ${esc(t('wa_order'))}</h2><button class="btn sm ghost" data-a="close">✕</button></div>
    <p class="muted small">${esc(t('wa_order_s'))}</p>
    <label class="f">${esc(t('name'))} *</label><input class="in" id="gName" autocomplete="name" value="${esc(pr.name || '')}">
    <div class="row" style="gap:10px;align-items:flex-start">
      <div style="flex:1.3"><label class="f">${esc(t('phone'))} *</label><input class="in" id="gPhone" inputmode="numeric" data-digits="10" maxlength="10" autocomplete="tel" value="${esc(pr.phone || '')}" placeholder="98XXXXXXXX"></div>
      <div style="flex:1"><label class="f">${esc(t('flat'))}</label><input class="in" id="gFlat" value="${esc(pr.flat || '')}" placeholder="A-504"></div>
    </div>
    <div class="total"><span>${esc(t('total'))}</span><span>${money(cartTotal())}</span></div>
    <h3 style="margin:14px 0 6px">${esc(t('send_to'))}:</h3>
    ${CFG.PHONES.map(p => `<button class="btn wa big" style="margin-top:8px" data-a="waSend" data-p="${p}">${ic('wa', 20)} WhatsApp ${p}</button>`).join('')}
    <a class="btn ghost big" style="margin-top:8px" href="${telLink(CFG.PHONES[0])}">${ic('phone', 18)} ${esc(t('call_us'))}</a>`);
}
function waSend(btn) {
  const c = { name: $('#gName').value.trim(), phone: KKCore.digits($('#gPhone').value), flat: $('#gFlat').value.trim() };
  if (!c.name || c.phone.length !== 10) { toast(t('required')); (!c.name ? $('#gName') : $('#gPhone')).focus(); return; }
  const dr = S.waDraft || {}, pv = String(dr.pick || '');
  const p = { id: KKCore.newOrderId(), items: S.cart.map(x => ({ id: x.id, v: x.v, addons: x.addons, qty: x.qty })), customer: c, notes: dr.notes || '',
    pickupAt: pv.startsWith('asap:') ? +pv.slice(5) : +pv || 0, asap: pv.startsWith('asap:'), sentTo: btn.dataset.p };
  const o = localOrder(p); o.asap = p.asap; o.guest = true;
  // open WhatsApp right away (must happen inside the tap), save to the kitchen dashboard in the background
  window.open(waLink(btn.dataset.p, KKCore.orderText(o)), '_blank');
  api('guestOrder', p).catch(e => { if (/^BLOCKED:/.test(e.message)) toast(msgOf(e), 5000); });
  if (!S.me) { S.profile = { ...S.profile, ...c }; lsSet('kk_profile', S.profile); }
  S.cart = []; saveCart(); closeSheet(); render(); confetti(200);
  openSheet(`<div class="success"><div class="tick">✓</div><h2 style="margin:0">${esc(t('confirmed'))}</h2>
    <p class="muted">${esc(o.id)} → WhatsApp ${esc(btn.dataset.p)}</p></div>
    <a class="btn wa big" href="${waLink(btn.dataset.p, KKCore.orderText(o))}" target="_blank" rel="noopener">${ic('wa', 20)} ${esc(t('send_wa'))}</a>
    <button class="btn ghost big" style="margin-top:10px" data-a="close">OK</button>`, true);
}
