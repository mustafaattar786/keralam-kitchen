/* Keralam Kitchen — admin dashboard */
const A = {
  auth: lsGet('kk_admin_auth', null),
  data: null, tab: 'orders', filter: 'active', chatPhone: null, seen: new Set(lsGet('kk_admin_seen', [])),
  from: null, to: null, search: ''
};
const app = $('#app');
const DAY = 864e5, MIN = 6e4;
const ST = ['placed', 'accepted', 'preparing', 'ready', 'collected', 'cancelled'];
const ST_LABEL = { placed: 'New', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', collected: 'Collected', cancelled: 'Cancelled' };
const fmtDate = ts => new Date(ts).toISOString().slice(0, 10);
const startOf = s => new Date(s + 'T00:00:00').getTime();
function defaultRange() { const to = new Date(); const from = new Date(Date.now() - 29 * DAY); A.from = fmtDate(from); A.to = fmtDate(to); }
defaultRange();
const adminApi = (action, d = {}) => api(action, { ...d, auth: A.auth });
const siteBase = () => siteUrl();

/* ---------- Login ---------- */
function renderLogin(err) {
  app.innerHTML = `
  <div class="lang-screen">
    <div style="font-size:48px">🔐</div>
    <h1 style="color:var(--green)">Kitchen login</h1>
    <p class="muted">Only for Keralam Kitchen admins (${CFG.PHONES.map(p => p.slice(0, 2) + '••••' + p.slice(-2)).join(', ')})</p>
    ${DEMO ? '<div class="demo" style="border-radius:10px">Demo mode: PIN is 1234</div>' : ''}
    <label class="f" style="text-align:left">Admin mobile number</label><input class="in" id="lp" inputmode="numeric" maxlength="14" autocomplete="tel">
    <label class="f" style="text-align:left">PIN</label><input class="in" id="lpin" type="password" inputmode="numeric" autocomplete="current-password">
    ${err ? `<p style="color:var(--red);font-weight:600">${esc(err)}</p>` : ''}
    <button class="btn primary big" style="margin-top:16px" id="lgo">Login</button>
    <p class="small"><a href="index.html">← Customer site</a></p>
  </div>`;
  const go = async () => {
    const auth = { phone: KKCore.digits($('#lp').value), pin: $('#lpin').value };
    if (!CFG.PHONES.map(KKCore.digits).includes(auth.phone)) return renderLogin('This number is not an admin number.');
    $('#lgo').disabled = true;
    try { A.auth = auth; await adminApi('adminLogin'); lsSet('kk_admin_auth', auth); await load(); try { Notification.requestPermission(); } catch (e) {} }
    catch (e) { A.auth = null; renderLogin(e.offline ? 'No internet connection' : e.message); }
  };
  $('#lgo').onclick = go; $('#lpin').onkeydown = e => e.key === 'Enter' && go();
}

/* ---------- Data ---------- */
async function load(silent) {
  try {
    const d = await adminApi('adminData');
    const fresh = d.orders.filter(o => !A.seen.has(o.id));
    if (A.data && fresh.length) {
      beep();
      fresh.forEach(o => { try { if (Notification.permission === 'granted') new Notification('🆕 ' + o.id + ' — ' + o.name, { body: (o.items || []).map(l => l.name + ' ×' + l.qty).join(', ') || o.customText || '' }); } catch (e) {} });
      toast('🆕 ' + fresh.length + ' new order(s)!', 5000);
    }
    d.orders.forEach(o => A.seen.add(o.id)); lsSet('kk_admin_seen', [...A.seen].slice(-500));
    A.data = d;
    const typing = document.activeElement && document.activeElement.matches('input,textarea,select');
    if (!silent || (!typing && !$('#overlay'))) render();
  } catch (e) {
    if (e.server && /PIN/.test(e.message)) { lsSet('kk_admin_auth', null); A.auth = null; return renderLogin(e.message); }
    if (!silent) toast(e.offline ? 'Offline — showing last data' : e.message);
  }
}

/* ---------- Shell ---------- */
function render() {
  const d = A.data; if (!d) return;
  const active = d.orders.filter(o => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status)).length;
  const unreadChats = Object.values(chatThreads()).filter(th => th[th.length - 1].from === 'customer').length;
  const y = window.scrollY;
  app.innerHTML = `
  ${DEMO ? '<div class="demo">Demo mode — connect the Google Sheet (config.js → API_URL) to go live.</div>' : ''}
  <header class="top"><div class="wrap"><div class="logo">🌿 Kitchen Admin<small>${esc(CFG.BRAND)} · ${KKCore.digits(A.auth.phone)}</small></div><div class="sp"></div>
    <button class="iconbtn" data-a="refresh">⟳</button><button class="iconbtn" data-a="logout">⎋</button></div></header>
  <div class="wrap">
    <div class="tabs">
      ${[['orders', `🧾 Orders${active ? ' (' + active + ')' : ''}`], ['menu', '🍽️ Menu & Stock'], ['customers', '👥 Customers'], ['money', '💰 Accounts'], ['analytics', '📊 Analysis'], ['chat', `💬 Chat${unreadChats ? ' (' + unreadChats + ')' : ''}`], ['share', '🔗 Share']]
        .map(([k, l]) => `<button class="chip ${A.tab === k ? 'on' : ''}" data-a="tab" data-t="${k}">${l}</button>`).join('')}
    </div>
    <div id="main">${({ orders: renderOrders, menu: renderMenu, customers: renderCustomers, money: renderMoney, analytics: renderAnalytics, chat: renderChat, share: renderShare })[A.tab]()}</div>
  </div>`;
  window.scrollTo(0, y);
  const c = $('#chat'); if (c) c.scrollTop = c.scrollHeight;
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
  return `<div class="card ocard ${stale ? 'stale' : ''}">
    <div class="row between"><b style="font-size:18px">${esc(o.id)}</b><span class="status s-${o.status}">${ST_LABEL[o.status]}</span></div>
    ${stale ? `<div style="color:var(--red);font-weight:700">⏰ Waiting ${age} min — please accept</div>` : ''}
    <div><b>${esc(o.name)}</b> · Flat ${esc(o.flat)} · <a href="${telLink(o.phone)}">${esc(o.phone)}</a> ${o.source !== 'web' ? `<span class="tag g">${esc(o.source)}</span>` : ''}</div>
    <div class="small muted">Placed ${fmtTime(o.createdAt)} · <b style="color:var(--ink)">Pickup ${o.pickupAt ? fmtTime(o.pickupAt) : '—'}</b></div>
    <div style="margin:8px 0">${o.type === 'custom' ? `✨ <b>Custom:</b> ${esc(o.customText)}${o.customPhoto ? `<br><a href="${esc(o.customPhoto)}" target="_blank"><img src="${esc(o.customPhoto)}" class="photo-prev"></a>` : ''}` :
      (o.items || []).map(l => `• ${esc(l.name)} <b>${esc(l.variant)}${l.addons.length ? ' + ' + esc(l.addons.join(', ')) : ''} × ${l.qty}</b> = ${money(l.amount)}`).join('<br>')}</div>
    ${o.notes ? `<div class="banner" style="margin:6px 0">📝 ${esc(o.notes)}</div>` : ''}
    ${o.adminNote ? `<div class="small">🔒 Admin note: ${esc(o.adminNote)}</div>` : ''}
    <div class="row between"><span>${o.pay === 'now' ? '💳 Pay now (UPI)' : '💵 Pay at pickup'} · <b>${esc(o.payStatus === 'paid' ? 'PAID ' + (o.payMethod || '').toUpperCase() : 'Due')}</b></span><b style="font-size:18px">${money(o.total)}</b></div>
    <div class="acts">
      ${next ? (next[0] === 'collected' ? `<button class="btn primary" data-a="collect" data-id="${o.id}">${next[1]}</button>` : `<button class="btn primary" data-a="setStatus" data-id="${o.id}" data-s="${next[0]}">${next[1]}</button>`) : ''}
      <a class="btn wa sm" href="${waLink(o.phone, statusMsg(o))}" target="_blank" rel="noopener">📲 WhatsApp update</a>
      <a class="btn sm" href="sms:+91${o.phone}?body=${encodeURIComponent(statusMsg(o))}">✉️ SMS</a>
      <a class="btn sm" href="${telLink(o.phone)}">📞</a>
      ${['cancelled', 'collected'].includes(o.status) ? '' : `<button class="btn sm" data-a="editOrder" data-id="${o.id}">✏️ Edit</button><button class="btn sm danger" data-a="adminCancel" data-id="${o.id}">✕ Cancel</button>`}
      ${o.status === 'collected' && !o.reviewed ? (Date.now() >= reviewAt
        ? `<a class="btn gold sm" href="${waLink(o.phone, `Hi ${o.name.split(' ')[0]} 🌿 How was your food? Please rate us here: ${siteBase()}#review=${o.id} ⭐`)}" target="_blank">⭐ Ask for review</a>`
        : `<span class="small muted">⭐ Review link active at ${new Date(reviewAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>`) : ''}
    </div>
  </div>`;
}
function renderOrders() {
  const all = A.data.orders, today = new Date().toDateString();
  const f = {
    active: o => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status),
    today: o => new Date(o.pickupAt || o.createdAt).toDateString() === today,
    tomorrow: o => new Date(o.pickupAt || 0).toDateString() === new Date(Date.now() + DAY).toDateString() && o.status !== 'cancelled',
    collected: o => o.status === 'collected', cancelled: o => o.status === 'cancelled', all: () => true
  };
  let list = all.filter(f[A.filter]);
  if (A.filter === 'active') list = list.sort((a, b) => (a.pickupAt || a.createdAt) - (b.pickupAt || b.createdAt));
  // Prep summary for active orders
  const prep = {};
  all.filter(f.active).forEach(o => (o.items || []).forEach(l => { const k = l.name + ' — ' + l.variant + (l.addons.length ? ' + ' + l.addons.join(', ') : ''); prep[k] = (prep[k] || 0) + l.qty; }));
  return `
  <div class="row" style="gap:6px;flex-wrap:wrap">${Object.keys(f).map(k => `<button class="chip ${A.filter === k ? 'on' : ''}" data-a="filter" data-f="${k}">${k[0].toUpperCase() + k.slice(1)} (${all.filter(f[k]).length})</button>`).join('')}
    <button class="btn sm primary" style="margin-left:auto" data-a="newPhoneOrder">＋ Phone/WhatsApp order</button></div>
  ${Object.keys(prep).length && A.filter === 'active' ? `<div class="card"><b>👩‍🍳 To prepare (all active orders)</b><br>${Object.entries(prep).map(([k, q]) => `${esc(k)}: <b>${q}</b>`).join('<br>')}</div>` : ''}
  ${list.map(orderCard).join('') || '<div class="card muted">No orders here.</div>'}`;
}
function itemsEditor(items) {
  const menu = A.data.menu;
  return `<div id="lines">${(items.length ? items : [{ id: menu[0].id, v: 0, addonIdx: [], qty: 1 }]).map(l => lineRow(l)).join('')}</div>
    <button class="btn sm" data-a="addLine">＋ Add item</button>`;
}
function lineRow(l) {
  const menu = A.data.menu;
  const m = menu.find(x => x.id === l.id) || menu[0];
  return `<div class="row lineRow" style="margin:6px 0;gap:6px">
    <select class="in" style="flex:2" data-k="item">${menu.map(x => `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <select class="in" style="flex:1.2" data-k="v">${m.variants.map((v, i) => `<option value="${i}" ${+l.v === i ? 'selected' : ''}>${esc(v.label)} ₹${v.price}</option>`).join('')}</select>
    ${m.addons.length ? `<select class="in" style="flex:1" data-k="addon"><option value="">no extra</option>${m.addons.map((a, i) => `<option value="${i}" ${(l.addonIdx || []).includes(i) ? 'selected' : ''}>+${esc(a.label)}</option>`).join('')}</select>` : ''}
    <input class="in" style="width:70px;flex:none" type="number" min="0" data-k="qty" value="${l.qty}">
  </div>`;
}
function readLines() {
  return $$('.lineRow').map(r => ({ id: $('[data-k=item]', r).value, v: +$('[data-k=v]', r).value, addons: $('[data-k=addon]', r) && $('[data-k=addon]', r).value !== '' ? [+$('[data-k=addon]', r).value] : [], qty: +$('[data-k=qty]', r).value }))
    .filter(l => l.qty > 0);
}
const toLocalInput = ts => { if (!ts) return ''; const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
function openSheet(html) {
  closeSheet();
  const o = document.createElement('div'); o.className = 'overlay center'; o.id = 'overlay';
  o.innerHTML = `<div class="sheet">${html}</div>`; o.onclick = e => { if (e.target === o) closeSheet(); };
  document.body.appendChild(o); return o;
}
function closeSheet() { const o = $('#overlay'); if (o) o.remove(); }

/* ---------- Menu ---------- */
function renderMenu() {
  return `
  <div class="row between"><h2>Menu & stock</h2><button class="btn primary sm" data-a="editItem">＋ New dish</button></div>
  <p class="small muted">Untick <b>In stock</b> and customers see “Fresh batch tomorrow — order now 🌿” (never “out of stock”). <b>Always available</b> items (like roti) ignore stock.</p>
  ${A.data.menu.map(m => `<div class="card">
    <div class="row"><div style="font-size:30px">${m.img ? `<img src="${esc(m.img)}" style="width:56px;height:56px;object-fit:cover;border-radius:10px">` : esc(m.emoji || '🍽️')}</div>
      <div style="flex:1"><b>${esc(m.name)}</b>${m.hidden ? ' <span class="tag">hidden</span>' : ''}<div class="small muted">${m.variants.map(v => `${esc(v.label)} ₹${v.price}${v.cost ? ' (cost ₹' + v.cost + ')' : ''}`).join(' · ')} · ready in ${m.leadMins >= 1440 ? 'next day' : (m.leadMins || 0) + ' min'}</div></div>
      <button class="btn sm" data-a="editItem" data-id="${m.id}">✏️</button></div>
    <div class="row" style="margin-top:8px;gap:18px">
      <label class="switch"><input type="checkbox" data-a="toggle" data-id="${m.id}" data-k="inStock" ${m.inStock ? 'checked' : ''}> In stock</label>
      <label class="switch"><input type="checkbox" data-a="toggle" data-id="${m.id}" data-k="alwaysAvailable" ${m.alwaysAvailable ? 'checked' : ''}> Always available</label>
      <label class="switch"><input type="checkbox" data-a="toggle" data-id="${m.id}" data-k="hidden" ${m.hidden ? 'checked' : ''}> Hide</label>
    </div>
    ${m.prep ? `<div class="small" style="margin-top:6px">👩‍🍳 Prep: ${esc(m.prep)}</div>` : ''}
  </div>`).join('')}`;
}
function editItem(id) {
  const m = A.data.menu.find(x => x.id === id) || { name: '', emoji: '🍽️', img: '', desc: '', tags: [], variants: [{ label: '1 plate', price: 50, cost: 0 }], addons: [], inStock: true, leadMins: 0, prep: '', sort: A.data.menu.length + 1 };
  const vtxt = arr => arr.map(v => `${v.label} | ${v.price} | ${v.cost || 0}`).join('\n');
  openSheet(`<h2>${id ? 'Edit' : 'New'} dish</h2>
    <label class="f">Name</label><input class="in" id="iName" value="${esc(m.name)}">
    <div class="row"><div style="flex:1"><label class="f">Emoji</label><input class="in" id="iEmoji" value="${esc(m.emoji || '')}"></div>
      <div style="flex:1"><label class="f">Ready in (minutes, 1440 = next day)</label><input class="in" id="iLead" type="number" value="${m.leadMins || 0}"></div></div>
    <label class="f">Photo</label><div class="row"><input class="in" id="iImg" style="flex:1" value="${esc(m.img || '')}" placeholder="image link or upload →"><label class="btn sm">📷<input type="file" accept="image/*" id="iFile" hidden></label></div>
    <label class="f">Description</label><input class="in" id="iDesc" value="${esc(m.desc || '')}">
    <label class="f">Tags (comma separated) — e.g. Best seller, Most popular, People love the taste</label><input class="in" id="iTags" value="${esc((m.tags || []).join(', '))}">
    <label class="f">Sizes — one per line: <code>label | price | your cost</code></label><textarea class="in" id="iVar">${esc(vtxt(m.variants))}</textarea>
    <label class="f">Extras — one per line: <code>label | price | cost</code> (e.g. Butter | 5 | 2)</label><textarea class="in" id="iAdd">${esc(vtxt(m.addons || []))}</textarea>
    <label class="f">Preparation details (only admins see this)</label><textarea class="in" id="iPrep">${esc(m.prep || '')}</textarea>
    <label class="f">Sort order</label><input class="in" id="iSort" type="number" value="${m.sort || 0}">
    <div class="row" style="margin-top:14px"><button class="btn primary" style="flex:1" data-a="saveItem" data-id="${id || ''}">Save</button>
      ${id ? `<button class="btn danger" data-a="deleteItem" data-id="${id}">Delete</button>` : ''}<button class="btn ghost" data-a="close">Close</button></div>`);
  $('#iFile').onchange = async e => { const f = e.target.files[0]; if (f) { $('#iImg').value = await fileToDataUrl(f, 700); toast('Photo ready — press Save'); } };
}
const parseLines = txt => txt.split('\n').map(l => l.split('|').map(s => s.trim())).filter(p => p[0]).map(p => ({ label: p[0], price: +p[1] || 0, cost: +p[2] || 0 }));

/* ---------- Customers ---------- */
function renderCustomers() {
  const q = A.search.toLowerCase();
  const list = A.data.customers.filter(c => !q || [c.name, c.flat, c.phone].join(' ').toLowerCase().includes(q)).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
  return `
  <div class="card"><h3>＋ Add customer (from call / WhatsApp)</h3>
    <div class="row"><input class="in" id="cName" placeholder="Name" style="flex:1.4"><input class="in" id="cFlat" placeholder="Flat" style="flex:1"><input class="in" id="cPhone" placeholder="Mobile" inputmode="numeric" style="flex:1.4"></div>
    <input class="in" id="cNote" placeholder="Note (optional)" style="margin-top:8px">
    <button class="btn primary" style="margin-top:8px" data-a="saveCustomer">Save customer</button></div>
  <input class="in" id="cSearch" placeholder="🔍 Search name / flat / phone" value="${esc(A.search)}">
  <p class="small muted">${list.length} customers · Details are private and used only for order contact.</p>
  ${list.map(c => `<div class="card"><div class="row between"><div><b>${esc(c.name)}</b> · Flat ${esc(c.flat)}<div class="small muted">${esc(c.phone)} · ${c.orders || 0} orders · since ${new Date(c.firstAt).toLocaleDateString('en-IN')}${c.note ? ' · ' + esc(c.note) : ''}</div></div>
    <div class="row"><a class="btn sm" href="${telLink(c.phone)}">📞</a><a class="btn sm wa" href="${waLink(c.phone, 'Hi ' + c.name + ' 🌿 — Keralam Kitchen')}" target="_blank">WA</a><button class="btn sm primary" data-a="newPhoneOrder" data-phone="${c.phone}">＋ Order</button></div></div></div>`).join('')}`;
}
function phoneOrderSheet(phone) {
  const c = A.data.customers.find(x => x.phone === phone) || {};
  openSheet(`<h2>New order (phone / WhatsApp)</h2>
    <div class="row"><input class="in" id="poName" placeholder="Name" value="${esc(c.name || '')}" style="flex:1.4"><input class="in" id="poFlat" placeholder="Flat" value="${esc(c.flat || '')}" style="flex:1"><input class="in" id="poPhone" placeholder="Mobile" inputmode="numeric" value="${esc(c.phone || '')}" style="flex:1.4"></div>
    <label class="f">Items</label>${itemsEditor([])}
    <label class="f">Pickup</label><input class="in" type="datetime-local" id="poPick" value="${toLocalInput(Date.now() + 60 * MIN)}">
    <label class="f">Notes</label><input class="in" id="poNotes">
    <label class="f">Source</label><select class="in" id="poSrc"><option value="phone">Phone call</option><option value="whatsapp">WhatsApp</option><option value="walk-in">Walk-in</option></select>
    <div class="row" style="margin-top:14px"><button class="btn primary" style="flex:1" data-a="savePhoneOrder">Create order</button><button class="btn ghost" data-a="close">Close</button></div>`);
}

/* ---------- Money / accounts ---------- */
function inRange(ts) { return ts >= startOf(A.from) && ts < startOf(A.to) + DAY; }
function rangeBar() {
  return `<div class="row" style="margin:6px 0 10px"><input class="in" type="date" id="rFrom" value="${A.from}" style="flex:1"><span>→</span><input class="in" type="date" id="rTo" value="${A.to}" style="flex:1">
    <button class="btn sm" data-a="range30">Last 30 days</button></div>`;
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
  const pending = A.data.orders.filter(o => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status)).reduce((s, o) => s + o.total, 0);
  const perItem = {};
  done.forEach(o => (o.items || []).forEach(l => { const k = l.name + ' (' + l.variant + ')'; const p = perItem[k] = perItem[k] || { qty: 0, rev: 0, cost: 0 }; p.qty += l.qty; p.rev += l.amount; p.cost += (l.unitCost || 0) * l.qty; }));
  return { orders, done, revenue, cash, upi, itemCost, exps, expTotal, pending, perItem, net: revenue - itemCost - expTotal };
}
function renderMoney() {
  const s = moneyStats();
  return `<h2>💰 Accounts</h2>${rangeBar()}
  <div class="kpis">
    <div class="kpi"><b>${money(s.revenue)}</b><span>Money received</span></div>
    <div class="kpi"><b>${money(s.cash)}</b><span>Cash</span></div>
    <div class="kpi"><b>${money(s.upi)}</b><span>UPI</span></div>
    <div class="kpi"><b>${money(s.itemCost)}</b><span>Ingredient cost (from item costs)</span></div>
    <div class="kpi"><b>${money(s.expTotal)}</b><span>Expenses / stock bought</span></div>
    <div class="kpi"><b style="color:${s.net >= 0 ? 'var(--green)' : 'var(--red)'}">${money(s.net)}</b><span>Net profit</span></div>
    <div class="kpi"><b>${money(s.pending)}</b><span>Pending (active orders)</span></div>
  </div>
  <div class="card"><h3>Per item</h3><table><tr><th>Item</th><th class="n">Sold</th><th class="n">Sales</th><th class="n">Cost</th><th class="n">Profit</th></tr>
    ${Object.entries(s.perItem).map(([k, p]) => `<tr><td>${esc(k)}</td><td class="n">${p.qty}</td><td class="n">${money(p.rev)}</td><td class="n">${money(p.cost)}</td><td class="n">${money(p.rev - p.cost)}</td></tr>`).join('') || '<tr><td colspan=5 class="muted">No collected orders in range</td></tr>'}</table>
    <p class="small muted">Set “your cost” per size in Menu → ✏️ to get per-item profit.</p></div>
  <div class="card"><h3>＋ Add expense / stock purchase</h3>
    <div class="row"><input class="in" type="date" id="eDate" value="${fmtDate(Date.now())}" style="flex:1">
      <select class="in" id="eCat" style="flex:1">${['Rice', 'Urad dal', 'Dal', 'Coconut', 'Wheat flour (atta)', 'Garlic', 'Butter / Cheese', 'Oil', 'Gas', 'Packaging', 'Electricity', 'Other'].map(c => `<option>${c}</option>`).join('')}</select></div>
    <div class="row" style="margin-top:8px"><input class="in" id="eQty" placeholder="Qty / production (e.g. 5 kg → 12 kg batter)" style="flex:2"><input class="in" id="eAmt" type="number" placeholder="₹ Amount" style="flex:1"></div>
    <button class="btn primary" style="margin-top:8px" data-a="saveExpense">Add</button>
    <table style="margin-top:10px"><tr><th>Date</th><th>Item</th><th>Qty / note</th><th class="n">₹</th><th></th></tr>
    ${s.exps.sort((a, b) => b.date.localeCompare(a.date)).map(e => `<tr><td>${e.date}</td><td>${esc(e.category)}</td><td>${esc(e.qty || '')}</td><td class="n">${money(e.amount)}</td><td><button class="btn sm danger" data-a="delExpense" data-id="${e.id}">✕</button></td></tr>`).join('')}</table></div>`;
}

/* ---------- Analytics ---------- */
function renderAnalytics() {
  const s = moneyStats(), orders = s.orders;
  const cancelled = orders.filter(o => o.status === 'cancelled');
  const reviews = A.data.reviews.filter(r => inRange(r.at));
  const avgStars = reviews.length ? reviews.reduce((a, r) => a + r.stars, 0) / reviews.length : 0;
  const days = Math.max(1, Math.round((startOf(A.to) - startOf(A.from)) / DAY) + 1);
  const daily = [];
  for (let i = 0; i < days; i++) { const d0 = startOf(A.from) + i * DAY; const os = orders.filter(o => o.createdAt >= d0 && o.createdAt < d0 + DAY); daily.push({ d: d0, n: os.filter(o => o.status !== 'cancelled').length, c: os.filter(o => o.status === 'cancelled').length, rev: os.filter(o => o.status === 'collected').reduce((a, o) => a + o.total, 0) }); }
  const maxN = Math.max(1, ...daily.map(x => x.n + x.c));
  // Weekday prediction
  const wd = Array.from({ length: 7 }, () => ({ days: 0, orders: 0, items: {} }));
  daily.forEach(x => wd[new Date(x.d).getDay()].days++);
  orders.filter(o => o.status !== 'cancelled').forEach(o => { const w = wd[new Date(o.createdAt).getDay()]; w.orders++; (o.items || []).forEach(l => { const k = l.name + ' (' + l.variant + ')'; w.items[k] = (w.items[k] || 0) + l.qty; }); });
  const tmr = new Date(Date.now() + DAY), w = wd[tmr.getDay()];
  const expTomorrow = w.days ? w.orders / w.days : 0;
  const weekExp = wd.reduce((a, x) => a + (x.days ? x.orders / x.days : 0), 0);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const top = Object.entries(s.perItem).sort((a, b) => b[1].qty - a[1].qty);
  const repeat = A.data.customers.filter(c => (c.orders || 0) > 1).length;
  return `<h2>📊 Analysis</h2>${rangeBar()}
  <div class="kpis">
    <div class="kpi"><b>${orders.filter(o => o.status !== 'cancelled').length}</b><span>Orders received</span></div>
    <div class="kpi"><b>${s.done.length}</b><span>Completed</span></div>
    <div class="kpi"><b>${cancelled.length}</b><span>Cancelled (${orders.length ? Math.round(cancelled.length / orders.length * 100) : 0}%)</span></div>
    <div class="kpi"><b>${money(s.revenue)}</b><span>Money received</span></div>
    <div class="kpi"><b>${money(s.done.length ? s.revenue / s.done.length : 0)}</b><span>Avg order value</span></div>
    <div class="kpi"><b>${avgStars ? avgStars.toFixed(1) + '★' : '—'}</b><span>Avg stars (${reviews.length} reviews)</span></div>
    <div class="kpi"><b>${repeat}</b><span>Repeat customers</span></div>
  </div>
  <div class="card"><h3>Orders per day</h3><div class="bars">${daily.map(x => `<div title="${new Date(x.d).toLocaleDateString('en-IN')} — ${x.n} orders, ${x.c} cancelled, ${money(x.rev)}" style="height:${(x.n / maxN) * 100}%"></div>`).join('')}</div>
    <div class="row between small muted"><span>${A.from}</span><span>${A.to}</span></div></div>
  <div class="card"><h3>🔮 Next order prediction</h3>
    <p>Tomorrow (<b>${names[tmr.getDay()]}</b>): expect about <b>${expTomorrow.toFixed(1)}</b> orders · Next 7 days: about <b>${Math.round(weekExp)}</b> orders.</p>
    ${Object.keys(w.items).length ? `<p><b>Suggested prep for tomorrow:</b><br>${Object.entries(w.items).sort((a, b) => b[1] - a[1]).map(([k, q]) => `${esc(k)}: ~${Math.ceil(q / w.days)}`).join('<br>')}</p>` : '<p class="muted small">Needs a few weeks of orders to predict per-item quantities.</p>'}
    <table><tr><th>Day</th>${names.map(n => `<th class="n">${n}</th>`).join('')}</tr><tr><td>Avg orders</td>${wd.map(x => `<td class="n">${x.days ? (x.orders / x.days).toFixed(1) : '—'}</td>`).join('')}</tr></table></div>
  <div class="card"><h3>🏆 Best sellers</h3>${top.map(([k, p], i) => `<div class="row between"><span>${i + 1}. ${esc(k)}</span><b>${p.qty} sold · ${money(p.rev)}</b></div>`).join('') || '<p class="muted small">No data yet.</p>'}</div>
  <div class="card"><h3>⭐ Reviews</h3>${reviews.sort((a, b) => b.at - a.at).map(r => `<div class="review"><div class="row between"><b>${esc(r.name)} <span class="small muted">${esc(r.phone || '')}</span></b><span class="stars">${'★'.repeat(r.stars)}</span></div>
    <div class="small muted">${esc(r.itemName)} · ${fmtTime(r.at)} ${r.orderId ? '· ' + esc(r.orderId) : ''}</div>${esc(r.text)}${r.photo ? `<img src="${esc(r.photo)}">` : ''}
    <div><button class="btn sm ${r.hidden ? '' : 'ghost'}" data-a="hideReview" data-id="${r.id}">${r.hidden ? '👁 Show on site' : '🙈 Hide from site'}</button></div></div>`).join('') || '<p class="muted small">No reviews in range.</p>'}</div>`;
}

/* ---------- Chat ---------- */
function chatThreads() { const th = {}; (A.data.chats || []).sort((a, b) => a.at - b.at).forEach(m => (th[m.phone] = th[m.phone] || []).push(m)); return th; }
function renderChat() {
  const th = chatThreads(), phones = Object.keys(th).sort((a, b) => th[b][th[b].length - 1].at - th[a][th[a].length - 1].at);
  if (A.chatPhone && th[A.chatPhone]) {
    const msgs = th[A.chatPhone], name = (msgs.find(m => m.from === 'customer') || {}).name || A.chatPhone;
    return `<div class="card"><div class="row between"><button class="btn sm ghost" data-a="chatBack">←</button><b>${esc(name)} · ${esc(A.chatPhone)}</b><a class="btn sm wa" href="${waLink(A.chatPhone, '')}" target="_blank">WA</a></div>
      <div class="chat" id="chat">${msgs.map(m => `<div class="msg ${m.from === 'admin' ? 'me' : 'them'}">${esc(m.text)}<small>${fmtTime(m.at)}</small></div>`).join('')}</div>
      <div class="row" style="margin-top:8px"><input class="in" id="replyIn" style="flex:1" placeholder="Reply…"><button class="btn primary" data-a="reply">➤</button></div></div>`;
  }
  return `<p class="small muted">Customers see “Kitchen is online” while this dashboard is open on any admin phone.</p>` +
    (phones.map(p => { const last = th[p][th[p].length - 1]; return `<div class="card" data-a="openChat" data-p="${p}" style="cursor:pointer"><div class="row between"><b>${esc((th[p].find(m => m.from === 'customer') || {}).name || p)}</b>${last.from === 'customer' ? '<span class="tag">needs reply</span>' : ''}</div><div class="small muted">${esc(last.text).slice(0, 80)} · ${fmtTime(last.at)}</div></div>`; }).join('') || '<div class="card muted">No chats yet.</div>');
}

/* ---------- Share ---------- */
function renderShare() {
  const url = siteBase();
  const msg = `🌿 Keralam Kitchen 🌿\nHomemade • Fresh • Hygienic\n\nOrder Idli/Dosa batter, Coconut chutney, Rotis & more 👇\n${url}\n\n📲 9594727293 / 7045610770`;
  return `<div class="card"><h3>🔗 Customer link</h3><input class="in" readonly value="${esc(url)}" onclick="this.select()">
    <div class="row" style="margin-top:10px"><button class="btn primary" data-a="copy" data-v="${esc(url)}">Copy link</button>
    <a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank">Share on WhatsApp</a></div>
    <img alt="QR code" style="margin-top:14px;width:220px;height:220px;background:#fff;padding:8px;border-radius:12px" src="https://api.qrserver.com/v1/create-qr-code/?size=440x440&data=${encodeURIComponent(url)}" onerror="this.remove()">
    <p class="small muted">Print this QR for the society notice board.</p></div>
  <div class="card"><h3>Backend status</h3><p>${DEMO ? '⚠️ Demo mode (data only on this device). Paste the Apps Script URL in <code>config.js</code>.' : '✅ Connected to Google Sheet'}</p></div>`;
}

/* ---------- Actions ---------- */
async function update(id, patch, okMsg) {
  try { const { order } = await adminApi('adminUpdateOrder', { id, patch }); const i = A.data.orders.findIndex(o => o.id === id); A.data.orders[i] = order; render(); if (okMsg) toast(okMsg); return order; }
  catch (e) { toast(e.message, 4000); }
}
const ACT = {
  tab: el => { A.tab = el.dataset.t; A.chatPhone = null; render(); window.scrollTo(0, 0); },
  filter: el => { A.filter = el.dataset.f; render(); },
  refresh: () => load(),
  logout: () => { lsSet('kk_admin_auth', null); A.auth = null; A.data = null; renderLogin(); },
  close: () => closeSheet(),
  setStatus: async el => {
    const o = await update(el.dataset.id, { status: el.dataset.s }, '✓ ' + ST_LABEL[el.dataset.s]);
    if (o && el.dataset.s === 'ready') openSheet(`<h2>🎉 Order ${esc(o.id)} is ready</h2><p>Tell ${esc(o.name)}:</p>
      <a class="btn wa big" href="${waLink(o.phone, statusMsg(o))}" target="_blank" data-a="close">📲 Send “ready” on WhatsApp</a>
      <a class="btn big" style="margin-top:8px" href="sms:+91${o.phone}?body=${encodeURIComponent(statusMsg(o))}">✉️ Send SMS</a>
      <button class="btn ghost big" style="margin-top:8px" data-a="close">Later</button>`);
  },
  collect: el => {
    const o = A.data.orders.find(x => x.id === el.dataset.id);
    openSheet(`<h2>🤝 ${esc(o.id)} collected</h2><p>${esc(o.name)} paid <b>${money(o.total)}</b> by:</p>
      <div class="row"><button class="btn primary big" style="flex:1" data-a="paid" data-id="${o.id}" data-m="cash">💵 Cash</button><button class="btn gold big" style="flex:1" data-a="paid" data-id="${o.id}" data-m="upi">📱 UPI</button></div>
      <button class="btn ghost big" style="margin-top:8px" data-a="close">Back</button>`);
  },
  paid: async el => {
    closeSheet();
    const o = await update(el.dataset.id, { status: 'collected', payMethod: el.dataset.m }, '✓ Collected');
    if (o) openSheet(`<h2>❤️ Say thank you</h2><p>Send ${esc(o.name)} a thank-you with the review link (review opens in 40 min):</p>
      <a class="btn wa big" href="${waLink(o.phone, statusMsg(o))}" target="_blank" data-a="close">📲 Thank-you on WhatsApp</a>
      <a class="btn big" style="margin-top:8px" href="sms:+91${o.phone}?body=${encodeURIComponent(statusMsg(o))}">✉️ SMS</a>
      <button class="btn ghost big" style="margin-top:8px" data-a="close">Skip</button>`);
  },
  adminCancel: async el => {
    const r = prompt('Reason for cancelling ' + el.dataset.id + ' (customer will see this):', ''); if (r === null) return;
    const o = await update(el.dataset.id, { status: 'cancelled', cancelReason: r }, 'Cancelled');
    if (o) openSheet(`<h2>Order cancelled</h2><a class="btn wa big" href="${waLink(o.phone, statusMsg(o))}" target="_blank" data-a="close">📲 Inform on WhatsApp</a><button class="btn ghost big" style="margin-top:8px" data-a="close">Close</button>`);
  },
  editOrder: el => {
    const o = A.data.orders.find(x => x.id === el.dataset.id);
    openSheet(`<h2>✏️ Edit ${esc(o.id)}</h2>
      ${o.type === 'custom' ? `<label class="f">Price agreed (₹)</label><input class="in" id="eoTotal" type="number" value="${o.total || ''}">` : `<label class="f">Items</label>${itemsEditor(o.items)}`}
      <label class="f">Pickup</label><input class="in" type="datetime-local" id="eoPick" value="${toLocalInput(o.pickupAt)}">
      <label class="f">Customer notes</label><input class="in" id="eoNotes" value="${esc(o.notes || '')}">
      <label class="f">Admin note (private) / preparation</label><input class="in" id="eoAdmin" value="${esc(o.adminNote || '')}">
      <label class="f">Payment</label><select class="in" id="eoPay"><option value="due" ${o.payStatus !== 'paid' ? 'selected' : ''}>Due</option><option value="paid" ${o.payStatus === 'paid' ? 'selected' : ''}>Paid</option></select>
      <div class="row" style="margin-top:14px"><button class="btn primary" style="flex:1" data-a="saveOrder" data-id="${o.id}">Save</button><button class="btn ghost" data-a="close">Close</button></div>`);
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
      await api('placeOrder', { id: KKCore.newOrderId(), customer, items, pickupAt: new Date($('#poPick').value).getTime(), notes: $('#poNotes').value, pay: 'spot', source: $('#poSrc').value });
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
  saveCustomer: async () => {
    try { await adminApi('adminSaveCustomer', { customer: { name: $('#cName').value, flat: $('#cFlat').value, phone: $('#cPhone').value, note: $('#cNote').value, source: 'phone' } }); await load(); toast('Customer saved ✓'); }
    catch (e) { toast(e.message, 4000); }
  },
  range30: () => { defaultRange(); render(); },
  saveExpense: async () => {
    const amt = +$('#eAmt').value; if (!amt) return toast('Enter amount');
    try { await adminApi('adminSaveExpense', { expense: { date: $('#eDate').value, category: $('#eCat').value, qty: $('#eQty').value, amount: amt } }); await load(); toast('Added ✓'); } catch (e) { toast(e.message); }
  },
  delExpense: async el => { if (!confirm('Delete expense?')) return; await adminApi('adminDeleteExpense', { id: el.dataset.id }); await load(); },
  hideReview: async el => { await adminApi('adminHideReview', { id: el.dataset.id }); await load(); },
  openChat: el => { A.chatPhone = el.dataset.p; render(); },
  chatBack: () => { A.chatPhone = null; render(); },
  reply: async () => {
    const text = $('#replyIn').value.trim(); if (!text) return;
    try { const { message } = await adminApi('adminChatReply', { phone: A.chatPhone, text }); A.data.chats.push(message); render(); } catch (e) { toast(e.message); }
  },
  copy: el => { navigator.clipboard.writeText(el.dataset.v).then(() => toast('Copied ✓')); }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || !ACT[el.dataset.a]) return;
  if (el.dataset.a === 'toggle') return;
  if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href') !== '#') { setTimeout(() => ACT[el.dataset.a](el, e), 0); return; }
  e.preventDefault(); ACT[el.dataset.a](el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.a === 'toggle') return ACT.toggle(el);
  if (el.id === 'rFrom' || el.id === 'rTo') { A[el.id === 'rFrom' ? 'from' : 'to'] = el.value; render(); }
  if (el.dataset.k === 'item') { const row = el.closest('.lineRow'); row.outerHTML = lineRow({ id: el.value, v: 0, addonIdx: [], qty: +$('[data-k=qty]', row).value || 1 }); }
});
document.addEventListener('input', e => { if (e.target.id === 'cSearch') { A.search = e.target.value; const pos = e.target.selectionStart; render(); const s = $('#cSearch'); s.focus(); s.setSelectionRange(pos, pos); } });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'replyIn') ACT.reply(); });

(function boot() {
  if (!A.auth) return renderLogin();
  app.innerHTML = '<p style="text-align:center;padding:40px">Loading…</p>';
  load();
  setInterval(() => { if (A.auth && !document.hidden) load(true); }, 20000);
  setInterval(() => { if (A.data && A.tab === 'orders' && !$('#overlay') && !(document.activeElement || {}).matches?.('input,textarea,select')) render(); }, 60000);
})();
