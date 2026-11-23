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
    <p class="muted">Only for kitchen admins</p>
    ${DEMO ? '<div class="pill y">Demo mode: PIN is 1234</div>' : ''}
    <label class="lbl">Admin mobile number</label><input class="inp" id="lp" inputmode="numeric" maxlength="14" autocomplete="tel">
    <label class="lbl">PIN</label><input class="inp" id="lpin" type="password" inputmode="numeric" autocomplete="current-password">
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    <button class="b b-pri b-full" style="margin-top:18px" id="lgo">Sign in</button>
    <p class="small" style="text-align:center;margin-top:14px"><a href="index.html">← Customer site</a></p>
  </div></div>`;
  const go = async () => {
    const auth = { phone: KKCore.digits($('#lp').value), pin: $('#lpin').value };
    if (auth.phone.length !== 10) return renderLogin('Enter your 10-digit admin number.');
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
    d.activity = d.activity || []; d.settings = d.settings || {}; d.materials = d.materials || []; d.trash = d.trash || []; d.production = d.production || [];
    A.rev = d.rev || A.rev;
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
    if (!silent || (!typing && !$('#overlay'))) render(); else A.dirty = true;
    attention();
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
  ['overview', 'grid', 'Overview'], ['orders', 'receipt', 'Orders'], ['customers', 'users', 'Customers'], ['activity', 'zap', 'Activity'],
  ['chat', 'chat', 'Chat'], ['menu', 'menu', 'Menu'], ['stock', 'box', 'Raw material & cost'], ['money', 'wallet', 'Accounts'], ['analytics', 'chart', 'Analysis'],
  ['settings', 'settings', 'Settings'], ['trash', 'trash', 'Trash']
];
const MOBILE_NAV = ['overview', 'orders', 'chat', 'customers'];
function counts() {
  const d = A.data;
  const th = chatThreads();
  return {
    orders: d.orders.filter(o => ACTIVE.includes(o.status)).length,
    newOrders: d.orders.filter(o => o.status === 'placed').length, trash: (d.trash || []).length,
    chat: Object.values(th).filter(t => t[t.length - 1].from === 'customer').length
  };
}
function render() {
  const d = A.data; if (!d) return;
  document.body.className = 'adm';
  const c = counts();
  const badge = k => { const n = k === 'orders' ? c.newOrders || c.orders : k === 'chat' ? c.chat : k === 'stock' ? lowStock().length : 0; return n ? `<span class="nb ${k === 'orders' && c.newOrders ? 'red' : ''}">${n}</span>` : ''; };
  const title = (NAV.find(n => n[0] === A.tab) || NAV[0])[2];
  const y = window.scrollY;
  const view = { overview: renderOverview, orders: renderOrders, customers: renderCustomers, activity: renderActivity, menu: renderMenu, stock: renderStock, money: renderMoney, analytics: renderAnalytics, chat: renderChat, settings: renderSettings, trash: renderTrash }[A.tab] || renderOverview;
  A.dirty = false;
  app.innerHTML = `
  ${DEMO ? '<div class="demo">Demo mode — connect the Google Sheet (config.js → API_URL) to go live.</div>' : ''}
  <div class="shell ${A.drawer ? 'open' : ''}">
    <aside class="side">
      <div class="brand">${d.settings.logo ? `<img class="brand-logo" src="${esc(d.settings.logo)}" alt="">` : '<span class="brand-mark">🌿</span>'}<div><b>Keralam Kitchen</b><small>Admin</small></div></div>
      <nav>${NAV.map(([k, i, l]) => `<button class="${A.tab === k ? 'on' : ''}" data-a="tab" data-t="${k}"><span class="ni">${ic(i, 19)}</span><span class="nl">${l}</span>${badge(k)}</button>`).join('')}</nav>
      <div class="side-foot">
        <div class="who">${avatar({ name: 'A' }, 30)}<div><b>${KKCore.digits(A.auth.phone)}</b><small>Signed in</small></div></div>
        <a class="b b-ghost b-sm b-full" href="index.html" target="_blank">${ic('ext', 16)} Open customer site</a>
        <button class="b b-ghost b-sm b-full" data-a="logout">${ic('logout', 16)} Sign out</button>
      </div>
    </aside>
    <div class="scrim" data-a="drawer"></div>
    <div class="main">
      <header class="topbar">
        <button class="b b-icon hamb" data-a="drawer" aria-label="Menu">${ic('layout', 20)}</button>
        <div class="tt"><h1>${title}</h1><small>${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · updated ${ago(A.loadedAt)}</small></div>
        <div class="sp"></div>
        <span class="live"><i></i>Live</span>
        ${A.tab === 'orders' || A.tab === 'overview' ? `<button class="b b-pri b-sm hide-xs" data-a="newPhoneOrder">${ic('plus', 16)} New order</button>` : ''}
        <button class="b b-icon" data-a="calc" title="Calculator">${ic('calc', 19)}</button>
        <button class="b b-icon" data-a="refresh" title="Refresh">${ic('refresh', 19)}</button>
      </header>
      ${notifBanner()}
      <section class="content">${view()}</section>
    </div>
    <nav class="bnav">${MOBILE_NAV.map(k => { const n = NAV.find(x => x[0] === k); return `<button class="${A.tab === k ? 'on' : ''}" data-a="tab" data-t="${k}"><b>${ic(n[1], 21)}</b>${n[2]}${badge(k)}</button>`; }).join('')}
      <button data-a="drawer"><b>${ic('layout', 21)}</b>More</button></nav>
    <button class="fab-calc" data-a="calc" aria-label="Calculator">${ic('calc', 22)}</button>
  </div>`;
  window.scrollTo(0, y);
  const ch = $('#chat'); if (ch) ch.scrollTop = ch.scrollHeight;
}

/* ---------- Helpers ---------- */
const custOf = phone => phone ? A.data.customers.find(c => c.phone === phone || c.id === phone) : null;
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
  const low = lowStock();
  const cards = {
    orders: () => kpi('Orders today', todayOrders.length, d.orders.filter(o => o.status === 'placed').length + ' waiting to accept', 'tone-g'),
    collected: () => kpi('Collected today', money(todayRev), 'cash + UPI received'),
    active: () => kpi('Active orders', d.orders.filter(o => ACTIVE.includes(o.status)).length, pickupsToday.length + ' pickups today'),
    visitors: () => kpi('Visitors today', visitors, logins + ' logins · ' + signups + ' new sign-ups', 'tone-b'),
    customers: () => kpi('Customers', d.customers.length, d.customers.filter(c => c.pin).length + ' with accounts · ' + d.customers.filter(c => c.blocked).length + ' blocked'),
    rating: () => kpi('Rating', avg, reviews.length + ' reviews', 'tone-y'),
    month: () => { const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0); const rev = d.orders.filter(o => o.status === 'collected' && o.createdAt >= m0.getTime()).reduce((a, o) => a + o.total, 0); const ex = d.expenses.filter(e => startOf(e.date) >= m0.getTime()).reduce((a, e) => a + e.amount, 0); return kpi('This month', money(rev), 'expenses ' + money(ex) + ' · profit ' + money(rev - ex), 'tone-g'); },
    stock: () => kpi('Low raw material', low.length, low.slice(0, 3).map(m => m.name).join(', ') || 'all stocked', low.length ? 'tone-r' : ''),
    chats: () => kpi('Chats waiting', waiting.length, 'unanswered customer chats', waiting.length ? 'tone-r' : 'tone-b'),
    guests: () => kpi('WhatsApp orders', d.orders.filter(o => o.guest && o.createdAt >= t0).length, 'no-login orders today')
  };
  const panels = {
    attention: () => `<div class="pane"><div class="pane-h"><h3>Needs attention</h3>${attention.length ? `<span class="pill r">${attention.length}</span>` : ''}</div>${attention.join('') || '<p class="empty">All clear — nothing waiting on you.</p>'}</div>`,
    pickups: () => `<div class="pane"><div class="pane-h"><h3>Today's pickups</h3><button class="b b-ghost b-sm" data-a="tab" data-t="orders">All orders →</button></div>
      ${pickupsToday.map(o => `<div class="pick"><span class="pick-t">${o.asap ? 'ASAP' : new Date(o.pickupAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
        <div style="flex:1"><b>${esc(o.name)}</b> <span class="muted small">${o.flat ? 'Flat ' + esc(o.flat) : ''}</span><div class="small muted">${(o.items || []).map(l => esc(l.name) + ' ×' + l.qty).join(', ') || esc(o.customText || '')}</div></div>
        <span class="status s-${o.status}">${ST_LABEL[o.status]}</span></div>`).join('') || '<p class="empty">No pickups scheduled for today.</p>'}</div>`,
    activity: () => `<div class="pane"><div class="pane-h"><h3>Live activity</h3><button class="b b-ghost b-sm" data-a="tab" data-t="activity">See all →</button></div>
      <div class="act-list">${d.activity.slice(0, 14).map(a => actRow(a, true)).join('') || '<p class="empty">No activity yet.</p>'}</div></div>`,
    stockp: () => `<div class="pane"><div class="pane-h"><h3>Raw material in stock</h3><button class="b b-ghost b-sm" data-a="tab" data-t="stock">Manage →</button></div>
      ${(d.materials || []).map(m => `<div class="pick"><span style="flex:1">${esc(m.name)}</span><b class="${isLow(m) ? 'txt-r' : ''}">${fmtQty(m.stock)} ${esc(m.unit)}</b></div>`).join('') || '<p class="empty">Add raw materials in “Raw material & cost”.</p>'}</div>`,
    prep: () => { const prep = {}; d.orders.filter(o => ACTIVE.includes(o.status)).forEach(o => (o.items || []).forEach(l => { const k = l.name + ' — ' + l.variant; prep[k] = (prep[k] || 0) + l.qty; }));
      return `<div class="pane"><div class="pane-h"><h3>To prepare</h3></div>${Object.entries(prep).map(([k, q]) => `<div class="pick"><span style="flex:1">${esc(k)}</span><b>${q}</b></div>`).join('') || '<p class="empty">Nothing to prepare.</p>'}</div>`; }
  };
  A.cardDefs = { cards: Object.keys(cards), panels: Object.keys(panels) };
  const lay = dashLayout();
  return `
  <div class="row between" style="margin-bottom:10px"><span class="small muted">Your dashboard — choose what you see</span><button class="b b-ghost b-sm" data-a="customize">${ic('layout', 16)} Customize</button></div>
  <div class="kpis">${lay.cards.filter(k => cards[k]).map(k => cards[k]()).join('')}</div>
  <div class="grid2">${lay.panels.filter(k => panels[k]).map(k => panels[k]()).join('')}</div>`;
  /* old layout below is unused */
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
      <span>${o.source !== 'web' ? `<span class="pill">${esc(o.source)}</span>` : ''}${o.guest ? '<span class="pill g">no login</span>' : ''}${o.contactedBy ? `<span class="pill b">via ${esc(o.contactedBy)}</span>` : ''}</span></div>
    <div class="oc-m"><span>${ic('clock', 15)} Pickup <b>${o.asap ? 'ASAP today' : o.pickupAt ? fmtTime(o.pickupAt) : '—'}</b></span><span class="muted">Placed ${ago(o.createdAt)}</span></div>
    <div class="oc-items">${o.type === 'custom' ? `✨ <b>Custom:</b> ${esc(o.customText)}${o.customPhoto ? `<br><a href="${esc(o.customPhoto)}" target="_blank"><img src="${esc(o.customPhoto)}" class="photo-prev"></a>` : ''}` :
      (o.items || []).map(l => `<div class="row between" style="flex-wrap:nowrap"><span>${esc(l.name)} <span class="muted">${esc(l.variant)}${l.addons.length ? ' + ' + esc(l.addons.join(', ')) : ''}</span> × <b>${l.qty}</b></span><span>${money(l.amount)}</span></div>`).join('')}</div>
    ${o.notes ? `<div class="note-box">📝 ${esc(o.notes)}</div>` : ''}
    ${o.adminNote ? `<div class="small muted">🔒 ${esc(o.adminNote)}</div>` : ''}
    <div class="small" style="margin-top:6px">${o.pay === 'now' ? '💳 Pay now (UPI)' : '💵 Pay at pickup'} · <b class="${o.payStatus === 'paid' ? 'txt-g' : 'txt-y'}">${esc(o.payStatus === 'paid' ? 'PAID ' + (o.payMethod || '').toUpperCase() : 'Due')}</b></div>
    <div class="oc-a">
      ${next ? (next[0] === 'collected' ? `<button class="b b-pri b-sm" data-a="collect" data-id="${o.id}">${next[1]}</button>` : `<button class="b b-pri b-sm" data-a="setStatus" data-id="${o.id}" data-s="${next[0]}">${next[1]}</button>`) : ''}
      ${o.phone ? `<a class="b b-wa b-sm" href="${waLink(o.phone, statusMsg(o))}" target="_blank" rel="noopener">${ic('wa', 15)} WhatsApp</a>
      <a class="b b-ghost b-sm" href="${telLink(o.phone)}">${ic('phone', 15)} Call</a>
      <a class="b b-ghost b-sm" href="sms:+91${o.phone}?body=${encodeURIComponent(statusMsg(o))}">SMS</a>` : ''}
      <button class="b b-ghost b-sm" data-a="editOrder" data-id="${o.id}">${ic('edit', 15)} Edit</button>
      ${['cancelled', 'collected'].includes(o.status) ? '' : `<button class="b b-dan b-sm" data-a="adminCancel" data-id="${o.id}">Cancel</button>`}
      <button class="b b-ghost b-sm b-del" data-a="deleteOrder" data-id="${o.id}" title="Delete order completely">${ic('trash', 15)}</button>
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
    ${A.filter === 'cancelled' && list.length ? `<button class="b b-dan b-sm" data-a="deleteCancelled">${ic('trash', 15)} Delete all cancelled</button>` : ''}
    <button class="b b-pri b-sm" data-a="newPhoneOrder">${ic('plus', 15)} New order</button>
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
    <tbody>${list.map(c => `<tr class="click" data-a="openCustomer" data-p="${esc(c.id)}">
      <td><div class="row" style="gap:8px;flex-wrap:nowrap">${avatar(c, 30)}<b>${esc(c.name)}</b></div></td>
      <td>${esc(c.flat)}</td><td>${esc(c.phone)}</td>
      <td>${c.pin ? `<span class="pin" data-pin="${esc(c.pin)}">••••</span>` : '<span class="muted small">no account</span>'}</td>
      <td class="n">${c.visits || 0}</td><td class="n">${c.orders || 0}</td><td class="n">${money(spentOf(c.phone))}</td>
      <td>${ago(c.lastSeen || c.lastAt)}</td>
      <td>${c.blocked ? '<span class="pill r">Blocked</span>' : c.pin ? '<span class="pill g">Active</span>' : '<span class="pill">Guest</span>'}</td>
      <td class="n" style="white-space:nowrap">${c.phone ? `<a class="b b-ghost b-xs" href="${telLink(c.phone)}" data-stop="1" title="Call">${ic('phone', 14)}</a> <a class="b b-wa b-xs" href="${waLink(c.phone, 'Hi ' + c.name + ' 🌿 — Keralam Kitchen')}" target="_blank" data-stop="1" title="WhatsApp">${ic('wa', 14)}</a>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="10" class="empty">No customers yet.</td></tr>'}</tbody>
  </table></div>`;
}
function openCustomer(phone) {
  const c = custOf(phone); if (!c) return; phone = c.phone || c.id;
  const orders = A.data.orders.filter(o => o.phone === phone);
  const acts = A.data.activity.filter(a => a.phone === phone);
  const pinMsg = `Hi ${(c.name || '').split(' ')[0]} 🌿 Your Keralam Kitchen login PIN is ${c.pin}. Please keep it private. ${siteBase()}`;
  openSheet(`
    <div class="row between" style="flex-wrap:nowrap"><div class="row" style="gap:12px;flex-wrap:nowrap">${avatar(c, 56)}<div><h2 style="margin:0">${esc(c.name)}</h2><div class="muted">${c.flat ? 'Flat ' + esc(c.flat) + ' · ' : ''}${esc(c.phone || 'no number')}</div></div></div>
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
      ${c.phone ? `<a class="b b-wa b-sm" href="${waLink(phone, 'Hi ' + c.name + ' 🌿 — Keralam Kitchen')}" target="_blank">${ic('wa', 15)} WhatsApp</a>
      <a class="b b-ghost b-sm" href="${telLink(phone)}">${ic('phone', 15)} Call</a>` : ''}
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
      <div><label class="lbl">Name</label><input class="inp" id="ecName" value="${esc(c.name)}"></div>
      <div><label class="lbl">Flat</label><input class="inp" id="ecFlat" value="${esc(c.flat)}"></div>
      <div><label class="lbl">Mobile</label><input class="inp" id="ecPhone" inputmode="numeric" value="${esc(c.phone)}"></div>
      <div><label class="lbl">Login PIN (4–6 digits)</label><input class="inp" id="ecPin" inputmode="numeric" maxlength="6" value="${esc(c.pin || '')}" placeholder="leave empty = no login"></div>
    </div>
    <label class="lbl">Private note</label><input class="inp" id="ecNote" value="${esc(c.note || '')}" placeholder="e.g. prefers less spicy">
    <label class="sw" style="margin-top:12px"><input type="checkbox" id="ecBlocked" ${c.blocked ? 'checked' : ''}> ⛔ Blocked (cannot log in or order)</label>
    <div class="row" style="margin-top:16px"><button class="b b-pri" style="flex:1" data-a="saveCustomer" data-orig="${esc((c && c.id) || '')}">Save</button><button class="b b-ghost" data-a="close">Cancel</button></div>`);
  $('#ecPhoto').onchange = async e => { const f = e.target.files[0]; if (!f) return; editPhoto = await fileToDataUrl(f, 400); $('#ecPrev').innerHTML = `<img class="av" src="${editPhoto}" style="width:56px;height:56px">`; };
}
function phoneOrderSheet(phone) {
  const c = (phone && custOf(phone)) || {};
  const staff = staffList(), srcs = sourceList();
  openSheet(`<div class="row between"><h2 style="margin:0">New order</h2><button class="b b-icon" data-a="close">✕</button></div>
    <p class="small muted" style="margin:4px 0 0">Nothing is mandatory — fill what you know.</p>
    <div class="form2 f3">
      <div><label class="lbl">Name</label><input class="inp" id="poName" value="${esc(c.name || '')}"></div>
      <div><label class="lbl">Flat</label><input class="inp" id="poFlat" value="${esc(c.flat || '')}"></div>
      <div><label class="lbl">Mobile</label><input class="inp" id="poPhone" inputmode="numeric" value="${esc(c.phone || '')}"></div>
    </div>
    <label class="lbl">Items</label>${itemsEditor([])}
    <div class="form2">
      <div><label class="lbl">Pickup</label><input class="inp" type="datetime-local" id="poPick" value="${toLocalInput(Date.now() + 60 * MIN)}"></div>
      <div><label class="lbl">Order came from</label><select class="inp" id="poSrc">${srcs.map(x => `<option>${esc(x)}</option>`).join('')}<option value="__other">Other…</option></select></div>
      <div><label class="lbl">Customer contacted</label><select class="inp" id="poBy">${staff.map(x => `<option>${esc(x)}</option>`).join('')}<option value="__other">Other…</option></select></div>
      <div><label class="lbl">Status</label><select class="inp" id="poSt"><option value="accepted">Accepted</option><option value="placed">New</option><option value="ready">Ready</option><option value="collected">Already collected</option></select></div>
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
      <div style="flex:1"><b>${esc(m.name)}</b>${costTag(m)}${m.hidden ? ' <span class="pill">hidden</span>' : ''}${!m.inStock && !m.alwaysAvailable ? ' <span class="pill y">tomorrow</span>' : ''}
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
    <label class="lbl">Description ${aiBtns('iDesc', 'menu')}</label><textarea class="inp" id="iDesc" rows="2">${esc(m.desc || '')}</textarea>
    <label class="lbl">Tags (comma separated)</label><input class="inp" id="iTags" value="${esc((m.tags || []).join(', '))}">
    <label class="lbl">Sizes — one per line: <code>label | price | your cost</code></label><textarea class="inp" id="iVar">${esc(vtxt(m.variants))}</textarea>
    <label class="lbl">Extras — one per line: <code>label | price | cost</code></label><textarea class="inp" id="iAdd">${esc(vtxt(m.addons || []))}</textarea>
    <label class="lbl">Preparation details (only admins see this) ${aiBtns('iPrep', 'fix')}</label><textarea class="inp" id="iPrep">${esc(m.prep || '')}</textarea>
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
    <div class="pane"><h3>Add expense / stock purchase</h3>
      <div class="form2"><div><label class="lbl">Date</label><input class="inp" type="date" id="eDate" value="${fmtDate(Date.now())}"></div>
        <div><label class="lbl">What did you buy? <a href="#" data-a="addCat" class="small">＋ new</a></label><select class="inp" id="eCat">
          ${(A.data.materials || []).length ? `<optgroup label="Raw material (adds to stock)">${A.data.materials.map(m => `<option value="mat:${m.id}">${esc(m.name)} (${esc(m.unit)})</option>`).join('')}</optgroup>` : ''}
          <optgroup label="Other expense">${catList().map(c => `<option>${esc(c)}</option>`).join('')}</optgroup></select></div>
        <div><label class="lbl" id="eQtyL">Quantity bought</label><input class="inp" id="eQty" placeholder="e.g. 5"></div>
        <div><label class="lbl">₹ Amount paid</label><input class="inp" id="eAmt" type="number" inputmode="decimal"></div></div>
      <label class="lbl">Note (optional)</label><input class="inp" id="eNote" placeholder="shop name, etc.">
      <button class="b b-pri b-sm" style="margin-top:10px" data-a="saveExpense">${ic('plus', 15)} Add</button>
      <div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Date</th><th>Item</th><th>Qty / note</th><th class="n">₹</th><th></th></tr></thead><tbody>
      ${s.exps.sort((a, b) => b.date.localeCompare(a.date)).map(e => `<tr><td>${e.date}</td><td>${esc(e.category)}${e.mat ? ' <span class="pill g">stock</span>' : ''}</td><td>${esc(e.qty || '')}${e.note ? ' · ' + esc(e.note) : ''}</td><td class="n">${money(e.amount)}</td><td class="n"><button class="b b-ghost b-xs" data-a="delExpense" data-id="${e.id}" title="Delete">${ic('trash', 14)}</button></td></tr>`).join('') || '<tr><td colspan=5 class="empty">No expenses in range</td></tr>'}</tbody></table></div></div>
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
    conv = `<div class="conv-h"><button class="b b-icon only-m" data-a="chatBack">←</button>${avatar(c, 34)}<b style="flex:1">${esc(c.name)} <span class="muted small">${esc(cur)}</span></b><a class="b b-ghost b-sm" href="${telLink(cur)}">${ic('phone', 15)}</a><a class="b b-wa b-sm" href="${waLink(cur, '')}" target="_blank">${ic('wa', 15)}</a></div>
      <div class="chat" id="chat">${msgs.map(m => `<div class="msg ${m.from === 'admin' ? 'me' : 'them'} ${m.pending ? 'pending' : ''}">${esc(m.text)}<small>${m.pending ? 'sending…' : fmtTime(m.at)}</small></div>`).join('')}</div>
      <div class="row" style="padding:10px;border-top:1px solid var(--a-line);flex-wrap:nowrap;gap:6px"><textarea class="inp" id="replyIn" rows="1" style="flex:1;min-height:42px" placeholder="Type a reply…">${esc(A.replyDraft || '')}</textarea>
        <button class="b b-ghost" data-a="ai" data-f="replyIn" data-m="polite" title="AI: fix spelling & make it polite">${ic('sparkle', 17)}</button><button class="b b-pri" data-a="reply">${ic('send', 17)}</button></div>`;
  }
  return `<p class="small muted">Customers see “Kitchen is online” while this dashboard is open on any admin device.</p>
  <div class="pane chatbox ${cur ? 'has' : ''}"><div class="threads">${list || '<p class="empty">No chats yet.</p>'}</div><div class="conv">${conv}</div></div>`;
}

/* ---------- Settings ---------- */
function renderSettings() {
  const s = A.data.settings || {};
  const url = siteBase();
  const msg = `🌿 Keralam Kitchen 🌿\nHomemade • Fresh • Hygienic\n\nOrder Idli/Dosa batter, Coconut chutney, Rotis & more 👇\n${url}\n\n📲 ${CFG.PHONES.join(' / ')}`;
  const admins = s.admins || [];
  return `<div class="grid2">
  <div class="pane"><h3>${ic('wallet', 18)} UPI payments</h3>
    <p class="small muted">When filled, customers get a “Pay now (UPI)” option that opens GPay / PhonePe / Paytm with the amount filled in. Your QR code is shown too.</p>
    <label class="lbl">UPI ID</label><input class="inp" id="sUpi" value="${esc(s.upiId || '')}" placeholder="e.g. 9594727293@ybl">
    <label class="lbl">Name shown in the UPI app</label><input class="inp" id="sUpiName" value="${esc(s.upiName || 'Keralam Kitchen')}">
    <label class="lbl">UPI QR code image</label>
    <div class="row">${s.upiQr || A.qrDraft ? `<img src="${esc(A.qrDraft || s.upiQr)}" class="qr-prev" alt="QR">` : '<span class="small muted">No QR uploaded</span>'}
      <label class="b b-ghost b-sm">${ic('image', 15)} Upload QR<input type="file" accept="image/*" id="sQr" hidden></label>${s.upiQr ? '<button class="b b-ghost b-sm" data-a="removeQr">Remove</button>' : ''}</div>
    <div class="row" style="margin-top:12px"><button class="b b-pri" data-a="saveSettings">Save UPI</button>
      ${s.upiId ? `<a class="b b-ghost b-sm" href="upi://pay?pa=${encodeURIComponent(s.upiId)}&pn=${encodeURIComponent(s.upiName || 'Keralam Kitchen')}&am=1&cu=INR&tn=Test">Test ₹1 on this phone</a>` : ''}</div></div>
  <div class="pane"><h3>${ic('bell', 18)} Alerts</h3>
    <p class="small muted">An <b>email</b> for every login, sign-up, order, cancel, chat, review and PIN problem (arrives within 1 minute). Install the <b>Gmail app</b> and turn on its notifications.</p>
    <label class="lbl">Send alerts to — add as many emails as you like (one per line)</label>
    <textarea class="inp" id="sEmail" rows="3" placeholder="owner's Gmail (default)">${esc(String(s.notifyEmail || '').split(/[,;\s]+/).filter(Boolean).join('\n'))}</textarea>
    <label class="sw" style="margin-top:12px"><input type="checkbox" id="sAlerts" ${s.emailAlerts !== false ? 'checked' : ''}> Email alerts ON</label>
    <label class="sw" style="margin-top:8px"><input type="checkbox" id="sVisits" ${s.emailVisits ? 'checked' : ''}> Also email when a logged-in customer just opens the website</label>
    <div class="row" style="margin-top:12px"><button class="b b-pri" data-a="saveSettings">Save alerts</button><button class="b b-ghost" data-a="testAlert">Send test alert</button>
      <button class="b b-ghost" data-a="enableBrowserNotif">${ic('bell', 15)} Pop-ups on this device</button></div>
    <p class="small muted">Keep this dashboard open (even in the background) to get a sound + pop-up for new orders and chats.</p></div>
  <div class="pane"><h3>${ic('image', 18)} Website logo</h3>
    <div class="row">${s.logo || A.logoDraft ? `<img src="${esc(A.logoDraft || s.logo)}" class="logo-prev" alt="logo">` : '<span class="brand-mark">🌿</span>'}
      <label class="b b-ghost b-sm">${ic('image', 15)} Upload logo<input type="file" accept="image/*" id="sLogo" hidden></label>${s.logo ? '<button class="b b-ghost b-sm" data-a="removeLogo">Use default 🌿</button>' : ''}</div>
    <button class="b b-pri" style="margin-top:12px" data-a="saveSettings">Save logo</button>
    <p class="small muted">Shown at the top of the customer website and here in the dashboard. A square image works best.</p></div>
  <div class="pane"><h3>${ic('users', 18)} Admins</h3>
    <p class="small muted">Main admins: <b>${CFG.PHONES.join(', ')}</b> (PIN set in Apps Script). Add more people below — each gets their own PIN.</p>
    <div id="admList">${admins.map((a, i) => admRow(a, i)).join('')}</div>
    <button class="b b-ghost b-sm" data-a="addAdmin">${ic('plus', 15)} Add admin</button>
    <button class="b b-pri b-sm" data-a="saveSettings">Save admins</button></div>
  <div class="pane"><h3>${ic('user', 18)} Team & order sources</h3>
    <label class="lbl">People who talk to customers (one per line)</label><textarea class="inp" id="sStaff" rows="4">${esc(staffList().join('\n'))}</textarea>
    <label class="lbl">Where orders come from (one per line)</label><textarea class="inp" id="sSrc" rows="4">${esc(sourceList().join('\n'))}</textarea>
    <label class="lbl">Expense categories (one per line)</label><textarea class="inp" id="sCats" rows="4">${esc(catList().join('\n'))}</textarea>
    <button class="b b-pri b-sm" style="margin-top:10px" data-a="saveSettings">Save lists</button></div>
  <div class="pane"><h3>${ic('sparkle', 18)} AI writing help</h3>
    <p class="small muted">The ${ic('sparkle', 13)} buttons in Chat and Menu fix spelling & grammar for you. It uses Google's free Gemini AI: open <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a>, sign in with your Gmail, click “Create API key”, copy it and paste it here. Free.</p>
    <label class="lbl">Gemini API key ${s.hasAiKey ? '<span class="pill g">connected</span>' : '<span class="pill">not set</span>'}</label>
    <input class="inp" id="sAiKey" type="password" placeholder="${s.hasAiKey ? '•••••••• (saved — paste a new one to change)' : 'paste key here'}">
    <button class="b b-pri b-sm" style="margin-top:10px" data-a="saveSettings">Save key</button></div>
  <div class="pane"><h3>${ic('ext', 18)} Customer link</h3><input class="inp" readonly value="${esc(url)}" onclick="this.select()">
    <div class="row" style="margin-top:10px"><button class="b b-pri b-sm" data-a="copy" data-v="${esc(url)}">Copy link</button>
    <a class="b b-wa b-sm" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank">Share on WhatsApp</a></div>
    <img alt="QR code" style="margin-top:14px;width:180px;height:180px;background:#fff;padding:8px;border-radius:12px;border:1px solid var(--a-line)" src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}" onerror="this.remove()"></div>
  <div class="pane"><h3>${ic('trash', 18)} Trash</h3><p class="small muted">Deleted orders, dishes, customers, expenses and raw materials stay in Trash for 30 days so you can restore them.</p>
    <button class="b b-ghost b-sm" data-a="tab" data-t="trash">Open trash (${(A.data.trash || []).length})</button>
    <p>Backend: ${DEMO ? '⚠️ Demo mode (data only on this device)' : '✅ Connected to Google Sheet'}</p></div>
  </div>`;
}
const admRow = (a, i) => `<div class="row adm-row" style="gap:6px;margin:6px 0;flex-wrap:nowrap"><input class="inp" data-k="name" placeholder="Name" value="${esc(a.name || '')}"><input class="inp" data-k="phone" inputmode="numeric" placeholder="Mobile" value="${esc(a.phone || '')}"><input class="inp" data-k="pin" inputmode="numeric" placeholder="PIN" style="max-width:90px" value="${esc(a.pin || '')}"><button class="b b-ghost b-xs" data-a="rmAdmin">${ic('x', 14)}</button></div>`;
const DEF_STAFF = ['Mustafa', 'Adil', 'Fehmida', 'Ronak'];
const DEF_SRC = ['Phone call', 'WhatsApp', 'Society app', 'Walk-in', 'Website'];
const DEF_CATS = ['Gas', 'Packaging', 'Electricity', 'Transport', 'Utensils', 'Other'];
const staffList = () => (A.data.settings.staff && A.data.settings.staff.length ? A.data.settings.staff : DEF_STAFF);
const sourceList = () => (A.data.settings.sources && A.data.settings.sources.length ? A.data.settings.sources : DEF_SRC);
const catList = () => (A.data.settings.expenseCats && A.data.settings.expenseCats.length ? A.data.settings.expenseCats : DEF_CATS);
const lines = v => v.split('\n').map(x => x.trim()).filter(Boolean);

/* ---------- Raw material, recipes & cost ---------- */
const fmtQty = n => String(Math.round((+n || 0) * 1000) / 1000);
const isLow = m => (+m.stock || 0) <= (+m.low || 0) && (+m.low || 0) > 0 || (+m.stock || 0) < 0;
const lowStock = () => ((A.data && A.data.materials) || []).filter(isLow);
const matOf = id => (A.data.materials || []).find(m => m.id === id);
function variantCost(v) {
  const mats = (v.recipe || []).reduce((a, r) => { const m = matOf(r.mat); return a + (m ? (+r.qty || 0) * (+m.costPerUnit || 0) : 0); }, 0);
  const labour = (+v.prepMins || 0) / 60 * (+A.data.settings.labourRate || 0);
  const pack = (+v.packCost || 0) + (+v.otherCost || 0);
  return { mats, pack, labour, total: mats + pack + labour };
}
function costTag(m) {
  const v = m.variants[0]; if (!v || !(v.recipe || []).length) return '';
  const c = variantCost(v), pr = v.price - c.total;
  return ` <span class="pill ${pr >= 0 ? 'g' : 'r'}">profit ${money(pr)} (${v.price ? Math.round(pr / v.price * 100) : 0}%)</span>`;
}
function renderStock() {
  const d = A.data, mats = d.materials || [];
  return `<div class="grid2">
    <div class="pane"><div class="pane-h"><h3>Raw material stock</h3><button class="b b-pri b-sm" data-a="editMat">${ic('plus', 15)} Add raw material</button></div>
      <p class="small muted">Buying raw material? Add it in <b>Accounts → Add expense</b> and pick the material — stock and cost per unit update by themselves.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Material</th><th class="n">In stock</th><th class="n">Cost / unit</th><th class="n">Value</th><th></th></tr></thead><tbody>
      ${mats.map(m => `<tr><td><b>${esc(m.name)}</b>${isLow(m) ? ' <span class="pill r">low</span>' : ''}</td><td class="n ${isLow(m) ? 'txt-r' : ''}">${fmtQty(m.stock)} ${esc(m.unit)}</td><td class="n">${money(m.costPerUnit)}/${esc(m.unit)}</td><td class="n">${money((m.stock || 0) * (m.costPerUnit || 0))}</td>
        <td class="n" style="white-space:nowrap"><button class="b b-ghost b-xs" data-a="editMat" data-id="${m.id}">${ic('edit', 14)}</button> <button class="b b-ghost b-xs" data-a="delMat" data-id="${m.id}">${ic('trash', 14)}</button></td></tr>`).join('') || '<tr><td colspan=5 class="empty">No raw materials yet. Add rice, urad dal, coconut, atta…</td></tr>'}</tbody></table></div></div>
    <div class="pane"><h3>Record what you made</h3>
      <p class="small muted">Tell us how much you prepared — the raw material used (from the recipe) is taken out of stock.</p>
      <div class="form2"><div><label class="lbl">Dish & size</label><select class="inp" id="prItem">${d.menu.map(m => m.variants.map((v, i) => `<option value="${m.id}|${i}">${esc(m.name)} — ${esc(v.label)}${(v.recipe || []).length ? '' : ' (no recipe yet)'}</option>`).join('')).join('')}</select></div>
        <div><label class="lbl">How many made</label><input class="inp" id="prQty" type="number" inputmode="decimal" placeholder="e.g. 10"></div></div>
      <button class="b b-pri b-sm" style="margin-top:10px" data-a="produce">${ic('check', 15)} Save & update stock</button>
      <h4 style="margin:16px 0 6px">Recent</h4>
      ${(d.production || []).sort((a, b) => b.at - a.at).slice(0, 8).map(p => `<div class="pick"><span class="pick-t">${ago(p.at)}</span><span style="flex:1">${esc(p.itemName)} ${esc(p.variant)} × <b>${p.qty}</b><div class="small muted">${p.used.map(u => esc(u.name) + ' ' + fmtQty(u.qty) + esc(u.unit)).join(', ')}</div></span></div>`).join('') || '<p class="empty">Nothing recorded yet.</p>'}</div>
  </div>
  <div class="pane"><div class="pane-h"><h3>Cost of making & profit per dish</h3><span class="small muted">Labour ₹/hour: <input class="inp inline" id="labRate" type="number" value="${+d.settings.labourRate || 0}" style="width:80px"></span></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Dish</th><th class="n">Price</th><th class="n">Raw material</th><th class="n">Packing</th><th class="n">Prep</th><th class="n">Total cost</th><th class="n">Profit</th><th></th></tr></thead><tbody>
    ${d.menu.map(m => m.variants.map((v, i) => { const c = variantCost(v), pr = v.price - c.total, has = (v.recipe || []).length || v.packCost;
      return `<tr><td><b>${esc(m.name)}</b> <span class="muted">${esc(v.label)}</span></td><td class="n">${money(v.price)}</td><td class="n">${money(c.mats)}</td><td class="n">${money(c.pack)}</td><td class="n">${v.prepMins ? v.prepMins + ' min' : '—'}</td>
        <td class="n"><b>${has ? money(c.total) : '—'}</b></td><td class="n ${pr >= 0 ? 'txt-g' : 'txt-r'}"><b>${has ? money(pr) + ' · ' + (v.price ? Math.round(pr / v.price * 100) : 0) + '%' : '—'}</b></td>
        <td class="n"><button class="b ${has ? 'b-ghost' : 'b-pri'} b-xs" data-a="editRecipe" data-id="${m.id}" data-v="${i}">${has ? 'Edit' : 'Add'} cost breakdown</button></td></tr>`; }).join('')).join('')}</tbody></table></div></div>`;
}
function editMat(id) {
  const m = matOf(id) || { name: '', unit: 'kg', stock: 0, costPerUnit: 0, low: 0 };
  openSheet(`<div class="row between"><h2 style="margin:0">${id ? 'Edit' : 'Add'} raw material</h2><button class="b b-icon" data-a="close">${ic('x', 18)}</button></div>
    <div class="form2"><div><label class="lbl">Name</label><input class="inp" id="mName" value="${esc(m.name)}" placeholder="Rice"></div>
      <div><label class="lbl">Unit</label><select class="inp" id="mUnit">${['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'dozen'].map(u => `<option ${u === m.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      <div><label class="lbl">In stock now</label><input class="inp" id="mStock" type="number" inputmode="decimal" value="${m.stock}"></div>
      <div><label class="lbl">Cost per unit (₹)</label><input class="inp" id="mCost" type="number" inputmode="decimal" value="${m.costPerUnit}"></div>
      <div><label class="lbl">Warn me when below</label><input class="inp" id="mLow" type="number" inputmode="decimal" value="${m.low || 0}"></div></div>
    <div class="row" style="margin-top:16px"><button class="b b-pri" style="flex:1" data-a="saveMat" data-id="${id || ''}">Save</button><button class="b b-ghost" data-a="close">Cancel</button></div>`);
}
function editRecipe(id, vi) {
  const m = A.data.menu.find(x => x.id === id), v = m.variants[vi];
  const rows = (v.recipe || []).length ? v.recipe : [{ mat: '', qty: '' }];
  const mats = A.data.materials || [];
  if (!mats.length) return toast('First add raw materials (rice, dal…) with “Add raw material”', 4500);
  const row = r => `<div class="row rc-row" style="gap:6px;margin:6px 0;flex-wrap:nowrap"><select class="inp" data-k="mat" style="flex:2"><option value="">— material —</option>${mats.map(x => `<option value="${x.id}" ${x.id === r.mat ? 'selected' : ''}>${esc(x.name)} (₹${x.costPerUnit}/${esc(x.unit)})</option>`).join('')}</select>
    <input class="inp" data-k="qty" type="number" inputmode="decimal" step="any" placeholder="qty" value="${r.qty}" style="flex:1"><button class="b b-ghost b-xs" data-a="rmRc">${ic('x', 14)}</button></div>`;
  A.rcRow = row;
  openSheet(`<div class="row between"><h2 style="margin:0">Cost breakdown — ${esc(m.name)} ${esc(v.label)}</h2><button class="b b-icon" data-a="close">${ic('x', 18)}</button></div>
    <p class="small muted">How much of each raw material goes into <b>one ${esc(v.label)}</b>? (use the material's unit, e.g. 0.4 for 400 g when the unit is kg)</p>
    <div id="rcRows">${rows.map(row).join('')}</div><button class="b b-ghost b-sm" data-a="addRc">${ic('plus', 15)} Add material</button>
    <div class="form2"><div><label class="lbl">Preparing time (minutes)</label><input class="inp" id="rcPrep" type="number" value="${v.prepMins || ''}"></div>
      <div><label class="lbl">Packing cost (₹)</label><input class="inp" id="rcPack" type="number" inputmode="decimal" value="${v.packCost || ''}"></div>
      <div><label class="lbl">Other cost (₹ gas etc.)</label><input class="inp" id="rcOther" type="number" inputmode="decimal" value="${v.otherCost || ''}"></div></div>
    <div class="pane" id="rcSum" style="margin-top:12px"></div>
    <div class="row" style="margin-top:12px"><button class="b b-pri" style="flex:1" data-a="saveRecipe" data-id="${id}" data-v="${vi}">Save</button><button class="b b-ghost" data-a="close">Cancel</button></div>`, true);
  rcCalc();
}
function readRc() {
  return { recipe: $$('.rc-row').map(r => ({ mat: $('[data-k=mat]', r).value, qty: +$('[data-k=qty]', r).value || 0 })).filter(r => r.mat && r.qty),
    prepMins: +$('#rcPrep').value || 0, packCost: +$('#rcPack').value || 0, otherCost: +$('#rcOther').value || 0 };
}
function rcCalc() {
  const box = $('#rcSum'); if (!box) return;
  const r = readRc(), btn = $('[data-a=saveRecipe]'), m = A.data.menu.find(x => x.id === btn.dataset.id), v = m.variants[+btn.dataset.v];
  const c = variantCost(r), pr = v.price - c.total;
  box.innerHTML = `<div class="kpis mini">${kpi('Raw material', money(c.mats))}${kpi('Packing + other', money(c.pack))}${kpi('Labour', money(c.labour), (+A.data.settings.labourRate || 0) ? '' : 'set ₹/hour on the page')}
    ${kpi('Cost to make', money(c.total), '', 'tone-y')}${kpi('Selling price', money(v.price))}${kpi('Profit', money(pr), (v.price ? Math.round(pr / v.price * 100) : 0) + '% margin', pr >= 0 ? 'tone-g' : 'tone-r')}</div>`;
}

/* ---------- Trash ---------- */
const TBL_NAME = { orders: 'Order', menu: 'Dish', customers: 'Customer', expenses: 'Expense', materials: 'Raw material' };
function renderTrash() {
  const tr = (A.data.trash || []).slice().sort((a, b) => b.at - a.at);
  return `<div class="toolbar"><p class="small muted" style="margin:0;flex:1">Deleted things stay here for 30 days, then they are removed for good. Restore anything deleted by mistake.</p>
    ${tr.length ? `<button class="b b-dan b-sm" data-a="emptyTrash">${ic('trash', 15)} Empty trash</button>` : ''}</div>
    <div class="pane">${tr.map(t => `<div class="pick"><span class="pill">${TBL_NAME[t.table] || t.table}</span><span style="flex:1"><b>${esc(t.label)}</b><div class="small muted">deleted ${ago(t.at)} · removed for good in ${Math.max(0, 30 - Math.floor((Date.now() - t.at) / DAY))} days</div></span>
      <button class="b b-pri b-sm" data-a="restore" data-id="${t.id}">${ic('undo', 15)} Restore</button><button class="b b-ghost b-sm" data-a="purge" data-id="${t.id}" title="Delete forever">${ic('x', 15)}</button></div>`).join('') || '<p class="empty">Trash is empty.</p>'}</div>`;
}
async function softDelete(action, d, table, idKey, label) {
  const list = A.data[table], i = list.findIndex(x => String(x[idKey]) === String(d.id || d.phone)), obj = list[i];
  if (i >= 0) list.splice(i, 1);
  closeSheet(); render();
  try {
    const r = await adminApi(action, d);
    if (r.trash) A.data.trash.push(r.trash);
    toast(label + ' moved to trash', 7000, () => restore(r.trash && r.trash.id));
  } catch (e) { if (obj) list.splice(i, 0, obj); render(); toast(e.message, 4000); }
}
async function restore(tid) {
  if (!tid) return;
  try {
    const r = await adminApi('adminRestore', { id: tid });
    A.data.trash = A.data.trash.filter(t => t.id !== tid);
    const list = A.data[r.table]; if (list) { const k = r.table === 'customers' ? 'id' : 'id'; if (!list.find(x => x[k] === r.obj[k])) list.push(r.obj); if (r.table === 'orders') list.sort((a, b) => b.createdAt - a.createdAt); }
    render(); toast('Restored ✓');
  } catch (e) { toast(e.message, 4000); }
}

/* ---------- Dashboard layout (choose cards) ---------- */
const DEF_LAYOUT = { cards: ['orders', 'collected', 'active', 'visitors', 'customers', 'rating'], panels: ['attention', 'activity', 'pickups', 'stockp'] };
const CARD_NAMES = { orders: 'Orders today', collected: 'Collected today', active: 'Active orders', visitors: 'Visitors today', customers: 'Customers', rating: 'Rating', month: 'This month (sales, expenses, profit)', stock: 'Low raw material', chats: 'Chats waiting', guests: 'WhatsApp orders today',
  attention: 'Needs attention', pickups: "Today's pickups", activity: 'Live activity', stockp: 'Raw material in stock', prep: 'To prepare' };
function dashLayout() { return lsGet('kk_dash', DEF_LAYOUT); }
function customize() {
  const lay = dashLayout();
  const grp = (k, title) => `<h4 style="margin:12px 0 6px">${title}</h4>${A.cardDefs[k].map(c => `<label class="sw cz"><input type="checkbox" data-g="${k}" value="${c}" ${lay[k].includes(c) ? 'checked' : ''}> ${CARD_NAMES[c] || c}</label>`).join('')}`;
  openSheet(`<div class="row between"><h2 style="margin:0">Customize dashboard</h2><button class="b b-icon" data-a="close">${ic('x', 18)}</button></div>
    <p class="small muted">Tick what you want to see on the Overview. Unticked cards are hidden (nothing is deleted).</p>
    ${grp('cards', 'Number cards')}${grp('panels', 'Boxes')}
    <div class="row" style="margin-top:16px"><button class="b b-pri" style="flex:1" data-a="saveLayout">Save</button><button class="b b-ghost" data-a="resetLayout">Reset</button></div>`);
}

/* ---------- Calculator (pop-up, keeps history) ---------- */
function calc() {
  if ($('#calcPop')) { $('#calcPop').remove(); return; }
  const el = document.createElement('div'); el.id = 'calcPop'; el.className = 'calc-pop';
  const keys = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '='];
  el.innerHTML = `<div class="calc-h"><b>${ic('calc', 16)} Calculator</b><button class="b b-icon b-xs" data-c="close">${ic('x', 16)}</button></div>
    <input class="calc-in" id="calcIn" inputmode="decimal" autocomplete="off" placeholder="0"><div class="calc-res" id="calcRes"></div>
    <div class="calc-k">${keys.map(k => `<button data-c="${k}" class="${'÷×−+='.includes(k) ? 'op' : ''}">${k}</button>`).join('')}</div>
    <div class="calc-hist" id="calcHist"></div>`;
  document.body.appendChild(el);
  const inp = $('#calcIn'), hist = () => { $('#calcHist').innerHTML = lsGet('kk_calc', []).map(h => `<button data-h="${esc(h.r)}">${esc(h.e)} = <b>${esc(h.r)}</b></button>`).join('') + (lsGet('kk_calc', []).length ? '<button data-c="clearh" class="small muted">Clear history</button>' : ''); };
  const evalx = e => { const x = e.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/%/g, '/100'); if (!/^[\d+\-*/().\s]*$/.test(x) || !x.trim()) return ''; try { const v = Function('return (' + x + ')')(); return isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : ''; } catch (e) { return ''; } };
  const live = () => { $('#calcRes').textContent = evalx(inp.value) ? '= ' + evalx(inp.value) : ''; };
  const eq = () => { const r = evalx(inp.value); if (r === '') return; const h = lsGet('kk_calc', []); h.unshift({ e: inp.value, r }); lsSet('kk_calc', h.slice(0, 30)); inp.value = r; live(); hist(); };
  el.onclick = e => { const b = e.target.closest('[data-c],[data-h]'); if (!b) return;
    if (b.dataset.h) { inp.value += b.dataset.h; live(); return; }
    const k = b.dataset.c;
    if (k === 'close') return el.remove(); if (k === 'clearh') { lsSet('kk_calc', []); return hist(); }
    if (k === 'C') inp.value = ''; else if (k === '⌫') inp.value = inp.value.slice(0, -1); else if (k === '=') return eq(); else inp.value += k;
    live(); };
  inp.oninput = live; inp.onkeydown = e => { if (e.key === 'Enter') eq(); if (e.key === 'Escape') el.remove(); };
  hist(); if (matchMedia('(min-width: 700px)').matches) inp.focus();
}

/* ---------- AI writing helper ---------- */
const aiBtns = (field, mode) => `<button type="button" class="b b-ghost b-xs ai-b" data-a="ai" data-f="${field}" data-m="${mode}">${ic('sparkle', 13)} Fix with AI</button>`;
async function aiFix(el) {
  const f = $('#' + el.dataset.f); if (!f) return;
  const text = f.value.trim(); if (!text) return toast('Write something first');
  const old = el.innerHTML; el.disabled = true; el.innerHTML = ic('sparkle', 13) + ' …';
  try { const r = await adminApi('adminAI', { text, mode: el.dataset.m }); f.value = r.text; f.focus(); toast('AI rewrote it ✓ — check & send', 2500, () => { f.value = text; }); if (f.id === 'replyIn') A.replyDraft = r.text; }
  catch (e) { toast(e.message, 5000); }
  el.disabled = false; el.innerHTML = old;
}

/* ---------- Notifications (sound + pop-up + title) ---------- */
function notifBanner() {
  if (!('Notification' in window) || Notification.permission === 'granted') return '';
  return `<div class="nbanner">${ic('bell', 18)} <span>Turn on pop-up alerts on this device to hear about new orders & chats instantly.</span><button class="b b-pri b-sm" data-a="enableBrowserNotif">Turn on</button></div>`;
}
let lastNag = 0;
function attention() {
  if (!A.data) return;
  const c = counts(), n = c.newOrders + c.chat;
  document.title = (n ? '(' + n + ') ' : '') + 'Keralam Kitchen — Admin';
  // keep reminding every 45 s while an order waits for acceptance or a chat is unanswered
  if (n && Date.now() - lastNag > 45000) { if (lastNag) { beep(); sysNotify('Keralam Kitchen — waiting on you', (c.newOrders ? c.newOrders + ' order(s) to accept. ' : '') + (c.chat ? c.chat + ' chat(s) to answer.' : '')); } lastNag = Date.now(); }
  if (!n) lastNag = 0;
}

/* ---------- Actions ---------- */
async function update(id, patch, okMsg) {
  const i = A.data.orders.findIndex(o => o.id === id), before = A.data.orders[i];
  // show the change instantly, save in the background
  const opt = { ...before, ...patch }; if (patch.status) { opt[patch.status + 'At'] = Date.now(); if (patch.status === 'collected') opt.payStatus = 'paid'; }
  if (patch.pickupAt !== undefined) opt.pickupAt = +patch.pickupAt || 0;
  if (!patch.items) { A.data.orders[i] = opt; render(); if (okMsg) toast(okMsg); }
  try { const { order } = await adminApi('adminUpdateOrder', { id, patch }); const j = A.data.orders.findIndex(o => o.id === id); if (j >= 0) A.data.orders[j] = order; if (patch.items) { render(); if (okMsg) toast(okMsg); } else if (!$('#overlay')) render(); return order; }
  catch (e) { A.data.orders[i] = before; render(); toast('Not saved: ' + e.message, 4500); }
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
    const p = update(el.dataset.id, { status: el.dataset.s }, '✓ ' + ST_LABEL[el.dataset.s]);
    const o = A.data.orders.find(x => x.id === el.dataset.id);
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
    update(el.dataset.id, { status: 'collected', payMethod: el.dataset.m }, '✓ Collected');
    const o = A.data.orders.find(x => x.id === el.dataset.id);
    if (o && o.phone) openSheet(`<h2>❤️ Say thank you</h2><p>Send ${esc(o.name)} a thank-you with the review link (review opens in 40 min):</p>
      <a class="b b-wa b-full" href="${waLink(o.phone, statusMsg(o))}" target="_blank" data-a="close">📲 Thank-you on WhatsApp</a>
      <a class="b b-ghost b-full" style="margin-top:8px" href="sms:+91${o.phone}?body=${encodeURIComponent(statusMsg(o))}">✉️ SMS</a>
      <button class="b b-ghost b-full" style="margin-top:8px" data-a="close">Skip</button>`);
  },
  adminCancel: async el => {
    const r = prompt('Reason for cancelling ' + el.dataset.id + ' (customer will see this):', ''); if (r === null) return;
    update(el.dataset.id, { status: 'cancelled', cancelReason: r }, 'Cancelled');
    const o = A.data.orders.find(x => x.id === el.dataset.id);
    if (o && o.phone) openSheet(`<h2>Order cancelled</h2><a class="b b-wa b-full" href="${waLink(o.phone, statusMsg(o))}" target="_blank" data-a="close">📲 Inform on WhatsApp</a><button class="b b-ghost b-full" style="margin-top:8px" data-a="close">Close</button>`);
  },
  editOrder: el => {
    const o = A.data.orders.find(x => x.id === el.dataset.id);
    openSheet(`<div class="row between"><h2 style="margin:0">✏️ Edit ${esc(o.id)}</h2><button class="b b-icon" data-a="close">✕</button></div>
      <div class="form2 f3"><div><label class="lbl">Name</label><input class="inp" id="eoName" value="${esc(o.name || '')}"></div><div><label class="lbl">Flat</label><input class="inp" id="eoFlat" value="${esc(o.flat || '')}"></div><div><label class="lbl">Mobile</label><input class="inp" id="eoPhone" inputmode="numeric" value="${esc(o.phone || '')}"></div>
        <div><label class="lbl">Order came from</label><input class="inp" id="eoSrc" list="srcL" value="${esc(o.source || '')}"><datalist id="srcL">${sourceList().map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
        <div><label class="lbl">Customer contacted</label><input class="inp" id="eoBy" list="byL" value="${esc(o.contactedBy || '')}"><datalist id="byL">${staffList().map(x => `<option value="${esc(x)}">`).join('')}</datalist></div></div>
      ${o.type === 'custom' ? `<label class="lbl">Price agreed (₹)</label><input class="inp" id="eoTotal" type="number" value="${o.total || ''}">` : `<label class="lbl">Items</label>${itemsEditor(o.items)}`}
      <div class="form2"><div><label class="lbl">Pickup</label><input class="inp" type="datetime-local" id="eoPick" value="${toLocalInput(o.pickupAt)}"></div>
      <div><label class="lbl">Payment</label><select class="inp" id="eoPay"><option value="due" ${o.payStatus !== 'paid' ? 'selected' : ''}>Due</option><option value="paid" ${o.payStatus === 'paid' ? 'selected' : ''}>Paid</option></select></div></div>
      <label class="lbl">Customer notes</label><input class="inp" id="eoNotes" value="${esc(o.notes || '')}">
      <label class="lbl">Admin note (private) / preparation</label><input class="inp" id="eoAdmin" value="${esc(o.adminNote || '')}">
      <div class="row" style="margin-top:16px"><button class="b b-pri" style="flex:1" data-a="saveOrder" data-id="${o.id}">Save</button><button class="b b-ghost" data-a="close">Close</button></div>`, true);
  },
  saveOrder: async el => {
    const o = A.data.orders.find(x => x.id === el.dataset.id);
    const patch = { pickupAt: $('#eoPick').value ? new Date($('#eoPick').value).getTime() : o.pickupAt, notes: $('#eoNotes').value, adminNote: $('#eoAdmin').value, payStatus: $('#eoPay').value,
      name: $('#eoName').value.trim(), flat: $('#eoFlat').value.trim(), phone: $('#eoPhone').value, source: $('#eoSrc').value.trim(), contactedBy: $('#eoBy').value.trim() };
    if (o.type === 'custom') patch.total = $('#eoTotal').value; else { patch.items = readLines(); if (!patch.items.length) return toast('Add at least one item'); }
    closeSheet(); await update(o.id, patch, 'Saved ✓');
  },
  deleteOrder: el => { const o = A.data.orders.find(x => x.id === el.dataset.id); if (!confirm(`Delete order ${o.id} (${o.name}, ${money(o.total)}) completely?\nIt will not count in Accounts or Analysis. You can restore it from Trash for 30 days.`)) return; softDelete('adminDeleteOrder', { id: o.id }, 'orders', 'id', 'Order ' + o.id); },
  deleteCancelled: async () => {
    const list = A.data.orders.filter(o => o.status === 'cancelled'); if (!confirm(`Delete all ${list.length} cancelled orders? They go to Trash for 30 days.`)) return;
    A.data.orders = A.data.orders.filter(o => o.status !== 'cancelled'); render();
    for (const o of list) { try { const r = await adminApi('adminDeleteOrder', { id: o.id }); A.data.trash.push(r.trash); } catch (e) {} }
    toast(list.length + ' cancelled orders moved to trash'); render();
  },
  addLine: () => { $('#lines').insertAdjacentHTML('beforeend', lineRow({ id: A.data.menu[0].id, v: 0, addonIdx: [], qty: 1 })); },
  newPhoneOrder: el => phoneOrderSheet(el.dataset.phone),
  savePhoneOrder: async el => {
    const customer = { name: $('#poName').value, flat: $('#poFlat').value, phone: $('#poPhone').value };
    const ph = KKCore.digits(customer.phone); if (ph && ph.length !== 10) return toast('Mobile should be 10 digits (or leave it empty)');
    const items = readLines(); if (!items.length) return toast('Add at least one item');
    const other = (v, q) => v === '__other' ? (prompt(q) || 'Other') : v;
    const source = other($('#poSrc').value, 'Where did the order come from?'), contactedBy = other($('#poBy').value, 'Who talked to the customer?');
    const st = $('#poSt').value;
    el.disabled = true;
    try {
      const { order } = await adminApi('placeOrder', { id: KKCore.newOrderId(), customer, items, pickupAt: $('#poPick').value ? new Date($('#poPick').value).getTime() : 0, notes: $('#poNotes').value, pay: 'spot', source, contactedBy, status: st === 'collected' ? 'ready' : st });
      A.data.orders.unshift(order); closeSheet(); A.tab = 'orders'; lsSet('kk_admin_tab', 'orders'); render(); toast('Order created ✓');
      if (st === 'collected') update(order.id, { status: 'collected', payMethod: 'cash' });
      load(true);
    } catch (e) { toast(e.message, 4000); el.disabled = false; }
  },
  toggle: async el => {
    const m = A.data.menu.find(x => x.id === el.dataset.id), k = el.dataset.k, v = el.checked; m[k] = v; toast('Saved ✓', 1200);
    try { await adminApi('adminSaveItem', { item: m }); } catch (e) { m[k] = !v; render(); toast('Not saved: ' + e.message); }
  },
  editItem: el => editItem(el.dataset.id),
  saveItem: async el => {
    const old = A.data.menu.find(x => x.id === el.dataset.id) || { inStock: true };
    const item = { ...old, id: el.dataset.id || undefined, name: $('#iName').value.trim(), emoji: $('#iEmoji').value.trim(), img: $('#iImg').value.trim(), desc: $('#iDesc').value.trim(),
      tags: $('#iTags').value.split(',').map(s => s.trim()).filter(Boolean), variants: parseLines($('#iVar').value), addons: parseLines($('#iAdd').value),
      leadMins: +$('#iLead').value || 0, prep: $('#iPrep').value, sort: +$('#iSort').value || 0 };
    el.disabled = true;
    try { const r = await adminApi('adminSaveItem', { item }); const i = A.data.menu.findIndex(x => x.id === r.item.id); if (i >= 0) A.data.menu[i] = r.item; else A.data.menu.push(r.item); closeSheet(); render(); toast('Saved ✓'); } catch (e) { toast(e.message, 4000); el.disabled = false; }
  },
  deleteItem: el => { if (!confirm('Delete this dish from the menu? (You can restore it from Trash for 30 days.)')) return; softDelete('adminDeleteItem', { id: el.dataset.id }, 'menu', 'id', 'Dish'); },
  openCustomer: el => openCustomer(el.dataset.p),
  editCustomer: el => editCustomer(el.dataset.p),
  ecNoPhoto: () => { editPhoto = ''; $('#ecPrev').innerHTML = avatar({ name: $('#ecName').value }, 56); },
  saveCustomer: async el => {
    const customer = { name: $('#ecName').value.trim(), flat: $('#ecFlat').value.trim(), phone: KKCore.digits($('#ecPhone').value), pin: $('#ecPin').value.trim(), note: $('#ecNote').value, blocked: $('#ecBlocked').checked, source: 'phone' };
    if (editPhoto !== undefined) customer.photo = editPhoto;
    el.disabled = true;
    try { const r = await adminApi('adminSaveCustomer', { customer, originalPhone: el.dataset.orig });
      A.data.customers = A.data.customers.filter(c => c.id !== el.dataset.orig && c.id !== r.customer.id); A.data.customers.push(r.customer);
      render(); openCustomer(r.customer.id); toast('Customer saved ✓'); }
    catch (e) { toast(e.message, 4000); el.disabled = false; }
  },
  blockCustomer: async el => {
    const block = !!el.dataset.b, c = custOf(el.dataset.p);
    const reason = block ? prompt(`Block ${c.name}? They won't be able to log in or order.\nReason (private, optional):`, '') : '';
    if (block && reason === null) return;
    c.blocked = block; c.blockReason = reason || ''; render(); openCustomer(el.dataset.p); toast(block ? '⛔ Blocked' : '✅ Unblocked');
    try { await adminApi('adminBlockCustomer', { phone: el.dataset.p, blocked: block, reason }); } catch (e) { c.blocked = !block; render(); toast('Not saved: ' + e.message); }
  },
  deleteCustomer: async el => {
    const c = custOf(el.dataset.p);
    if (!confirm(`Delete ${c.name} (${c.phone || 'no number'})?\nTheir account and PIN are removed. Past orders stay. You can restore from Trash for 30 days.`)) return;
    softDelete('adminDeleteCustomer', { phone: c.id }, 'customers', 'id', c.name);
  },
  range30: () => { defaultRange(); render(); },
  saveExpense: async el => {
    const amt = +$('#eAmt').value; if (!amt) return toast('Enter amount');
    const cat = $('#eCat').value, mat = cat.startsWith('mat:') ? matOf(cat.slice(4)) : null;
    const e = { id: KKCore.newId('E'), date: $('#eDate').value, category: mat ? mat.name : cat, qty: $('#eQty').value + (mat ? ' ' + mat.unit : ''), note: $('#eNote').value.trim(), amount: amt };
    if (mat) { if (!(+$('#eQty').value > 0)) return toast('Enter how much you bought (number)'); e.mat = mat.id; e.mqty = +$('#eQty').value; }
    A.data.expenses.push(e); render(); toast(mat ? 'Added ✓ — stock updated' : 'Added ✓');
    try { const r = await adminApi('adminSaveExpense', { expense: e }); if (r.materials) A.data.materials = r.materials; render(); }
    catch (x) { A.data.expenses = A.data.expenses.filter(y => y !== e); render(); toast('Not saved: ' + x.message); }
  },
  delExpense: el => softDelete('adminDeleteExpense', { id: el.dataset.id }, 'expenses', 'id', 'Expense'),
  addCat: () => { const c = prompt('New expense category name:'); if (!c) return; const cats = [...catList(), c.trim()]; A.data.settings.expenseCats = cats; adminApi('adminSaveSettings', { settings: { expenseCats: cats } }).catch(e => toast(e.message)); render(); toast('Category added ✓'); },
  hideReview: async el => { const r = A.data.reviews.find(x => x.id === el.dataset.id); r.hidden = !r.hidden; render(); adminApi('adminHideReview', { id: el.dataset.id }).catch(e => toast(e.message)); },
  calc: () => calc(),
  customize: () => customize(),
  saveLayout: () => { const lay = { cards: $$('[data-g=cards]:checked').map(x => x.value), panels: $$('[data-g=panels]:checked').map(x => x.value) }; lsSet('kk_dash', lay); closeSheet(); render(); toast('Dashboard updated ✓'); },
  resetLayout: () => { lsSet('kk_dash', DEF_LAYOUT); closeSheet(); render(); },
  editMat: el => editMat(el.dataset.id),
  saveMat: async el => {
    const old = matOf(el.dataset.id) || {};
    const material = { ...old, id: el.dataset.id || undefined, name: $('#mName').value.trim(), unit: $('#mUnit').value, stock: +$('#mStock').value || 0, costPerUnit: +$('#mCost').value || 0, low: +$('#mLow').value || 0 };
    if (!material.name) return toast('Enter a name');
    el.disabled = true;
    try { const r = await adminApi('adminSaveMaterial', { material }); A.data.materials = A.data.materials.filter(m => m.id !== r.material.id); A.data.materials.push(r.material); closeSheet(); render(); toast('Saved ✓'); }
    catch (e) { toast(e.message); el.disabled = false; }
  },
  delMat: el => { if (!confirm('Delete this raw material?')) return; softDelete('adminDeleteMaterial', { id: el.dataset.id }, 'materials', 'id', 'Raw material'); },
  produce: async el => {
    const [itemId, v] = $('#prItem').value.split('|'), qty = +$('#prQty').value; if (!(qty > 0)) return toast('Enter how many you made');
    el.disabled = true;
    try { const r = await adminApi('adminProduce', { itemId, v: +v, qty }); A.data.materials = r.materials; A.data.production.push(r.production); render();
      toast(r.production.used.length ? 'Saved ✓ — stock updated' : 'Saved — add a cost breakdown (recipe) to auto-update stock', 4000); }
    catch (e) { toast(e.message); el.disabled = false; }
  },
  editRecipe: el => editRecipe(el.dataset.id, +el.dataset.v),
  addRc: () => { $('#rcRows').insertAdjacentHTML('beforeend', A.rcRow({ mat: '', qty: '' })); },
  rmRc: el => { el.closest('.rc-row').remove(); rcCalc(); },
  saveRecipe: async el => {
    const m = A.data.menu.find(x => x.id === el.dataset.id), v = m.variants[+el.dataset.v], r = readRc();
    Object.assign(v, r); v.cost = Math.round(variantCost(v).total * 100) / 100;
    closeSheet(); render(); toast('Cost breakdown saved ✓');
    try { await adminApi('adminSaveItem', { item: m }); } catch (e) { toast('Not saved: ' + e.message); }
  },
  restore: el => restore(el.dataset.id),
  purge: async el => { if (!confirm('Delete forever? This cannot be undone.')) return; A.data.trash = A.data.trash.filter(t => t.id !== el.dataset.id); render(); adminApi('adminPurge', { id: el.dataset.id }).catch(e => toast(e.message)); },
  emptyTrash: async () => { if (!confirm('Delete everything in trash forever? This cannot be undone.')) return; const ids = A.data.trash.map(t => t.id); A.data.trash = []; render(); adminApi('adminPurge', { ids }).catch(e => toast(e.message)); },
  ai: el => aiFix(el),
  addAdmin: () => { $('#admList').insertAdjacentHTML('beforeend', admRow({}, 0)); },
  rmAdmin: el => el.closest('.adm-row').remove(),
  removeQr: () => { A.qrDraft = ''; A.data.settings.upiQr = ''; A.qrRemove = true; render(); },
  removeLogo: () => { A.logoDraft = ''; A.data.settings.logo = ''; A.logoRemove = true; render(); },
  openChat: el => { closeSheet(); A.tab = 'chat'; A.chatPhone = el.dataset.p; A.drawer = false; lsSet('kk_admin_tab', 'chat'); render(); },
  chatBack: () => { A.chatPhone = null; render(); },
  reply: async () => {
    const text = $('#replyIn').value.trim(); if (!text) return;
    const tmp = { id: KKCore.newId('M'), phone: A.chatPhone, from: 'admin', text, at: Date.now(), pending: true };
    A.data.chats.push(tmp); A.replyDraft = ''; render(); const ri = $('#replyIn'); if (ri) ri.focus();
    try { const { message } = await adminApi('adminChatReply', { phone: A.chatPhone, text, mid: tmp.id }); Object.assign(tmp, message, { pending: false }); render(); const r2 = $('#replyIn'); if (r2) r2.focus(); }
    catch (e) { A.data.chats = A.data.chats.filter(m => m !== tmp); A.replyDraft = text; render(); toast('Not sent: ' + e.message); }
  },
  saveSettings: async el => {
    const emails = $('#sEmail').value.split(/[,;\s]+/).filter(Boolean);
    const bad = emails.find(x => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)); if (bad) return toast('This email looks wrong: ' + bad);
    const settings = { upiId: $('#sUpi').value.trim(), upiName: $('#sUpiName').value.trim(), notifyEmail: emails.join(','), emailAlerts: $('#sAlerts').checked, emailVisits: $('#sVisits').checked,
      staff: lines($('#sStaff').value), sources: lines($('#sSrc').value), expenseCats: lines($('#sCats').value),
      admins: $$('.adm-row').map(r => ({ name: $('[data-k=name]', r).value.trim(), phone: KKCore.digits($('[data-k=phone]', r).value), pin: $('[data-k=pin]', r).value.trim() })).filter(a => a.phone) };
    if (settings.admins.find(a => a.phone.length !== 10 || !/^\d{4,6}$/.test(a.pin))) return toast('Each admin needs a 10-digit number and a 4–6 digit PIN');
    if (A.qrDraft) settings.upiQr = A.qrDraft; else if (A.qrRemove) settings.upiQr = '';
    if (A.logoDraft) settings.logo = A.logoDraft; else if (A.logoRemove) settings.logo = '';
    if ($('#sAiKey').value.trim()) settings.geminiKey = $('#sAiKey').value.trim();
    if (settings.upiId && !/^[\w.\-]+@[\w.\-]+$/.test(settings.upiId)) return toast('UPI ID looks wrong — it should look like name@bank');
    el.disabled = true;
    try { const r = await adminApi('adminSaveSettings', { settings }); r.settings.hasAiKey = A.data.settings.hasAiKey || !!settings.geminiKey; A.data.settings = r.settings; A.qrDraft = A.logoDraft = null; A.qrRemove = A.logoRemove = false;
      setSettings({ upiId: r.settings.upiId, upiName: r.settings.upiName, upiQr: r.settings.upiQr, logo: r.settings.logo }); render(); toast('Settings saved ✓ — customers see it right away'); }
    catch (e) { toast(e.message); el.disabled = false; }
  },
  testAlert: async el => { el.disabled = true; try { await adminApi('adminTestAlert'); toast('Test alert queued — the email arrives within 1 minute ✉️', 5000); } catch (e) { toast(e.message); } el.disabled = false; },
  enableBrowserNotif: async () => { try { const p = await Notification.requestPermission(); toast(p === 'granted' ? '🔔 Pop-ups on for this device' : 'Pop-ups are blocked — allow notifications for this site in your browser settings', 5000); if (p === 'granted') { sysNotify('Keralam Kitchen', 'Pop-up alerts are on ✅'); beep(); } render(); } catch (e) { toast('Not supported here'); } },
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
  if (el.id === 'sQr' || el.id === 'sLogo') { const f = el.files[0]; if (!f) return; fileToDataUrl(f, el.id === 'sQr' ? 800 : 400).then(u => { if (el.id === 'sQr') A.qrDraft = u; else A.logoDraft = u; const keep = { e: $('#sEmail').value }; render(); $('#sEmail').value = keep.e; toast('Image ready — press Save'); }); }
  if (el.id === 'eCat') { const m = el.value.startsWith('mat:') && matOf(el.value.slice(4)); $('#eQtyL').textContent = m ? 'Quantity bought (' + m.unit + ')' : 'Quantity / note'; }
  if (el.id === 'labRate') { A.data.settings.labourRate = +el.value || 0; render(); adminApi('adminSaveSettings', { settings: { labourRate: +el.value || 0 } }).catch(e => toast(e.message)); }
  if (el.closest && el.closest('.rc-row')) rcCalc();
  if (el.dataset.k === 'item') { const row = el.closest('.lineRow'); row.outerHTML = lineRow({ id: el.value, v: 0, addonIdx: [], qty: +$('[data-k=qty]', row).value || 1 }); }
});
document.addEventListener('input', e => {
  const id = e.target.id;
  if (e.target.closest && (e.target.closest('.rc-row') || ['rcPrep', 'rcPack', 'rcOther'].includes(id))) rcCalc();
  if (id === 'replyIn') A.replyDraft = e.target.value;
  if (id === 'cSearch' || id === 'aSearch') {
    if (id === 'cSearch') A.search = e.target.value; else A.actSearch = e.target.value;
    const pos = e.target.selectionStart; render(); const s = $('#' + id); s.focus(); s.setSelectionRange(pos, pos);
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'replyIn') { e.preventDefault(); ACT.reply(); } if (e.key === 'Escape') closeSheet(); });

(function boot() {
  if (!A.auth) return renderLogin();
  document.body.className = 'adm';
  app.innerHTML = '<div class="boot">Loading dashboard…</div>';
  load();
  // tiny "anything new?" check every 5 s; full reload only when something changed
  let polling = false;
  setInterval(async () => {
    if (!A.auth || !A.data || polling) return; polling = true;
    try { const r = await adminApi('adminPoll'); if (r.rev && r.rev !== A.rev) { A.rev = r.rev; await load(true); } } catch (e) {}
    polling = false;
    if (A.dirty && !$('#overlay') && !(document.activeElement || {}).matches?.('input,textarea,select')) render();
  }, document.hidden ? 15000 : 5000);
  setInterval(() => { if (A.auth && A.data) load(true); }, 120000);
  setInterval(attention, 15000);
  setInterval(() => { if (A.data && ['orders', 'overview'].includes(A.tab) && !$('#overlay') && !(document.activeElement || {}).matches?.('input,textarea,select')) render(); }, 60000);
})();
