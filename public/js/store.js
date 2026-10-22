/* Ledgerlight — data store.
   Talks to the local Python server (SQLite at data/finance.db). If the server is not
   running (page opened directly from disk), falls back to this browser's localStorage. */
window.LL = window.LL || {};
(function (LL) {
  'use strict';
  const U = LL.U;
  const COLS = ['meta', 'accounts', 'categories', 'transactions', 'budgets', 'bills', 'goals', 'debts', 'holdings', 'rules', 'documents'];
  const LS_KEY = 'ledgerlight_state_v1';

  const S = (LL.S = { state: null, mode: 'local', v: 0, listeners: [], dirty: new Set(), saving: false });
  S.COLS = COLS;
  /* true when served from a website (e.g. Hostinger) rather than the local server or a file on disk */
  S.hosted = () => S.mode === 'local' && /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  /* ---------- persistence ---------- */
  S.init = async function () {
    let state = null;
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (r.ok) { S.mode = 'server'; state = (await r.json()).state; }
    } catch (e) { S.mode = 'local'; }
    if (S.mode === 'local') {
      try { state = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { state = null; }
    }
    if (!state || !state.meta || !state.meta.version) {
      state = LL.Sample.generate();
      S.state = normalise(state);
      await S.saveAll();
    } else S.state = normalise(state);
    S.v++;
    return S.state;
  };
  function normalise(st) {
    COLS.forEach((c) => { if (c !== 'meta' && !Array.isArray(st[c])) st[c] = []; });
    st.meta = st.meta || {};
    st.meta.currency = st.meta.currency || 'INR';
    st.meta.fyStartMonth = st.meta.fyStartMonth || 4;
    const have = new Set(st.categories.map((c) => c.id));
    LL.defaultCategories().forEach((c) => { if (!have.has(c.id) && ['cat_uncat', 'cat_other_in', 'cat_rent'].includes(c.id)) st.categories.push(c); });
    return st;
  }
  const flush = U.debounce(async () => {
    if (S.mode === 'local') return writeLocal();
    const cols = [...S.dirty]; S.dirty.clear();
    try {
      await Promise.all(cols.map((c) => fetch('/api/collections/' + c, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S.state[c]) })));
      S.emit('saved');
    } catch (e) { U.toast('Could not reach the local server. Changes are kept in this tab until it is back.', 'warn'); cols.forEach((c) => S.dirty.add(c)); }
  }, 350);
  function writeLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(S.state)); S.emit('saved'); }
    catch (e) { U.toast('Browser storage is full or blocked. Export a backup to keep your data.', 'warn'); }
  }
  S.touch = (col) => { S.dirty.add(col); S.v++; S.cache = {}; flush(); S.emit('change', col); };
  S.saveAll = async () => {
    S.v++; S.cache = {};
    if (S.mode === 'server') {
      await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S.state) });
    } else writeLocal();
    S.emit('change', '*');
  };
  S.replaceAll = async (state) => { S.state = normalise(state); await S.saveAll(); };
  S.loadSample = () => S.replaceAll(LL.Sample.generate());
  S.clearAll = async () => {
    if (S.mode === 'server') { try { await fetch('/api/state', { method: 'DELETE' }); } catch (e) {} }
    await S.replaceAll(LL.Sample.empty());
  };
  S.on = (fn) => S.listeners.push(fn);
  S.emit = (ev, d) => S.listeners.forEach((f) => f(ev, d));

  /* ---------- CRUD ---------- */
  S.get = (col, id) => S.state[col].find((x) => x.id === id);
  S.upsert = (col, obj) => {
    if (!obj.id) obj.id = U.uid(col.slice(0, 3));
    const i = S.state[col].findIndex((x) => x.id === obj.id);
    if (i >= 0) S.state[col][i] = { ...S.state[col][i], ...obj }; else S.state[col].unshift(obj);
    if (col === 'transactions') S.state.transactions.sort((a, b) => ((a.date + (a.time || '')) < (b.date + (b.time || '')) ? 1 : -1));
    S.touch(col);
    return obj;
  };
  S.remove = (col, id) => { S.state[col] = S.state[col].filter((x) => x.id !== id); S.touch(col); };
  S.removeMany = (col, ids) => { const set = new Set(ids); S.state[col] = S.state[col].filter((x) => !set.has(x.id)); S.touch(col); };
  S.setMeta = (patch) => { Object.assign(S.state.meta, patch); S.touch('meta'); };

  /* ---------- memo helper ---------- */
  S.cache = {};
  const memo = (key, fn) => { if (!(key in S.cache)) S.cache[key] = fn(); return S.cache[key]; };

  /* ---------- lookups ---------- */
  S.cat = (id) => memo('catmap', () => new Map(S.state.categories.map((c) => [c.id, c]))).get(id) || { id, name: 'Uncategorised', group: 'Other', type: 'expense', icon: 'tag' };
  S.acc = (id) => memo('accmap', () => new Map(S.state.accounts.map((a) => [a.id, a]))).get(id) || { id, name: 'Unknown account', type: 'bank' };
  S.groups = () => memo('groups', () => [...new Set(S.state.categories.filter((c) => c.type === 'expense').map((c) => c.group))]);
  S.expenseCats = () => S.state.categories.filter((c) => c.type === 'expense');
  S.incomeCats = () => S.state.categories.filter((c) => c.type === 'income');
  S.isExpense = (t) => t.type === 'expense';
  S.isIncome = (t) => t.type === 'income';
  S.expenses = () => memo('exp', () => S.state.transactions.filter(S.isExpense));
  S.incomes = () => memo('inc', () => S.state.transactions.filter(S.isIncome));
  S.payees = () => memo('payees', () => [...new Set(S.state.transactions.map((t) => t.payee).filter(Boolean))].sort());
  S.tags = () => memo('tags', () => { const m = new Map(); S.state.transactions.forEach((t) => (t.tags || []).forEach((g) => m.set(g, (m.get(g) || 0) + 1))); return [...m.entries()].sort((a, b) => b[1] - a[1]); });

  /* date range of data */
  S.lastDate = () => memo('last', () => { const t = S.state.transactions; return t.length ? t.reduce((m, x) => (x.date > m ? x.date : m), t[0].date) : U.today(); });
  S.firstDate = () => memo('first', () => { const t = S.state.transactions; return t.length ? t.reduce((m, x) => (x.date < m ? x.date : m), t[0].date) : U.today(); });
  S.asOf = () => (S.lastDate() > U.today() ? S.lastDate() : U.today());
  S.curYM = () => U.ym(S.asOf());
  S.months = (n) => { const end = S.curYM(); const all = U.monthsBetween(U.ym(S.firstDate()), end); return n ? all.slice(-n) : all; };

  /* ---------- monthly aggregates ---------- */
  S.monthly = () => memo('monthly', () => {
    const map = new Map();
    const get = (ym) => { if (!map.has(ym)) map.set(ym, { ym, income: 0, expense: 0, byCat: {}, byGroup: {}, incBy: {}, count: 0 }); return map.get(ym); };
    for (const t of S.state.transactions) {
      if (t.type === 'transfer') continue;
      const m = get(U.ym(t.date));
      const c = S.cat(t.categoryId);
      if (t.type === 'income') { m.income += t.amount; m.incBy[t.categoryId] = (m.incBy[t.categoryId] || 0) + t.amount; }
      else { m.expense += t.amount; m.byCat[t.categoryId] = (m.byCat[t.categoryId] || 0) + t.amount; m.byGroup[c.group] = (m.byGroup[c.group] || 0) + t.amount; m.count++; }
    }
    S.months().forEach(get);
    return map;
  });
  S.month = (ym) => S.monthly().get(ym) || { ym, income: 0, expense: 0, byCat: {}, byGroup: {}, incBy: {}, count: 0 };
  S.inRange = (from, to, f) => S.state.transactions.filter((t) => t.date >= from && t.date <= to && (!f || f(t)));
  S.rangeFor = (key) => {
    const end = S.asOf(), ym = U.ym(end);
    switch (key) {
      case 'mtd': return [ym + '-01', end];
      case 'last': { const p = U.ymAdd(ym, -1); return [p + '-01', p + '-' + U.daysInMonth(p)]; }
      case '3m': return [U.ymAdd(ym, -2) + '-01', end];
      case '6m': return [U.ymAdd(ym, -5) + '-01', end];
      case '12m': return [U.ymAdd(ym, -11) + '-01', end];
      case 'ytd': return [ym.slice(0, 4) + '-01-01', end];
      case 'fy': { const fy = S.fyRange(end); return fy; }
      default: return [S.firstDate(), end];
    }
  };
  S.fyRange = (iso) => {
    const fm = S.state.meta.fyStartMonth || 4;
    const d = U.d(iso); let y = d.getFullYear();
    if (d.getMonth() + 1 < fm) y--;
    const s = y + '-' + String(fm).padStart(2, '0') + '-01';
    return [s, U.addDays(U.addMonths(s, 12), -1)];
  };

  /* ---------- balances ---------- */
  const LIQUID = new Set(['bank', 'savings', 'cash', 'credit', 'wallet']);
  S.isLiquidType = (t) => LIQUID.has(t);
  S.balanceSeries = (accId) => memo('bs_' + accId, () => {
    // running balance after each txn, oldest first
    const a = S.acc(accId);
    let b = +a.opening || 0;
    const tx = S.state.transactions.filter((t) => t.accountId === accId || t.toAccountId === accId).slice().sort((x, y) => (x.date + (x.time || '') < y.date + (y.time || '') ? -1 : 1));
    return tx.map((t) => {
      if (t.toAccountId === accId && t.type === 'transfer') b += t.amount;
      else if (t.accountId === accId) b += t.type === 'income' ? t.amount : -t.amount;
      return { date: t.date, bal: b, tx: t };
    });
  });
  S.accountBalance = (accId, asOf) => {
    const a = S.acc(accId);
    asOf = asOf || '9999-12-31';
    if (a.type === 'investment' || a.type === 'retirement') return U.sum(S.state.holdings.filter((h) => h.accountId === accId), (h) => S.holdingValue(h, asOf));
    if (a.type === 'property' || a.type === 'vehicle' || a.type === 'asset') {
      const vals = (a.valuations || []).filter((v) => v.date <= asOf);
      return vals.length ? vals[vals.length - 1].value : +a.opening || 0;
    }
    const s = S.balanceSeries(accId);
    let b = +a.opening || 0;
    for (const p of s) { if (p.date > asOf) break; b = p.bal; }
    return b;
  };
  S.holdingUnitsAt = (h, asOf) => U.sum((h.flows || []).filter((f) => f.date <= asOf), (f) => f.units);
  S.holdingCost = (h, asOf = '9999-12-31') => U.sum((h.flows || []).filter((f) => f.date <= asOf), (f) => f.amount);
  S.holdingPriceAt = (h, asOf) => {
    if (!h.history || !h.history.length) return +h.price || 0;
    const ym = U.ym(asOf);
    if (ym >= S.curYM()) return +h.price;
    let p = h.history[0].price;
    for (const x of h.history) { if (x.ym > ym) break; p = x.price; }
    return p;
  };
  S.holdingValue = (h, asOf = '9999-12-31') => (asOf >= S.asOf() ? (+h.units || S.holdingUnitsAt(h, asOf)) * h.price : S.holdingUnitsAt(h, asOf) * S.holdingPriceAt(h, asOf));

  /* loan balance from its amortisation schedule */
  S.debtSchedule = (d) => {
    if (!d.tenure || !d.principal) return [];
    const r = d.rate / 1200, emi = d.emi || (r ? (d.principal * r * Math.pow(1 + r, d.tenure)) / (Math.pow(1 + r, d.tenure) - 1) : d.principal / d.tenure);
    const out = []; let bal = d.principal;
    for (let k = 1; k <= d.tenure && bal > 0.5; k++) {
      const interest = bal * r, principal = Math.min(bal, emi - interest + (d.extra || 0));
      bal -= principal;
      out.push({ n: k, date: U.addMonths(d.startDate, k), interest, principal, emi: interest + principal, balance: Math.max(0, bal) });
    }
    return out;
  };
  S.debtBalance = (d, asOf = S.asOf()) => {
    if (d.balanceManual != null && !d.tenure) return asOf >= (d.startDate || '') ? d.balanceManual : 0;
    if (asOf < d.startDate) return 0;
    const sch = S.debtSchedule(d);
    let b = d.principal;
    for (const p of sch) { if (p.date > asOf) break; b = p.balance; }
    return b;
  };

  S.netWorth = (asOf = S.asOf()) => {
    let assets = 0, liabilities = 0;
    const byType = {};
    for (const a of S.state.accounts) {
      if (a.archived || a.includeInNetWorth === false) continue;
      const b = S.accountBalance(a.id, asOf);
      if (b >= 0) assets += b; else liabilities += -b;
      byType[a.type] = (byType[a.type] || 0) + b;
    }
    for (const d of S.state.debts) {
      const b = S.debtBalance(d, asOf);
      if (d.kind === 'lent') { assets += b; byType.receivable = (byType.receivable || 0) + b; }
      else { liabilities += b; byType.loan = (byType.loan || 0) - b; }
    }
    return { assets, liabilities, net: assets - liabilities, byType };
  };
  S.netWorthSeries = () => memo('nws', () => S.months().map((ym) => {
    const asOf = ym === S.curYM() ? S.asOf() : ym + '-' + U.daysInMonth(ym);
    return { ym, ...S.netWorth(asOf) };
  }));
  S.liquid = (asOf) => U.sum(S.state.accounts.filter((a) => !a.archived && ['bank', 'savings', 'cash', 'wallet'].includes(a.type)), (a) => S.accountBalance(a.id, asOf));
  S.cardDebt = () => -U.sum(S.state.accounts.filter((a) => a.type === 'credit' && !a.archived), (a) => Math.min(0, S.accountBalance(a.id)));

  /* ---------- bills ---------- */
  S.billAmount = (b, iso = S.asOf()) => { if (!b.priceHistory) return b.amount; let a = b.amount; for (const p of b.priceHistory) if (iso >= p.from) a = p.amount; return a; };
  S.nextDue = (b, from = S.asOf()) => {
    const dd = (ym) => ym + '-' + String(Math.min(b.dueDay || 1, U.daysInMonth(ym))).padStart(2, '0');
    let ym = U.ym(from);
    for (let i = 0; i < 26; i++) {
      const cand = dd(ym);
      const mon = +ym.slice(5);
      const okFreq = b.frequency === 'yearly' ? mon === (b.dueMonth || mon) : b.frequency === 'quarterly' ? (mon - (b.dueMonth || 1) + 12) % 3 === 0 : true;
      if (okFreq && cand >= from && (!b.startDate || cand >= b.startDate)) return cand;
      ym = U.ymAdd(ym, 1);
    }
    return null;
  };
  S.monthlyCost = (b) => b.frequency === 'yearly' ? b.amount / 12 : b.frequency === 'quarterly' ? b.amount / 3 : b.frequency === 'weekly' ? (b.amount * 52) / 12 : b.amount;
  S.upcoming = (days = 30, from = S.asOf()) => {
    const until = U.addDays(from, days), out = [];
    for (const b of S.state.bills) {
      if (!b.active) continue;
      let d = S.nextDue(b, from);
      let guard = 0;
      while (d && d <= until && guard++ < 6) { out.push({ bill: b, date: d, amount: S.billAmount(b, d) }); d = S.nextDue(b, U.addDays(d, 1)); }
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  };
  S.isBillPaid = (b, date) => {
    const ym = U.ym(date);
    return S.state.transactions.some((t) => U.ym(t.date) === ym && (t.payee === b.name || (b.debtId && t.debtId === b.debtId)) && Math.abs(U.daysBetween(t.date, date)) <= 6);
  };

  /* ---------- rules ---------- */
  S.applyRules = (t) => {
    for (const r of S.state.rules) {
      if (!r.active) continue;
      const val = String(t[r.field] || '').toLowerCase(), v = String(r.value).toLowerCase();
      const hit = r.op === 'equals' ? val === v : r.op === 'starts' ? val.startsWith(v) : val.includes(v);
      if (hit) { if (r.categoryId) t.categoryId = r.categoryId; if (r.tags && r.tags.length) t.tags = [...new Set([...(t.tags || []), ...r.tags])]; return r; }
    }
    return null;
  };

  /* ---------- budgets ---------- */
  S.budgetStatus = (ym = S.curYM()) => {
    const m = S.month(ym);
    const elapsed = ym === S.curYM() ? U.d(S.asOf()).getDate() / U.daysInMonth(ym) : 1;
    return S.state.budgets.map((b) => {
      let limit = b.amount;
      if (b.rollover) {
        const prev = S.month(U.ymAdd(ym, -1));
        if (prev.count) limit += Math.max(-b.amount * 0.5, b.amount - (prev.byCat[b.categoryId] || 0));
      }
      const spent = m.byCat[b.categoryId] || 0;
      const projected = elapsed > 0 ? spent / elapsed : spent;
      return { b, cat: S.cat(b.categoryId), limit, spent, left: limit - spent, ratio: limit ? spent / limit : 0, projected, pace: limit ? projected / limit : 0 };
    });
  };
})(window.LL);
