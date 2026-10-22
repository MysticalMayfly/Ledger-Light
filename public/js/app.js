/* Ledgerlight — app shell: tool rail, command bar, router, search, quick add. */
window.LL = window.LL || {};
(function (LL) {
  'use strict';
  const U = LL.U, S = LL.S, I = LL.I;
  LL.V = {};

  const NAV = [
    { label: 'Overview', items: [['dashboard', 'Dashboard', 'grid'], ['networth', 'Net worth', 'layers'], ['cashflow', 'Cash flow', 'flow']] },
    { label: 'Money', items: [['accounts', 'Accounts', 'wallet'], ['transactions', 'Transactions', 'list'], ['budgets', 'Budgets', 'pie'], ['bills', 'Bills & subscriptions', 'receipt'], ['calendar', 'Money calendar', 'calendar']] },
    { label: 'Plan', items: [['goals', 'Goals', 'target'], ['debts', 'Debts & loans', 'debt'], ['investments', 'Investments', 'trend'], ['forecast', 'Forecast & scenarios', 'forecast']] },
    { label: 'Insight', items: [['reports', 'Reports', 'bar'], ['lab', 'Pattern lab', 'lab'], ['health', 'Health score', 'heart'], ['taxes', 'Taxes', 'tax']] },
    { label: 'Tools', items: [['tools', 'Calculators', 'calc'], ['categories', 'Categories & rules', 'tag'], ['data', 'Import & export', 'db'], ['settings', 'Settings', 'gear']] },
  ];
  LL.NAV = NAV;
  const ALL = NAV.flatMap((g) => g.items);

  /* ---------- theme & preferences ---------- */
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : !window.matchMedia('(prefers-color-scheme: light)').matches; };
  LL.toggleTheme = () => { const next = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = next; pref('ll_theme', next); renderTopbar(); LL.rerender(); };
  LL.togglePrivacy = () => { document.body.classList.toggle('hide-amounts'); pref('ll_hide', document.body.classList.contains('hide-amounts') ? '1' : '0'); renderTopbar(); };

  /* ---------- rail ---------- */
  function renderRail() {
    const rail = U.$('#rail');
    const badges = navBadges();
    rail.innerHTML = `
      <a class="brand" href="index.html" title="Back to the home page"><span class="brand-mark">${I('logo', 20)}</span><span class="brand-text"><b>Ledgerlight</b><small>Personal finance</small></span></a>
      <div class="rail-scroll">
        ${NAV.map((g) => `<div class="nav-group"><div class="nav-label">${g.label}</div><nav class="nav">${g.items.map(([id, name, ico]) => `<a href="#${id}" data-route="${id}" title="${name}">${I(ico, 18)}<span>${name}</span>${badges[id] ? `<em class="badge ${badges[id].bad ? 'bad' : ''}">${badges[id].n}</em>` : ''}</a>`).join('')}</nav></div>`).join('')}
      </div>
      <div class="rail-foot">
        <div class="mode-chip ${S.mode}" title="${S.mode === 'server' ? 'Saved to data/finance.db on this computer' : (S.hosted() ? 'Saved in this browser on this device only. Export a .json backup from Import & export to keep a copy.' : 'Saved in this browser only. Start the app with “Start Ledgerlight.command” to use the database file.')}"><span class="dot"></span><span>${S.mode === 'server' ? 'Saving to local database' : 'Browser storage mode'}</span></div>
        <button class="btn ghost sm collapse-btn" id="collapse" title="Collapse panel">${I('menu', 16)}<span class="brand-text">Collapse panel</span></button>
      </div>`;
    U.$$('.nav', rail).forEach((n) => n.prepend(U.h('<span class="nav-pill" style="opacity:0"></span>')));
    U.$('#collapse', rail).onclick = () => { U.$('#shell').classList.toggle('collapsed'); pref('ll_collapsed', U.$('#shell').classList.contains('collapsed') ? '1' : '0'); setTimeout(movePill, 420); setTimeout(LL.rerenderCharts, 450); };
    rail.addEventListener('click', (e) => { if (e.target.closest('a[data-route]')) U.$('#shell').classList.remove('drawer'); });
    movePill();
  }
  function navBadges() {
    const b = {};
    try {
      const up = S.upcoming(7).filter((u) => !S.isBillPaid(u.bill, u.date));
      if (up.length) b.bills = { n: up.length };
      const over = S.budgetStatus().filter((x) => x.ratio > 1).length;
      if (over) b.budgets = { n: over, bad: true };
      const warn = LL.A.all().filter((a) => a.severity === 'warn' || a.severity === 'bad').length;
      if (warn) b.lab = { n: warn };
      const pend = S.state.transactions.filter((t) => t.status === 'pending').length;
      if (pend) b.transactions = { n: pend };
    } catch (e) { console.warn(e); }
    return b;
  }
  function movePill() {
    const route = currentRoute();
    U.$$('.nav').forEach((nav) => {
      const pill = U.$('.nav-pill', nav);
      const a = U.$(`a[data-route="${route}"]`, nav);
      U.$$('a', nav).forEach((x) => x.classList.toggle('active', x === a));
      if (!pill) return;
      if (a) { pill.style.transform = `translateY(${a.offsetTop}px)`; pill.style.opacity = 1; } else pill.style.opacity = 0;
    });
  }

  /* ---------- topbar ---------- */
  function renderTopbar() {
    const v = LL.V[currentRoute()] || {};
    const meta = ALL.find((x) => x[0] === currentRoute());
    const hidden = document.body.classList.contains('hide-amounts');
    U.$('#topbar').innerHTML = `
      <button class="icon-btn menu-btn" id="menu" aria-label="Open tools">${I('menu')}</button>
      <div class="tb-title"><span class="crumb">${U.esc(S.state.meta.householdName || 'Ledgerlight')}${S.state.meta.isSample ? ' · sample data' : ''}</span><h1>${U.esc(v.title || (meta && meta[1]) || 'Ledgerlight')}</h1></div>
      <div class="tb-spacer"></div>
      <div class="search" id="search">${I('search', 16)}<input id="q" type="search" placeholder="Search payees, notes, tags, tools…" autocomplete="off" aria-label="Search"><kbd>/</kbd><div class="search-results" id="sr"></div></div>
      <button class="icon-btn tb-search-sm menu-btn" id="qbtn" aria-label="Search">${I('search')}</button>
      <button class="icon-btn" id="eye" title="${hidden ? 'Show amounts' : 'Hide amounts'}" aria-label="Toggle privacy">${I(hidden ? 'eyeoff' : 'eye')}</button>
      <button class="icon-btn" id="theme" title="Switch theme" aria-label="Switch theme">${I(isDark() ? 'sun' : 'moon')}</button>
      <button class="btn primary tb-hide-sm" id="add">${I('plus', 16)}Add transaction</button>`;
    U.$('#menu').onclick = () => U.$('#shell').classList.toggle('drawer');
    U.$('#theme').onclick = LL.toggleTheme;
    U.$('#eye').onclick = LL.togglePrivacy;
    U.$('#add').onclick = () => LL.txForm();
    U.$('#qbtn').onclick = () => { U.$('#search').classList.toggle('open'); U.$('#q').focus(); };
    wireSearch();
  }

  /* ---------- search ---------- */
  function wireSearch() {
    const q = U.$('#q'), box = U.$('#sr');
    let sel = 0, items = [];
    const run = U.debounce(() => {
      const term = q.value.trim().toLowerCase();
      if (!term) { box.classList.remove('on'); return; }
      const pages = ALL.filter(([, n]) => n.toLowerCase().includes(term)).slice(0, 4).map(([id, n, ico]) => ({ kind: 'Tool', label: n, ico, go: () => (location.hash = id) }));
      const num = parseFloat(term.replace(/[^\d.]/g, ''));
      const tx = S.state.transactions.filter((t) => (t.payee || '').toLowerCase().includes(term) || (t.notes || '').toLowerCase().includes(term) || (t.tags || []).some((g) => g.includes(term.replace('#', ''))) || S.cat(t.categoryId).name.toLowerCase().includes(term) || (num && Math.abs(t.amount - num) < 1)).slice(0, 8)
        .map((t) => ({ kind: 'Transaction', label: t.payee, sub: U.fmtDate(t.date) + ' · ' + U.money(t.amount), ico: 'list', go: () => LL.txForm(t) }));
      const accs = S.state.accounts.filter((a) => a.name.toLowerCase().includes(term)).map((a) => ({ kind: 'Account', label: a.name, sub: U.money(S.accountBalance(a.id)), ico: 'wallet', go: () => (location.hash = 'transactions?account=' + a.id) }));
      const cats = S.state.categories.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 4).map((c) => ({ kind: 'Category', label: c.name, sub: c.group, ico: 'tag', go: () => (location.hash = 'transactions?category=' + c.id) }));
      items = [...pages, ...accs, ...cats, ...tx];
      sel = 0;
      box.innerHTML = items.length ? items.map((it, i) => `<div class="sr-item ${i === 0 ? 'sel' : ''}" data-i="${i}">${I(it.ico, 16)}<span class="sr-t">${U.esc(it.label)}${it.sub ? ` <span class="muted">· ${U.esc(it.sub)}</span>` : ''}</span><span class="eyebrow">${it.kind}</span></div>`).join('') : `<div class="sr-h muted">Nothing matches “${U.esc(q.value)}”.</div>`;
      box.classList.add('on');
    }, 120);
    q.addEventListener('input', run);
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = U.clamp(sel + (e.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1); U.$$('.sr-item', box).forEach((x, i) => x.classList.toggle('sel', i === sel)); }
      if (e.key === 'Enter' && items[sel]) { items[sel].go(); box.classList.remove('on'); q.blur(); }
      if (e.key === 'Escape') { box.classList.remove('on'); q.blur(); }
    });
    box.addEventListener('mousedown', (e) => { const it = e.target.closest('.sr-item'); if (it) { e.preventDefault(); items[+it.dataset.i].go(); box.classList.remove('on'); q.value = ''; } });
    q.addEventListener('blur', () => setTimeout(() => { box.classList.remove('on'); U.$('#search').classList.remove('open'); }, 150));
  }

  /* ---------- router ---------- */
  function currentRoute() { return (location.hash.slice(1).split('?')[0] || 'dashboard'); }
  function params() { const q = location.hash.split('?')[1] || ''; const o = {}; q.split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); o[decodeURIComponent(k)] = decodeURIComponent(v || ''); }); return o; }
  LL.params = params;
  let rendering = false;
  function route(animate = true) {
    const r = currentRoute();
    const v = LL.V[r] || LL.V.dashboard;
    const root = U.$('#view');
    LL.C.reset(); LL.C.untip();
    const draw = () => {
      root.innerHTML = '';
      root.classList.remove('page-leave');
      if (animate) { root.classList.remove('page-enter'); void root.offsetWidth; root.classList.add('page-enter'); }
      try { v.render(root, params()); } catch (e) { console.error(e); root.innerHTML = `<div class="empty"><div class="em-ico">${I('alert', 28)}</div><h3>This page hit an error</h3><p>${U.esc(e.message)}</p></div>`; }
      U.stagger(root); U.countUp(root); U.tilt(root); ripple(root);
      rendering = false;
    };
    renderTopbar(); movePill();
    if (animate && !U.reduced && root.children.length) { rendering = true; root.classList.add('page-leave'); setTimeout(draw, 160); } else draw();
    if (animate) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }
  LL.rerender = () => { if (!rendering) route(false); };
  LL.rerenderCharts = () => LL.C.redrawers.forEach((f) => f());
  function ripple(root) {
    U.$$('.btn', root).forEach((b) => b.addEventListener('pointerdown', (e) => { const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height); const s = document.createElement('span'); s.className = 'ripple'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`; b.appendChild(s); setTimeout(() => s.remove(), 600); }));
  }

  /* ---------- shared view helpers ---------- */
  LL.card = (o) => `<section class="card ${o.cls || ''} rise ${o.tilt ? 'tilt' : ''}" ${o.id ? `id="${o.id}"` : ''}>
      ${o.title ? `<header class="card-h">${o.icon ? `<span class="ico-wrap">${I(o.icon, 16)}</span>` : ''}<div><h3>${U.esc(o.title)}</h3>${o.sub ? `<div class="sub">${o.sub}</div>` : ''}</div>${o.right ? `<div class="right">${o.right}</div>` : ''}</header>` : ''}
      ${o.body || ''}</section>`;
  LL.kpi = (o) => `<section class="card kpi rise tilt ${o.cls || ''}">
      <div class="k-l">${I(o.icon || 'coin', 15)}${U.esc(o.label)}</div>
      <div class="k-v" data-count="${o.value}" data-kind="${o.kind || 'money'}">${o.kind === 'pct' ? U.pct(o.value, 1) : o.kind === 'num' ? U.num(o.value) : U.money(o.value)}</div>
      <div class="k-d">${o.delta || ''}</div>${o.spark || ''}</section>`;
  LL.delta = (now, prev, goodUp = true, fmt) => {
    if (!prev) return '';
    const d = (now - prev) / Math.abs(prev);
    const good = goodUp ? d >= 0 : d <= 0;
    return `<span class="delta ${good ? 'up' : 'down'}">${I(d >= 0 ? 'up' : 'down', 13)}${U.pct(Math.abs(d))}</span><span>${fmt || 'vs last month'}</span>`;
  };
  LL.seg = (id, opts, cur) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  LL.wireSeg = (root, id, fn) => { const el = U.$('#' + id, root); if (!el) return; el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; U.$$('button', el).forEach((x) => x.classList.toggle('on', x === b)); fn(b.dataset.v); }); };
  LL.emptyState = (icon, title, text, actions = '') => `<div class="empty rise"><div class="em-ico">${I(icon, 28)}</div><h3>${title}</h3><p>${text}</p><div class="toolbar" style="justify-content:center">${actions}</div></div>`;
  LL.catOptions = (type) => S.state.categories.filter((c) => !type || c.type === type).map((c) => ({ value: c.id, label: c.group + ' · ' + c.name }));
  LL.accOptions = (filter) => S.state.accounts.filter((a) => !a.archived && (!filter || filter(a))).map((a) => ({ value: a.id, label: a.name }));
  LL.ACC_ICON = { bank: 'bank', savings: 'coin', cash: 'cash', credit: 'card', investment: 'trend', retirement: 'shield', property: 'house', vehicle: 'car', wallet: 'wallet', asset: 'layers' };
  LL.ACC_TYPES = [['bank', 'Bank account'], ['savings', 'Savings'], ['cash', 'Cash'], ['wallet', 'Digital wallet'], ['credit', 'Credit card'], ['investment', 'Investments'], ['retirement', 'Retirement'], ['property', 'Property'], ['vehicle', 'Vehicle'], ['asset', 'Other asset']];
  LL.sampleBanner = () => S.state.meta.isSample ? `<div class="banner rise">${I('sparkle', 20)}<div class="b-t"><b>You are looking at sample data.</b> Everything here is a fictional household so you can explore every tool. Remove it to start fresh, or bring in your own bank statements.</div><a class="btn sm" href="#data">Import my data</a><button class="btn sm danger" data-act="clear-sample">Remove sample data</button></div>` : '';
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act="clear-sample"]');
    if (!b) return;
    if (await U.confirm('Remove all sample data?', 'This clears every sample account, transaction, budget, bill, goal, loan and holding. Default categories stay so you can start adding your own. A backup copy of the database is made first.', 'Remove sample data')) {
      await S.clearAll(); U.toast('Sample data removed. You are starting fresh.'); renderRail(); route();
    }
  });

  /* ---------- quick add / edit transaction ---------- */
  LL.txForm = (tx) => {
    const isNew = !tx || !tx.id;
    const t = tx ? { ...tx } : { type: 'expense', date: U.today(), time: new Date().toTimeString().slice(0, 5), accountId: (S.state.accounts.find((a) => a.type === 'bank') || S.state.accounts[0] || {}).id, categoryId: 'cat_groceries', tags: [], status: 'cleared' };
    let type = t.type;
    const body = U.h(`<div>
      <div class="type-tabs">${['expense', 'income', 'transfer'].map((k) => `<button type="button" data-t="${k}" class="${k === type ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
      <div class="field" style="margin-bottom:12px"><input id="tx_amount" class="amount-in" type="number" step="0.01" min="0" placeholder="0" value="${t.amount || ''}" aria-label="Amount"></div>
      <div id="tx_fields"></div>
      <datalist id="payees">${S.payees().slice(0, 400).map((p) => `<option value="${U.esc(p)}">`).join('')}</datalist>
    </div>`);
    const fieldsFor = (k) => [
      { key: 'payee', label: k === 'transfer' ? 'Description' : k === 'income' ? 'Source' : 'Payee', list: 'payees', required: true, placeholder: k === 'income' ? 'Employer, client…' : 'Where did it go?' },
      { key: 'accountId', label: k === 'transfer' ? 'From account' : 'Account', type: 'select', options: LL.accOptions(), half: true },
      k === 'transfer' ? { key: 'toAccountId', label: 'To account', type: 'select', options: LL.accOptions(), half: true } : { key: 'categoryId', label: 'Category', type: 'select', options: LL.catOptions(k), half: true },
      { key: 'date', label: 'Date', type: 'date', half: true },
      { key: 'time', label: 'Time', type: 'text', half: true, placeholder: 'HH:MM' },
      { key: 'tags', label: 'Tags (comma separated)', type: 'tags', placeholder: 'vacation, reimbursable' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'pending', label: 'Status', type: 'checkbox', hint: 'Still pending' },
    ];
    let form;
    const mount = () => {
      const vals = form ? form.read() : { ...t, pending: t.status === 'pending' };
      if (type === 'transfer' && !vals.toAccountId) vals.toAccountId = (S.state.accounts.find((a) => a.id !== vals.accountId) || {}).id;
      if (type !== 'transfer' && S.cat(vals.categoryId).type !== type) vals.categoryId = (S.state.categories.find((c) => c.type === type) || {}).id;
      form = U.form(fieldsFor(type), vals);
      const box = U.$('#tx_fields', body); box.innerHTML = ''; box.appendChild(form);
      const payee = form.elements.payee;
      payee.addEventListener('change', () => {
        const probe = { payee: payee.value, categoryId: form.elements.categoryId && form.elements.categoryId.value };
        const rule = S.applyRules(probe);
        const last = S.state.transactions.find((x) => x.payee === payee.value && x.type === type);
        const cat = rule ? probe.categoryId : last && last.categoryId;
        if (cat && form.elements.categoryId) { form.elements.categoryId.value = cat; form.elements.categoryId.classList.add('flash'); }
        if (last && !U.$('#tx_amount', body).value) U.$('#tx_amount', body).value = last.amount;
      });
    };
    body.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; type = b.dataset.t; U.$$('[data-t]', body).forEach((x) => x.classList.toggle('on', x === b)); mount(); });
    mount();
    const actions = [];
    if (!isNew) actions.push({ label: 'Delete', kind: 'ghost', onClick: async () => { S.remove('transactions', t.id); U.toast('Transaction deleted'); } });
    actions.push({ label: 'Cancel', kind: 'ghost' });
    actions.push({
      label: isNew ? 'Add transaction' : 'Save changes', kind: 'primary', onClick: () => {
        const amount = +U.$('#tx_amount', body).value;
        if (!amount || amount <= 0) { U.$('#tx_amount', body).classList.add('bad'); U.toast('Enter an amount above zero', 'warn'); return false; }
        if (!form.check()) return false;
        const v = form.read();
        const rec = { ...t, ...v, amount: U.round(amount), type, status: v.pending ? 'pending' : 'cleared' };
        delete rec.pending;
        if (type !== 'transfer') delete rec.toAccountId; else rec.categoryId = 'cat_transfer';
        if (rec.accountId === rec.toAccountId) { U.toast('Pick two different accounts for a transfer', 'warn'); return false; }
        if (isNew) { const r = S.applyRules({ ...rec, categoryId: rec.categoryId }); void r; }
        S.upsert('transactions', rec);
        U.toast(isNew ? 'Added ' + U.money(rec.amount) + ' · ' + rec.payee : 'Saved');
      },
    });
    U.modal({ title: isNew ? 'New transaction' : 'Edit transaction', body, actions, onOpen: (m) => setTimeout(() => U.$('#tx_amount', m).focus(), 80) });
  };

  /* generic record editor used by many views */
  LL.editRecord = ({ col, title, fields, rec, onSave, onDelete }) => {
    const isNew = !rec || !rec.id;
    const f = U.form(fields, rec || {});
    const actions = [];
    if (!isNew) actions.push({ label: 'Delete', kind: 'ghost', onClick: async () => { if (await U.confirm('Delete this?', 'This cannot be undone.', 'Delete')) { S.remove(col, rec.id); onDelete && onDelete(); U.toast('Deleted'); } } });
    actions.push({ label: 'Cancel', kind: 'ghost' });
    actions.push({ label: isNew ? 'Create' : 'Save', kind: 'primary', onClick: () => { if (!f.check()) return false; let v = { ...(rec || {}), ...f.read() }; if (onSave) v = onSave(v) || v; if (v === false) return false; S.upsert(col, v); U.toast(isNew ? 'Created' : 'Saved'); } });
    U.modal({ title, body: f, actions });
  };

  /* ---------- boot ---------- */
  LL.boot = async () => {
    U.$('#fab').innerHTML = I('plus', 26);
    U.$('#fab').onclick = () => LL.txForm();
    if (pref('ll_hide') === '1') document.body.classList.add('hide-amounts');
    if (pref('ll_collapsed') === '1' && window.innerWidth > 860) U.$('#shell').classList.add('collapsed');
    U.$('#scrim').onclick = () => U.$('#shell').classList.remove('drawer');
    await S.init();
    renderRail();
    route(false);
    window.addEventListener('hashchange', () => route(true));
    S.on(U.debounce((ev) => { if (ev === 'change') { renderRail(); LL.rerender(); } }, 120));
    document.addEventListener('keydown', (e) => {
      const typing = /input|textarea|select/i.test((e.target.tagName || '')) || e.target.isContentEditable;
      if (typing || document.querySelector('.modal-wrap')) return;
      if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); const q = U.$('#q'); U.$('#search').classList.add('open'); q && q.focus(); }
      else if (e.key.toLowerCase() === 'n') { e.preventDefault(); LL.txForm(); }
      else if (e.key.toLowerCase() === 'h' && e.shiftKey) LL.togglePrivacy();
    });
    window.addEventListener('resize', U.debounce(movePill, 200));
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { renderTopbar(); LL.rerender(); });
  };
})(window.LL);
