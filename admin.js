/* Keralam Kitchen — admin dashboard (v5) */
const A = {
  auth: lsGet('kk_admin_auth', null),
  data: null, tab: lsGet('kk_admin_tab', 'overview'), filter: 'active', chatPhone: null,
  seen: new Set(lsGet('kk_admin_seen', [])), seenAct: new Set(lsGet('kk_admin_seen_act', [])),
  from: null, to: null, search: '', actFilter: 'all', actSearch: '', custSort: 'recent', drawer: false
};
const app = $('#app');
const DAY = 864e5, MIN = 6e4;
const ST_LABEL = { placed: 'New', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', collected: 'Collected', cancelled: 'Cancelled' };
const ACTIVE = ['placed', 'accepted', 'preparing', 'ready'];
const fmtDate = ts => { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const startOf = s => new Date(s + 'T00:00:00').getTime();
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
function defaultRange() { A.from = fmtDate(Date.now() - 29 * DAY); A.to = fmtDate(Date.now()); }
defaultRange();
const adminApi = (action, d = {}) => api(action, { ...d, auth: A.auth });
const siteBase = () => siteUrl();
const ago = ts => { if (!ts) return '—'; const m = Math.round((Date.now() - ts) / MIN); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
const avatar = (c, size = 34) => c && c.photo
  ? `<img class="av" src="${esc(c.photo)}" alt="" style="width:${size}px;height:${size}px">`
  : `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px">${esc(((c && c.name) || '?').trim().charAt(0).toUpperCase() || '?')}</span>`;

const ACT_META = {
  signup: ['🎉', 'Signed up', 'g'], login: ['🔑', 'Logged in', 'g'], visit: ['👀', 'Visited', ''], logout: ['⎋', 'Logged out', ''],
  cart: ['🛒', 'Added to cart', ''], checkout: ['🧺', 'Opened cart', ''], order: ['🆕', 'Placed order', 'b'], custom: ['✨', 'Custom request', 'b'],
  modify: ['✏️', 'Modified order', 'y'], cancel: ['❌', 'Cancelled', 'r'], review: ['⭐', 'Review', 'y'], chat: ['💬', 'Chat', 'b'],
  profile: ['👤', 'Profile updated', ''], forgot_pin: ['🔑', 'Forgot PIN', 'r'], wrong_pin: ['⚠️', 'Wrong PIN', 'r'], blocked: ['⛔', 'Blocked user tried', 'r'],
  notify_on: ['🔔', 'Turned on alerts', ''], admin_login: ['🔐', 'Admin login', ''], admin_fail: ['⚠️', 'Wrong admin PIN', 'r'],
  admin_status: ['🧑‍🍳', 'Order status', ''], admin_customer: ['🗂️', 'Customer edited', '']
};
const ALERT_TYPES = ['signup', 'login', 'order', 'custom', 'modify', 'cancel', 'review', 'chat', 'forgot_pin', 'wrong_pin', 'blocked', 'admin_login', 'admin_fail'];
const ACT_FILTERS = {
  all: ['All', () => true], logins: ['Logins & sign-ups', a => ['login', 'signup', 'logout'].includes(a.type)], visits: ['Visits', a => a.type === 'visit'],
  orders: ['Orders', a => ['order', 'custom', 'modify', 'cancel'].includes(a.type)], cart: ['Cart', a => ['cart', 'checkout'].includes(a.type)],
  chat: ['Chat & reviews', a => ['chat', 'review'].includes(a.type)], security: ['Security', a => ['forgot_pin', 'wrong_pin', 'blocked', 'admin_login', 'admin_fail'].includes(a.type)]
};

/* ---------- Login ---------- */
function renderLogin(err) {
  document.body.className = 'adm-login';
  app.innerHTML = `
  <div class="login-wrap"><div class="login-card">
    <div class="brand"><span class="brand-mark">🌿</span><div><b>Keralam Kitchen</b><small>Admin dashboard</small></div></div>
    <h1>Sign in</h1>
    <p class="muted">Only for kitchen admins (${CFG.PHONES.map(p => p.slice(0, 2) + '••••' + p.slice(-2)).join(', ')})</p>
    ${DEMO ? '<div class="pill y">Demo mode: PIN is 1234</div>' : ''}
    <label class="lbl">Admin mobile number</label><input class="inp" id="lp" inputmode="numeric" maxlength="14" autocomplete="tel">
    <label class="lbl">PIN</label><input class="inp" id="lpin" type="password" inputmode="numeric" autocomplete="current-password">
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    <button class="b b-pri b-full" style="margin-top:18px" id="lgo">Sign in</button>
    <p class="small" style="text-align:center;margin-top:14px"><a href="index.html">← Customer site</a></p>
  </div></div>`;
  const go = async () => {
    const auth = { phone: KKCore.digits($('#lp').value), pin: $('#lpin').value };
    if (!CFG.PHONES.map(KKCore.digits).includes(auth.phone)) return renderLogin('This number is not an admin number.');
    $('#lgo').disabled = true; $('#lgo').textContent = 'Signing in…';
    try { A.auth = auth; await adminApi('adminLogin', { device: deviceName() }); lsSet('kk_admin_auth', auth); await load(); try { Notification.requestPermission(); } catch (e) {} }
    catch (e) { A.auth = null; renderLogin(e.offline ? 'No internet connection' : e.message); }
  };
  $('#lgo').onclick = go; $('#lpin').onkeydown = e => { if (e.key === 'Enter') go(); };
}

/* ---------- Data ---------- */
async function load(silent) {
  try {
    const d = await adminApi('adminData');
    d.activity = d.activity || []; d.settings = d.settings || {};
    const first = !A.data;
    const fresh = d.orders.filter(o => !A.seen.has(o.id));
    const freshAct = d.activity.filter(a => !A.seenAct.has(a.id) && ALERT_TYPES.includes(a.type) && !(a.type === 'admin_login' && a.phone === KKCore.digits(A.auth.phone)));
    if (!first && (fresh.length || freshAct.length)) {
      beep();
      freshAct.slice(0, 4).forEach(a => sysNotify((ACT_META[a.type] || ['•'])[0] + ' ' + (a.name || a.phone || 'Customer'), a.text));
      toast(fresh.length ? '🆕 ' + fresh.length + ' new order(s)!' : (ACT_META[freshAct[0].type] || ['•'])[0] + ' ' + (freshAct[0].name || '') + ' — ' + freshAct[0].text, 5000);
    }
    d.orders.forEach(o => A.seen.add(o.id)); lsSet('kk_admin_seen', [...A.seen].slice(-800));
    d.activity.forEach(a => A.seenAct.add(a.id)); lsSet('kk_admin_seen_act', [...A.seenAct].slice(-1500));
    A.data = d; A.loadedAt = Date.now();
    setSettings({ upiId: d.settings.upiId, upiName: d.settings.upiName });
    const typing = document.activeElement && document.activeElement.matches('input,textarea,select');
    if (!silent || (!typing && !$('#overlay'))) render();
  } catch (e) {
    if (e.server && /PIN/.test(e.message)) { lsSet('kk_admin_auth', null); A.auth = null; return renderLogin(e.message); }
    if (!silent) toast(e.offline ? 'Offline — showing last data' : e.message);
  }
}
function sysNotify(title, body) {
  try { if (Notification.permission === 'granted') navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification(title, { body, icon: 'icon-192.png' }) : new Notification(title, { body })); } catch (e) {}
}

/* ---------- Shell ---------- */
const NAV = [
  ['overview', '📊', 'Overview'], ['orders', '🧾', 'Orders'], ['customers', '👥', 'Customers'], ['activity', '⚡', 'Activity'],
  ['chat', '💬', 'Chat'], ['menu', '🍽️', 'Menu & stock'], ['money', '💰', 'Accounts'], ['analytics', '📈', 'Analysis'], ['settings', '⚙️', 'Settings']
];
const MOBILE_NAV = ['overview', 'orders', 'customers', 'activity'];
function counts() {
  const d = A.data;
  const th = chatThreads();
  return {
    orders: d.orders.filter(o => ACTIVE.includes(o.status)).length,
    newOrders: d.orders.filter(o => o.status === 'placed').length,
    chat: Object.values(th).filter(t => t[t.length - 1].from === 'customer').length
  };
}
function render() {
  const d = A.data; if (!d) return;
  document.body.className = 'adm';
  const c = counts();
  const badge = k => { const n = k === 'orders' ? c.newOrders || c.orders : k === 'chat' ? c.chat : 0; return n ? `<span class="nb ${k === 'orders' && c.newOrders ? 'red' : ''}">${n}</span>` : ''; };
  const title = (NAV.find(n => n[0] === A.tab) || NAV[0])[2];
  const y = window.scrollY;
  const view = { overview: renderOverview, orders: renderOrders, customers: renderCustomers, activity: renderActivity, menu: renderMenu, money: renderMoney, analytics: renderAnalytics, chat: renderChat, settings: renderSettings }[A.tab] || renderOverview;
  app.innerHTML = `
  ${DEMO ? '<div class="demo">Demo mode — connect the Google Sheet (config.js → API_URL) to go live.</div>' : ''}
  <div class="shell ${A.drawer ? 'open' : ''}">
    <aside class="side">
      <div class="brand"><span class="brand-mark">🌿</span><div><b>Keralam Kitchen</b><small>Admin</small></div></div>
      <nav>${NAV.map(([k, i, l]) => `<button class="${A.tab === k ? 'on' : ''}" data-a="tab" data-t="${k}"><span class="ni">${i}</span><span class="nl">${l}</span>${badge(k)}</button>`).join('')}</nav>
      <div class="side-foot">
        <div class="who">${avatar({ name: 'A' }, 30)}<div><b>${KKCore.digits(A.auth.phone)}</b><small>Signed in</small></div></div>
        <a class="b b-ghost b-sm b-full" href="index.html" target="_blank">↗ Open customer site</a>
        <button class="b b-ghost b-sm b-full" data-a="logout">⎋ Sign out</button>
      </div>
    </aside>
    <div class="scrim" data-a="drawer"></div>
    <div class="main">
      <header class="topbar">
        <button class="b b-icon hamb" data-a="drawer" aria-label="Menu">☰</button>
        <div class="tt"><h1>${title}</h1><small>${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · updated ${ago(A.loadedAt)}</small></div>
        <div class="sp"></div>
        <span class="live"><i></i>Live</span>
        ${A.tab === 'orders' || A.tab === 'overview' ? '<button class="b b-pri b-sm hide-xs" data-a="newPhoneOrder">＋ Phone order</button>' : ''}
        <button class="b b-icon" data-a="refresh" title="Refresh">⟳</button>
      </header>
      <section class="content">${view()}</section>
    </div>
    <nav class="bnav">${MOBILE_NAV.map(k => { const n = NAV.find(x => x[0] === k); return `<button class="${A.tab === k ? 'on' : ''}" data-a="tab" data-t="${k}"><b>${n[1]}</b>${n[2]}${badge(k)}</button>`; }).join('')}
      <button data-a="drawer"><b>☰</b>More${c.chat ? `<span class="nb">${c.chat}</span>` : ''}</button></nav>
  </div>`;
  window.scrollTo(0, y);
  const ch = $('#chat'); if (ch) ch.scrollTop = ch.scrollHeight;
}

/* ---------- Helpers ---------- */
const custOf = phone => A.data.customers.find(c => c.phone === phone);
const spentOf = phone => A.data.orders.filter(o => o.phone === phone && o.status === 'collected').reduce((s, o) => s + (o.total || 0), 0);
const kpi = (label, value, sub, tone) => `<div class="kpi ${tone || ''}"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
function actRow(a, compact) {
  const m = ACT_META[a.type] || ['•', a.type, ''];
  const c = custOf(a.phone);
  return `<div class="act">
    <span class="act-ic ${m[2]}">${m[0]}</span>
    <div class="act-b">
      <div><a href="#" class="act-who" data-a="${c ? 'openCustomer' : 'noop'}" data-p="${esc(a.phone)}">${esc(a.name || (a.phone ? a.phone : 'Guest visitor'))}</a> <span class="muted">· ${esc(m[1])}</span></div>
      <div class="act-t">${esc(a.text)}</div>
    </div>
    <span class="act-time" title="${fmtTime(a.at)}">${compact ? ago(a.at) : fmtTime(a.at)}</span>
  </div>`;
}
function openSheet(html, wide) {
  closeSheet();
  const o = document.createElement('div'); o.className = 'overlay center'; o.id = 'overlay';
  o.innerHTML = `<div class="sheet panel ${wide ? 'wide' : ''}">${html}</div>`; o.onclick = e => { if (e.target === o) closeSheet(); };
  document.body.appendChild(o); return o;
}
function closeSheet() { const o = $('#overlay'); if (o) o.remove(); }

/* ---------- Overview ---------- */
function renderOverview() {
  const d = A.data, t0 = todayStart();
  const todayOrders = d.orders.filter(o => o.createdAt >= t0 && o.status !== 'cancelled');
  const todayRev = d.orders.filter(o => o.status === 'collected' && (o.collectedAt || o.createdAt) >= t0).reduce((s, o) => s + o.total, 0);
  const pickupsToday = d.orders.filter(o => ACTIVE.includes(o.status) && o.pickupAt && new Date(o.pickupAt).toDateString() === new Date().toDateString()).sort((a, b) => a.pickupAt - b.pickupAt);
  const actToday = d.activity.filter(a => a.at >= t0);
  const visitors = new Set(actToday.filter(a => ['visit', 'login', 'signup'].includes(a.type)).map(a => a.phone || a.id)).size;
  const logins = actToday.filter(a => a.type === 'login').length;
  const signups = actToday.filter(a => a.type === 'signup').length;
  const stale = d.orders.filter(o => o.status === 'placed' && Date.now() - o.createdAt > 15 * MIN);
  const th = chatThreads(), waiting = Object.keys(th).filter(p => th[p][th[p].length - 1].from === 'customer');
  const forgot = d.activity.filter(a => a.type === 'forgot_pin' && a.at > Date.now() - DAY);
  const reviews = d.reviews.filter(r => !r.hidden);
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1) + '★' : '—';
  const attention = [
    ...stale.map(o => `<button class="att r" data-a="tab" data-t="orders">⏰ <b>${esc(o.id)}</b> from ${esc(o.name)} waiting ${Math.round((Date.now() - o.createdAt) / MIN)} min — accept it</button>`),
    ...waiting.map(p => `<button class="att b" data-a="openChat" data-p="${p}">💬 <b>${esc((th[p].find(m => m.from === 'customer') || {}).name || p)}</b> is waiting for a chat reply</button>`),
    ...forgot.map(a => `<button class="att y" data-a="openCustomer" data-p="${a.phone}">🔑 <b>${esc(a.name)}</b> forgot their PIN — tap to see it & send on WhatsApp</button>`)
  ];
  return `
  <div class="kpis">
    ${kpi('Orders today', todayOrders.length, d.orders.filter(o => o.status === 'placed').length + ' waiting to accept', 'tone-g')}
    ${kpi('Collected today', money(todayRev), 'cash + UPI received')}
    ${kpi('Active orders', d.orders.filter(o => ACTIVE.includes(o.status)).length, pickupsToday.length + ' pickups today')}
    ${kpi('Visitors today', visitors, logins + ' logins · ' + signups + ' new sign-ups', 'tone-b')}
    ${kpi('Customers', d.customers.length, d.customers.filter(c => c.pin).length + ' with accounts · ' + d.customers.filter(c => c.blocked).length + ' blocked')}
    ${kpi('Rating', avg, reviews.length + ' reviews', 'tone-y')}
  </div>
  <div class="grid2">
    <div class="pane">
      <div class="pane-h"><h3>Needs attention</h3>${attention.length ? `<span class="pill r">${attention.length}</span>` : ''}</div>
      ${attention.join('') || '<p class="empty">✅ All clear — nothing waiting on you.</p>'}
      <div class="pane-h" style="margin-top:18px"><h3>Today's pickups</h3><button class="b b-ghost b-sm" data-a="tab" data-t="orders">All orders →</button></div>
      ${pickupsToday.map(o => `<div class="pick"><span class="pick-t">${new Date(o.pickupAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
        <div style="flex:1"><b>${esc(o.name)}</b> <span class="muted small">Flat ${esc(o.flat)}</span><div class="small muted">${(o.items || []).map(l => esc(l.name) + ' ×' + l.qty).join(', ') || esc(o.customText || '')}</div></div>
        <span class="status s-${o.status}">${ST_LABEL[o.status]}</span></div>`).join('') || '<p class="empty">No pickups scheduled for today.</p>'}
    </div>
    <div class="pane">
      <div class="pane-h"><h3>Live activity</h3><button class="b b-ghost b-sm" data-a="tab" data-t="activity">See all →</button></div>
      <div class="act-list">${d.activity.slice(0, 14).map(a => actRow(a, true)).join('') || '<p class="empty">No activity yet. When customers visit, log in or order, it shows up here.</p>'}</div>
    </div>
  </div>`;
}

/* ---------- Orders ---------- */
function statusMsg(o) {
  const first = o.name.split(' ')[0];
  const m = {
    placed: `Hi ${first}, we received your order ${o.id} 🌿`,
    accepted: `Hi ${first}, your order ${o.id} is accepted ✅. Pickup: ${fmtTime(o.pickupAt)}.`,
    preparing: `Hi ${first}, we are preparing your order ${o.id} fresh for you 🍳`,
    ready: `Hi ${first}, your order ${o.id} is READY for pickup 🎉 Total ${money(o.total)}. See you at the door! 🌿`,
    collected: `Thank you for choosing Keralam Kitchen, ${first}! ❤️🌿\nOrder ${o.id} — paid ${money(o.total)} by ${o.payMethod || 'cash'}.\nPlease share your feedback (opens 40 min after pickup): ${siteBase()}#review=${o.id}`,
    cancelled: `Hi ${first}, your order ${o.id} has been cancelled. ${o.cancelReason || ''} Please contact us for any help 🌿`
  };
  return m[o.status] + '\n\n' + KKCore.orderText(o);
}
function orderCard(o) {
  const age = Math.round((Date.now() - o.createdAt) / MIN);
  const stale = o.status === 'placed' && age >= 15;
  const next = { placed: ['accepted', '✅ Accept'], accepted: ['preparing', '🍳 Start preparing'], preparing: ['ready', '🎉 Mark ready'], ready: ['collected', '🤝 Collected'] }[o.status];
  const reviewAt = KKCore.reviewOpensAt(o);
  const cu = custOf(o.phone);
  return `<div class="ocard ${stale ? 'stale' : ''}">
    <div class="oc-h"><div><b class="oid">${esc(o.id)}</b> <span class="status s-${o.status}">${ST_LABEL[o.status]}</span></div><b class="amt">${money(o.total)}</b></div>
    ${stale ? `<div class="pill r" style="margin:6px 0">⏰ Waiting ${age} min — please accept</div>` : ''}
    <div class="oc-c"><a href="#" data-a="${cu ? 'openCustomer' : 'noop'}" data-p="${o.phone}" class="row" style="gap:8px;text-decoration:none;color:inherit;flex-wrap:nowrap">${avatar(cu || o, 30)}<span><b>${esc(o.name)}</b> <span class="muted">· Flat ${esc(o.flat)}</span><br><span class="small muted">${esc(o.phone)}</span></span></a>
      ${o.source !== 'web' ? `<span class="pill">${esc(o.source)}</span>` : ''}</div>
    <div class="oc-m"><span>🕑 Pickup <b>${o.pickupAt ? fmtTime(o.pickupAt) : '—'}</b></span><span class="muted">Placed ${ago(o.createdAt)}</span></div>
    <div class="oc-items">${o.type === 'custom' ? `✨ <b>Custom:</b> ${esc(o.customText)}${o.customPhoto ? `<br><a href="${esc(o.customPhoto)}" target="_blank"><img src="${esc(o.customPhoto)}" class="photo-prev"></a>` : ''}` :
      (o.items || []).map(l => `<div class="row between" style="flex-wrap:nowrap"><span>${esc(l.name)} <span class="muted">${esc(l.variant)}${l.addons.length ? ' + ' + esc(l.addons.join(', ')) : ''}</span> × <b>${l.qty}</b></span><span>${money(l.amount)}</span></div>`).join('')}</div>
    ${o.notes ? `<div class="note-box">📝 ${esc(o.notes)}</div>` : ''}
    ${o.adminNote ? `<div class="small muted">🔒 ${esc(o.adminNote)}</div>` : ''}
    <div class="small" style="margin-top:6px">${o.pay === 'now' ? '💳 Pay now (UPI)' : '💵 Pay at pickup'} · <b class="${o.payStatus === 'paid' ? 'txt-g' : 'txt-y'}">${esc(o.payStatus === 'paid' ? 'PAID ' + (o.payMethod || '').toUpperCase() : 'Due')}</b></div>
    <div class="oc-a">
      ${next ? (next[0] === 'collected' ? `<button class="b b-pri b-sm" data-a="collect" data-id="${o.id}">${next[1]}</button>` : `<button class="b b-pri b-sm" data-a="setStatus" data-id="${o.id}" data-s="${next[0]}">${next[1]}</button>`) : ''}
      <a class="b b-wa b-sm" href="${waLink(o.phone, statusMsg(o))}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="b b-ghost b-sm" href="sms:+91${o.phone}?body=${encodeURIComponent(statusMsg(o))}">SMS</a>
      <a class="b b-ghost b-sm" href="${telLink(o.phone)}">📞</a>
      ${['cancelled', 'collected'].includes(o.status) ? '' : `<button class="b b-ghost b-sm" data-a="editOrder" data-id="${o.id}">✏️ Edit</button><button class="b b-dan b-sm" data-a="adminCancel" data-id="${o.id}">Cancel</button>`}
      ${o.status === 'collected' && !o.reviewed ? (Date.now() >= reviewAt
        ? `<a class="b b-gold b-sm" href="${waLink(o.phone, `Hi ${o.name.split(' ')[0]} 🌿 How was your food? Please rate us here: ${siteBase()}#review=${o.id} ⭐`)}" target="_blank">⭐ Ask review</a>`
        : `<span class="small muted">⭐ Review link at ${new Date(reviewAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>`) : ''}
    </div>
  </div>`;
}
function renderOrders() {
  const all = A.data.orders, today = new Date().toDateString();
  const f = {
    active: o => ACTIVE.includes(o.status),
    today: o => new Date(o.pickupAt || o.createdAt).toDateString() === today,
    tomorrow: o => new Date(o.pickupAt || 0).toDateString() === new Date(Date.now() + DAY).toDateString() && o.status !== 'cancelled',
    collected: o => o.status === 'collected', cancelled: o => o.status === 'cancelled', all: () => true
  };
  let list = all.filter(f[A.filter]);
  if (A.filter === 'active') list = list.sort((a, b) => (a.status === 'placed' ? 0 : 1) - (b.status === 'placed' ? 0 : 1) || (a.pickupAt || a.createdAt) - (b.pickupAt || b.createdAt));
  const prep = {};
  all.filter(f.active).forEach(o => (o.items || []).forEach(l => { const k = l.name + ' — ' + l.variant + (l.addons.length ? ' + ' + l.addons.join(', ') : ''); prep[k] = (prep[k] || 0) + l.qty; }));
  return `
  <div class="toolbar">
    <div class="tabs-s">${Object.keys(f).map(k => `<button class="${A.filter === k ? 'on' : ''}" data-a="filter" data-f="${k}">${k[0].toUpperCase() + k.slice(1)} <span>${all.filter(f[k]).length}</span></button>`).join('')}</div>
    <button class="b b-pri b-sm" data-a="newPhoneOrder">＋ Phone / WhatsApp order</button>
  </div>
  ${Object.keys(prep).length && A.filter === 'active' ? `<div class="pane prep"><b>👩‍🍳 To prepare (all active orders)</b><div class="prep-g">${Object.entries(prep).map(([k, q]) => `<div><span>${esc(k)}</span><b>${q}</b></div>`).join('')}</div></div>` : ''}
  <div class="ogrid">${list.map(orderCard).join('') || '<div class="pane empty">No orders here.</div>'}</div>`;
}
function itemsEditor(items) {
  const menu = A.data.menu;
  return `<div id="lines">${(items.length ? items : [{ id: menu[0].id, v: 0, addonIdx: [], qty: 1 }]).map(l => lineRow(l)).join('')}</div>
    <button class="b b-ghost b-sm" data-a="addLine">＋ Add item</button>`;
}
function lineRow(l) {
  const menu = A.data.menu;
  const m = menu.find(x => x.id === l.id) || menu[0];
  return `<div class="row lineRow" style="margin:6px 0;gap:6px">
    <select class="inp" style="flex:2" data-k="item">${menu.map(x => `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <select class="inp" style="flex:1.2" data-k="v">${m.variants.map((v, i) => `<option value="${i}" ${+l.v === i ? 'selected' : ''}>${esc(v.label)} ₹${v.price}</option>`).join('')}</select>
    ${m.addons.length ? `<select class="inp" style="flex:1" data-k="addon"><option value="">no extra</option>${m.addons.map((a, i) => `<option value="${i}" ${(l.addonIdx || []).includes(i) ? 'selected' : ''}>+${esc(a.label)}</option>`).join('')}</select>` : ''}
    <input class="inp" style="width:70px;flex:none" type="number" min="0" data-k="qty" value="${l.qty}">
  </div>`;
}
function readLines() {
  return $$('.lineRow').map(r => ({ id: $('[data-k=item]', r).value, v: +$('[data-k=v]', r).value, addons: $('[data-k=addon]', r) && $('[data-k=addon]', r).value !== '' ? [+$('[data-k=addon]', r).value] : [], qty: +$('[data-k=qty]', r).value }))
    .filter(l => l.qty > 0);
}
const toLocalInput = ts => { if (!ts) return ''; const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

/* ---------- Customers ---------- */
function renderCustomers() {
  const q = A.search.toLowerCase();
  const sorters = { recent: (a, b) => (b.lastSeen || b.lastAt || 0) - (a.lastSeen || a.lastAt || 0), visits: (a, b) => (b.visits || 0) - (a.visits || 0), orders: (a, b) => (b.orders || 0) - (a.orders || 0), name: (a, b) => String(a.name).localeCompare(b.name) };
  const list = A.data.customers.filter(c => !q || [c.name, c.flat, c.phone].join(' ').toLowerCase().includes(q)).sort(sorters[A.custSort]);
  return `
  <div class="toolbar">
    <input class="inp search" id="cSearch" placeholder="🔍 Search name, flat or phone" value="${esc(A.search)}">
    <select class="inp" id="cSort" style="max-width:180px">${[['recent', 'Last active'], ['visits', 'Most visits'], ['orders', 'Most orders'], ['name', 'Name A–Z']].map(([k, l]) => `<option value="${k}" ${A.custSort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <button class="b b-pri b-sm" data-a="editCustomer">＋ Add customer</button>
  </div>
  <p class="small muted">${list.length} customers · tap a row to see PIN, visits, orders and all their activity. Details are private — used only for order contact.</p>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Customer</th><th>Flat</th><th>Phone</th><th>PIN</th><th class="n">Visits</th><th class="n">Orders</th><th class="n">Spent</th><th>Last active</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(c => `<tr class="click" data-a="openCustomer" data-p="${c.phone}">
      <td><div class="row" style="gap:8px;flex-wrap:nowrap">${avatar(c, 30)}<b>${esc(c.name)}</b></div></td>
      <td>${esc(c.flat)}</td><td>${esc(c.phone)}</td>
      <td>${c.pin ? `<span class="pin" data-pin="${esc(c.pin)}">••••</span>` : '<span class="muted small">no account</span>'}</td>
      <td class="n">${c.visits || 0}</td><td class="n">${c.orders || 0}</td><td class="n">${money(spentOf(c.phone))}</td>
      <td>${ago(c.lastSeen || c.lastAt)}</td>
      <td>${c.blocked ? '<span class="pill r">Blocked</span>' : c.pin ? '<span class="pill g">Active</span>' : '<span class="pill">Guest</span>'}</td>
      <td class="n" style="white-space:nowrap"><a class="b b-wa b-xs" href="${waLink(c.phone, 'Hi ' + c.name + ' 🌿 — Keralam Kitchen')}" target="_blank" data-stop="1">WA</a></td>
    </tr>`).join('') || '<tr><td colspan="10" class="empty">No customers yet.</td></tr>'}</tbody>
  </table></div>`;
}
function openCustomer(phone) {
  const c = custOf(phone); if (!c) return;
  const orders = A.data.orders.filter(o => o.phone === phone);
  const acts = A.data.activity.filter(a => a.phone === phone);
  const pinMsg = `Hi ${c.name.split(' ')[0]} 🌿 Your Keralam Kitchen login PIN is ${c.pin}. Please keep it private. ${siteBase()}`;
  openSheet(`
    <div class="row between" style="flex-wrap:nowrap"><div class="row" style="gap:12px;flex-wrap:nowrap">${avatar(c, 56)}<div><h2 style="margin:0">${esc(c.name)}</h2><div class="muted">Flat ${esc(c.flat)} · ${esc(c.phone)}</div></div></div>
      <button class="b b-icon" data-a="close">✕</button></div>
    ${c.blocked ? `<div class="pill r" style="margin-top:10px">⛔ Blocked${c.blockReason ? ' — ' + esc(c.blockReason) : ''}</div>` : ''}
    <div class="kpis mini" style="margin-top:14px">
      ${kpi('Login PIN', c.pin ? `<span class="pin big" data-pin="${esc(c.pin)}">••••</span>` : '—', c.pin ? 'tap to show' : 'no account yet')}
      ${kpi('Visits', c.visits || 0, (c.logins || 0) + ' logins')}
      ${kpi('Orders', c.orders || 0, money(spentOf(phone)) + ' spent')}
      ${kpi('Last active', ago(c.lastSeen || c.lastAt), 'since ' + new Date(c.firstAt || Date.now()).toLocaleDateString('en-IN'))}
    </div>
    ${c.note ? `<div class="note-box">📝 ${esc(c.note)}</div>` : ''}
    <div class="oc-a" style="margin-top:12px">
      <a class="b b-wa b-sm" href="${waLink(phone, 'Hi ' + c.name + ' 🌿 — Keralam Kitchen')}" target="_blank">WhatsApp</a>
      <a class="b b-ghost b-sm" href="${telLink(phone)}">📞 Call</a>
      ${c.pin ? `<a class="b b-ghost b-sm" href="${waLink(phone, pinMsg)}" target="_blank">🔑 Send PIN on WhatsApp</a>` : ''}
      <button class="b b-ghost b-sm" data-a="newPhoneOrder" data-phone="${phone}">＋ New order</button>
      <button class="b b-ghost b-sm" data-a="editCustomer" data-p="${phone}">✏️ Edit</button>
      <button class="b ${c.blocked ? 'b-pri' : 'b-dan'} b-sm" data-a="blockCustomer" data-p="${phone}" data-b="${c.blocked ? '' : 1}">${c.blocked ? '✅ Unblock' : '⛔ Block'}</button>
      <button class="b b-dan b-sm" data-a="deleteCustomer" data-p="${phone}">🗑 Delete</button>
    </div>
    <div class="grid2" style="margin-top:14px">
      <div><h3>Orders (${orders.length})</h3>${orders.slice(0, 10).map(o => `<div class="pick"><div style="flex:1"><b>${esc(o.id)}</b> <span class="muted small">${fmtTime(o.createdAt)}</span><div class="small muted">${(o.items || []).map(l => esc(l.name) + ' ×' + l.qty).join(', ') || esc(o.customText || '')}</div></div><b>${money(o.total)}</b> <span class="status s-${o.status}">${ST_LABEL[o.status]}</span></div>`).join('') || '<p class="empty">No orders yet.</p>'}</div>
      <div><h3>Activity (${acts.length})</h3><div class="act-list">${acts.slice(0, 25).map(a => actRow(a, true)).join('') || '<p class="empty">No activity yet.</p>'}</div></div>
    </div>`, true);
}
let editPhoto;
function editCustomer(phone) {
  const c = (phone && custOf(phone)) || { name: '', flat: '', phone: '', pin: '', note: '', blocked: false };
  editPhoto = undefined;
  openSheet(`<div class="row between"><h2 style="margin:0">${phone ? 'Edit customer' : 'Add customer'}</h2><button class="b b-icon" data-a="close">✕</button></div>
    <div class="row" style="margin-top:12px;gap:12px"><span id="ecPrev">${avatar(c, 56)}</span><label class="b b-ghost b-sm">📷 Photo<input type="file" accept="image/*" id="ecPhoto" hidden></label>${c.photo ? '<button class="b b-ghost b-sm" data-a="ecNoPhoto">Remove</button>' : ''}</div>
    <div class="form2">
      <div><label class="lbl">Name *</label><input class="inp" id="ecName" value="${esc(c.name)}"></div>
      <div><label class="lbl">Flat *</label><input class="inp" id="ecFlat" value="${esc(c.flat)}"></div>
      <div><label class="lbl">Mobile *</label><input class="inp" id="ecPhone" inputmode="numeric" value="${esc(c.phone)}"></div>
      <div><label class="lbl">Login PIN (4–6 digits)</label><input class="inp" id="ecPin" inputmode="numeric" maxlength="6" value="${esc(c.pin || '')}" placeholder="leave empty = no login"></div>
    </div>
    <label class="lbl">Private note</label><input class="inp" id="ecNote" value="${esc(c.note || '')}" placeholder="e.g. prefers less spicy">
    <label class="sw" style="margin-top:12px"><input type="checkbox" id="ecBlocked" ${c.blocked ? 'checked' : ''}> ⛔ Blocked (cannot log in or order)</label>
    <div class="row" style="margin-top:16px"><button class="b b-pri" style="flex:1" data-a="saveCustomer" data-orig="${esc(phone || '')}">Save</button><button class="b b-ghost" data-a="close">Cancel</button></div>`);
  $('#ecPhoto').onchange = async e => { const f = e.target.files[0]; if (!f) return; editPhoto = await fileToDataUrl(f, 400); $('#ecPrev').innerHTML = `<img class="av" src="${editPhoto}" style="width:56px;height:56px">`; };
}
function phoneOrderSheet(phone) {
  const c = (phone && custOf(phone)) || {};
  openSheet(`<div class="row between"><h2 style="margin:0">New order (phone / WhatsApp)</h2><button class="b b-icon" data-a="close">✕</button></div>
    <div class="form2 f3">
      <div><label class="lbl">Name</label><input class="inp" id="poName" value="${esc(c.name || '')}"></div>
      <div><label class="lbl">Flat</label><input class="inp" id="poFlat" value="${esc(c.flat || '')}"></div>
      <div><label class="lbl">Mobile</label><input class="inp" id="poPhone" inputmode="numeric" value="${esc(c.phone || '')}"></div>
    </div>
    <label class="lbl">Items</label>${itemsEditor([])}
    <div class="form2">
      <div><label class="lbl">Pickup</label><input class="inp" type="datetime-local" id="poPick" value="${toLocalInput(Date.now() + 60 * MIN)}"></div>
      <div><label class="lbl">Source</label><select class="inp" id="poSrc"><option value="phone">Phone call</option><option value="whatsapp">WhatsApp</option><option value="walk-in">Walk-in</option></select></div>
    </div>
    <label class="lbl">Notes</label><input class="inp" id="poNotes">
    <div class="row" style="margin-top:16px"><button class="b b-pri" style="flex:1" data-a="savePhoneOrder">Create order</button><button class="b b-ghost" data-a="close">Cancel</button></div>`, true);
}

/* ---------- Activity ---------- */
function renderActivity() {
  const q = A.actSearch.toLowerCase(), f = ACT_FILTERS[A.actFilter][1];
  const list = A.data.activity.filter(f).filter(a => !q || [a.name, a.phone, a.text].join(' ').toLowerCase().includes(q));
  const t0 = todayStart(), today = A.data.activity.filter(a => a.at >= t0);
  return `
  <div class="kpis">
    ${kpi('Events today', today.length, '')}
    ${kpi('Visits today', today.filter(a => a.type === 'visit').length, new Set(today.filter(a => a.type === 'visit' && a.phone).map(a => a.phone)).size + ' known customers')}
    ${kpi('Logins today', today.filter(a => a.type === 'login').length, today.filter(a => a.type === 'signup').length + ' new sign-ups', 'tone-g')}
    ${kpi('Cart adds today', today.filter(a => a.type === 'cart').length, today.filter(a => a.type === 'order').length + ' orders placed', 'tone-b')}
    ${kpi('Security', today.filter(a => ['wrong_pin', 'forgot_pin', 'blocked', 'admin_fail'].includes(a.type)).length, 'wrong PIN / forgot / blocked', 'tone-y')}
  </div>
  <div class="toolbar">
    <div class="tabs-s">${Object.entries(ACT_FILTERS).map(([k, [l, fn]]) => `<button class="${A.actFilter === k ? 'on' : ''}" data-a="actFilter" data-f="${k}">${l} <span>${A.data.activity.filter(fn).length}</span></button>`).join('')}</div>
    <input class="inp search" id="aSearch" placeholder="🔍 Search" value="${esc(A.actSearch)}" style="max-width:240px">
  </div>
  <div class="pane"><div class="act-list">${list.slice(0, 300).map(a => actRow(a)).join('') || '<p class="empty">No activity matches.</p>'}</div></div>
  <p class="small muted">Showing the latest ${Math.min(300, list.length)} events. Every event is also saved in the Google Sheet → “activity” tab.</p>`;
}

/* ---------- Menu ---------- */
function renderMenu() {
  return `
  <div class="toolbar"><p class="small muted" style="margin:0;flex:1">Untick <b>In stock</b> and customers see “Fresh batch tomorrow — order now 🌿” (never “out of stock”). <b>Always available</b> items (like roti) ignore stock.</p>
    <button class="b b-pri b-sm" data-a="editItem">＋ New dish</button></div>
  <div class="mgrid">${A.data.menu.map(m => `<div class="pane mcard">
    <div class="row" style="flex-wrap:nowrap;align-items:flex-start"><div class="mimg">${m.img ? `<img src="${esc(m.img)}">` : esc(m.emoji || '🍽️')}</div>
      <div style="flex:1"><b>${esc(m.name)}</b>${m.hidden ? ' <span class="pill">hidden</span>' : ''}${!m.inStock && !m.alwaysAvailable ? ' <span class="pill y">tomorrow</span>' : ''}
      <div class="small muted">${m.variants.map(v => `${esc(v.label)} ₹${v.price}${v.cost ? ' (cost ₹' + v.cost + ')' : ''}`).join(' · ')}</div>
      <div class="small muted">Ready in ${m.leadMins >= 1440 ? 'next day' : (m.leadMins || 0) + ' min'}</div></div>
      <button class="b b-ghost b-sm" data-a="editItem" data-id="${m.id}">✏️</button></div>
    <div class="row" style="margin-top:10px;gap:16px">
      <label class="sw"><input type="checkbox" data-a="toggle" data-id="${m.id}" data-k="inStock" ${m.inStock ? 'checked' : ''}> In stock</label>
      <label class="sw"><input type="checkbox" data-a="toggle" data-id="${m.id}" data-k="alwaysAvailable" ${m.alwaysAvailable ? 'checked' : ''}> Always available</label>
      <label class="sw"><input type="checkbox" data-a="toggle" data-id="${m.id}" data-k="hidden" ${m.hidden ? 'checked' : ''}> Hide</label>
    </div>
    ${m.prep ? `<div class="small" style="margin-top:6px">👩‍🍳 Prep: ${esc(m.prep)}</div>` : ''}
  </div>`).join('')}</div>`;
}
function editItem(id) {
  const m = A.data.menu.find(x => x.id === id) || { name: '', emoji: '🍽️', img: '', desc: '', tags: [], variants: [{ label: '1 plate', price: 50, cost: 0 }], addons: [], inStock: true, leadMins: 0, prep: '', sort: A.data.menu.length + 1 };
  const vtxt = arr => arr.map(v => `${v.label} | ${v.price} | ${v.cost || 0}`).join('\n');
  openSheet(`<div class="row between"><h2 style="margin:0">${id ? 'Edit' : 'New'} dish</h2><button class="b b-icon" data-a="close">✕</button></div>
    <div class="form2"><div><label class="lbl">Name</label><input class="inp" id="iName" value="${esc(m.name)}"></div>
      <div><label class="lbl">Emoji</label><input class="inp" id="iEmoji" value="${esc(m.emoji || '')}"></div>
      <div><label class="lbl">Ready in (minutes, 1440 = next day)</label><input class="inp" id="iLead" type="number" value="${m.leadMins || 0}"></div>
      <div><label class="lbl">Sort order</label><input class="inp" id="iSort" type="number" value="${m.sort || 0}"></div></div>
    <label class="lbl">Photo</label><div class="row"><input class="inp" id="iImg" style="flex:1" value="${esc(m.img || '')}" placeholder="image link or upload →"><label class="b b-ghost b-sm">📷<input type="file" accept="image/*" id="iFile" hidden></label></div>
    <label class="lbl">Description</label><input class="inp" id="iDesc" value="${esc(m.desc || '')}">
    <label class="lbl">Tags (comma separated)</label><input class="inp" id="iTags" value="${esc((m.tags || []).join(', '))}">
    <label class="lbl">Sizes — one per line: <code>label | price | your cost</code></label><textarea class="inp" id="iVar">${esc(vtxt(m.variants))}</textarea>
    <label class="lbl">Extras — one per line: <code>label | price | cost</code></label><textarea class="inp" id="iAdd">${esc(vtxt(m.addons || []))}</textarea>
    <label class="lbl">Preparation details (only admins see this)</label><textarea class="inp" id="iPrep">${esc(m.prep || '')}</textarea>
    <div class="row" style="margin-top:16px"><button class="b b-pri" style="flex:1" data-a="saveItem" data-id="${id || ''}">Save</button>
      ${id ? `<button class="b b-dan" data-a="deleteItem" data-id="${id}">Delete</button>` : ''}<button class="b b-ghost" data-a="close">Close</button></div>`, true);
  $('#iFile').onchange = async e => { const f = e.target.files[0]; if (f) { $('#iImg').value = await fileToDataUrl(f, 700); toast('Photo ready — press Save'); } };
}
const parseLines = txt => txt.split('\n').map(l => l.split('|').map(s => s.trim())).filter(p => p[0]).map(p => ({ label: p[0], price: +p[1] || 0, cost: +p[2] || 0 }));

/* ---------- Money / accounts ---------- */
function inRange(ts) { return ts >= startOf(A.from) && ts < startOf(A.to) + DAY; }
function rangeBar() {
  return `<div class="toolbar"><div class="row" style="gap:8px"><input class="inp" type="date" id="rFrom" value="${A.from}"><span class="muted">→</span><input class="inp" type="date" id="rTo" value="${A.to}"></div>
    <button class="b b-ghost b-sm" data-a="range30">Last 30 days</button></div>`;
}
function moneyStats() {
  const orders = A.data.orders.filter(o => inRange(o.createdAt));
  const done = orders.filter(o => o.status === 'collected');
  const revenue = done.reduce((s, o) => s + o.total, 0);
  const cash = done.filter(o => o.payMethod === 'cash').reduce((s, o) => s + o.total, 0);
  const upi = done.filter(o => o.payMethod === 'upi').reduce((s, o) => s + o.total, 0);
  const itemCost = done.reduce((s, o) => s + (o.items || []).reduce((a, l) => a + (l.unitCost || 0) * l.qty, 0), 0);
  const exps = A.data.expenses.filter(e => inRange(startOf(e.date)));
  const expTotal = exps.reduce((s, e) => s + e.amount, 0);
  const pending = A.data.orders.filter(o => ACTIVE.includes(o.status)).reduce((s, o) => s + o.total, 0);
  const perItem = {};
  done.forEach(o => (o.items || []).forEach(l => { const k = l.name + ' (' + l.variant + ')'; const p = perItem[k] = perItem[k] || { qty: 0, rev: 0, cost: 0 }; p.qty += l.qty; p.rev += l.amount; p.cost += (l.unitCost || 0) * l.qty; }));
  return { orders, done, revenue, cash, upi, itemCost, exps, expTotal, pending, perItem, net: revenue - itemCost - expTotal };
}
function renderMoney() {
  const s = moneyStats();
  return `${rangeBar()}
  <div class="kpis">
    ${kpi('Money received', money(s.revenue), s.done.length + ' collected orders', 'tone-g')}
    ${kpi('Cash', money(s.cash), '')}${kpi('UPI', money(s.upi), '')}
    ${kpi('Ingredient cost', money(s.itemCost), 'from item costs')}
    ${kpi('Expenses', money(s.expTotal), s.exps.length + ' entries')}
    ${kpi('Net profit', `<span style="color:${s.net >= 0 ? 'var(--a-g)' : 'var(--a-r)'}">${money(s.net)}</span>`, '', s.net >= 0 ? 'tone-g' : 'tone-r')}
    ${kpi('Pending', money(s.pending), 'active orders')}
  </div>
  <div class="grid2">
    <div class="pane"><h3>Per item</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th class="n">Sold</th><th class="n">Sales</th><th class="n">Cost</th><th class="n">Profit</th></tr></thead><tbody>
      ${Object.entries(s.perItem).map(([k, p]) => `<tr><td>${esc(k)}</td><td class="n">${p.qty}</td><td class="n">${money(p.rev)}</td><td class="n">${money(p.cost)}</td><td class="n">${money(p.rev - p.cost)}</td></tr>`).join('') || '<tr><td colspan=5 class="empty">No collected orders in range</td></tr>'}</tbody></table></div>
      <p class="small muted">Set “your cost” per size in Menu → ✏️ to get per-item profit.</p></div>
    <div class="pane"><h3>＋ Add expense / stock purchase</h3>
      <div class="form2"><div><label class="lbl">Date</label><input class="inp" type="date" id="eDate" value="${fmtDate(Date.now())}"></div>
        <div><label class="lbl">Category</label><select class="inp" id="eCat">${['Rice', 'Urad dal', 'Dal', 'Coconut', 'Wheat flour (atta)', 'Garlic', 'Butter / Cheese', 'Oil', 'Gas', 'Packaging', 'Electricity', 'Other'].map(c => `<option>${c}</option>`).join('')}</select></div>
        <div><label class="lbl">Qty / note</label><input class="inp" id="eQty" placeholder="5 kg → 12 kg batter"></div>
        <div><label class="lbl">₹ Amount</label><input class="inp" id="eAmt" type="number"></div></div>
      <button class="b b-pri b-sm" style="margin-top:10px" data-a="saveExpense">Add expense</button>
      <div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Date</th><th>Item</th><th>Qty / note</th><th class="n">₹</th><th></th></tr></thead><tbody>
      ${s.exps.sort((a, b) => b.date.localeCompare(a.date)).map(e => `<tr><td>${e.date}</td><td>${esc(e.category)}</td><td>${esc(e.qty || '')}</td><td class="n">${money(e.amount)}</td><td class="n"><button class="b b-dan b-xs" data-a="delExpense" data-id="${e.id}">✕</button></td></tr>`).join('') || '<tr><td colspan=5 class="empty">No expenses in range</td></tr>'}</tbody></table></div></div>
  </div>`;
}

/* ---------- Analytics ---------- */
function renderAnalytics() {
  const s = moneyStats(), orders = s.orders;
  const cancelled = orders.filter(o => o.status === 'cancelled');
  const reviews = A.data.reviews.filter(r => inRange(r.at));
  const avgStars = reviews.length ? reviews.reduce((a, r) => a + r.stars, 0) / reviews.length : 0;
  const days = Math.max(1, Math.round((startOf(A.to) - startOf(A.from)) / DAY) + 1);
  const daily = [];
  for (let i = 0; i < days; i++) { const d0 = startOf(A.from) + i * DAY; const os = orders.filter(o => o.createdAt >= d0 && o.createdAt < d0 + DAY); const vis = A.data.activity.filter(a => a.type === 'visit' && a.at >= d0 && a.at < d0 + DAY).length; daily.push({ d: d0, n: os.filter(o => o.status !== 'cancelled').length, c: os.filter(o => o.status === 'cancelled').length, rev: os.filter(o => o.status === 'collected').reduce((a, o) => a + o.total, 0), vis }); }
  const maxN = Math.max(1, ...daily.map(x => x.n + x.c));
  const wd = Array.from({ length: 7 }, () => ({ days: 0, orders: 0, items: {} }));
  daily.forEach(x => wd[new Date(x.d).getDay()].days++);
  orders.filter(o => o.status !== 'cancelled').forEach(o => { const w = wd[new Date(o.createdAt).getDay()]; w.orders++; (o.items || []).forEach(l => { const k = l.name + ' (' + l.variant + ')'; w.items[k] = (w.items[k] || 0) + l.qty; }); });
  const tmr = new Date(Date.now() + DAY), w = wd[tmr.getDay()];
  const expTomorrow = w.days ? w.orders / w.days : 0;
  const weekExp = wd.reduce((a, x) => a + (x.days ? x.orders / x.days : 0), 0);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const top = Object.entries(s.perItem).sort((a, b) => b[1].qty - a[1].qty);
  const repeat = A.data.customers.filter(c => (c.orders || 0) > 1).length;
  const visits = daily.reduce((a, x) => a + x.vis, 0);
  return `${rangeBar()}
  <div class="kpis">
    ${kpi('Orders received', orders.filter(o => o.status !== 'cancelled').length, s.done.length + ' completed', 'tone-g')}
    ${kpi('Cancelled', cancelled.length, (orders.length ? Math.round(cancelled.length / orders.length * 100) : 0) + '% of orders', 'tone-r')}
    ${kpi('Money received', money(s.revenue), 'avg ' + money(s.done.length ? s.revenue / s.done.length : 0) + ' / order')}
    ${kpi('Avg stars', avgStars ? avgStars.toFixed(1) + '★' : '—', reviews.length + ' reviews', 'tone-y')}
    ${kpi('Website visits', visits, visits ? Math.round(orders.length / visits * 100) + '% became orders' : '', 'tone-b')}
    ${kpi('Repeat customers', repeat, 'ordered 2+ times')}
  </div>
  <div class="pane"><div class="pane-h"><h3>Orders per day</h3><span class="small muted"><i class="lg g"></i>orders <i class="lg r"></i>cancelled</span></div>
    <div class="bars">${daily.map(x => `<div class="bar" title="${new Date(x.d).toLocaleDateString('en-IN')} — ${x.n} orders, ${x.c} cancelled, ${money(x.rev)}, ${x.vis} visits"><i class="c" style="height:${(x.c / maxN) * 100}%"></i><i style="height:${(x.n / maxN) * 100}%"></i></div>`).join('')}</div>
    <div class="row between small muted"><span>${A.from}</span><span>${A.to}</span></div></div>
  <div class="grid2">
    <div class="pane"><h3>🔮 Prediction</h3>
      <p>Tomorrow (<b>${names[tmr.getDay()]}</b>): about <b>${expTomorrow.toFixed(1)}</b> orders · Next 7 days: about <b>${Math.round(weekExp)}</b>.</p>
      ${Object.keys(w.items).length ? `<p><b>Suggested prep for tomorrow:</b><br>${Object.entries(w.items).sort((a, b) => b[1] - a[1]).map(([k, q]) => `${esc(k)}: ~${Math.ceil(q / w.days)}`).join('<br>')}</p>` : '<p class="muted small">Needs a few weeks of orders to predict per-item quantities.</p>'}
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Day</th>${names.map(n => `<th class="n">${n}</th>`).join('')}</tr></thead><tbody><tr><td>Avg orders</td>${wd.map(x => `<td class="n">${x.days ? (x.orders / x.days).toFixed(1) : '—'}</td>`).join('')}</tr></tbody></table></div></div>
    <div class="pane"><h3>🏆 Best sellers</h3>${top.map(([k, p], i) => `<div class="pick"><span class="pick-t">#${i + 1}</span><span style="flex:1">${esc(k)}</span><b>${p.qty} · ${money(p.rev)}</b></div>`).join('') || '<p class="empty">No data yet.</p>'}</div>
  </div>
  <div class="pane"><h3>⭐ Reviews</h3>${reviews.sort((a, b) => b.at - a.at).map(r => `<div class="review"><div class="row between"><b>${esc(r.name)} <span class="small muted">${esc(r.phone || '')}</span></b><span class="stars">${'★'.repeat(r.stars)}</span></div>
    <div class="small muted">${esc(r.itemName)} · ${fmtTime(r.at)} ${r.orderId ? '· ' + esc(r.orderId) : ''}</div>${esc(r.text)}${r.photo ? `<img src="${esc(r.photo)}">` : ''}
    <div><button class="b b-ghost b-xs" data-a="hideReview" data-id="${r.id}">${r.hidden ? '👁 Show on site' : '🙈 Hide from site'}</button></div></div>`).join('') || '<p class="empty">No reviews in range.</p>'}</div>`;
}

/* ---------- Chat ---------- */
function chatThreads() { const th = {}; (A.data.chats || []).sort((a, b) => a.at - b.at).forEach(m => (th[m.phone] = th[m.phone] || []).push(m)); return th; }
function renderChat() {
  const th = chatThreads(), phones = Object.keys(th).sort((a, b) => th[b][th[b].length - 1].at - th[a][th[a].length - 1].at);
  const cur = A.chatPhone && th[A.chatPhone] ? A.chatPhone : null;
  const list = phones.map(p => { const last = th[p][th[p].length - 1], c = custOf(p) || { name: (th[p].find(m => m.from === 'customer') || {}).name || p };
    return `<button class="thread ${cur === p ? 'on' : ''}" data-a="openChat" data-p="${p}">${avatar(c, 36)}<div style="flex:1;min-width:0"><div class="row between" style="flex-wrap:nowrap"><b>${esc(c.name)}</b><small class="muted">${ago(last.at)}</small></div><div class="small muted ell">${esc(last.text)}</div></div>${last.from === 'customer' ? '<span class="dotn"></span>' : ''}</button>`; }).join('');
  let conv = '<div class="empty" style="padding:40px">Select a conversation</div>';
  if (cur) {
    const msgs = th[cur], c = custOf(cur) || { name: (msgs.find(m => m.from === 'customer') || {}).name || cur };
    conv = `<div class="conv-h"><button class="b b-icon only-m" data-a="chatBack">←</button>${avatar(c, 34)}<b style="flex:1">${esc(c.name)} <span class="muted small">${esc(cur)}</span></b><a class="b b-wa b-sm" href="${waLink(cur, '')}" target="_blank">WhatsApp</a></div>
      <div class="chat" id="chat">${msgs.map(m => `<div class="msg ${m.from === 'admin' ? 'me' : 'them'}">${esc(m.text)}<small>${fmtTime(m.at)}</small></div>`).join('')}</div>
      <div class="row" style="padding:10px;border-top:1px solid var(--a-line);flex-wrap:nowrap"><input class="inp" id="replyIn" style="flex:1" placeholder="Type a reply…"><button class="b b-pri" data-a="reply">Send</button></div>`;
  }
  return `<p class="small muted">Customers see “Kitchen is online” while this dashboard is open on any admin device.</p>
  <div class="pane chatbox ${cur ? 'has' : ''}"><div class="threads">${list || '<p class="empty">No chats yet.</p>'}</div><div class="conv">${conv}</div></div>`;
}

/* ---------- Settings ---------- */
function renderSettings() {
  const s = A.data.settings || {};
  const url = siteBase();
  const msg = `🌿 Keralam Kitchen 🌿\nHomemade • Fresh • Hygienic\n\nOrder Idli/Dosa batter, Coconut chutney, Rotis & more 👇\n${url}\n\n📲 ${CFG.PHONES.join(' / ')}`;
  return `<div class="grid2">
  <div class="pane"><h3>💳 UPI payments</h3>
    <p class="small muted">When filled, customers get a “Pay now (UPI)” option that opens GPay / PhonePe / Paytm with the amount filled in.</p>
    <label class="lbl">UPI ID</label><input class="inp" id="sUpi" value="${esc(s.upiId || '')}" placeholder="e.g. 9594727293@ybl">
    <label class="lbl">Name shown in the UPI app</label><input class="inp" id="sUpiName" value="${esc(s.upiName || 'Keralam Kitchen')}">
    <div class="row" style="margin-top:12px"><button class="b b-pri" data-a="saveSettings">Save UPI</button>
      ${s.upiId ? `<a class="b b-ghost b-sm" href="upi://pay?pa=${encodeURIComponent(s.upiId)}&pn=${encodeURIComponent(s.upiName || 'Keralam Kitchen')}&am=1&cu=INR&tn=Test">Test ₹1 on this phone</a>` : ''}</div>
    <p class="small muted">Leave empty to hide online payment (customers pay at pickup).</p></div>
  <div class="pane"><h3>🔔 Alerts to your phone</h3>
    <p class="small muted">You get an <b>email</b> for every customer login, sign-up, order, change, cancel, chat, review, forgot-PIN and wrong-PIN. Install the <b>Gmail app</b> on your phone and turn on its notifications — it pops up like a message. Free (up to ~100 emails a day).</p>
    <label class="lbl">Send alerts to (leave empty = the Google account that owns the sheet)</label><input class="inp" id="sEmail" type="email" value="${esc(s.notifyEmail || '')}" placeholder="owner's Gmail (default)">
    <label class="sw" style="margin-top:12px"><input type="checkbox" id="sAlerts" ${s.emailAlerts !== false ? 'checked' : ''}> Email alerts ON</label>
    <label class="sw" style="margin-top:8px"><input type="checkbox" id="sVisits" ${s.emailVisits ? 'checked' : ''}> Also email every time a customer just opens the website (can be a lot)</label>
    <div class="row" style="margin-top:12px"><button class="b b-pri" data-a="saveSettings">Save alerts</button><button class="b b-ghost" data-a="testAlert">Send test alert</button>
      <button class="b b-ghost" data-a="enableBrowserNotif">🔔 Pop-ups on this device</button></div>
    <p class="small muted">While this dashboard is open, it also beeps and shows a pop-up for new activity. For instant Telegram messages too, see SETUP.md step 5.</p></div>
  <div class="pane"><h3>🔗 Customer link</h3><input class="inp" readonly value="${esc(url)}" onclick="this.select()">
    <div class="row" style="margin-top:10px"><button class="b b-pri b-sm" data-a="copy" data-v="${esc(url)}">Copy link</button>
    <a class="b b-wa b-sm" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank">Share on WhatsApp</a></div>
    <img alt="QR code" style="margin-top:14px;width:200px;height:200px;background:#fff;padding:8px;border-radius:12px;border:1px solid var(--a-line)" src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}" onerror="this.remove()">
    <p class="small muted">Print this QR for the society notice board.</p></div>
  <div class="pane"><h3>🔐 Security</h3>
    <p>Admin numbers: <b>${CFG.PHONES.join(', ')}</b></p>
    <p class="small muted">Admin PIN is set in Apps Script → Project Settings → Script properties → <code>ADMIN_PIN</code>. Every admin sign-in and wrong-PIN attempt sends you an alert.</p>
    <p>Backend: ${DEMO ? '⚠️ Demo mode (data only on this device)' : '✅ Connected to Google Sheet'}</p></div>
  </div>`;
}

/* ---------- Actions ---------- */
async function update(id, patch, okMsg) {
  try { const { order } = await adminApi('adminUpdateOrder', { id, patch }); const i = A.data.orders.findIndex(o => o.id === id); A.data.orders[i] = order; render(); if (okMsg) toast(okMsg); return order; }
  catch (e) { toast(e.message, 4000); }
}
function setTab(t) { A.tab = t; A.chatPhone = null; A.drawer = false; lsSet('kk_admin_tab', t); render(); window.scrollTo(0, 0); }
const ACT = {
  noop: () => {},
  tab: el => { closeSheet(); setTab(el.dataset.t); },
  drawer: () => { A.drawer = !A.drawer; $('.shell').classList.toggle('open', A.drawer); },
  filter: el => { A.filter = el.dataset.f; render(); },
  actFilter: el => { A.actFilter = el.dataset.f; render(); },
  refresh: () => { toast('Refreshing…', 1200); load(); },
  logout: () => { if (!confirm('Sign out of the dashboard?')) return; lsSet('kk_admin_auth', null); A.auth = null; A.data = null; renderLogin(); },
  close: () => closeSheet(),
  setStatus: async el => {
    const o = await update(el.dataset.id, { status: el.dataset.s }, '✓ ' + ST_LABEL[el.dataset.s]);
    if (o && el.dataset.s === 'ready') openSheet(`<h2>🎉 Order ${esc(o.id)} is ready</h2><p>Tell ${esc(o.name)}:</p>
      <a class="b b-wa b-full" href="${waLink(o.phone, statusMsg(o))}" target="_blank" data-a="close">📲 Send “ready” on WhatsApp</a>
      <a class="b b-ghost b-full" style="margin-top:8px" href="sms:+91${o.phone}?body=${encodeURIComponent(statusMsg(o))}">✉️ Send SMS</a>
      <button class="b b-ghost b-full" style="margin-top:8px" data-a="close">Later</button>`);
  },
  collect: el => {
    const o = A.data.orders.find(x => x.id === el.dataset.id);
    openSheet(`<h2>🤝 ${esc(o.id)} collected</h2><p>${esc(o.name)} paid <b>${money(o.total)}</b> by:</p>
      <div class="row"><button class="b b-pri" style="flex:1;min-height:56px" data-a="paid" data-id="${o.id}" data-m="cash">💵 Cash</button><button class="b b-gold" style="flex:1;min-height:56px" data-a="paid" data-id="${o.id}" data-m="upi">📱 UPI</button></div>
      <button class="b b-ghost b-full" style="margin-top:8px" data-a="close">Back</button>`);
  },
  paid: async el => {
    closeSheet();
    const o = await update(el.dataset.id, { status: 'collected', payMethod: el.dataset.m }, '✓ Collected');
    if (o) openSheet(`<h2>❤️ Say thank you</h2><p>Send ${esc(o.name)} a thank-you with the review link (review opens in 40 min):</p>
      <a class="b b-wa b-full" href="${waLink(o.phone, statusMsg(o))}" target="_blank" data-a="close">📲 Thank-you on WhatsApp</a>
      <a class="b b-ghost b-full" style="margin-top:8px" href="sms:+91${o.phone}?body=${encodeURIComponent(statusMsg(o))}">✉️ SMS</a>
      <button class="b b-ghost b-full" style="margin-top:8px" data-a="close">Skip</button>`);
  },
  adminCancel: async el => {
    const r = prompt('Reason for cancelling ' + el.dataset.id + ' (customer will see this):', ''); if (r === null) return;
    const o = await update(el.dataset.id, { status: 'cancelled', cancelReason: r }, 'Cancelled');
    if (o) openSheet(`<h2>Order cancelled</h2><a class="b b-wa b-full" href="${waLink(o.phone, statusMsg(o))}" target="_blank" data-a="close">📲 Inform on WhatsApp</a><button class="b b-ghost b-full" style="margin-top:8px" data-a="close">Close</button>`);
  },
  editOrder: el => {
    const o = A.data.orders.find(x => x.id === el.dataset.id);
    openSheet(`<div class="row between"><h2 style="margin:0">✏️ Edit ${esc(o.id)}</h2><button class="b b-icon" data-a="close">✕</button></div>
      ${o.type === 'custom' ? `<label class="lbl">Price agreed (₹)</label><input class="inp" id="eoTotal" type="number" value="${o.total || ''}">` : `<label class="lbl">Items</label>${itemsEditor(o.items)}`}
      <div class="form2"><div><label class="lbl">Pickup</label><input class="inp" type="datetime-local" id="eoPick" value="${toLocalInput(o.pickupAt)}"></div>
      <div><label class="lbl">Payment</label><select class="inp" id="eoPay"><option value="due" ${o.payStatus !== 'paid' ? 'selected' : ''}>Due</option><option value="paid" ${o.payStatus === 'paid' ? 'selected' : ''}>Paid</option></select></div></div>
      <label class="lbl">Customer notes</label><input class="inp" id="eoNotes" value="${esc(o.notes || '')}">
      <label class="lbl">Admin note (private) / preparation</label><input class="inp" id="eoAdmin" value="${esc(o.adminNote || '')}">
      <div class="row" style="margin-top:16px"><button class="b b-pri" style="flex:1" data-a="saveOrder" data-id="${o.id}">Save</button><button class="b b-ghost" data-a="close">Close</button></div>`, true);
  },
  saveOrder: async el => {
    const o = A.data.orders.find(x => x.id === el.dataset.id);
    const patch = { pickupAt: $('#eoPick').value ? new Date($('#eoPick').value).getTime() : o.pickupAt, notes: $('#eoNotes').value, adminNote: $('#eoAdmin').value, payStatus: $('#eoPay').value };
    if (o.type === 'custom') patch.total = $('#eoTotal').value; else { patch.items = readLines(); if (!patch.items.length) return toast('Add at least one item'); }
    closeSheet(); await update(o.id, patch, 'Saved ✓');
  },
  addLine: () => { $('#lines').insertAdjacentHTML('beforeend', lineRow({ id: A.data.menu[0].id, v: 0, addonIdx: [], qty: 1 })); },
  newPhoneOrder: el => phoneOrderSheet(el.dataset.phone),
  savePhoneOrder: async el => {
    const customer = { name: $('#poName').value, flat: $('#poFlat').value, phone: $('#poPhone').value };
    const items = readLines(); if (!items.length) return toast('Add items');
    el.disabled = true;
    try {
      await adminApi('placeOrder', { id: KKCore.newOrderId(), customer, items, pickupAt: new Date($('#poPick').value).getTime(), notes: $('#poNotes').value, pay: 'spot', source: $('#poSrc').value });
      closeSheet(); A.tab = 'orders'; await load(); toast('Order created ✓');
    } catch (e) { toast(e.message, 4000); el.disabled = false; }
  },
  toggle: async el => {
    const m = A.data.menu.find(x => x.id === el.dataset.id); m[el.dataset.k] = el.checked;
    try { await adminApi('adminSaveItem', { item: m }); toast('Saved ✓'); render(); } catch (e) { toast(e.message); }
  },
  editItem: el => editItem(el.dataset.id),
  saveItem: async el => {
    const old = A.data.menu.find(x => x.id === el.dataset.id) || { inStock: true };
    const item = { ...old, id: el.dataset.id || undefined, name: $('#iName').value.trim(), emoji: $('#iEmoji').value.trim(), img: $('#iImg').value.trim(), desc: $('#iDesc').value.trim(),
      tags: $('#iTags').value.split(',').map(s => s.trim()).filter(Boolean), variants: parseLines($('#iVar').value), addons: parseLines($('#iAdd').value),
      leadMins: +$('#iLead').value || 0, prep: $('#iPrep').value, sort: +$('#iSort').value || 0 };
    el.disabled = true;
    try { await adminApi('adminSaveItem', { item }); closeSheet(); await load(); toast('Saved ✓'); } catch (e) { toast(e.message, 4000); el.disabled = false; }
  },
  deleteItem: async el => { if (!confirm('Delete this dish from the menu?')) return; await adminApi('adminDeleteItem', { id: el.dataset.id }); closeSheet(); await load(); },
  openCustomer: el => openCustomer(el.dataset.p),
  editCustomer: el => editCustomer(el.dataset.p),
  ecNoPhoto: () => { editPhoto = ''; $('#ecPrev').innerHTML = avatar({ name: $('#ecName').value }, 56); },
  saveCustomer: async el => {
    const customer = { name: $('#ecName').value.trim(), flat: $('#ecFlat').value.trim(), phone: KKCore.digits($('#ecPhone').value), pin: $('#ecPin').value.trim(), note: $('#ecNote').value, blocked: $('#ecBlocked').checked, source: 'phone' };
    if (editPhoto !== undefined) customer.photo = editPhoto;
    el.disabled = true;
    try { const r = await adminApi('adminSaveCustomer', { customer, originalPhone: el.dataset.orig }); await load(true); openCustomer(r.customer.phone); toast('Customer saved ✓'); }
    catch (e) { toast(e.message, 4000); el.disabled = false; }
  },
  blockCustomer: async el => {
    const block = !!el.dataset.b, c = custOf(el.dataset.p);
    const reason = block ? prompt(`Block ${c.name}? They won't be able to log in or order.\nReason (private, optional):`, '') : '';
    if (block && reason === null) return;
    try { await adminApi('adminBlockCustomer', { phone: el.dataset.p, blocked: block, reason }); await load(true); openCustomer(el.dataset.p); toast(block ? '⛔ Blocked' : '✅ Unblocked'); } catch (e) { toast(e.message); }
  },
  deleteCustomer: async el => {
    const c = custOf(el.dataset.p);
    if (!confirm(`Delete ${c.name} (${c.phone}) permanently?\nTheir account and PIN will be removed. Past orders stay in your records.`)) return;
    try { await adminApi('adminDeleteCustomer', { phone: el.dataset.p }); closeSheet(); await load(); toast('Deleted'); } catch (e) { toast(e.message); }
  },
  range30: () => { defaultRange(); render(); },
  saveExpense: async () => {
    const amt = +$('#eAmt').value; if (!amt) return toast('Enter amount');
    try { await adminApi('adminSaveExpense', { expense: { date: $('#eDate').value, category: $('#eCat').value, qty: $('#eQty').value, amount: amt } }); await load(); toast('Added ✓'); } catch (e) { toast(e.message); }
  },
  delExpense: async el => { if (!confirm('Delete expense?')) return; await adminApi('adminDeleteExpense', { id: el.dataset.id }); await load(); },
  hideReview: async el => { await adminApi('adminHideReview', { id: el.dataset.id }); await load(); },
  openChat: el => { closeSheet(); A.tab = 'chat'; A.chatPhone = el.dataset.p; A.drawer = false; lsSet('kk_admin_tab', 'chat'); render(); },
  chatBack: () => { A.chatPhone = null; render(); },
  reply: async () => {
    const text = $('#replyIn').value.trim(); if (!text) return;
    try { const { message } = await adminApi('adminChatReply', { phone: A.chatPhone, text }); A.data.chats.push(message); render(); } catch (e) { toast(e.message); }
  },
  saveSettings: async el => {
    const settings = { upiId: $('#sUpi').value.trim(), upiName: $('#sUpiName').value.trim(), notifyEmail: $('#sEmail').value.trim(), emailAlerts: $('#sAlerts').checked, emailVisits: $('#sVisits').checked };
    if (settings.upiId && !/^[\w.\-]+@[\w.\-]+$/.test(settings.upiId)) return toast('UPI ID looks wrong — it should look like name@bank');
    el.disabled = true;
    try { const r = await adminApi('adminSaveSettings', { settings }); A.data.settings = r.settings; setSettings(r.settings); render(); toast('Settings saved ✓ — customers see it right away'); }
    catch (e) { toast(e.message); el.disabled = false; }
  },
  testAlert: async el => { el.disabled = true; try { await adminApi('adminTestAlert'); toast('Test alert sent — check your email ✉️', 4000); } catch (e) { toast(e.message); } el.disabled = false; },
  enableBrowserNotif: async () => { try { const p = await Notification.requestPermission(); toast(p === 'granted' ? '🔔 Pop-ups on for this device' : 'Pop-ups blocked in browser settings'); if (p === 'granted') sysNotify('Keralam Kitchen', 'Pop-up alerts are on ✅'); } catch (e) { toast('Not supported here'); } },
  copy: el => { navigator.clipboard.writeText(el.dataset.v).then(() => toast('Copied ✓')); }
};
document.addEventListener('click', e => {
  const pin = e.target.closest('.pin');
  if (pin) { e.stopPropagation(); e.preventDefault(); pin.textContent = pin.textContent === '••••' ? pin.dataset.pin : '••••'; return; }
  if (e.target.closest('[data-stop]')) return;
  const el = e.target.closest('[data-a]'); if (!el || !ACT[el.dataset.a]) return;
  if (el.dataset.a === 'toggle') return;
  if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href') !== '#') { setTimeout(() => ACT[el.dataset.a](el, e), 0); return; }
  e.preventDefault(); ACT[el.dataset.a](el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.a === 'toggle') return ACT.toggle(el);
  if (el.id === 'rFrom' || el.id === 'rTo') { A[el.id === 'rFrom' ? 'from' : 'to'] = el.value; render(); }
  if (el.id === 'cSort') { A.custSort = el.value; render(); }
  if (el.dataset.k === 'item') { const row = el.closest('.lineRow'); row.outerHTML = lineRow({ id: el.value, v: 0, addonIdx: [], qty: +$('[data-k=qty]', row).value || 1 }); }
});
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'cSearch' || id === 'aSearch') {
    if (id === 'cSearch') A.search = e.target.value; else A.actSearch = e.target.value;
    const pos = e.target.selectionStart; render(); const s = $('#' + id); s.focus(); s.setSelectionRange(pos, pos);
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'replyIn') ACT.reply(); if (e.key === 'Escape') closeSheet(); });

(function boot() {
  if (!A.auth) return renderLogin();
  document.body.className = 'adm';
  app.innerHTML = '<div class="boot">Loading dashboard…</div>';
  load();
  setInterval(() => { if (A.auth && !document.hidden) load(true); }, 20000);
  setInterval(() => { if (A.data && ['orders', 'overview'].includes(A.tab) && !$('#overlay') && !(document.activeElement || {}).matches?.('input,textarea,select')) render(); }, 60000);
})();
