/* Ledgerlight — insight pages: reports builder, pattern lab, taxes */
(function (LL) {
  'use strict';
  const U = LL.U, S = LL.S, C = LL.C, A = LL.A, I = LL.I;

  /* ===================== REPORTS ===================== */
  const DIMS = {
    category: ['Category', (t) => S.cat(t.categoryId).name],
    group: ['Category group', (t) => S.cat(t.categoryId).group],
    payee: ['Payee', (t) => t.payee || '—'],
    account: ['Account', (t) => S.acc(t.accountId).name],
    tag: ['Tag', (t) => (t.tags && t.tags.length ? t.tags.map((g) => '#' + g) : ['(no tag)'])],
    weekday: ['Weekday', (t) => U.DOW[U.dow(t.date)]],
    hour: ['Hour of day', (t) => (t.time || '12:00').slice(0, 2) + ':00'],
    month: ['Month', (t) => U.ym(t.date)],
  };
  const MEAS = { spend: 'Spending', income: 'Income', net: 'Net (income − spending)', count: 'Number of transactions', avg: 'Average payment' };
  LL.V.reports = {
    title: 'Reports',
    render(root) {
      const st = { dim: 'category', meas: 'spend', range: '3m', chart: 'bars', top: 12 };
      root.innerHTML = `
        <div class="page-intro"><div><h2>Build any report</h2><p>Pick what to group by and what to measure. Every report compares with the previous period of the same length.</p></div><div class="toolbar"><button class="btn" id="r-csv">${I('download', 16)}Export this report</button></div></div>
        <section class="card rise" style="margin-bottom:16px"><div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
          <div class="field half"><label for="r-dim">Group by</label><select id="r-dim">${Object.entries(DIMS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
          <div class="field half"><label for="r-meas">Measure</label><select id="r-meas">${Object.entries(MEAS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
          <div class="field half"><label for="r-range">Period</label><select id="r-range">${[['mtd', 'This month'], ['last', 'Last month'], ['3m', 'Last 3 months'], ['6m', 'Last 6 months'], ['12m', 'Last 12 months'], ['ytd', 'Year to date'], ['fy', 'This financial year'], ['all', 'All time']].map(([v, l]) => `<option value="${v}" ${v === st.range ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field half"><label for="r-top">Show top</label><select id="r-top">${[8, 12, 20, 50].map((n) => `<option ${n === st.top ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        </div><div style="margin-top:12px">${LL.seg('r-chart', [['bars', 'Bars'], ['hbars', 'Ranked list'], ['donut', 'Donut'], ['treemap', 'Treemap'], ['trend', 'Trend by month']], st.chart)}</div></section>
        <div class="grid"><section class="card c7 rise"><div class="card-h"><span class="ico-wrap">${I('bar', 16)}</span><div><h3 id="r-title"></h3><div class="sub" id="r-sub"></div></div></div><div id="r-chartbox"></div></section>
        <section class="card c5 rise"><div class="card-h"><span class="ico-wrap">${I('list', 16)}</span><h3>Table</h3></div><div class="table-wrap" style="max-height:440px;overflow:auto"><table class="tbl"><thead><tr><th>Name</th><th class="r">Value</th><th class="r">Share</th><th class="r">Prev.</th><th class="r">Change</th></tr></thead><tbody id="r-tbody"></tbody></table></div></section></div>
        <div class="section-h"><h2>Monthly statement</h2><p>Spending per group over the last 6 months</p></div>
        <section class="card rise"><div class="table-wrap" id="r-stmt"></div></section>
        <div class="section-h"><h2>Year over year</h2><p>This year's monthly spending against last year's</p></div>
        <div class="grid">${LL.card({ cls: 'c8', title: 'Spending by month', icon: 'trend', body: '<div id="r-yoy"></div>' })}${LL.card({ cls: 'c4', title: 'Top payees all time', icon: 'tag', body: '<div id="r-payees"></div>' })}</div>`;
      let last = [];
      const compute = (from, to) => {
        const tx = S.inRange(from, to, (t) => t.type !== 'transfer');
        const map = new Map();
        tx.forEach((t) => {
          const keys = [].concat(DIMS[st.dim][1](t));
          keys.forEach((k) => { if (!map.has(k)) map.set(k, { k, inc: 0, exp: 0, n: 0, ne: 0 }); const o = map.get(k); o.n++; if (t.type === 'income') o.inc += t.amount; else { o.exp += t.amount; o.ne++; } });
        });
        const val = (o) => (st.meas === 'spend' ? o.exp : st.meas === 'income' ? o.inc : st.meas === 'net' ? o.inc - o.exp : st.meas === 'count' ? o.n : o.ne ? o.exp / o.ne : 0);
        return [...map.values()].map((o) => ({ ...o, v: val(o) })).filter((o) => o.v !== 0);
      };
      const draw = () => {
        const [from, to] = S.rangeFor(st.range);
        const len = U.daysBetween(from, to);
        const pf = U.addDays(from, -len - 1), pt = U.addDays(from, -1);
        const now = compute(from, to), prev = new Map(compute(pf, pt).map((o) => [o.k, o.v]));
        let rows = now.sort((a, b) => (st.dim === 'month' || st.dim === 'hour' ? (a.k < b.k ? -1 : 1) : st.dim === 'weekday' ? U.DOW.indexOf(a.k) - U.DOW.indexOf(b.k) : Math.abs(b.v) - Math.abs(a.v)));
        const ordered = st.dim === 'month' || st.dim === 'hour' || st.dim === 'weekday';
        if (!ordered) rows = rows.slice(0, st.top);
        last = rows.map((r) => ({ ...r, prev: prev.get(r.k) || 0 }));
        const total = U.sum(rows, (r) => Math.abs(r.v));
        const fmt = st.meas === 'count' ? (v) => U.num(v) : U.money;
        U.$('#r-title', root).textContent = MEAS[st.meas] + ' by ' + DIMS[st.dim][0].toLowerCase();
        U.$('#r-sub', root).textContent = U.fmtDate(from) + ' – ' + U.fmtDate(to);
        const label = (k) => (st.dim === 'month' ? U.monLabel(k, true) : k);
        const box = U.$('#r-chartbox', root);
        const items = rows.map((r, i) => ({ label: label(r.k), value: Math.abs(r.v), color: C.series(i % 8) }));
        if (st.chart === 'donut') C.donut(box, items, { centerLabel: MEAS[st.meas], size: 230, max: 10, fmt: st.meas === 'count' ? U.num : U.short });
        else if (st.chart === 'treemap') C.track(() => C.treemap(box, items, { h: 380 }));
        else if (st.chart === 'hbars') C.hbars(box, rows.map((r, i) => ({ label: label(r.k), value: r.v, sub: r.n + ' transactions', color: C.series(i % 8) })), { fmt });
        else if (st.chart === 'trend') {
          const ms = U.monthsBetween(U.ym(from), U.ym(to));
          const top = rows.slice(0, 5).map((r) => r.k);
          const series = top.map((k, i) => ({ name: label(k), color: 's' + (i + 1), values: ms.map((m) => { const x = compute(m + '-01', m + '-' + U.daysInMonth(m)).find((o) => o.k === k); return x ? Math.abs(x.v) : 0; }) }));
          C.track(() => (ms.length > 1 ? C.line(box, { labels: ms.map((m) => U.monLabel(m, true)), series, h: 340, tipFmt: fmt }) : C.empty(box, 'Pick a period longer than one month for a trend')));
        } else C.track(() => C.bars(box, { labels: rows.map((r) => String(label(r.k)).slice(0, 10)), tipLabels: rows.map((r) => label(r.k)), series: [{ name: MEAS[st.meas], values: rows.map((r) => r.v), colors: rows.map((r) => (r.v < 0 ? 'var(--bad)' : 's1')) }], h: 340, fmt: st.meas === 'count' ? (v) => Math.round(v) : U.short, tipFmt: fmt }));
        U.$('#r-tbody', root).innerHTML = last.map((r) => { const d = r.prev ? (r.v - r.prev) / Math.abs(r.prev) : null; return `<tr><td class="wrap">${U.esc(label(r.k))}</td><td class="r">${fmt(r.v)}</td><td class="r">${U.pct(Math.abs(r.v) / (total || 1), 1)}</td><td class="r">${fmt(r.prev)}</td><td class="r ${d == null ? '' : (d > 0) === (st.meas !== 'spend' && st.meas !== 'avg') ? 'up' : 'down'}">${d == null ? 'new' : (d > 0 ? '+' : '') + U.pct(d)}</td></tr>`; }).join('') || '<tr><td colspan="5"><div class="chart-empty">No data in this period</div></td></tr>';
      };
      ['dim', 'meas', 'range', 'top'].forEach((k) => (U.$('#r-' + k, root).onchange = (e) => { st[k] = k === 'top' ? +e.target.value : e.target.value; if (k === 'dim' && e.target.value === 'month' && st.chart === 'trend') st.chart = 'bars'; draw(); }));
      LL.wireSeg(root, 'r-chart', (v) => { st.chart = v; draw(); });
      U.$('#r-csv', root).onclick = () => { U.download('ledgerlight-report-' + st.dim + '-' + U.today() + '.csv', U.toCSV([[DIMS[st.dim][0], MEAS[st.meas], 'Previous period', 'Transactions'], ...last.map((r) => [r.k, U.round(r.v), U.round(r.prev), r.n])]), 'text/csv'); U.toast('Report exported'); };
      draw();
      // monthly statement
      const ms6 = S.months(6), groups = S.groups();
      const cell = (g, m) => S.month(m).byGroup[g] || 0;
      const allMax = Math.max(1, ...groups.flatMap((g) => ms6.map((m) => cell(g, m))));
      U.$('#r-stmt', root).innerHTML = `<table class="tbl"><thead><tr><th>Group</th>${ms6.map((m) => `<th class="r">${U.monLabel(m, true)}</th>`).join('')}<th class="r">Average</th><th>Trend</th></tr></thead><tbody>${groups.map((g) => { const vals = ms6.map((m) => cell(g, m)); return `<tr><td><b>${U.esc(g)}</b></td>${vals.map((v) => `<td class="r" style="background:color-mix(in srgb, var(--heat) ${Math.round((v / allMax) * 35)}%, transparent)">${v ? U.short(v) : '—'}</td>`).join('')}<td class="r">${U.short(U.avg(vals))}</td><td>${C.spark(vals, { w: 80, h: 22, color: 'var(--s1)' })}</td></tr>`; }).join('')}<tr><td><b>Total spending</b></td>${ms6.map((m) => `<td class="r"><b>${U.short(S.month(m).expense)}</b></td>`).join('')}<td class="r"><b>${U.short(U.avg(ms6.map((m) => S.month(m).expense)))}</b></td><td></td></tr><tr><td><b>Income</b></td>${ms6.map((m) => `<td class="r up">${U.short(S.month(m).income)}</td>`).join('')}<td class="r up">${U.short(U.avg(ms6.map((m) => S.month(m).income)))}</td><td></td></tr></tbody></table>`;
      C.track(() => {
        const y = S.asOf().slice(0, 4), py = String(+y - 1);
        const v = (yy) => U.MON.map((_, i) => { const m = yy + '-' + String(i + 1).padStart(2, '0'); return m <= S.curYM() && S.monthly().has(m) ? S.month(m).expense : null; });
        C.line(U.$('#r-yoy', root), { labels: U.MON, series: [{ name: py, values: v(py), color: 's7', dash: true }, { name: y, values: v(y), color: 's2', area: true }], h: 260 });
      });
      const pay = [...U.groupBy(S.expenses(), (t) => t.payee).entries()].map(([p, a]) => ({ label: p, value: U.sum(a, (t) => t.amount), sub: a.length + ' payments' })).sort((a, b) => b.value - a.value).slice(0, 8);
      C.hbars(U.$('#r-payees', root), pay.map((x, i) => ({ ...x, color: C.series(i % 8) })));
    },
  };

  /* ===================== PATTERN LAB ===================== */
  LL.V.lab = {
    title: 'Pattern lab',
    render(root, p) {
      const all = A.all();
      let group = 'All', q = '';
      const sevCount = (s) => all.filter((a) => a.severity === s).length;
      root.innerHTML = `
        <div class="page-intro"><div><h2>${all.length} deep pattern analyses</h2><p>Each card asks one question about your money and answers it from your own transactions: timing, habits, trends, anomalies, forecasts and risk. Nothing leaves your computer.</p></div></div>
        <div class="grid">
          ${LL.kpi({ cls: 'c3', label: 'Analyses run', icon: 'lab', kind: 'num', value: all.length })}
          ${LL.kpi({ cls: 'c3', label: 'Worth a look', icon: 'alert', kind: 'num', value: sevCount('warn') + sevCount('bad'), delta: '<span class="pill warn">Warning</span>' })}
          ${LL.kpi({ cls: 'c3', label: 'Looking good', icon: 'check', kind: 'num', value: sevCount('good'), delta: '<span class="pill good">Healthy</span>' })}
          ${LL.kpi({ cls: 'c3', label: 'Transactions analysed', icon: 'list', kind: 'num', value: S.state.transactions.length })}
        </div>
        <div class="toolbar" style="margin:18px 0"><div class="seg" id="lab-g">${['All', ...A.groups].map((g) => `<button data-v="${g}" class="${g === group ? 'on' : ''}">${g} <span class="muted">${g === 'All' ? all.length : all.filter((a) => a.group === g).length}</span></button>`).join('')}</div><div class="seg" id="lab-s"><button data-v="" class="on">Any result</button><button data-v="warn">Needs attention</button><button data-v="good">Healthy</button></div><input type="search" id="lab-q" placeholder="Search analyses" style="max-width:240px"></div>
        <div class="lab-grid" id="lab-grid"></div>`;
      let sev = '';
      const io = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { const el = en.target; io.unobserve(el); const a = all.find((x) => x.id === el.dataset.id); try { C.track(() => a.render(el)); } catch (e) { el.innerHTML = '<div class="chart-empty">Could not draw this chart</div>'; } } }), { rootMargin: '200px' }) : null;
      const draw = () => {
        const list = all.filter((a) => (group === 'All' || a.group === group) && (!sev || (sev === 'warn' ? ['warn', 'bad'].includes(a.severity) : a.severity === sev)) && (!q || (a.title + a.question + a.headline).toLowerCase().includes(q)));
        U.$('#lab-grid', root).innerHTML = list.map((a) => `<section class="card lab-card rise" id="lab-${a.id}">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="lab-num">#${String(A.defs.findIndex((d) => d.id === a.id) + 1).padStart(2, '0')}</span><span class="chip">${a.group}</span><span class="pill ${a.severity}">${{ good: 'Healthy', warn: 'Worth a look', bad: 'Act on this', info: 'Insight' }[a.severity]}</span></div>
          <h3 style="margin-top:10px;font-size:15px">${U.esc(a.title)}</h3><div class="lab-q">${U.esc(a.question)}</div>
          <div class="lab-head">${U.esc(a.headline)}</div><div class="lab-metric">${U.esc(a.metric || '')}</div>
          <div class="lab-chart" data-id="${a.id}" style="min-height:120px"></div>
          <p class="lab-detail">${U.esc(a.detail || '')}</p>
          ${a.list && a.list.length ? `<div class="mini-list" style="margin-top:10px">${a.list.slice(0, 5).map((t) => `<div class="ml-row" style="cursor:pointer" data-tx="${t.id}"><span>${U.esc(t.payee)}</span><span class="muted">${U.fmtDate(t.date)}</span><b>${U.money(t.amount)}</b></div>`).join('')}</div>` : ''}
        </section>`).join('') || LL.emptyState('lab', 'No analyses match', 'Try a different group or search.');
        U.stagger(U.$('#lab-grid', root));
        U.$$('.lab-chart', root).forEach((el) => { if (io) io.observe(el); else { const a = all.find((x) => x.id === el.dataset.id); a.render(el); } });
      };
      U.$('#lab-g', root).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; group = b.dataset.v; U.$$('#lab-g button', root).forEach((x) => x.classList.toggle('on', x === b)); draw(); });
      U.$('#lab-s', root).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; sev = b.dataset.v; U.$$('#lab-s button', root).forEach((x) => x.classList.toggle('on', x === b)); draw(); });
      U.$('#lab-q', root).addEventListener('input', U.debounce((e) => { q = e.target.value.toLowerCase(); draw(); }, 150));
      U.on(root, 'click', '[data-tx]', (e, el) => LL.txForm(S.get('transactions', el.dataset.tx)));
      if (!all.length) { U.$('#lab-grid', root).innerHTML = LL.emptyState('lab', 'Not enough data yet', 'The lab needs a few weeks of transactions. Import a statement or load the sample household to try it.', '<a class="btn primary" href="#data">Import data</a>'); return; }
      draw();
      if (p.focus) setTimeout(() => { const el = U.$('#lab-' + p.focus, root); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.borderColor = 'var(--accent)'; el.style.boxShadow = '0 0 0 4px var(--accent-soft)'; } }, 350);
    },
  };

  /* ===================== TAXES ===================== */
  const slabTax = (inc, slabs) => { let tax = 0, prev = 0; for (const [upto, rate] of slabs) { if (inc > prev) tax += (Math.min(inc, upto) - prev) * rate; prev = upto; } return tax; };
  const NEW = [[400000, 0], [800000, 0.05], [1200000, 0.1], [1600000, 0.15], [2000000, 0.2], [2400000, 0.25], [Infinity, 0.3]];
  const OLD = [[250000, 0], [500000, 0.05], [1000000, 0.2], [Infinity, 0.3]];
  LL.V.taxes = {
    title: 'Taxes',
    render(root) {
      const fyNow = S.fyRange(S.asOf());
      const fys = [fyNow, S.fyRange(U.addDays(fyNow[0], -1))];
      let fi = 0;
      const inr = S.state.meta.currency === 'INR';
      root.innerHTML = `
        <div class="page-intro"><div><h2>Tax year at a glance</h2><p>Totals for the financial year, deduction tracking from your tags (<span class="tag">#tax-80C</span><span class="tag">#tax-80D</span><span class="tag">#tax-80G</span>), and an old vs new regime estimate. This is an estimate for planning, not tax advice; confirm figures with your accountant.</p></div><div class="toolbar">${LL.seg('tx-fy', fys.map((f, i) => [String(i), 'FY ' + f[0].slice(0, 4) + '–' + f[1].slice(2, 4)]), '0')}<button class="btn" id="tx-pack">${I('download', 16)}Export tax pack</button></div></div>
        <div id="tx-body"></div>`;
      const draw = () => {
        const [from, to] = fys[fi];
        const tx = S.inRange(from, to);
        const elapsed = Math.min(1, (U.daysBetween(from, S.asOf()) + 1) / 365);
        const inc = (c) => U.sum(tx.filter((t) => t.type === 'income' && t.categoryId === c), (t) => t.amount);
        const salaryCredited = inc('cat_salary');
        const meta = S.state.meta;
        const grossSalary = meta.taxGross && meta.taxGross[from] ? meta.taxGross[from] : (salaryCredited / elapsed) * 1.12;
        const other = { Freelance: inc('cat_freelance') / elapsed, Interest: inc('cat_interest') / elapsed, Dividends: inc('cat_dividends') / elapsed };
        const tagged = (tag) => tx.filter((t) => (t.tags || []).includes(tag));
        const d80c = U.sum(tagged('tax-80C'), (t) => t.amount);
        const d80d = U.sum(tagged('tax-80D'), (t) => t.amount), d80g = U.sum(tagged('tax-80G'), (t) => t.amount);
        const lim = { c: 150000, d: 25000 };
        const otherTot = U.sum(Object.values(other));
        const gross = grossSalary + otherTot;
        const taxPaid = U.sum(tx.filter((t) => t.categoryId === 'cat_taxes'), (t) => t.amount);
        const nTaxable = Math.max(0, gross - 75000);
        let nTax = nTaxable <= 1200000 ? 0 : slabTax(nTaxable, NEW);
        nTax *= 1.04;
        const oDed = 50000 + Math.min(d80c, lim.c) + Math.min(d80d, lim.d) + d80g * 0.5;
        const oTaxable = Math.max(0, gross - oDed);
        let oTax = oTaxable <= 500000 ? 0 : slabTax(oTaxable, OLD);
        oTax *= 1.04;
        const best = nTax <= oTax ? 'new' : 'old';
        // capital gains (unrealised) from holdings
        const cg = S.state.holdings.map((h) => { let st = 0, lt = 0; const price = h.price; (h.flows || []).forEach((f) => { if (f.units <= 0) return; const g = f.units * price - f.amount; if (U.daysBetween(f.date, S.asOf()) > 365) lt += g; else st += g; }); return { h, st, lt }; });
        const ltTot = U.sum(cg, (x) => x.lt), stTot = U.sum(cg, (x) => x.st);
        const body = U.$('#tx-body', root);
        body.innerHTML = `
          <div class="grid">
            ${LL.kpi({ cls: 'c3', label: 'Income so far this FY', icon: 'coin', value: U.sum(tx.filter(S.isIncome), (t) => t.amount), delta: `<span>${U.pct(elapsed)} of the year gone</span>` })}
            ${LL.kpi({ cls: 'c3', label: 'Estimated gross income', icon: 'trend', value: gross, delta: '<span>Annualised, salary grossed up for TDS</span>' })}
            ${LL.kpi({ cls: 'c3', label: 'Advance tax paid', icon: 'tax', value: taxPaid })}
            ${inr ? LL.kpi({ cls: 'c3 hero', label: 'Better regime (estimate)', icon: 'check', value: Math.abs(oTax - nTax), delta: `<span><b>${best === 'new' ? 'New' : 'Old'} regime</b> saves this much</span>` }) : ''}
            ${LL.card({ cls: 'c6', title: 'Deductions tracker', icon: 'shield', sub: 'From tagged transactions in this FY', body: `<div class="list" style="gap:16px">${[['Section 80C · PPF, ELSS, life insurance', d80c, lim.c], ['Section 80D · health insurance', d80d, lim.d], ['Section 80G · donations (50%)', d80g * 0.5, null]].map(([l, v, mx]) => `<div><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${l}</b><span class="num">${U.money(v)}${mx ? ' / ' + U.short(mx) : ''}</span></div>${mx ? `<div class="bar-track" style="margin-top:6px"><div class="bar-fill" style="--w:${Math.min(100, (v / mx) * 100)}%;--c:${v >= mx ? 'var(--good)' : 'var(--s1)'}"></div></div><div class="kbd-hint" style="margin-top:3px">${v >= mx ? 'Limit used fully' : U.money(mx - v) + ' of room left'}</div>` : ''}</div>`).join('')}</div>` })}
            ${inr ? LL.card({ cls: 'c6', title: 'Old vs new regime', icon: 'bar', sub: 'Estimated tax including 4% cess · surcharge ignored', body: `<div id="tx-reg"></div><div class="stats" style="margin-top:10px"><div class="stat"><div class="s-l">New: taxable</div><div class="s-v">${U.short(nTaxable)}</div></div><div class="stat"><div class="s-l">Old: taxable</div><div class="s-v">${U.short(oTaxable)}</div></div><div class="stat"><div class="s-l">Old: deductions</div><div class="s-v">${U.short(oDed)}</div></div></div><div class="field" style="margin-top:12px"><label for="tx-gross">Gross salary for this FY (optional, improves accuracy)</label><input id="tx-gross" type="number" placeholder="${Math.round(grossSalary)}" value="${meta.taxGross && meta.taxGross[from] ? meta.taxGross[from] : ''}"></div>` }) : ''}
            ${LL.card({ cls: 'c6', title: 'Income by source', icon: 'coin', sub: 'Annualised for this FY', body: '<div id="tx-src"></div>' })}
            ${LL.card({ cls: 'c6', title: 'Capital gains if sold today', icon: 'trend', sub: 'Unrealised · long term means held over 12 months', body: `<div class="stats"><div class="stat"><div class="s-l">Long-term gains</div><div class="s-v ${ltTot >= 0 ? 'up' : 'down'}">${U.money(ltTot)}</div></div><div class="stat"><div class="s-l">Short-term gains</div><div class="s-v ${stTot >= 0 ? 'up' : 'down'}">${U.money(stTot)}</div></div></div><div id="tx-cg" style="margin-top:12px"></div>` })}
            ${LL.card({ cls: 'c12', title: 'Tax-relevant transactions', icon: 'list', body: `<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Payee</th><th>Tag</th><th class="r">Amount</th></tr></thead><tbody>${tx.filter((t) => (t.tags || []).some((g) => g.startsWith('tax-')) || t.categoryId === 'cat_taxes').slice(0, 60).map((t) => `<tr><td>${U.fmtDate(t.date)}</td><td>${U.esc(t.payee)}</td><td>${(t.tags || []).filter((g) => g.startsWith('tax')).map((g) => `<span class="tag">#${g}</span>`).join('') || '<span class="tag">tax paid</span>'}</td><td class="r">${U.money(t.amount)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="chart-empty">Tag transactions with #tax-80C, #tax-80D or #tax-80G to track them here.</div></td></tr>'}</tbody></table></div>` })}
          </div>`;
        if (inr) C.track(() => C.bars(U.$('#tx-reg', root), { labels: ['New regime', 'Old regime'], series: [{ name: 'Estimated tax', values: [nTax, oTax], colors: [best === 'new' ? 'var(--good)' : 's7', best === 'old' ? 'var(--good)' : 's7'] }], h: 200 }));
        C.hbars(U.$('#tx-src', root), [{ label: 'Salary (gross est.)', value: grossSalary, color: 's1' }, ...Object.entries(other).map(([k, v], i) => ({ label: k, value: v, color: C.series(i + 2) }))].filter((x) => x.value > 0));
        C.hbars(U.$('#tx-cg', root), cg.filter((x) => Math.abs(x.lt + x.st) > 100).sort((a, b) => b.lt + b.st - (a.lt + a.st)).slice(0, 6).map((x) => ({ label: x.h.name, value: x.lt + x.st, sub: 'LT ' + U.short(x.lt) + ' · ST ' + U.short(x.st), color: x.lt + x.st >= 0 ? 'var(--good)' : 'var(--bad)' })), { fmt: (v) => U.money(v, { sign: true }) });
        U.countUp(body); U.stagger(body); U.tilt(body);
        const g = U.$('#tx-gross', root);
        if (g) g.onchange = () => { const tg = { ...(meta.taxGross || {}) }; if (g.value) tg[from] = +g.value; else delete tg[from]; S.setMeta({ taxGross: tg }); };
      };
      LL.wireSeg(root, 'tx-fy', (v) => { fi = +v; draw(); });
      U.$('#tx-pack', root).onclick = () => {
        const [from, to] = fys[fi];
        const tx = S.inRange(from, to, (t) => t.type === 'income' || (t.tags || []).some((g) => g.startsWith('tax-')) || t.categoryId === 'cat_taxes');
        U.download('ledgerlight-tax-pack-FY' + from.slice(0, 4) + '.csv', U.toCSV([['Date', 'Type', 'Payee', 'Category', 'Tags', 'Amount', 'Notes'], ...tx.map((t) => [t.date, t.type, t.payee, S.cat(t.categoryId).name, (t.tags || []).join(' '), t.amount, t.notes || ''])]), 'text/csv');
        U.toast('Tax pack exported (' + tx.length + ' rows)');
      };
      draw();
    },
  };
})(window.LL);
