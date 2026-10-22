/* Ledgerlight — overview pages: dashboard, net worth, cash flow, health score */
(function (LL) {
  'use strict';
  const U = LL.U, S = LL.S, C = LL.C, A = LL.A, I = LL.I;

  const prevYM = () => U.ymAdd(S.curYM(), -1);
  LL.safeToSpend = () => {
    const asOf = S.asOf();
    const nextPay = U.ymAdd(S.curYM(), 1) + '-01';
    const days = Math.max(1, U.daysBetween(asOf, nextPay));
    const cash = U.sum(S.state.accounts.filter((a) => ['bank', 'cash', 'wallet'].includes(a.type) && !a.archived), (a) => S.accountBalance(a.id));
    const bills = S.upcoming(days, U.addDays(asOf, 1)).filter((u) => !S.isBillPaid(u.bill, u.date) && (S.acc(u.bill.accountId).type !== 'credit'));
    const due = U.sum(bills, (u) => u.amount);
    const cards = U.sum(S.state.accounts.filter((a) => a.type === 'credit' && !a.archived), (a) => {
      const owed = -Math.min(0, S.accountBalance(a.id));
      let due = S.curYM() + '-' + String(Math.min(a.dueDay || 18, 28)).padStart(2, '0');
      if (due <= asOf) due = U.ymAdd(S.curYM(), 1) + '-' + String(Math.min(a.dueDay || 18, 28)).padStart(2, '0');
      return due < nextPay ? owed : 0;
    });
    const safe = cash - due - cards;
    return { safe, perDay: safe / days, days, cash, due, cards, bills };
  };

  /* ===================== DASHBOARD ===================== */
  LL.V.dashboard = {
    title: 'Dashboard',
    render(root) {
      if (!S.state.transactions.length && !S.state.holdings.length) {
        root.innerHTML = LL.emptyState('grid', 'Your dashboard is waiting for data', 'Add a transaction, import a bank statement (CSV) or reload the sample household to see every chart come alive.',
          `<button class="btn primary" onclick="LL.txForm()">${I('plus', 16)}Add a transaction</button><a class="btn" href="#data">${I('upload', 16)}Import a CSV</a><button class="btn" id="reload-sample">${I('sparkle', 16)}Load sample data</button>`);
        U.$('#reload-sample', root).onclick = async () => { await S.loadSample(); U.toast('Sample household loaded'); };
        return;
      }
      const cur = S.month(S.curYM()), prev = S.month(prevYM());
      const nw = S.netWorthSeries();
      const nwNow = nw[nw.length - 1] || { net: 0 }, nwPrev = nw[nw.length - 2] || { net: 0 };
      const safe = LL.safeToSpend();
      const dayOf = +S.asOf().slice(8);
      const prevSameDay = U.sum(S.inRange(prevYM() + '-01', prevYM() + '-' + String(Math.min(dayOf, U.daysInMonth(prevYM()))).padStart(2, '0'), S.isExpense), (t) => t.amount);
      const health = A.health();
      const ins = A.insights(6);
      const months12 = S.months(12);
      const tick = [
        ...S.state.accounts.filter((a) => !a.archived).slice(0, 8).map((a) => `<span class="ticker-item">${I(LL.ACC_ICON[a.type] || 'wallet', 14)}${U.esc(a.name)} <b>${U.money(S.accountBalance(a.id))}</b></span>`),
        ...ins.map((x) => `<span class="ticker-item"><span class="pill ${x.severity}">${x.group}</span>${U.esc(x.headline)}</span>`),
      ].join('');
      root.innerHTML = `
        ${LL.sampleBanner()}
        <div class="ticker rise" aria-label="Live summary"><div class="ticker-track">${tick}${tick}</div></div>
        <div class="grid">
          ${LL.kpi({ cls: 'c3 hero', label: 'Net worth', icon: 'layers', value: nwNow.net, delta: LL.delta(nwNow.net, nwPrev.net), spark: C.spark(nw.slice(-12).map((x) => x.net), { color: 'var(--accent)' }) })}
          ${LL.kpi({ cls: 'c3', label: 'Spent this month', icon: 'receipt', value: cur.expense, delta: LL.delta(cur.expense, prevSameDay, false, 'vs same point last month'), spark: C.spark(months12.map((m) => S.month(m).expense), { color: 'var(--s2)' }) })}
          ${LL.kpi({ cls: 'c3', label: 'Income this month', icon: 'coin', value: cur.income, delta: LL.delta(cur.income, prev.income), spark: C.spark(months12.map((m) => S.month(m).income), { color: 'var(--s3)' }) })}
          ${LL.kpi({ cls: 'c3', label: 'Safe to spend', icon: 'shield', value: safe.safe, delta: `<span>${U.money(safe.perDay)}/day for ${safe.days} days · after ${U.short(safe.due)} bills and ${U.short(safe.cards)} card dues</span>` })}

          ${LL.card({ cls: 'c4', title: 'Financial health', icon: 'heart', sub: 'Six signals rolled into one score', right: `<a class="btn sm ghost" href="#health">Details</a>`, body: `<div class="center" id="d-gauge"></div><div class="center"><span class="pill ${health.score >= 65 ? 'good' : health.score >= 45 ? 'warn' : 'bad'}">${health.label}</span></div><div class="stats" style="margin-top:14px">${health.parts.slice(0, 4).map((p) => `<div class="stat"><div class="s-l">${p.k}</div><div class="s-v">${p.show}</div></div>`).join('')}</div>` })}
          ${LL.card({ cls: 'c8', title: 'Income vs spending', icon: 'bar', sub: 'Last 12 months · click a month to see its transactions', right: LL.seg('d-cf-mode', [['bars', 'Bars'], ['net', 'Net']], 'bars'), body: '<div id="d-cf"></div>' })}

          ${LL.card({ cls: 'c5', title: 'Where the money went', icon: 'pie', sub: U.monLabel(S.curYM(), true) + ' by group', right: LL.seg('d-donut-m', [['cur', 'This month'], ['prev', 'Last month'], ['12', '12 months']], 'cur'), body: '<div id="d-donut"></div>' })}
          ${LL.card({ cls: 'c7', title: 'Budgets this month', icon: 'pie', sub: `Day ${dayOf} of ${U.daysInMonth(S.curYM())}`, right: '<a class="btn sm ghost" href="#budgets">All budgets</a>', body: '<div id="d-bud" class="grid" style="gap:12px"></div>' })}

          ${LL.card({ cls: 'c8', title: 'Net worth over time', icon: 'layers', sub: 'Assets minus loans and card balances', right: LL.seg('d-nw-r', [['12', '1Y'], ['24', 'All']], '24'), body: '<div id="d-nw"></div>' })}
          ${LL.card({ cls: 'c4', title: 'Coming up', icon: 'calendar', sub: 'Next 14 days', right: '<a class="btn sm ghost" href="#bills">Bills</a>', body: '<div id="d-up" class="list"></div>' })}

          ${LL.card({ cls: 'c6', title: 'Daily spending this month', icon: 'bar', sub: 'Bars are this month · line is your 6-month daily average', body: '<div id="d-daily"></div>' })}
          ${LL.card({ cls: 'c6', title: 'What the patterns say', icon: 'lab', sub: 'From the Pattern lab · click to explore', right: '<a class="btn sm ghost" href="#lab">Open lab</a>', body: `<div class="list" style="gap:8px">${ins.map((x) => `<div class="insight ${x.severity}" data-go="${x.id}"><span class="stripe"></span><div><div class="i-h">${U.esc(x.headline)}</div><div class="i-m">${U.esc(x.title)} · ${U.esc(x.metric || '')}</div></div></div>`).join('')}</div>` })}

          ${LL.card({ cls: 'c6', title: 'Recent transactions', icon: 'list', right: '<a class="btn sm ghost" href="#transactions">See all</a>', body: '<div id="d-recent" class="list"></div>' })}
          ${LL.card({ cls: 'c6', title: 'Goals', icon: 'target', right: '<a class="btn sm ghost" href="#goals">All goals</a>', body: '<div id="d-goals" class="list" style="gap:14px"></div>' })}

          ${LL.card({ cls: 'c12', title: 'Spending treemap', icon: 'grid', sub: 'Last 3 months by category · click a tile to filter transactions', body: '<div id="d-tree"></div>' })}
        </div>`;

      C.gauge(U.$('#d-gauge', root), { value: health.score, label: 'out of 100' });

      let cfMode = 'bars';
      const drawCF = () => {
        const el = U.$('#d-cf', root);
        const labels = months12.map((m) => U.monLabel(m)), tips = months12.map((m) => U.monLabel(m, true));
        const click = (i) => (location.hash = 'transactions?month=' + months12[i]);
        if (cfMode === 'bars') C.bars(el, { labels, tipLabels: tips, series: [{ name: 'Income', values: months12.map((m) => S.month(m).income), color: 's3' }, { name: 'Spending', values: months12.map((m) => S.month(m).expense), color: 's2' }], h: 260, onClick: click });
        else { const net = months12.map((m) => S.month(m).income - S.month(m).expense); C.bars(el, { labels, tipLabels: tips, series: [{ name: 'Net saved', values: net, colors: net.map((v) => (v >= 0 ? 'var(--good)' : 'var(--bad)')) }], h: 260, onClick: click }); }
      };
      C.track(drawCF);
      LL.wireSeg(root, 'd-cf-mode', (v) => { cfMode = v; drawCF(); });

      let dm = 'cur';
      const drawDonut = () => {
        const by = {};
        const ms = dm === 'cur' ? [S.curYM()] : dm === 'prev' ? [prevYM()] : months12;
        ms.forEach((m) => Object.entries(S.month(m).byGroup).forEach(([g, v]) => (by[g] = (by[g] || 0) + v)));
        const items = Object.entries(by).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
        C.donut(U.$('#d-donut', root), items, { centerLabel: dm === '12' ? 'Spent in 12 months' : 'Spent', size: 210, onClick: (it) => (location.hash = 'transactions?group=' + encodeURIComponent(it.label) + (dm === 'cur' ? '&month=' + S.curYM() : '')) });
      };
      drawDonut();
      LL.wireSeg(root, 'd-donut-m', (v) => { dm = v; drawDonut(); });

      const bud = S.budgetStatus().sort((a, b) => b.ratio - a.ratio).slice(0, 6);
      U.$('#d-bud', root).innerHTML = bud.length ? bud.map((b) => `<div class="budget-tile c6">${C.ring(b.ratio, { label: Math.round(b.ratio * 100) + '%' })}<div style="min-width:0"><div class="bt-n">${U.esc(b.cat.name)}</div><div class="bt-s">${U.money(b.spent)} of ${U.money(b.limit)} · ${b.left >= 0 ? U.money(b.left) + ' left' : U.money(-b.left) + ' over'}</div><div class="bt-s">${b.pace > 1.05 && b.ratio <= 1 ? '<span class="pill warn">On pace to overspend</span>' : b.ratio > 1 ? '<span class="pill bad">Over budget</span>' : '<span class="pill good">On track</span>'}</div></div></div>`).join('') : `<div class="c12">${LL.emptyState('pie', 'No budgets yet', 'Set monthly limits per category and they will show up here.', '<a class="btn" href="#budgets">Create budgets</a>')}</div>`;

      let nwr = 24;
      const drawNW = () => { const s = nw.slice(-nwr); C.line(U.$('#d-nw', root), { labels: s.map((x) => U.monLabel(x.ym, true)), series: [{ name: 'Net worth', values: s.map((x) => x.net), color: 's1', area: true }, { name: 'Assets', values: s.map((x) => x.assets), color: 's3' }, { name: 'Liabilities', values: s.map((x) => x.liabilities), color: 's8' }], h: 250 }); };
      C.track(drawNW);
      LL.wireSeg(root, 'd-nw-r', (v) => { nwr = +v; drawNW(); });

      const up = S.upcoming(14);
      U.$('#d-up', root).innerHTML = up.length ? up.slice(0, 7).map((u) => { const paid = S.isBillPaid(u.bill, u.date); return `<div class="row"><div class="av">${I(u.bill.kind === 'subscription' ? 'repeat' : 'receipt', 16)}</div><div style="min-width:0"><div class="t1">${U.esc(u.bill.name)}</div><div class="t2">${U.fmtDate(u.date, { year: false, weekday: true })} · ${U.relDay(u.date)}${u.bill.autopay ? ' · autopay' : ''}</div></div><div class="amt">${U.money(u.amount)}<small>${paid ? '<span class="up">Paid</span>' : 'Due'}</small></div></div>`; }).join('') : '<p class="muted">Nothing due in the next two weeks.</p>';

      C.track(() => {
        const ym = S.curYM(), dim = U.daysInMonth(ym);
        const days = [...Array(dim).keys()].map((i) => i + 1);
        const spent = days.map((d) => U.sum(S.inRange(ym + '-' + String(d).padStart(2, '0'), ym + '-' + String(d).padStart(2, '0'), S.isExpense), (t) => t.amount));
        const six = S.months(7).slice(0, 6);
        const avg = days.map((d) => U.avg(six.map((m) => (d <= U.daysInMonth(m) ? U.sum(S.inRange(m + '-' + String(d).padStart(2, '0'), m + '-' + String(d).padStart(2, '0'), S.isExpense), (t) => t.amount) : 0))));
        C.bars(U.$('#d-daily', root), { labels: days.map(String), tipLabels: days.map((d) => U.fmtDate(ym + '-' + String(d).padStart(2, '0'), { weekday: true })), series: [{ name: 'Spent', values: days.map((d, i) => (d <= dayOf ? spent[i] : 0)), color: 's1' }], line: { name: '6-month average', values: avg, color: 's4' }, h: 240, onClick: (i) => (location.hash = 'transactions?day=' + ym + '-' + String(i + 1).padStart(2, '0')) });
      });

      U.$('#d-recent', root).innerHTML = S.state.transactions.slice(0, 7).map(LL.txRow).join('');
      U.on(U.$('#d-recent', root), 'click', '.row', (e, r) => LL.txForm(S.get('transactions', r.dataset.id)));

      U.$('#d-goals', root).innerHTML = S.state.goals.length ? S.state.goals.slice(0, 4).map((g) => { const r = g.saved / g.target; return `<div><div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:6px"><b>${U.esc(g.name)}</b><span class="num">${U.short(g.saved)} / ${U.short(g.target)}</span></div><div class="bar-track"><div class="bar-fill" style="--w:${Math.min(100, r * 100)}%;--c:var(--${g.color || 's1'})"></div></div><div class="kbd-hint" style="margin-top:4px">${r >= 1 ? 'Reached' : U.pct(r) + ' · due ' + U.fmtDate(g.deadline)}</div></div>`; }).join('') : '<p class="muted">No goals yet.</p>';

      C.track(() => {
        const by = {};
        S.months(3).forEach((m) => Object.entries(S.month(m).byCat).forEach(([c, v]) => (by[c] = (by[c] || 0) + v)));
        const groups = S.groups();
        C.treemap(U.$('#d-tree', root), Object.entries(by).map(([c, v]) => ({ id: c, label: S.cat(c).name, value: v, color: C.series(groups.indexOf(S.cat(c).group)) })), { h: 320, onClick: (r) => (location.hash = 'transactions?category=' + r.id) });
      });
      U.on(root, 'click', '[data-go]', (e, el) => (location.hash = 'lab?focus=' + el.dataset.go));
    },
  };

  LL.txRow = (t) => {
    const c = S.cat(t.categoryId), a = S.acc(t.accountId);
    const sign = t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '−';
    return `<div class="row clickable" data-id="${t.id}"><div class="av" style="color:${C.series(S.groups().indexOf(c.group) >= 0 ? S.groups().indexOf(c.group) : 6)}">${I(t.type === 'transfer' ? 'repeat' : c.icon || 'tag', 16)}</div><div style="min-width:0"><div class="t1">${U.esc(t.payee)}</div><div class="t2">${t.type === 'transfer' ? U.esc(a.name) + ' → ' + U.esc(S.acc(t.toAccountId).name) : U.esc(c.name)} · ${U.fmtDate(t.date, { year: false })}${t.status === 'pending' ? ' · pending' : ''}</div></div><div class="amt ${t.type === 'income' ? 'in' : ''}">${sign}${U.money(t.amount)}<small>${U.esc(a.name)}</small></div></div>`;
  };

  /* ===================== NET WORTH ===================== */
  LL.V.networth = {
    title: 'Net worth',
    render(root) {
      const series = S.netWorthSeries();
      const now = series[series.length - 1] || { net: 0, assets: 0, liabilities: 0, byType: {} };
      const yr = series[Math.max(0, series.length - 13)] || now;
      const startAsOf = yr.ym ? yr.ym + '-' + U.daysInMonth(yr.ym) : S.asOf();
      const typeName = { bank: 'Bank', savings: 'Savings', cash: 'Cash', wallet: 'Wallets', credit: 'Credit cards', investment: 'Investments', retirement: 'Retirement', property: 'Property', vehicle: 'Vehicles', asset: 'Other assets', receivable: 'Money owed to you', loan: 'Loans' };
      const assets = Object.entries(now.byType).filter(([, v]) => v > 0).map(([k, v]) => ({ label: typeName[k] || k, value: v })).sort((a, b) => b.value - a.value);
      const liab = [
        ...S.state.accounts.filter((a) => a.type === 'credit').map((a) => ({ label: a.name, value: -Math.min(0, S.accountBalance(a.id)), color: 's5', sub: 'Credit card' })),
        ...S.state.debts.filter((d) => d.kind !== 'lent').map((d) => ({ label: d.name, value: S.debtBalance(d), color: 's8', sub: d.rate + '% interest' })),
      ].filter((x) => x.value > 0);
      // waterfall of the last 12 months
      const liquidT = ['bank', 'savings', 'cash', 'wallet', 'credit'];
      const sumType = (types, asOf) => U.sum(S.state.accounts.filter((a) => types.includes(a.type) && !a.archived), (a) => S.accountBalance(a.id, asOf));
      const liqD = sumType(liquidT, S.asOf()) - sumType(liquidT, startAsOf);
      const contrib = U.sum(S.state.holdings.flatMap((h) => h.flows || []).filter((f) => f.date > startAsOf && f.date <= S.asOf()), (f) => f.amount);
      const invD = sumType(['investment', 'retirement'], S.asOf()) - sumType(['investment', 'retirement'], startAsOf);
      const realD = sumType(['property', 'vehicle', 'asset'], S.asOf()) - sumType(['property', 'vehicle', 'asset'], startAsOf);
      const debtD = U.sum(S.state.debts.filter((d) => d.kind !== 'lent'), (d) => S.debtBalance(d, startAsOf) - S.debtBalance(d, S.asOf()));
      const recD = U.sum(S.state.debts.filter((d) => d.kind === 'lent'), (d) => S.debtBalance(d, S.asOf()) - S.debtBalance(d, startAsOf));
      const steps = [{ label: '12 months ago', value: yr.net, total: true }, { label: 'Cash & cards', value: liqD }, { label: 'Invested', value: contrib }, { label: 'Market gains', value: invD - contrib }, { label: 'Property & car', value: realD }, { label: 'Loans repaid', value: debtD }, { label: 'Owed to you', value: recD }].filter((s) => s.total || Math.abs(s.value) > 1);
      // fix starting bar so waterfall runs from start
      const wf = [{ label: '12 months ago', value: yr.net, start: true }, ...steps.slice(1), { label: 'Today', total: true }];
      const milestones = [1e5, 5e5, 1e6, 2.5e6, 5e6, 7.5e6, 1e7, 2.5e7, 5e7, 1e8].map((m) => ({ m, when: (series.find((x) => x.net >= m) || {}).ym })).filter((x) => x.when);
      root.innerHTML = `
        <div class="page-intro"><div><h2>What you own, minus what you owe</h2><p>Bank and card balances come from your transactions; investments use their latest prices; property and vehicles use their last valuation; loans follow their repayment schedule.</p></div></div>
        <div class="grid">
          ${LL.kpi({ cls: 'c3 hero', label: 'Net worth', icon: 'layers', value: now.net, delta: LL.delta(now.net, yr.net, true, 'in 12 months'), spark: C.spark(series.map((x) => x.net), { color: 'var(--accent)' }) })}
          ${LL.kpi({ cls: 'c3', label: 'Total assets', icon: 'up', value: now.assets, delta: LL.delta(now.assets, yr.assets, true, 'in 12 months') })}
          ${LL.kpi({ cls: 'c3', label: 'Total liabilities', icon: 'down', value: now.liabilities, delta: LL.delta(now.liabilities, yr.liabilities, false, 'in 12 months') })}
          ${LL.kpi({ cls: 'c3', label: 'Debt-to-asset ratio', icon: 'debt', kind: 'pct', value: now.assets ? now.liabilities / now.assets : 0, delta: '<span>Under 30% is comfortable</span>' })}
          ${LL.card({ cls: 'c12', title: 'Net worth history', icon: 'trend', sub: 'Hover for the monthly breakdown', body: '<div id="nw-line"></div>' })}
          ${LL.card({ cls: 'c7', title: 'What changed in the last 12 months', icon: 'bar', sub: 'Each bar is one driver of the change', body: '<div id="nw-wf"></div>' })}
          ${LL.card({ cls: 'c5', title: 'Asset mix', icon: 'pie', body: '<div id="nw-assets"></div>' })}
          ${LL.card({ cls: 'c6', title: 'Liabilities', icon: 'debt', sub: 'Balance owed today', body: '<div id="nw-liab"></div>' })}
          ${LL.card({ cls: 'c6', title: 'Milestones', icon: 'target', sub: 'When your net worth first crossed each mark', body: `<div class="list">${milestones.length ? milestones.map((x) => `<div class="row"><div class="av">${I('check', 16)}</div><div><div class="t1">${U.short(x.m)}</div><div class="t2">${x.when === series[0].ym ? 'Already above it when tracking began' : 'Crossed in ' + U.monLabel(x.when, true)}</div></div><div class="amt"></div></div>`).join('') : '<p class="muted">No milestones yet.</p>'}</div>` })}
          ${LL.card({ cls: 'c12', title: 'Every account', icon: 'wallet', body: `<div class="table-wrap"><table class="tbl"><thead><tr><th>Account</th><th>Type</th><th class="r">12 months ago</th><th class="r">Today</th><th class="r">Change</th><th>Trend</th></tr></thead><tbody>${S.state.accounts.filter((a) => !a.archived).map((a) => { const b0 = S.accountBalance(a.id, startAsOf), b1 = S.accountBalance(a.id); const tr = S.months(12).map((m) => S.accountBalance(a.id, m === S.curYM() ? S.asOf() : m + '-' + U.daysInMonth(m))); return `<tr><td><b>${U.esc(a.name)}</b></td><td>${typeName[a.type] || a.type}</td><td class="r">${U.money(b0)}</td><td class="r">${U.money(b1)}</td><td class="r ${b1 - b0 >= 0 ? 'up' : 'down'}">${U.money(b1 - b0, { sign: true })}</td><td>${C.spark(tr, { w: 100, h: 26, color: 'var(--' + (a.color || 's1') + ')' })}</td></tr>`; }).join('')}</tbody></table></div>` })}
        </div>`;
      C.track(() => C.line(U.$('#nw-line', root), { labels: series.map((x) => U.monLabel(x.ym, true)), series: [{ name: 'Net worth', values: series.map((x) => x.net), color: 's1', area: true }, { name: 'Assets', values: series.map((x) => x.assets), color: 's3' }, { name: 'Liabilities', values: series.map((x) => x.liabilities), color: 's8' }], h: 300 }));
      C.track(() => C.waterfall(U.$('#nw-wf', root), wf, { h: 280 }));
      C.donut(U.$('#nw-assets', root), assets, { centerLabel: 'Assets', size: 210 });
      C.hbars(U.$('#nw-liab', root), liab);
    },
  };

  /* ===================== CASH FLOW ===================== */
  LL.V.cashflow = {
    title: 'Cash flow',
    render(root, p) {
      let range = p.range || 'last';
      root.innerHTML = `
        <div class="page-intro"><div><h2>Money in, money out</h2><p>Transfers between your own accounts are left out, so this shows only real income and spending.</p></div>${LL.seg('cf-range', [['mtd', 'This month'], ['last', 'Last month'], ['3m', '3 months'], ['12m', '12 months'], ['ytd', 'Year to date']], range)}</div>
        <div class="grid" id="cf-kpis"></div>
        <div class="grid" style="margin-top:16px">
          ${LL.card({ cls: 'c12', title: 'Flow of money', icon: 'flow', sub: 'Income sources on the left, where it went on the right', body: '<div id="cf-sankey"></div>' })}
          ${LL.card({ cls: 'c12', title: 'Monthly income and spending', icon: 'bar', sub: 'All history', body: '<div id="cf-bars"></div>' })}
          ${LL.card({ cls: 'c6', title: 'Net cash flow', icon: 'trend', sub: 'Income minus spending, per month', body: '<div id="cf-net"></div>' })}
          ${LL.card({ cls: 'c6', title: 'Savings rate', icon: 'coin', sub: 'Share of income kept each month', body: '<div id="cf-rate"></div>' })}
          ${LL.card({ cls: 'c6', title: 'Income sources', icon: 'coin', body: '<div id="cf-src"></div>' })}
          ${LL.card({ cls: 'c6', title: 'Biggest spending categories', icon: 'receipt', body: '<div id="cf-cats"></div>' })}
        </div>`;
      const draw = () => {
        const [from, to] = S.rangeFor(range);
        const tx = S.inRange(from, to);
        const inc = tx.filter(S.isIncome), ex = tx.filter(S.isExpense);
        const ti = U.sum(inc, (t) => t.amount), te = U.sum(ex, (t) => t.amount);
        U.$('#cf-kpis', root).innerHTML = [
          LL.kpi({ cls: 'c3', label: 'Money in', icon: 'up', value: ti, delta: `<span>${inc.length} credits</span>` }),
          LL.kpi({ cls: 'c3', label: 'Money out', icon: 'down', value: te, delta: `<span>${ex.length} payments</span>` }),
          LL.kpi({ cls: 'c3 hero', label: 'Net', icon: 'coin', value: ti - te, delta: `<span>${U.fmtDate(from)} – ${U.fmtDate(to)}</span>` }),
          LL.kpi({ cls: 'c3', label: 'Savings rate', icon: 'shield', kind: 'pct', value: ti ? (ti - te) / ti : 0, delta: '<span>20% or more is healthy</span>' }),
        ].join('');
        U.countUp(U.$('#cf-kpis', root)); U.tilt(U.$('#cf-kpis', root));
        const byInc = U.groupBy(inc, (t) => t.categoryId), byG = U.groupBy(ex, (t) => S.cat(t.categoryId).group);
        const left = [...byInc.entries()].map(([c, a], i) => ({ label: S.cat(c).name, value: U.sum(a, (t) => t.amount), color: 's' + ((i % 3) + 3) })).sort((a, b) => b.value - a.value);
        const right = [...byG.entries()].map(([g, a]) => ({ label: g, value: U.sum(a, (t) => t.amount) })).sort((a, b) => b.value - a.value);
        const small = right.filter((x) => x.value < Math.max(ti, te) * 0.03);
        if (small.length > 1) { right.splice(right.length - small.length, small.length, { label: 'Other (' + small.length + ' groups)', value: U.sum(small, (x) => x.value) }); }
        if (ti > te) right.push({ label: 'Kept / saved', value: ti - te, color: 'var(--good)' });
        C.track(() => C.sankey(U.$('#cf-sankey', root), { left, right, hub: 'Income', h: Math.max(320, right.length * 34) }));
        C.hbars(U.$('#cf-src', root), left.map((x) => ({ ...x, sub: U.pct(x.value / (ti || 1)) + ' of income' })));
        const byC = [...U.groupBy(ex, (t) => t.categoryId).entries()].map(([c, a], i) => ({ label: S.cat(c).name, value: U.sum(a, (t) => t.amount), sub: a.length + ' payments · ' + U.pct(U.sum(a, (t) => t.amount) / (te || 1)), color: C.series(i % 8), id: c })).sort((a, b) => b.value - a.value).slice(0, 10);
        C.hbars(U.$('#cf-cats', root), byC, { onClick: (it) => (location.hash = 'transactions?category=' + it.id) });
      };
      const ms = S.months();
      C.track(() => C.bars(U.$('#cf-bars', root), { labels: ms.map((m) => U.monLabel(m)), tipLabels: ms.map((m) => U.monLabel(m, true)), series: [{ name: 'Income', values: ms.map((m) => S.month(m).income), color: 's3' }, { name: 'Spending', values: ms.map((m) => S.month(m).expense), color: 's2' }], h: 260 }));
      C.track(() => { const net = ms.map((m) => S.month(m).income - S.month(m).expense); C.bars(U.$('#cf-net', root), { labels: ms.map((m) => U.monLabel(m)), tipLabels: ms.map((m) => U.monLabel(m, true)), series: [{ name: 'Net', values: net, colors: net.map((v) => (v >= 0 ? 'var(--good)' : 'var(--bad)')) }], h: 220 }); });
      C.track(() => C.line(U.$('#cf-rate', root), { labels: ms.map((m) => U.monLabel(m, true)), series: [{ name: 'Savings rate', values: ms.map((m) => { const x = S.month(m); return x.income ? ((x.income - x.expense) / x.income) * 100 : 0; }), color: 's7', area: true }], fmt: (v) => v + '%', tipFmt: (v) => v.toFixed(1) + '%', h: 220 }));
      draw();
      LL.wireSeg(root, 'cf-range', (v) => { range = v; draw(); });
    },
  };

  /* ===================== HEALTH ===================== */
  LL.V.health = {
    title: 'Health score',
    render(root) {
      const h = A.health();
      const tips = {
        'Savings rate': 'Automate a transfer to savings on payday so saving happens before spending.',
        'Emergency runway': 'Park three to six months of spending in a separate savings account you do not touch.',
        'Debt load (EMI ÷ income)': 'Prepay the highest-interest loan first; even one extra EMI a year shortens it noticeably.',
        'Budget discipline': 'Raise budgets that break every month to a realistic level, then trim slowly.',
        'Card utilisation': 'Pay cards in full each month and keep balances under 10% of the limit.',
        'Net worth growth (6m)': 'Growth comes from saving more, investing consistently and paying down debt.',
      };
      const weakest = [...h.parts].sort((a, b) => a.v - b.v).slice(0, 3);
      root.innerHTML = `
        <div class="page-intro"><div><h2>How healthy are your finances?</h2><p>A 0–100 score made from six signals, each weighted by how much it protects you. It updates as your data changes.</p></div></div>
        <div class="grid">
          ${LL.card({ cls: 'c5', title: 'Your score', icon: 'heart', body: `<div class="center" id="h-g"></div><div class="center" style="margin-top:6px"><span class="pill ${h.score >= 65 ? 'good' : h.score >= 45 ? 'warn' : 'bad'}">${h.label}</span></div>` })}
          ${LL.card({ cls: 'c7', title: 'Signal balance', icon: 'spark', sub: 'Each axis is 0–100% of full marks', body: '<div id="h-r"></div>' })}
          ${LL.card({ cls: 'c12', title: 'The six signals', icon: 'sliders', body: `<div class="list" style="gap:16px">${h.parts.map((p) => `<div><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px"><b>${p.k} <span class="muted">· weight ${p.w}</span></b><span><span class="num">${p.show}</span> · <span class="muted">${Math.round(p.v * p.w)} / ${p.w} pts</span></span></div><div class="bar-track"><div class="bar-fill" style="--w:${p.v * 100}%;--c:${p.v >= 0.7 ? 'var(--good)' : p.v >= 0.4 ? 'var(--warn)' : 'var(--bad)'}"></div></div><div class="kbd-hint" style="margin-top:4px">${p.tip}</div></div>`).join('')}</div>` })}
          ${LL.card({ cls: 'c12', title: 'Do these next', icon: 'bolt', sub: 'Your three weakest signals', body: `<div class="grid">${weakest.map((p, i) => `<div class="card c4 rise" style="background:var(--surface-2)"><div class="lab-num">Step ${i + 1}</div><h3 style="margin:6px 0">${p.k}</h3><p class="muted-p">${tips[p.k]}</p><div class="kbd-hint" style="margin-top:8px">Worth up to ${Math.round((1 - p.v) * p.w)} more points</div></div>`).join('')}</div>` })}
        </div>`;
      C.gauge(U.$('#h-g', root), { value: h.score, label: 'out of 100' });
      C.radar(U.$('#h-r', root), { axes: h.parts.map((p) => p.k.split(' (')[0].replace('Net worth growth', 'Growth')), series: [{ name: 'You', values: h.parts.map((p) => p.v), color: 's3' }], size: 320 });
    },
  };
})(window.LL);
