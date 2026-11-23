/* Keralam Kitchen — shared business logic.
   Runs in the browser (demo/offline mode) AND inside Google Apps Script (live backend). */
var KKCore = (function () {
  var MIN = 60000, HOUR = 3600000;
  var CANCEL_WINDOW = 2 * HOUR, REVIEW_DELAY = 40 * MIN, STALE_AFTER = 15 * MIN;

  var DEFAULT_MENU = [
    { id: 'batter', sort: 1, name: 'Idli & Dosa Batter', emoji: '🥣', img: 'img/batter.jpg',
      desc: 'Stone-ground & naturally fermented. Soft idlis, crispy dosas.',
      tags: ['Best seller'], variants: [{ label: '1 kg', price: 50, cost: 0 }, { label: '500 g', price: 30, cost: 0 }],
      addons: [], inStock: true, alwaysAvailable: false, leadMins: 0, prep: '' },
    { id: 'chutney', sort: 2, name: 'Coconut Green Chutney', emoji: '🥥', img: 'img/chutney.jpg',
      desc: 'Fresh coconut, green chilli & curry leaves.',
      tags: ['People love the taste'], variants: [{ label: '100 g', price: 20, cost: 0 }],
      addons: [], inStock: true, alwaysAvailable: false, leadMins: 0, prep: '' },
    { id: 'roti', sort: 3, name: 'Homemade Roti', emoji: '🫓', img: 'img/roti.jpg',
      desc: 'Soft whole-wheat rotis, made fresh on order.',
      tags: ['Most popular'], variants: [{ label: '1 roti', price: 15, cost: 0 }],
      addons: [{ label: 'Butter', price: 5, cost: 0 }, { label: 'Cheese', price: 10, cost: 0 }],
      inStock: true, alwaysAvailable: true, leadMins: 30, prep: '' },
    { id: 'garlic', sort: 4, name: 'Peeled Garlic', emoji: '🧄', img: 'img/garlic.jpg',
      desc: 'Hand-peeled, cleaned & ready to cook.',
      tags: ['Time saver'], variants: [{ label: '100 g', price: 50, cost: 0 }],
      addons: [], inStock: true, alwaysAvailable: false, leadMins: 1440, prep: '' }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function digits(p) { p = String(p || '').replace(/\D/g, ''); return p.length > 10 ? p.slice(-10) : p; }
  function newId(prefix) { return (prefix || '') + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 5).toUpperCase(); }
  function newOrderId() { var d = new Date(); return 'KK' + pad(d.getDate()) + pad(d.getMonth() + 1) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  function money(n) { return '₹' + (Math.round((+n || 0) * 100) / 100); }
  function fmtTime(t) {
    if (!t) return '';
    return new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function priceItems(menu, items, allowEmpty) {
    var byId = {}; menu.forEach(function (m) { byId[m.id] = m; });
    var lines = [], total = 0;
    (items || []).forEach(function (it) {
      var m = byId[it.id]; if (!m) throw new Error('Item not available: ' + it.id);
      var vi = +it.v || 0, v = m.variants[vi]; if (!v) throw new Error('Invalid option for ' + m.name);
      var qty = Math.max(1, Math.min(200, parseInt(it.qty, 10) || 1));
      var idx = (it.addons || []).filter(function (i) { return m.addons && m.addons[i]; });
      var adds = idx.map(function (i) { return m.addons[i]; });
      var unit = (+v.price || 0) + adds.reduce(function (s, a) { return s + (+a.price || 0); }, 0);
      var unitCost = (+v.cost || 0) + adds.reduce(function (s, a) { return s + (+a.cost || 0); }, 0);
      lines.push({ id: m.id, name: m.name, emoji: m.emoji || '', v: vi, variant: v.label, addonIdx: idx,
        addons: adds.map(function (a) { return a.label; }), qty: qty, unit: unit, unitCost: unitCost, amount: unit * qty });
      total += unit * qty;
    });
    if (!lines.length && !allowEmpty) throw new Error('Your cart is empty');
    return { lines: lines, total: total };
  }

  function orderText(o) {
    var s = '🌿 Keralam Kitchen\nOrder ID: ' + o.id + '\nDate: ' + fmtTime(o.createdAt) + '\n';
    if (o.type === 'custom') s += 'Custom request: ' + (o.customText || '') + (o.customPhoto ? '\nPhoto: ' + o.customPhoto : '') + '\n';
    (o.items || []).forEach(function (l) {
      s += '• ' + l.name + ' (' + l.variant + (l.addons && l.addons.length ? ' + ' + l.addons.join(', ') : '') + ') × ' + l.qty + ' = ' + money(l.amount) + '\n';
    });
    if (o.total) s += 'Total: ' + money(o.total) + '\n';
    s += 'Pickup: ' + (o.pickupAt ? fmtTime(o.pickupAt) : 'We will confirm') + '\n';
    s += 'Payment: ' + (o.pay === 'now' ? 'UPI (pay now)' : 'Pay at pickup') + '\n';
    s += 'Name: ' + o.name + ' | Flat: ' + o.flat + ' | 📞 ' + o.phone;
    if (o.notes) s += '\nNotes: ' + o.notes;
    return s;
  }

  function canChange(o) { return ['placed', 'accepted', 'preparing'].indexOf(o.status) >= 0 && Date.now() - o.createdAt < CANCEL_WINDOW; }
  function reviewOpensAt(o) { return o.collectedAt ? o.collectedAt + REVIEW_DELAY : 0; }

  function summarize(table, o) {
    try {
      if (table === 'orders') return [o.status.toUpperCase(), o.name, 'Flat ' + o.flat, o.phone, money(o.total),
        (o.items || []).map(function (l) { return l.name + ' ' + l.variant + ' x' + l.qty; }).join(', ') || (o.customText || ''),
        'Pickup ' + fmtTime(o.pickupAt), o.pay === 'now' ? 'UPI-now' : 'at pickup', o.payMethod || ''].join(' | ');
      if (table === 'customers') return [o.name, 'Flat ' + o.flat, o.phone, 'PIN ' + (o.pin || '-'), (o.orders || 0) + ' orders', (o.visits || 0) + ' visits', o.blocked ? 'BLOCKED' : '', o.note || ''].join(' | ');
      if (table === 'activity') return [fmtTime(o.at), o.type, o.name, o.phone, o.text].join(' | ');
      if (table === 'settings') return 'UPI ' + (o.upiId || '-') + ' | alerts ' + (o.notifyEmail || 'owner email');
      if (table === 'menu') return [o.name, o.inStock ? 'IN STOCK' : 'TOMORROW', (o.variants || []).map(function (v) { return v.label + ' ₹' + v.price; }).join(', ')].join(' | ');
      if (table === 'reviews') return [o.stars + '★', o.itemName || '', o.name, o.text || ''].join(' | ');
      if (table === 'chats') return [o.phone, o.from, o.text].join(' | ');
      if (table === 'expenses') return [o.date, o.category, o.qty || '', money(o.amount)].join(' | ');
    } catch (e) {}
    return '';
  }

  function create(store, hooks) {
    var admins = (hooks.adminPhones || []).map(digits);
    function prop(k) { return hooks.prop(k); }
    function getMenu() {
      var m = store.all('menu');
      if (!m.length) { DEFAULT_MENU.forEach(function (x) { store.put('menu', clone(x)); }); m = store.all('menu'); }
      return m.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    }
    function getSettings() { return store.get('settings', 'main') || { id: 'main', upiId: '', upiName: 'Keralam Kitchen', notifyEmail: '', emailAlerts: true, emailVisits: false }; }
    function publicSettings() { var s = getSettings(); return { upiId: s.upiId || '', upiName: s.upiName || 'Keralam Kitchen' }; }
    function adminOnline() { return Date.now() - (+prop('ADMIN_SEEN') || 0) < 2 * MIN; }
    function isAdmin(d) {
      var a = (d && d.auth) || {}, pin = prop('ADMIN_PIN');
      return !!pin && admins.indexOf(digits(a.phone)) >= 0 && String(a.pin) === String(pin);
    }
    function notify(t) { try { hooks.notify(t, getSettings()); } catch (e) {} }
    function img(data, name) { if (!data) return ''; if (/^(https?:|img\/)/.test(data)) return data; try { return hooks.saveImage(data, name) || ''; } catch (e) { return ''; } }
    function who(c) { return c ? ((c.name || 'Guest') + ' (' + (c.phone || '?') + (c.flat ? ', Flat ' + c.flat : '') + ')') : 'Guest'; }
    function log(type, c, text, alsoNotify) {
      var a = { id: newId('A'), at: Date.now(), type: type, phone: (c && c.phone) || '', name: (c && c.name) || '', text: String(text || '').slice(0, 300) };
      try { store.put('activity', a); } catch (e) {}
      if (alsoNotify) notify(alsoNotify === true ? text + '\n👤 ' + who(c) : alsoNotify);
      return a;
    }
    function pub(c) { return { phone: c.phone, name: c.name || '', flat: c.flat || '', photo: c.photo || '', createdAt: c.firstAt || 0, visits: c.visits || 0 }; }
    function validPin(p) { return /^\d{4,6}$/.test(String(p || '')); }
    // Customer login check. required=true → throws if not logged in.
    function custAuth(d, required) {
      var a = (d && d.cauth) || {}, ph = digits(a.phone);
      var c = ph.length === 10 ? store.get('customers', ph) : null;
      if (!c || !c.pin || String(c.pin) !== String(a.pin)) { if (required) throw new Error('LOGIN: Please log in again'); return null; }
      if (c.blocked) throw new Error('BLOCKED: Your account is on hold. Please contact Keralam Kitchen.');
      return c;
    }
    function ownOrder(d, c) { var o = store.get('orders', d.id); if (!o || o.phone !== c.phone) throw new Error('Order not found'); return o; }
    function upsertCustomer(c, source) {
      var id = digits(c.phone);
      var ex = store.get('customers', id) || { id: id, phone: id, firstAt: Date.now(), orders: 0, visits: 0, source: source || 'web' };
      if (c.name) ex.name = String(c.name).trim().slice(0, 60);
      if (c.flat) ex.flat = String(c.flat).trim().slice(0, 30);
      if (c.note !== undefined) ex.note = c.note;
      ex.lastAt = Date.now();
      store.put('customers', ex); return ex;
    }
    function publicReviews() { return store.all('reviews').filter(function (r) { return !r.hidden; }).sort(function (a, b) { return b.at - a.at; }).slice(0, 80); }
    function validCustomer(c) {
      c = c || {};
      if (!String(c.name || '').trim() || !String(c.flat || '').trim() || digits(c.phone).length !== 10) throw new Error('Name, flat number and 10-digit mobile number are required');
    }
    function setStatus(o, s, by) {
      if (o.status === s) return;
      o.status = s; o[s + 'At'] = Date.now();
      (o.history = o.history || []).push({ at: Date.now(), s: s, by: by || '' });
    }

    var A = {
      menu: function () { return { menu: getMenu(), reviews: publicReviews(), adminOnline: adminOnline(), settings: publicSettings() }; },

      /* ---------- customer accounts ---------- */
      register: function (d) {
        var ph = digits(d.phone);
        validCustomer({ name: d.name, flat: d.flat, phone: ph });
        if (!validPin(d.pin)) throw new Error('PIN must be 4 to 6 digits');
        if (admins.indexOf(ph) >= 0) throw new Error('This is the kitchen number — please use Kitchen login');
        var ex = store.get('customers', ph);
        if (ex && ex.pin) throw new Error('EXISTS: This number already has an account. Please log in, or tap “Forgot PIN”.');
        if (ex && ex.blocked) throw new Error('BLOCKED: Your account is on hold. Please contact Keralam Kitchen.');
        var c = upsertCustomer({ name: d.name, flat: d.flat, phone: ph }, 'web');
        c.pin = String(d.pin); c.visits = (c.visits || 0) + 1; c.logins = 1; c.lastSeen = c.lastLoginAt = Date.now(); c.fails = 0;
        if (d.photo) c.photo = img(d.photo, 'profile-' + ph);
        store.put('customers', c);
        log('signup', c, '🎉 NEW CUSTOMER SIGNED UP' + (d.device ? ' · ' + d.device : ''), true);
        return { customer: pub(c) };
      },
      login: function (d) {
        var ph = digits(d.phone);
        if (ph.length !== 10) throw new Error('Enter your 10-digit mobile number');
        var c = store.get('customers', ph);
        if (!c || !c.pin) throw new Error('NOACCOUNT: No account for this number yet — please create one.');
        if (c.lockUntil && Date.now() < c.lockUntil) throw new Error('Too many wrong tries. Please wait 15 minutes, or tap “Forgot PIN”.');
        if (String(c.pin) !== String(d.pin)) {
          c.fails = (c.fails || 0) + 1;
          var locked = c.fails >= 5; if (locked) { c.lockUntil = Date.now() + 15 * MIN; c.fails = 0; }
          store.put('customers', c);
          log('wrong_pin', c, 'Wrong PIN entered' + (locked ? ' 5 times — locked for 15 min' : ''), locked ? '⚠️ 5 WRONG PIN TRIES — account locked 15 min\n👤 ' + who(c) : false);
          throw new Error('Wrong PIN. Try again, or tap “Forgot PIN”.');
        }
        if (c.blocked) { log('blocked', c, '⛔ Blocked customer tried to log in', true); throw new Error('BLOCKED: Your account is on hold. Please contact Keralam Kitchen.'); }
        c.fails = 0; c.visits = (c.visits || 0) + 1; c.logins = (c.logins || 0) + 1; c.lastSeen = c.lastLoginAt = Date.now();
        store.put('customers', c);
        log('login', c, '🔑 CUSTOMER LOGGED IN' + (d.device ? ' · ' + d.device : ''), true);
        return { customer: pub(c) };
      },
      forgotPin: function (d) {
        var ph = digits(d.phone); if (ph.length !== 10) throw new Error('Enter your 10-digit mobile number');
        var c = store.get('customers', ph);
        if (!c || !c.pin) throw new Error('NOACCOUNT: No account for this number yet — please create one.');
        log('forgot_pin', c, 'Forgot PIN — asked the kitchen for help',
          '🔑 FORGOT PIN request\n👤 ' + who(c) + '\nTheir PIN is: ' + c.pin + '\nPlease confirm it is really them, then send the PIN on WhatsApp: https://wa.me/91' + ph);
        return { ok: true };
      },
      visit: function (d) {
        var c = custAuth(d, false);
        if (c) { c.visits = (c.visits || 0) + 1; c.lastSeen = Date.now(); store.put('customers', c); }
        var s = getSettings();
        log('visit', c, 'Opened the website' + (d.device ? ' · ' + d.device : ''), s.emailVisits && c ? '👀 ' + who(c) + ' opened the website' : false);
        return c ? { customer: pub(c), settings: publicSettings() } : { settings: publicSettings() };
      },
      track: function (d) {
        var c = custAuth(d, false), ok = ['cart', 'checkout', 'logout', 'notify_on'];
        if (ok.indexOf(d.type) < 0) return { ok: true };
        if (c) { c.lastSeen = Date.now(); store.put('customers', c); }
        log(d.type, c, String(d.text || '').slice(0, 200));
        return { ok: true };
      },
      updateProfile: function (d) {
        var c = custAuth(d, true);
        if (d.name !== undefined && String(d.name).trim()) c.name = String(d.name).trim().slice(0, 60);
        if (d.flat !== undefined && String(d.flat).trim()) c.flat = String(d.flat).trim().slice(0, 30);
        if (d.photo !== undefined) c.photo = d.photo ? img(d.photo, 'profile-' + c.phone + '-' + Date.now()) : '';
        var changedPin = false;
        if (d.newPin) { if (!validPin(d.newPin)) throw new Error('PIN must be 4 to 6 digits'); c.pin = String(d.newPin); changedPin = true; }
        store.put('customers', c);
        log('profile', c, 'Updated profile' + (changedPin ? ' (changed PIN)' : '') + (d.photo ? ' (new photo)' : ''));
        return { customer: pub(c) };
      },

      /* ---------- orders ---------- */
      placeOrder: function (d) {
        var admin = isAdmin(d), cu = admin ? null : custAuth(d, true);
        var c = d.customer || {};
        if (!admin) c = { name: c.name || cu.name, flat: c.flat || cu.flat, phone: cu.phone };
        validCustomer(c);
        if (d.id) { var ex = store.get('orders', d.id); if (ex && ex.phone === digits(c.phone)) return { order: ex }; }
        var custom = d.type === 'custom';
        if (custom && !String(d.customText || '').trim() && !d.customPhoto) throw new Error('Please describe the dish or add a photo');
        var p = priceItems(getMenu(), d.items, custom), now = Date.now();
        var o = { id: (d.id && !store.get('orders', d.id)) ? d.id : newOrderId(), type: custom ? 'custom' : 'regular', name: String(c.name).trim(), flat: String(c.flat).trim(),
          phone: digits(c.phone), items: p.lines, total: p.total, notes: String(d.notes || '').slice(0, 500), pickupAt: +d.pickupAt || 0,
          pay: d.pay === 'now' ? 'now' : 'spot', payStatus: 'due', payMethod: '', status: 'placed', source: admin ? (d.source || 'phone') : 'web',
          createdAt: now, history: [{ at: now, s: 'placed' }] };
        if (custom) { o.customText = String(d.customText || '').slice(0, 1000); o.customPhoto = img(d.customPhoto, o.id + '-custom'); }
        store.put('orders', o);
        var cr = upsertCustomer(c, o.source); cr.orders = (cr.orders || 0) + 1; cr.spent = (cr.spent || 0); store.put('customers', cr);
        log(custom ? 'custom' : 'order', cr, (custom ? 'Custom request ' : 'Placed order ') + o.id + ' · ' + money(o.total) + (admin ? ' (entered by kitchen)' : ''),
          admin ? false : (custom ? '✨ CUSTOM REQUEST — please call the customer\n' : '🆕 NEW ORDER\n') + orderText(o));
        return { order: o };
      },

      myOrders: function (d) {
        var c = custAuth(d, true);
        c.lastSeen = Date.now(); store.put('customers', c);
        return { orders: store.all('orders').filter(function (o) { return o.phone === c.phone; }).sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 40),
          adminOnline: adminOnline(), customer: pub(c), settings: publicSettings() };
      },

      cancelOrder: function (d) {
        var c = custAuth(d, true), o = ownOrder(d, c);
        if (!canChange(o)) throw new Error('This order can no longer be cancelled. Please contact support.');
        setStatus(o, 'cancelled', 'customer'); o.cancelReason = String(d.reason || '').slice(0, 300);
        store.put('orders', o);
        log('cancel', c, 'Cancelled order ' + o.id + (o.cancelReason ? ' — ' + o.cancelReason : ''), '❌ ORDER CANCELLED by customer\n' + orderText(o));
        return { order: o };
      },

      modifyOrder: function (d) {
        var c = custAuth(d, true), o = ownOrder(d, c);
        if (!canChange(o)) throw new Error('This order can no longer be changed. Please contact support.');
        var p = priceItems(getMenu(), d.items);
        o.items = p.lines; o.total = p.total; o.notes = String(d.notes || '').slice(0, 500);
        if (d.pickupAt) o.pickupAt = +d.pickupAt;
        if (d.pay) o.pay = d.pay === 'now' ? 'now' : 'spot';
        o.modifiedAt = Date.now(); (o.history = o.history || []).push({ at: Date.now(), s: 'modified', by: 'customer' });
        store.put('orders', o);
        log('modify', c, 'Modified order ' + o.id + ' · ' + money(o.total), '✏️ ORDER MODIFIED by customer\n' + orderText(o));
        return { order: o };
      },

      addReview: function (d) {
        var c = custAuth(d, true);
        var stars = Math.max(1, Math.min(5, parseInt(d.stars, 10) || 0));
        var o = null;
        if (d.orderId) {
          o = ownOrder({ id: d.orderId }, c);
          if (o.status !== 'collected' || Date.now() < reviewOpensAt(o)) throw new Error('Reviews open 40 minutes after pickup');
        }
        var menu = getMenu(), item = menu.filter(function (m) { return m.id === d.itemId; })[0];
        var r = { id: newId('R'), itemId: item ? item.id : '', itemName: item ? item.name : 'Overall', orderId: d.orderId || '',
          name: String(d.name || c.name).trim().slice(0, 40), phone: c.phone, photoUser: c.photo || '', stars: stars, text: String(d.text || '').slice(0, 600), at: Date.now() };
        r.photo = img(d.photo, r.id);
        store.put('reviews', r);
        if (o) { o.reviewed = true; store.put('orders', o); }
        log('review', c, stars + '★ review — ' + r.itemName, '⭐ NEW REVIEW ' + stars + '★ — ' + r.itemName + '\n' + r.name + ': ' + r.text);
        return { review: r };
      },

      chatSend: function (d) {
        var c = custAuth(d, true);
        var m = { id: newId('M'), phone: c.phone, name: c.name, from: 'customer', text: String(d.text || '').slice(0, 1000), at: Date.now() };
        if (!m.text.trim()) throw new Error('Empty message');
        store.put('chats', m);
        log('chat', c, 'Chat: ' + m.text.slice(0, 120), '💬 SUPPORT CHAT from ' + who(c) + '\n' + m.text + '\n(Reply from the admin dashboard → Chat)');
        return A.chatList(d);
      },
      chatList: function (d) {
        var c = custAuth(d, true);
        return { messages: store.all('chats').filter(function (m) { return m.phone === c.phone; }).sort(function (a, b) { return a.at - b.at; }), adminOnline: adminOnline() };
      },

      /* ---------- admin ---------- */
      adminLogin: function (d) {
        hooks.setProp('ADMIN_SEEN', Date.now());
        log('admin_login', { phone: digits(d.auth.phone), name: 'Admin' }, 'Admin logged in to the dashboard' + (d.device ? ' · ' + d.device : ''),
          '🔐 ADMIN DASHBOARD LOGIN\nNumber: ' + digits(d.auth.phone) + (d.device ? '\nDevice: ' + d.device : '') + '\nIf this was not you, change ADMIN_PIN in Apps Script now.');
        return { ok: true };
      },
      adminData: function () {
        hooks.setProp('ADMIN_SEEN', Date.now());
        return { orders: store.all('orders').sort(function (a, b) { return b.createdAt - a.createdAt; }), menu: getMenu(),
          customers: store.all('customers'), reviews: store.all('reviews'), chats: store.all('chats'), expenses: store.all('expenses'),
          activity: store.all('activity').sort(function (a, b) { return b.at - a.at; }).slice(0, 600), settings: getSettings(), now: Date.now() };
      },
      adminUpdateOrder: function (d) {
        var o = store.get('orders', d.id); if (!o) throw new Error('Order not found');
        var p = d.patch || {};
        if (p.items) { var pr = priceItems(getMenu(), p.items, o.type === 'custom'); o.items = pr.lines; o.total = pr.total; }
        if (p.total !== undefined && p.total !== '' && !p.items) o.total = +p.total;
        ['notes', 'adminNote', 'payMethod', 'payStatus', 'cancelReason'].forEach(function (k) { if (p[k] !== undefined) o[k] = p[k]; });
        if (p.pickupAt !== undefined) o.pickupAt = +p.pickupAt || 0;
        if (p.status) {
          setStatus(o, p.status, 'admin');
          if (p.status === 'collected') o.payStatus = 'paid';
          if (p.status !== 'placed') o.reminded = true;
        }
        o.updatedAt = Date.now();
        store.put('orders', o);
        if (p.status) log('admin_status', { phone: o.phone, name: o.name }, 'Kitchen marked ' + o.id + ' as ' + p.status);
        return { order: o };
      },
      adminSaveItem: function (d) {
        var it = d.item || {}; if (!String(it.name || '').trim()) throw new Error('Name required');
        it.id = it.id || String(it.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 5);
        it.variants = (it.variants || []).filter(function (v) { return v.label; });
        if (!it.variants.length) throw new Error('Add at least one size/price');
        it.addons = it.addons || []; it.tags = it.tags || [];
        if (it.img && /^data:/.test(it.img)) it.img = img(it.img, 'item-' + it.id);
        store.put('menu', it); return { item: it };
      },
      adminDeleteItem: function (d) { store.del('menu', d.id); return { ok: true }; },
      adminSaveCustomer: function (d) {
        var x = d.customer || {}; validCustomer(x);
        var ph = digits(x.phone), old = d.originalPhone ? digits(d.originalPhone) : ph;
        if (x.pin && !validPin(x.pin)) throw new Error('PIN must be 4 to 6 digits');
        if (old !== ph && store.get('customers', ph)) throw new Error('Another customer already uses ' + ph);
        var c = store.get('customers', old) || { firstAt: Date.now(), orders: 0, visits: 0, source: x.source || 'phone' };
        c.id = ph; c.phone = ph; c.name = String(x.name).trim(); c.flat = String(x.flat).trim();
        if (x.note !== undefined) c.note = x.note;
        if (x.pin !== undefined) c.pin = x.pin ? String(x.pin) : '';
        if (x.blocked !== undefined) c.blocked = !!x.blocked;
        if (x.photo !== undefined) c.photo = x.photo ? img(x.photo, 'profile-' + ph + '-' + Date.now()) : '';
        c.lockUntil = 0; c.fails = 0;
        store.put('customers', c);
        if (old !== ph) store.del('customers', old);
        log('admin_customer', c, 'Kitchen saved customer details');
        return { customer: c };
      },
      adminDeleteCustomer: function (d) { var c = store.get('customers', digits(d.phone)); store.del('customers', digits(d.phone)); log('admin_customer', c, 'Kitchen deleted this customer'); return { ok: true }; },
      adminBlockCustomer: function (d) {
        var c = store.get('customers', digits(d.phone)); if (!c) throw new Error('Customer not found');
        c.blocked = !!d.blocked; c.blockReason = String(d.reason || ''); store.put('customers', c);
        log('admin_customer', c, (c.blocked ? '⛔ Blocked' : '✅ Unblocked') + (c.blockReason ? ' — ' + c.blockReason : ''));
        return { customer: c };
      },
      adminSaveSettings: function (d) {
        var s = getSettings(), x = d.settings || {};
        ['upiId', 'upiName', 'notifyEmail'].forEach(function (k) { if (x[k] !== undefined) s[k] = String(x[k]).trim(); });
        ['emailAlerts', 'emailVisits'].forEach(function (k) { if (x[k] !== undefined) s[k] = !!x[k]; });
        s.id = 'main'; store.put('settings', s); return { settings: s };
      },
      adminTestAlert: function () { notify('✅ Test alert from Keralam Kitchen dashboard — alerts are working!'); return { ok: true }; },
      adminChatReply: function (d) {
        var m = { id: newId('M'), phone: digits(d.phone), name: 'Keralam Kitchen', from: 'admin', text: String(d.text || '').slice(0, 1000), at: Date.now() };
        store.put('chats', m); return { message: m };
      },
      adminSaveExpense: function (d) {
        var e = d.expense || {}; e.id = e.id || newId('E'); e.amount = +e.amount || 0;
        if (!e.date) throw new Error('Date required');
        store.put('expenses', e); return { expense: e };
      },
      adminDeleteExpense: function (d) { store.del('expenses', d.id); return { ok: true }; },
      adminHideReview: function (d) { var r = store.get('reviews', d.id); if (r) { r.hidden = !r.hidden; store.put('reviews', r); } return { review: r }; }
    };

    function checkStale() {
      var stale = store.all('orders').filter(function (o) { return o.status === 'placed' && !o.reminded && Date.now() - o.createdAt > STALE_AFTER; });
      stale.forEach(function (o) {
        notify('⏰ REMINDER: order waiting 15+ min without acceptance\n' + orderText(o));
        o.reminded = true; store.put('orders', o);
      });
      return stale.length;
    }

    function handle(action, d) {
      d = d || {};
      if (!A[action]) throw new Error('Unknown action');
      if (action.indexOf('admin') === 0 && !isAdmin(d)) {
        if (action === 'adminLogin') log('admin_fail', { phone: digits((d.auth || {}).phone), name: 'Admin?' }, 'Wrong admin PIN attempt',
          '⚠️ WRONG ADMIN PIN attempt for number ' + digits((d.auth || {}).phone) + (d.device ? '\nDevice: ' + d.device : ''));
        throw new Error('Wrong phone number or PIN');
      }
      return A[action](d);
    }
    handle.checkStale = checkStale;
    return handle;
  }

  return { create: create, priceItems: priceItems, orderText: orderText, canChange: canChange, reviewOpensAt: reviewOpensAt,
    newOrderId: newOrderId, newId: newId, digits: digits, money: money, fmtTime: fmtTime, summarize: summarize,
    DEFAULT_MENU: DEFAULT_MENU, CANCEL_WINDOW: CANCEL_WINDOW, REVIEW_DELAY: REVIEW_DELAY, STALE_AFTER: STALE_AFTER };
})();
