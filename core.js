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
      if (table === 'customers') return [o.name, 'Flat ' + o.flat, o.phone, (o.orders || 0) + ' orders', o.note || ''].join(' | ');
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
    function adminOnline() { return Date.now() - (+prop('ADMIN_SEEN') || 0) < 2 * MIN; }
    function isAdmin(d) {
      var a = (d && d.auth) || {}, pin = prop('ADMIN_PIN');
      return !!pin && admins.indexOf(digits(a.phone)) >= 0 && String(a.pin) === String(pin);
    }
    function notify(t) { try { hooks.notify(t); } catch (e) {} }
    function img(data, name) { if (!data) return ''; if (/^(https?:|img\/)/.test(data)) return data; try { return hooks.saveImage(data, name) || ''; } catch (e) { return ''; } }
    function ownOrder(d) { var o = store.get('orders', d.id); if (!o || o.phone !== digits(d.phone)) throw new Error('Order not found'); return o; }
    function upsertCustomer(c, source) {
      var id = digits(c.phone);
      var ex = store.get('customers', id) || { id: id, phone: id, firstAt: Date.now(), orders: 0, source: source || 'web' };
      if (c.name) ex.name = String(c.name).trim();
      if (c.flat) ex.flat = String(c.flat).trim();
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
      menu: function () { return { menu: getMenu(), reviews: publicReviews(), adminOnline: adminOnline() }; },

      placeOrder: function (d) {
        if (d.id) { var ex = store.get('orders', d.id); if (ex) return { order: ex }; }
        var c = d.customer || {}; validCustomer(c);
        var custom = d.type === 'custom';
        if (custom && !String(d.customText || '').trim() && !d.customPhoto) throw new Error('Please describe the dish or add a photo');
        var p = priceItems(getMenu(), d.items, custom), now = Date.now();
        var o = { id: d.id || newOrderId(), type: custom ? 'custom' : 'regular', name: String(c.name).trim(), flat: String(c.flat).trim(),
          phone: digits(c.phone), items: p.lines, total: p.total, notes: String(d.notes || '').slice(0, 500), pickupAt: +d.pickupAt || 0,
          pay: d.pay === 'now' ? 'now' : 'spot', payStatus: 'due', payMethod: '', status: 'placed', source: d.source || 'web',
          createdAt: now, history: [{ at: now, s: 'placed' }] };
        if (custom) { o.customText = String(d.customText || '').slice(0, 1000); o.customPhoto = img(d.customPhoto, o.id + '-custom'); }
        store.put('orders', o);
        var cu = upsertCustomer(c, o.source); cu.orders = (cu.orders || 0) + 1; store.put('customers', cu);
        notify((custom ? '✨ CUSTOM REQUEST — please call the customer\n' : '🆕 NEW ORDER\n') + orderText(o));
        return { order: o };
      },

      myOrders: function (d) {
        var ph = digits(d.phone); if (ph.length !== 10) return { orders: [] };
        return { orders: store.all('orders').filter(function (o) { return o.phone === ph; }).sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 40), adminOnline: adminOnline() };
      },

      cancelOrder: function (d) {
        var o = ownOrder(d);
        if (!canChange(o)) throw new Error('This order can no longer be cancelled. Please contact support.');
        setStatus(o, 'cancelled', 'customer'); o.cancelReason = String(d.reason || '').slice(0, 300);
        store.put('orders', o);
        notify('❌ ORDER CANCELLED by customer\n' + orderText(o));
        return { order: o };
      },

      modifyOrder: function (d) {
        var o = ownOrder(d);
        if (!canChange(o)) throw new Error('This order can no longer be changed. Please contact support.');
        var p = priceItems(getMenu(), d.items);
        o.items = p.lines; o.total = p.total; o.notes = String(d.notes || '').slice(0, 500);
        if (d.pickupAt) o.pickupAt = +d.pickupAt;
        if (d.pay) o.pay = d.pay === 'now' ? 'now' : 'spot';
        o.modifiedAt = Date.now(); (o.history = o.history || []).push({ at: Date.now(), s: 'modified', by: 'customer' });
        store.put('orders', o);
        notify('✏️ ORDER MODIFIED by customer\n' + orderText(o));
        return { order: o };
      },

      addReview: function (d) {
        var stars = Math.max(1, Math.min(5, parseInt(d.stars, 10) || 0));
        if (!String(d.name || '').trim()) throw new Error('Please enter your name');
        var o = null;
        if (d.orderId) {
          o = ownOrder({ id: d.orderId, phone: d.phone });
          if (o.status !== 'collected' || Date.now() < reviewOpensAt(o)) throw new Error('Reviews open 40 minutes after pickup');
        }
        var menu = getMenu(), item = menu.filter(function (m) { return m.id === d.itemId; })[0];
        var r = { id: newId('R'), itemId: item ? item.id : '', itemName: item ? item.name : 'Overall', orderId: d.orderId || '',
          name: String(d.name).trim().slice(0, 40), phone: digits(d.phone), stars: stars, text: String(d.text || '').slice(0, 600), at: Date.now() };
        r.photo = img(d.photo, r.id);
        store.put('reviews', r);
        if (o) { o.reviewed = true; store.put('orders', o); }
        notify('⭐ NEW REVIEW ' + stars + '★ — ' + r.itemName + '\n' + r.name + ': ' + r.text);
        return { review: r };
      },

      chatSend: function (d) {
        var ph = digits(d.phone); if (ph.length !== 10) throw new Error('Please add your mobile number first');
        var m = { id: newId('M'), phone: ph, name: String(d.name || '').slice(0, 40), from: 'customer', text: String(d.text || '').slice(0, 1000), at: Date.now() };
        if (!m.text.trim()) throw new Error('Empty message');
        store.put('chats', m);
        notify('💬 SUPPORT CHAT from ' + (m.name || ph) + ' (' + ph + ')\n' + m.text + '\n(Reply from the admin dashboard → Chat)');
        return A.chatList(d);
      },
      chatList: function (d) {
        var ph = digits(d.phone);
        return { messages: store.all('chats').filter(function (m) { return m.phone === ph; }).sort(function (a, b) { return a.at - b.at; }), adminOnline: adminOnline() };
      },

      /* ---------- admin ---------- */
      adminLogin: function () { hooks.setProp('ADMIN_SEEN', Date.now()); return { ok: true }; },
      adminData: function () {
        hooks.setProp('ADMIN_SEEN', Date.now());
        return { orders: store.all('orders').sort(function (a, b) { return b.createdAt - a.createdAt; }), menu: getMenu(),
          customers: store.all('customers'), reviews: store.all('reviews'), chats: store.all('chats'), expenses: store.all('expenses'), now: Date.now() };
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
          if (p.status === 'cancelled') notify('❌ Order ' + o.id + ' cancelled by admin');
          if (p.status !== 'placed') o.reminded = true;
        }
        o.updatedAt = Date.now();
        store.put('orders', o);
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
      adminSaveCustomer: function (d) { validCustomer(d.customer); return { customer: upsertCustomer(d.customer, d.customer.source || 'phone') }; },
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
      if (action.indexOf('admin') === 0 && !isAdmin(d)) throw new Error('Wrong phone number or PIN');
      return A[action](d);
    }
    handle.checkStale = checkStale;
    return handle;
  }

  return { create: create, priceItems: priceItems, orderText: orderText, canChange: canChange, reviewOpensAt: reviewOpensAt,
    newOrderId: newOrderId, newId: newId, digits: digits, money: money, fmtTime: fmtTime, summarize: summarize,
    DEFAULT_MENU: DEFAULT_MENU, CANCEL_WINDOW: CANCEL_WINDOW, REVIEW_DELAY: REVIEW_DELAY, STALE_AFTER: STALE_AFTER };
})();
