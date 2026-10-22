/* Ledgerlight — tools: calculators, categories & rules, import & export, settings */
(function (LL) {
  'use strict';
  const U = LL.U, S = LL.S, C = LL.C, I = LL.I;

  /* ===================== CALCULATORS ===================== */
  const CALCS = [
    { id: 'emi', title: 'Loan EMI', icon: 'debt', inputs: [['p', 'Loan amount', 100000, 20000000, 5000000, 50000, 'money'], ['r', 'Interest rate', 4, 20, 8.5, 0.05, '%'], ['n', 'Tenure', 1, 30, 20, 1, ' years']],
      run(v, out, chart) { const r = v.r / 1200, n = v.n * 12, emi = (v.p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1), tot = emi * n;
        out(`<div class="kbd-hint">Monthly EMI</div><div class="big">${U.money(emi)}</div><div class="muted-p">Total interest <b>${U.money(tot - v.p)}</b> · you repay ${U.money(tot)}, ${(tot / v.p).toFixed(2)}× the loan.</div>`);
        let b = v.p; const ys = []; for (let y = 1; y <= v.n; y++) { for (let k = 0; k < 12; k++) b -= emi - b * r; ys.push(Math.max(0, b)); }
        chart((el) => C.line(el, { labels: ys.map((_, i) => 'Y' + (i + 1)), series: [{ name: 'Balance left', values: ys, color: 's8', area: true }], h: 170 })); } },
    { id: 'sip', title: 'SIP growth', icon: 'trend', inputs: [['m', 'Monthly investment', 1000, 200000, 20000, 1000, 'money'], ['r', 'Expected return', 1, 20, 12, 0.5, '%'], ['n', 'Years', 1, 40, 15, 1, ' years'], ['s', 'Yearly step-up', 0, 20, 5, 1, '%']],
      run(v, out, chart) { let val = 0, inv = 0, m = v.m; const vs = [], is = []; for (let y = 1; y <= v.n; y++) { for (let k = 0; k < 12; k++) { val = (val + m) * (1 + v.r / 1200); inv += m; } vs.push(val); is.push(inv); m *= 1 + v.s / 100; }
        out(`<div class="kbd-hint">Value after ${v.n} years</div><div class="big">${U.short(val)}</div><div class="muted-p">You invest ${U.short(inv)}; growth adds <b class="up">${U.short(val - inv)}</b> (${(val / inv).toFixed(1)}×).</div>`);
        chart((el) => C.line(el, { labels: vs.map((_, i) => 'Y' + (i + 1)), series: [{ name: 'Value', values: vs, color: 's3', area: true }, { name: 'Invested', values: is, color: 's7', dash: true }], h: 170, legend: false })); } },
    { id: 'lump', title: 'Compound interest', icon: 'coin', inputs: [['p', 'Amount today', 10000, 10000000, 500000, 10000, 'money'], ['r', 'Rate per year', 1, 20, 9, 0.25, '%'], ['n', 'Years', 1, 40, 10, 1, ' years'], ['c', 'Compounding per year', 1, 12, 4, 1, '×']],
      run(v, out, chart) { const f = (y) => v.p * Math.pow(1 + v.r / 100 / v.c, v.c * y); const ys = [...Array(v.n).keys()].map((y) => f(y + 1));
        out(`<div class="kbd-hint">Grows to</div><div class="big">${U.short(f(v.n))}</div><div class="muted-p">Doubles roughly every <b>${(72 / v.r).toFixed(1)} years</b> (rule of 72).</div>`);
        chart((el) => C.bars(el, { labels: ys.map((_, i) => String(i + 1)), series: [{ name: 'Value', values: ys, color: 's1' }], h: 170 })); } },
    { id: 'fire', title: 'Financial independence', icon: 'target', inputs: [['e', 'Yearly expenses today', 200000, 10000000, 1500000, 50000, 'money'], ['c', 'Current investments', 0, 50000000, 4000000, 100000, 'money'], ['s', 'Saving per month', 0, 500000, 60000, 5000, 'money'], ['r', 'Return', 4, 15, 10, 0.5, '%'], ['i', 'Inflation', 2, 10, 6, 0.5, '%'], ['w', 'Safe withdrawal rate', 2.5, 5, 3.5, 0.1, '%']],
      run(v, out, chart) { let corpus = v.c, yrs = 0; const cs = [], ts = []; let need = v.e / (v.w / 100);
        while (yrs < 50) { yrs++; corpus = corpus * (1 + v.r / 100) + v.s * 12; need *= 1 + v.i / 100; cs.push(corpus); ts.push(need); if (corpus >= need) break; }
        const ok = corpus >= need;
        out(`<div class="kbd-hint">Your FI number today</div><div class="big">${U.short(v.e / (v.w / 100))}</div><div class="muted-p">${ok ? `At this pace you reach financial independence in <b class="up">${yrs} years</b>, with ${U.short(corpus)} invested.` : 'Not reached within 50 years at this pace. Try saving more or spending less.'}</div>`);
        chart((el) => C.line(el, { labels: cs.map((_, i) => 'Y' + (i + 1)), series: [{ name: 'Your corpus', values: cs, color: 's3', area: true }, { name: 'Needed (inflation-adjusted)', values: ts, color: 's2', dash: true }], h: 170, legend: false })); } },
    { id: 'infl', title: 'Inflation', icon: 'up', inputs: [['p', 'Cost today', 1000, 10000000, 100000, 1000, 'money'], ['i', 'Inflation', 1, 15, 6, 0.5, '%'], ['n', 'Years', 1, 40, 15, 1, ' years']],
      run(v, out, chart) { const f = v.p * Math.pow(1 + v.i / 100, v.n); const ys = [...Array(v.n).keys()].map((y) => v.p * Math.pow(1 + v.i / 100, y + 1));
        out(`<div class="kbd-hint">Will cost</div><div class="big">${U.short(f)}</div><div class="muted-p">Today's ${U.short(v.p)} will buy only <b>${U.short(v.p / Math.pow(1 + v.i / 100, v.n))}</b> worth of goods in ${v.n} years.</div>`);
        chart((el) => C.line(el, { labels: ys.map((_, i) => 'Y' + (i + 1)), series: [{ name: 'Future cost', values: ys, color: 's2', area: true }], h: 170 })); } },
    { id: 'goal', title: 'Goal planner', icon: 'target', inputs: [['t', 'Target amount', 50000, 50000000, 2000000, 50000, 'money'], ['n', 'Years to goal', 1, 30, 8, 1, ' years'], ['r', 'Expected return', 0, 15, 10, 0.5, '%'], ['h', 'Already saved', 0, 20000000, 200000, 10000, 'money']],
      run(v, out, chart) { const r = v.r / 1200, n = v.n * 12, fvH = v.h * Math.pow(1 + r, n), need = Math.max(0, v.t - fvH); const pmt = r ? (need * r) / ((Math.pow(1 + r, n) - 1) * (1 + r)) : need / n;
        out(`<div class="kbd-hint">Invest each month</div><div class="big">${U.money(pmt)}</div><div class="muted-p">Your existing ${U.short(v.h)} grows to ${U.short(fvH)}; the monthly amount covers the remaining ${U.short(need)}.</div>`);
        chart((el) => C.donut(el, [{ label: 'From savings', value: fvH, color: 's3' }, { label: 'Contributions', value: pmt * n, color: 's1' }, { label: 'Growth on contributions', value: Math.max(0, need - pmt * n), color: 's4' }], { size: 160, centerLabel: 'Target' })); } },
    { id: 'rvb', title: 'Rent vs buy', icon: 'house', inputs: [['price', 'Home price', 1000000, 50000000, 9000000, 100000, 'money'], ['dp', 'Down payment', 5, 60, 20, 1, '%'], ['rate', 'Loan rate', 5, 14, 8.5, 0.1, '%'], ['rent', 'Monthly rent instead', 5000, 300000, 30000, 1000, 'money'], ['app', 'Home price growth', 0, 12, 5, 0.5, '%'], ['ret', 'Investment return', 4, 15, 11, 0.5, '%'], ['n', 'Years', 3, 30, 15, 1, ' years']],
      run(v, out, chart) {
        const loan = v.price * (1 - v.dp / 100), r = v.rate / 1200, N = 240, emi = (loan * r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1);
        let bal = loan, rent = v.rent, port = v.price * (v.dp / 100) + v.price * 0.07; const buy = [], rentS = [];
        for (let y = 1; y <= v.n; y++) { for (let k = 0; k < 12; k++) { bal -= emi - bal * r; const diff = emi + v.price * 0.001 - rent; port = port * (1 + v.ret / 1200) + diff; } rent *= 1.06; buy.push(v.price * Math.pow(1 + v.app / 100, y) - Math.max(0, bal)); rentS.push(port); }
        const b = buy[buy.length - 1], rs = rentS[rentS.length - 1];
        out(`<div class="kbd-hint">After ${v.n} years</div><div class="big">${b > rs ? 'Buying' : 'Renting'} wins by ${U.short(Math.abs(b - rs))}</div><div class="muted-p">Buy: home equity ${U.short(b)}. Rent: investing the down payment, stamp duty and the monthly difference grows to ${U.short(rs)}. Rent rises 6% a year; EMI ${U.money(emi)}.</div>`);
        chart((el) => C.line(el, { labels: buy.map((_, i) => 'Y' + (i + 1)), series: [{ name: 'Buy · equity', values: buy, color: 's1' }, { name: 'Rent · portfolio', values: rentS, color: 's3' }], h: 170, legend: false })); } },
    { id: 'fd', title: 'Fixed deposit', icon: 'bank', inputs: [['p', 'Deposit', 10000, 10000000, 200000, 5000, 'money'], ['r', 'Rate', 3, 10, 7.1, 0.05, '%'], ['m', 'Months', 3, 120, 36, 1, ' months'], ['t', 'Tax slab', 0, 30, 30, 5, '%']],
      run(v, out, chart) { const mat = v.p * Math.pow(1 + v.r / 400, (v.m / 12) * 4), int = mat - v.p, post = int * (1 - v.t / 100);
        out(`<div class="kbd-hint">Maturity value</div><div class="big">${U.money(mat)}</div><div class="muted-p">Interest ${U.money(int)}; after ${v.t}% tax you keep ${U.money(post)}, an effective ${((Math.pow((v.p + post) / v.p, 12 / v.m) - 1) * 100).toFixed(2)}% a year.</div>`);
        chart((el) => C.donut(el, [{ label: 'Deposit', value: v.p, color: 's1' }, { label: 'Interest after tax', value: post, color: 's3' }, { label: 'Tax', value: int - post, color: 's8' }], { size: 160, centerLabel: 'Maturity' })); } },
  ];
  LL.V.tools = {
    title: 'Calculators',
    render(root) {
      root.innerHTML = `<div class="page-intro"><div><h2>Money calculators</h2><p>Drag any slider; results and charts update instantly. These work on their own and do not change your data.</p></div></div>
        <div class="lab-grid">${CALCS.map((c) => `<section class="card rise" id="calc-${c.id}"><div class="card-h"><span class="ico-wrap">${I(c.icon, 16)}</span><h3>${c.title}</h3></div><div class="grid" style="gap:14px"><div class="c6" style="display:grid;gap:12px">${c.inputs.map(([k, l, mn, mx, v, st, suf]) => `<div class="slider-row"><div class="sl-h"><span>${l}</span><b data-out="${k}"></b></div><input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${st}" value="${v}" data-suf="${suf}" aria-label="${l}"></div>`).join('')}</div><div class="c6"><div class="calc-out" data-o></div><div data-chart style="margin-top:10px"></div></div></div></section>`).join('')}</div>`;
      CALCS.forEach((c) => {
        const card = U.$('#calc-' + c.id, root);
        const go = () => {
          const v = {};
          U.$$('input[data-k]', card).forEach((el) => { v[el.dataset.k] = +el.value; U.$(`[data-out="${el.dataset.k}"]`, card).textContent = el.dataset.suf === 'money' ? U.money(+el.value) : el.value + el.dataset.suf; });
          c.run(v, (html) => (U.$('[data-o]', card).innerHTML = html), (fn) => fn(U.$('[data-chart]', card)));
        };
        U.$$('input', card).forEach((el) => el.addEventListener('input', go));
        C.track(go);
      });
    },
  };

  /* ===================== CATEGORIES & RULES ===================== */
  LL.V.categories = {
    title: 'Categories & rules',
    render(root) {
      const counts = new Map(); const spend12 = new Map(); const [f12] = S.rangeFor('12m');
      S.state.transactions.forEach((t) => { counts.set(t.categoryId, (counts.get(t.categoryId) || 0) + 1); if (t.date >= f12 && t.type !== 'transfer') spend12.set(t.categoryId, (spend12.get(t.categoryId) || 0) + t.amount); });
      const groups = [...new Set(S.state.categories.map((c) => c.group))];
      root.innerHTML = `
        <div class="page-intro"><div><h2>How money gets sorted</h2><p>Categories group your spending; rules sort new and imported transactions automatically by matching the payee.</p></div><div class="toolbar"><button class="btn" id="cr-run">${I('bolt', 16)}Run rules on all transactions</button><button class="btn" id="cr-rule">${I('plus', 16)}New rule</button><button class="btn primary" id="cr-cat">${I('plus', 16)}New category</button></div></div>
        <div class="grid">
          ${LL.card({ cls: 'c7', title: 'Categories', icon: 'tag', sub: S.state.categories.length + ' categories in ' + groups.length + ' groups', body: `<div class="table-wrap" style="max-height:620px;overflow:auto"><table class="tbl"><thead><tr><th>Category</th><th>Group</th><th>Type</th><th class="r">Transactions</th><th class="r">Last 12 months</th></tr></thead><tbody>${groups.map((g) => S.state.categories.filter((c) => c.group === g).map((c) => `<tr class="clickable" data-cat="${c.id}"><td><b>${U.esc(c.name)}</b></td><td>${U.esc(c.group)}</td><td><span class="pill ${c.type === 'income' ? 'good' : c.type === 'transfer' ? 'info' : 'warn'}">${c.type}</span></td><td class="r">${counts.get(c.id) || 0}</td><td class="r">${U.money(spend12.get(c.id) || 0)}</td></tr>`).join('')).join('')}</tbody></table></div>` })}
          ${LL.card({ cls: 'c5', title: 'Auto-categorisation rules', icon: 'bolt', sub: 'Checked top to bottom; first match wins', body: `<div class="list">${S.state.rules.map((r) => `<div class="row clickable" data-rule="${r.id}"><div class="av">${I(r.active ? 'bolt' : 'x', 16)}</div><div style="min-width:0"><div class="t1">Payee ${r.op === 'equals' ? 'is' : r.op === 'starts' ? 'starts with' : 'contains'} “${U.esc(r.value)}”</div><div class="t2">→ ${U.esc(S.cat(r.categoryId).name)}${(r.tags || []).length ? ' · ' + r.tags.map((g) => '#' + g).join(' ') : ''}${r.active ? '' : ' · paused'}</div></div><div class="amt"></div></div>`).join('') || '<p class="muted">No rules yet. Add one so imports sort themselves.</p>'}</div>` })}
          ${LL.card({ cls: 'c12', title: 'Payees', icon: 'list', sub: 'Rename or merge payees across all transactions', body: '<div id="cr-payees"></div>' })}
        </div>`;
      const editCat = (c) => LL.editRecord({ col: 'categories', title: c ? 'Edit category' : 'New category', rec: c || { type: 'expense', group: 'Personal', icon: 'tag' }, fields: [{ key: 'name', label: 'Name', required: true }, { key: 'group', label: 'Group', half: true, list: 'grp' }, { key: 'type', label: 'Type', type: 'select', options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfer' }], half: true }, { key: 'icon', label: 'Icon', type: 'select', options: LL.ICONS.map((i) => ({ value: i, label: i })), half: true }], onDelete: () => { S.state.transactions.forEach((t) => { if (t.categoryId === c.id) t.categoryId = t.type === 'income' ? 'cat_other_in' : 'cat_uncat'; }); S.state.budgets = S.state.budgets.filter((b) => b.categoryId !== c.id); S.touch('transactions'); S.touch('budgets'); } });
      U.$('#cr-cat', root).onclick = () => editCat();
      U.on(root, 'click', '[data-cat]', (e, tr) => editCat(S.get('categories', tr.dataset.cat)));
      const editRule = (r) => LL.editRecord({ col: 'rules', title: r ? 'Edit rule' : 'New rule', rec: r || { field: 'payee', op: 'contains', active: true, tags: [] }, fields: [{ key: 'op', label: 'When the payee', type: 'select', options: [{ value: 'contains', label: 'contains' }, { value: 'starts', label: 'starts with' }, { value: 'equals', label: 'is exactly' }], half: true }, { key: 'value', label: 'Text', required: true, half: true, list: 'payees-dl' }, { key: 'categoryId', label: 'Set category to', type: 'select', options: LL.catOptions() }, { key: 'tags', label: 'Add tags', type: 'tags' }, { key: 'active', label: 'Active', type: 'checkbox', hint: 'Rule is on' }], onSave: (v) => { v.field = 'payee'; return v; } });
      U.$('#cr-rule', root).onclick = () => editRule();
      U.on(root, 'click', '[data-rule]', (e, el) => editRule(S.get('rules', el.dataset.rule)));
      U.$('#cr-run', root).onclick = () => { let n = 0; S.state.transactions.forEach((t) => { if (t.type === 'transfer') return; const before = t.categoryId + (t.tags || []).join(); S.applyRules(t); if (before !== t.categoryId + (t.tags || []).join()) n++; }); S.touch('transactions'); U.toast(n ? 'Rules updated ' + n + ' transactions' : 'Everything already matches your rules'); };
      const pay = [...U.groupBy(S.state.transactions, (t) => t.payee).entries()].map(([p, a]) => ({ p, n: a.length, v: U.sum(a, (t) => t.amount) })).sort((a, b) => b.n - a.n);
      U.$('#cr-payees', root).innerHTML = `<div class="table-wrap" style="max-height:420px;overflow:auto"><table class="tbl"><thead><tr><th>Payee</th><th class="r">Transactions</th><th class="r">Total</th><th></th></tr></thead><tbody>${pay.slice(0, 200).map((x) => `<tr><td>${U.esc(x.p)}</td><td class="r">${x.n}</td><td class="r">${U.money(x.v)}</td><td><button class="btn sm ghost" data-payee="${U.esc(x.p)}">${I('edit', 14)}Rename / merge</button></td></tr>`).join('')}</tbody></table></div><datalist id="payees-dl">${pay.slice(0, 300).map((x) => `<option value="${U.esc(x.p)}">`).join('')}</datalist><datalist id="grp">${groups.map((g) => `<option value="${U.esc(g)}">`).join('')}</datalist>`;
      U.on(root, 'click', '[data-payee]', (e, b) => {
        const old = b.dataset.payee;
        const f = U.form([{ key: 'name', label: 'New name (pick an existing payee to merge)', required: true, list: 'payees-dl', default: old }]);
        U.modal({ title: 'Rename “' + old + '”', body: f, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Apply', kind: 'primary', onClick: () => { if (!f.check()) return false; const nn = f.read().name; let n = 0; S.state.transactions.forEach((t) => { if (t.payee === old) { t.payee = nn; n++; } }); S.touch('transactions'); U.toast('Updated ' + n + ' transactions'); } }] });
      });
    },
  };

  /* ===================== IMPORT & EXPORT ===================== */
  const parseAmount = (s) => {
    if (s == null) return NaN;
    let str = String(s).trim(); if (!str) return NaN;
    let neg = /^\(.*\)$/.test(str) || /^-/.test(str) || /\bdr\.?$/i.test(str);
    if (/\bcr\.?$/i.test(str)) neg = false;
    str = str.replace(/[^\d.,-]/g, '');
    if (/,\d{2}$/.test(str) && !/\.\d/.test(str)) str = str.replace(/\./g, '').replace(',', '.'); else str = str.replace(/,/g, '');
    const n = Math.abs(parseFloat(str));
    return neg ? -n : n;
  };
  const MONS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const parseDate = (s, fmt) => {
    s = String(s || '').trim(); if (!s) return null;
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return iso(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[\s-/.]([A-Za-z]{3,9})[\s-/.,]*(\d{2,4})/);
    if (m && MONS[m[2].toLowerCase().slice(0, 4)] || (m && MONS[m[2].toLowerCase().slice(0, 3)])) return iso(yr(m[3]), MONS[m[2].toLowerCase().slice(0, 4)] || MONS[m[2].toLowerCase().slice(0, 3)], +m[1]);
    m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
    if (m && MONS[m[1].toLowerCase().slice(0, 3)]) return iso(+m[3], MONS[m[1].toLowerCase().slice(0, 3)], +m[2]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) return fmt === 'mdy' ? iso(yr(m[3]), +m[1], +m[2]) : iso(yr(m[3]), +m[2], +m[1]);
    return null;
  };
  const yr = (y) => (String(y).length === 2 ? 2000 + +y : +y);
  const iso = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);
  const guess = (headers, words) => headers.findIndex((h) => words.some((w) => h.toLowerCase().includes(w)));

  LL.V.data = {
    title: 'Import & export',
    render(root) {
      const counts = S.COLS.filter((c) => c !== 'meta').map((c) => [c, S.state[c].length]);
      root.innerHTML = `
        <div class="page-intro"><div><h2>Your data, your files</h2><p>${S.mode === 'server' ? 'Everything is saved in <b class="mono">data/finance.db</b> inside the app folder. Backups go to <b class="mono">data/backups</b>.' : (S.hosted() ? 'Your data is kept in this browser on this device only. It is not uploaded to the website, and it does not sync to other devices. Download a .json backup regularly to keep a copy.' : 'The local server is not running, so data is kept in this browser. Start the app with <b>Start Ledgerlight.command</b> to save into the database file.')}</p></div></div>
        <div class="grid">
          ${LL.card({ cls: 'c12', title: 'Import a bank or card statement (CSV)', icon: 'upload', sub: 'Works with most bank exports: one row per transaction with a date, description and amount', body: `<label class="drop" id="im-drop" for="im-file">${I('upload', 30)}<b>Drop a CSV here or click to choose</b><span class="muted">Comma or semicolon separated · Debit/Credit columns or a single signed amount</span></label><input type="file" id="im-file" accept=".csv,text/csv" hidden><div id="im-map" style="margin-top:16px"></div>` })}
          ${LL.card({ cls: 'c4', title: 'Sample data', icon: 'sparkle', sub: S.state.meta.isSample ? 'Sample household is loaded' : 'Using your own data', body: `<p class="muted-p">The sample is a fictional household with 24 months of history. Load it to explore, or remove everything and start clean. A database backup is taken before either.</p><div class="toolbar" style="margin-top:14px"><button class="btn" id="dt-sample">${I('sparkle', 16)}Load sample data</button><button class="btn danger" id="dt-clear">${I('trash', 16)}Remove all data</button></div>` })}
          ${LL.card({ cls: 'c4', title: 'Export', icon: 'download', body: `<div class="list" style="gap:8px"><button class="btn" id="ex-json">${I('db', 16)}Full backup (.json)</button><button class="btn" id="ex-csv">${I('list', 16)}Transactions (.csv)</button><button class="btn" id="ex-acc">${I('wallet', 16)}Accounts & balances (.csv)</button><button class="btn" id="ex-tpl">${I('file', 16)}Blank import template (.csv)</button></div>` })}
          ${LL.card({ cls: 'c4', title: 'Restore & backups', icon: 'shield', body: `<p class="muted-p">Restore a full .json backup from Ledgerlight. This replaces all current data.</p><div class="toolbar" style="margin-top:12px"><label class="btn" for="im-json">${I('upload', 16)}Restore from .json</label><input type="file" id="im-json" accept=".json,application/json" hidden>${S.mode === 'server' ? `<button class="btn" id="dt-backup">${I('shield', 16)}Back up database now</button>` : ''}</div><div id="dt-backups" class="mini-list" style="margin-top:12px"></div>` })}
          ${LL.card({ cls: 'c12', title: "What's stored", icon: 'db', body: `<div class="stats">${counts.map(([c, n]) => `<div class="stat"><div class="s-l">${c}</div><div class="s-v" data-count="${n}" data-kind="num">${n}</div></div>`).join('')}</div>` })}
        </div>`;
      const bk = async () => { if (S.mode !== 'server') return; try { const r = await (await fetch('/api/backups')).json(); U.$('#dt-backups', root).innerHTML = r.backups.slice(0, 5).map((f) => `<div class="ml-row"><span class="mono">${U.esc(f)}</span><span></span><span></span></div>`).join('') || '<span class="muted">No backups yet.</span>'; } catch (e) {} };
      bk();
      U.$('#dt-sample', root).onclick = async () => { if (await U.confirm('Replace everything with the sample household?', 'Your current data will be replaced. ' + (S.mode === 'server' ? 'A copy of the database is saved to data/backups first.' : 'Export a backup first if you want to keep it.'), 'Load sample', false)) { await S.loadSample(); U.toast('Sample household loaded'); location.hash = 'dashboard'; } };
      U.$('#dt-clear', root).onclick = async () => { if (await U.confirm('Remove all data?', 'This deletes every account, transaction, budget, bill, goal, loan and holding. Default categories are kept. ' + (S.mode === 'server' ? 'A backup is saved to data/backups first.' : ''), 'Remove all data')) { await S.clearAll(); U.toast('All data removed. Starting fresh.'); location.hash = 'dashboard'; } };
      const b = U.$('#dt-backup', root); if (b) b.onclick = async () => { const r = await (await fetch('/api/backup', { method: 'POST' })).json(); U.toast('Backup saved: ' + r.file); bk(); };
      U.$('#ex-json', root).onclick = () => { U.download('ledgerlight-backup-' + U.today() + '.json', JSON.stringify({ app: 'Ledgerlight', exported: new Date().toISOString(), state: S.state }, null, 1)); U.toast('Backup downloaded'); };
      U.$('#ex-csv', root).onclick = () => { U.download('ledgerlight-transactions-' + U.today() + '.csv', U.toCSV([['Date', 'Time', 'Type', 'Payee', 'Category', 'Account', 'To account', 'Amount', 'Tags', 'Notes', 'Status'], ...S.state.transactions.map((t) => [t.date, t.time || '', t.type, t.payee, S.cat(t.categoryId).name, S.acc(t.accountId).name, t.toAccountId ? S.acc(t.toAccountId).name : '', t.type === 'income' ? t.amount : -t.amount, (t.tags || []).join(' '), t.notes || '', t.status])]), 'text/csv'); };
      U.$('#ex-acc', root).onclick = () => U.download('ledgerlight-accounts-' + U.today() + '.csv', U.toCSV([['Account', 'Type', 'Institution', 'Balance'], ...S.state.accounts.map((a) => [a.name, a.type, a.institution || '', U.round(S.accountBalance(a.id))])]), 'text/csv');
      U.$('#ex-tpl', root).onclick = () => U.download('ledgerlight-import-template.csv', 'Date,Description,Amount,Category,Account\n2026-10-01,Salary October,185000,Salary,Main Account\n2026-10-02,FreshBasket groceries,-2340,Groceries,Main Account\n2026-10-03,Electricity bill,-1890,Electricity,Main Account\n', 'text/csv');
      U.$('#im-json', root).onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const data = JSON.parse(await U.readFile(file)); const st = data.state || data;
          if (!st.transactions || !st.accounts) throw new Error('This file is not a Ledgerlight backup.');
          if (await U.confirm('Restore this backup?', `It contains ${st.transactions.length} transactions and ${st.accounts.length} accounts. Your current data will be replaced.`, 'Restore', false)) { await S.replaceAll(st); U.toast('Backup restored'); location.hash = 'dashboard'; }
        } catch (err) { U.toast(err.message || 'Could not read that file', 'bad'); }
        e.target.value = '';
      };
      const drop = U.$('#im-drop', root);
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) startImport(f); });
      U.$('#im-file', root).onchange = (e) => { if (e.target.files[0]) startImport(e.target.files[0]); e.target.value = ''; };

      const startImport = async (file) => {
        const text = await U.readFile(file);
        let rows = U.parseCSV(text);
        // skip preamble lines common in bank exports: find first row with 3+ non-empty cells containing a date-like header
        let hi = rows.findIndex((r) => r.filter((c) => c.trim()).length >= 3 && r.some((c) => /date/i.test(c)));
        if (hi < 0) hi = 0;
        const headers = rows[hi].map((h, i) => h.trim() || 'Column ' + (i + 1));
        rows = rows.slice(hi + 1).filter((r) => r.length >= 2);
        if (!rows.length) { U.toast('No rows found in that file', 'bad'); return; }
        const opt = (sel) => `<option value="-1">— none —</option>` + headers.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${U.esc(h)}</option>`).join('');
        const g = { date: guess(headers, ['date', 'posted', 'txn dt']), desc: guess(headers, ['description', 'narration', 'details', 'payee', 'particular', 'merchant', 'memo', 'remarks']), amt: guess(headers, ['amount', 'amt', 'value']), debit: guess(headers, ['debit', 'withdrawal', 'dr']), credit: guess(headers, ['credit', 'deposit', 'cr']), cat: guess(headers, ['category']), acc: guess(headers, ['account']) };
        if (g.debit >= 0 && g.credit >= 0) g.amt = -1;
        const sample = rows.slice(0, 30).map((r) => r[g.date] || '');
        const dmy = sample.some((s) => { const m = String(s).match(/^(\d{1,2})[-/.](\d{1,2})/); return m && +m[1] > 12; });
        const mdy = sample.some((s) => { const m = String(s).match(/^(\d{1,2})[-/.](\d{1,2})/); return m && +m[2] > 12; });
        const box = U.$('#im-map', root);
        box.innerHTML = `<div class="banner">${I('file', 18)}<div class="b-t"><b>${U.esc(file.name)}</b> · ${rows.length} rows · ${headers.length} columns. Check the column mapping, then preview.</div></div>
          <div class="map-grid">
            <div class="field"><label for="m-date">Date column</label><select id="m-date">${opt(g.date)}</select></div>
            <div class="field"><label for="m-desc">Description / payee</label><select id="m-desc">${opt(g.desc)}</select></div>
            <div class="field"><label for="m-amt">Amount (signed)</label><select id="m-amt">${opt(g.amt)}</select></div>
            <div class="field"><label for="m-debit">Debit / money out</label><select id="m-debit">${opt(g.amt >= 0 ? -1 : g.debit)}</select></div>
            <div class="field"><label for="m-credit">Credit / money in</label><select id="m-credit">${opt(g.amt >= 0 ? -1 : g.credit)}</select></div>
            <div class="field"><label for="m-cat">Category (optional)</label><select id="m-cat">${opt(g.cat)}</select></div>
            <div class="field"><label for="m-acc">Account column (optional)</label><select id="m-acc">${opt(g.acc)}</select></div>
            <div class="field"><label for="m-dfmt">Date format</label><select id="m-dfmt"><option value="dmy" ${dmy || (!mdy && S.state.meta.currency === 'INR') ? 'selected' : ''}>Day / Month / Year</option><option value="mdy" ${mdy ? 'selected' : ''}>Month / Day / Year</option></select></div>
            <div class="field"><label for="m-sign">Signed amounts mean</label><select id="m-sign"><option value="neg-exp">Negative = money out</option><option value="pos-exp">Positive = money out</option></select></div>
            <div class="field"><label for="m-target">Import into account</label><select id="m-target">${S.state.accounts.map((a) => `<option value="${a.id}">${U.esc(a.name)}</option>`).join('')}<option value="__new">+ New account from file name</option></select></div>
          </div>
          <div class="toolbar" style="margin-top:12px"><label class="switch"><input type="checkbox" id="m-rules" checked><span></span>Auto-categorise (my rules, then keywords)</label><label class="switch"><input type="checkbox" id="m-dupes" checked><span></span>Skip duplicates</label><label class="switch"><input type="checkbox" id="m-clear" ${S.state.meta.isSample ? 'checked' : ''}><span></span>Remove sample data first</label></div>
          <div id="m-preview" style="margin-top:14px"></div>
          <div class="toolbar" style="margin-top:12px"><button class="btn primary" id="m-go">${I('upload', 16)}Import transactions</button><button class="btn ghost" id="m-cancel">Cancel</button></div>`;
        const read = () => ({ date: +U.$('#m-date', box).value, desc: +U.$('#m-desc', box).value, amt: +U.$('#m-amt', box).value, debit: +U.$('#m-debit', box).value, credit: +U.$('#m-credit', box).value, cat: +U.$('#m-cat', box).value, acc: +U.$('#m-acc', box).value, dfmt: U.$('#m-dfmt', box).value, sign: U.$('#m-sign', box).value });
        const build = () => {
          const m = read(); const out = []; let bad = 0;
          const catByName = new Map(S.state.categories.map((c) => [c.name.toLowerCase(), c.id]));
          rows.forEach((r) => {
            const date = parseDate(r[m.date], m.dfmt);
            let amt;
            if (m.amt >= 0) { amt = parseAmount(r[m.amt]); if (m.sign === 'pos-exp') amt = -amt; }
            else { const d = parseAmount(r[m.debit]), c = parseAmount(r[m.credit]); amt = (isNaN(c) ? 0 : Math.abs(c)) - (isNaN(d) ? 0 : Math.abs(d)); }
            if (!date || !amt || isNaN(amt)) { bad++; return; }
            const payee = (r[m.desc] || 'Imported').trim().replace(/\s+/g, ' ').slice(0, 80);
            const t = { date, time: '12:00', amount: U.round(Math.abs(amt)), type: amt > 0 ? 'income' : 'expense', payee, tags: ['imported'], notes: '', status: 'cleared' };
            const cn = m.cat >= 0 ? (r[m.cat] || '').trim() : '';
            t.categoryId = cn && catByName.get(cn.toLowerCase()) ? catByName.get(cn.toLowerCase()) : t.type === 'income' ? 'cat_other_in' : 'cat_uncat';
            t._catName = cn;
            t._acc = m.acc >= 0 ? (r[m.acc] || '').trim() : '';
            out.push(t);
          });
          return { out, bad };
        };
        const preview = () => {
          const { out, bad } = build();
          U.$('#m-preview', box).innerHTML = `<div class="kbd-hint" style="margin-bottom:6px">${out.length} rows ready${bad ? ` · ${bad} rows skipped (missing date or amount)` : ''}. First 8 shown:</div><div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Payee</th><th>Type</th><th class="r">Amount</th></tr></thead><tbody>${out.slice(0, 8).map((t) => `<tr><td>${U.fmtDate(t.date)}</td><td>${U.esc(t.payee)}</td><td>${t.type}</td><td class="r ${t.type === 'income' ? 'up' : ''}">${U.money(t.amount)}</td></tr>`).join('')}</tbody></table></div>`;
        };
        U.$$('select', box).forEach((s) => (s.onchange = preview));
        preview();
        U.$('#m-cancel', box).onclick = () => (box.innerHTML = '');
        U.$('#m-go', box).onclick = async () => {
          const { out } = build();
          if (!out.length) { U.toast('Nothing to import. Check the date and amount columns.', 'warn'); return; }
          if (U.$('#m-clear', box).checked) await S.clearAll();
          let target = U.$('#m-target', box).value;
          if (target === '__new' || !S.get('accounts', target)) { const a = { id: U.uid('acc'), name: file.name.replace(/\.csv$/i, '').slice(0, 40) || 'Imported account', type: 'bank', opening: 0, openingDate: out.reduce((m, t) => (t.date < m ? t.date : m), out[0].date), color: 's1', group: 'Liquid', archived: false, includeInNetWorth: true }; S.state.accounts.push(a); target = a.id; }
          const accByName = new Map(S.state.accounts.map((a) => [a.name.toLowerCase(), a.id]));
          const useRules = U.$('#m-rules', box).checked, skip = U.$('#m-dupes', box).checked;
          const keys = new Set(S.state.transactions.map((t) => t.date + '|' + t.amount + '|' + (t.payee || '').toLowerCase()));
          let added = 0, dup = 0, newCats = 0;
          out.forEach((t) => {
            const k = t.date + '|' + t.amount + '|' + t.payee.toLowerCase();
            if (skip && keys.has(k)) { dup++; return; }
            keys.add(k);
            t.accountId = (t._acc && accByName.get(t._acc.toLowerCase())) || target;
            if (t._catName && !S.state.categories.some((c) => c.name.toLowerCase() === t._catName.toLowerCase())) { const c = { id: U.uid('cat'), name: t._catName, group: 'Imported', type: t.type, icon: 'tag' }; S.state.categories.push(c); t.categoryId = c.id; newCats++; }
            else if (t._catName) t.categoryId = S.state.categories.find((c) => c.name.toLowerCase() === t._catName.toLowerCase()).id;
            delete t._catName; delete t._acc;
            if (useRules && !S.applyRules(t) && (t.categoryId === 'cat_uncat' || t.categoryId === 'cat_other_in')) LL.autoCategorize(t);
            t.id = U.uid('tx');
            S.state.transactions.push(t); added++;
          });
          S.state.transactions.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
          S.state.meta.isSample = false;
          await S.saveAll();
          U.toast(`Imported ${added} transactions${dup ? ', skipped ' + dup + ' duplicates' : ''}${newCats ? ', created ' + newCats + ' categories' : ''}`);
          location.hash = 'transactions';
        };
      };
    },
  };

  /* ===================== SETTINGS ===================== */
  LL.V.settings = {
    title: 'Settings',
    render(root) {
      const m = S.state.meta;
      root.innerHTML = `
        <div class="page-intro"><div><h2>Make it yours</h2><p>Preferences are saved with your data. Theme and privacy mode are remembered by this browser.</p></div></div>
        <div class="grid">
          ${LL.card({ cls: 'c6', title: 'Household', icon: 'home', body: '<div id="st-form"></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" id="st-save">Save</button></div>' })}
          ${LL.card({ cls: 'c6', title: 'Appearance & privacy', icon: 'eye', body: `<div class="list" style="gap:14px"><div class="toolbar"><button class="btn" onclick="LL.toggleTheme()">${I('sun', 16)}Switch light / dark</button><button class="btn" onclick="LL.togglePrivacy()">${I('eyeoff', 16)}Hide or show amounts</button></div><p class="muted-p">Hiding amounts blurs every figure so you can use the app in public. Hover a number to peek.</p><p class="muted-p">Animations follow your system's reduced-motion setting automatically.</p></div>` })}
          ${LL.card({ cls: 'c6', title: 'Keyboard shortcuts', icon: 'bolt', body: `<div class="mini-list">${[['N', 'Add a transaction'], ['/', 'Search everything'], ['⌘K / Ctrl K', 'Search everything'], ['Shift H', 'Hide or show amounts'], ['Esc', 'Close a dialog']].map(([k, d]) => `<div class="ml-row"><span>${d}</span><span></span><b class="mono">${k}</b></div>`).join('')}</div>` })}
          ${LL.card({ cls: 'c6', title: 'About this app', icon: 'shield', body: `<p class="muted-p">Ledgerlight runs entirely ${S.hosted() ? 'in your browser' : 'on this computer'}. ${S.mode === 'server' ? 'Data lives in <b class="mono">data/finance.db</b> (SQLite) in the app folder.' : (S.hosted() ? 'Data lives in this browser on this device.' : 'The local server is off, so data lives in this browser.')} Nothing is sent to any bank, cloud or analytics service. The only internet request is for the web fonts, and the app falls back to system fonts without it.</p>` })}
        </div>`;
      const f = U.form([
        { key: 'householdName', label: 'Name shown at the top' },
        { key: 'currency', label: 'Currency', type: 'select', options: U.currencies.map((c) => ({ value: c, label: c })), half: true },
        { key: 'fyStartMonth', label: 'Financial year starts in', type: 'select', options: U.MON.map((mm, i) => ({ value: i + 1, label: mm })), half: true },
      ], m);
      U.$('#st-form', root).appendChild(f);
      U.$('#st-save', root).onclick = () => { const v = f.read(); v.fyStartMonth = +v.fyStartMonth; S.setMeta(v); U.toast('Settings saved'); };
    },
  };
})(window.LL);
