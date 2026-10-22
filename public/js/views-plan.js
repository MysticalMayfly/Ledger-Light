/* Ledgerlight — planning pages: goals, debts & loans, investments, forecast & scenarios */
(function (LL) {
  'use strict';
  const U = LL.U, S = LL.S, C = LL.C, I = LL.I;
  const COLORS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((c, i) => ({ value: c, label: ['Blue', 'Orange', 'Aqua', 'Amber', 'Pink', 'Green', 'Violet', 'Red'][i] }));
  const monthsLeft = (iso) => Math.max(0, U.daysBetween(S.asOf(), iso) / 30.44);

  /* ===================== GOALS ===================== */
  LL.V.goals = {
    title: 'Goals',
    render(root) {
      const goals = S.state.goals;
      const tot = U.sum(goals, (g) => g.target), saved = U.sum(goals, (g) => Math.min(g.saved, g.target));
      const info = goals.map((g) => {
        const left = Math.max(0, g.target - g.saved), ml = monthsLeft(g.deadline);
        const need = ml > 0 ? left / ml : left;
        const etaM = g.monthly > 0 ? left / g.monthly : Infinity;
        const eta = isFinite(etaM) ? U.addMonths(S.asOf(), Math.ceil(etaM)) : null;
        const status = left <= 0 ? ['good', 'Reached'] : !g.monthly ? ['bad', 'No plan'] : g.monthly >= need * 0.98 ? ['good', 'On track'] : ['warn', 'Behind'];
        return { g, left, ml, need, eta, status, r: g.target ? g.saved / g.target : 0 };
      });
      root.innerHTML = `
        <div class="page-intro"><div><h2>Save with a purpose</h2><p>Each goal shows how much you need to put away each month to hit its date, and when you will get there at your current pace.</p></div><div class="toolbar"><button class="btn primary" id="g-new">${I('plus', 16)}New goal</button></div></div>
        <div class="grid">
          ${LL.kpi({ cls: 'c3 hero', label: 'Saved toward goals', icon: 'target', value: saved, delta: `<span>${U.pct(tot ? saved / tot : 0)} of ${U.short(tot)}</span>` })}
          ${LL.kpi({ cls: 'c3', label: 'Still to save', icon: 'coin', value: tot - saved })}
          ${LL.kpi({ cls: 'c3', label: 'Needed per month', icon: 'calendar', value: U.sum(info.filter((x) => x.left > 0), (x) => x.need), delta: `<span>Planned ${U.money(U.sum(goals, (g) => g.monthly || 0))}</span>` })}
          ${LL.kpi({ cls: 'c3', label: 'On track', icon: 'check', kind: 'num', value: info.filter((x) => x.status[0] === 'good').length, delta: `<span>of ${goals.length} goals</span>` })}
        </div>
        <div class="grid" style="margin-top:16px">${info.map((x) => `
          <section class="card goal-card c4 rise tilt ${x.left <= 0 ? 'done' : ''}" data-id="${x.g.id}">
            <div class="g-top">${C.ring(x.r, { size: 70, sw: 8, color: 'var(--' + (x.g.color || 's1') + ')', label: Math.round(Math.min(1, x.r) * 100) + '%' })}<div style="min-width:0;flex:1"><b>${U.esc(x.g.name)}</b><div class="kbd-hint">Target ${U.fmtDate(x.g.deadline)} · ${x.ml >= 1 ? Math.round(x.ml) + ' months left' : x.left > 0 ? 'due now' : 'complete'}</div><div style="margin-top:6px"><span class="pill ${x.status[0]}">${x.status[1]}</span></div></div></div>
            <div style="display:flex;justify-content:space-between;align-items:end;margin-top:12px"><div><div class="g-amt">${U.money(x.g.saved)}</div><div class="kbd-hint">of ${U.money(x.g.target)}</div></div>${C.spark((x.g.history || []).map((h) => h.saved), { w: 110, h: 34, color: 'var(--' + (x.g.color || 's1') + ')' })}</div>
            <div class="stats" style="margin-top:12px"><div class="stat"><div class="s-l">Need / month</div><div class="s-v">${x.left > 0 ? U.short(x.need) : '—'}</div></div><div class="stat"><div class="s-l">Plan / month</div><div class="s-v">${U.short(x.g.monthly || 0)}</div></div><div class="stat"><div class="s-l">At this pace</div><div class="s-v">${x.left <= 0 ? 'Done' : x.eta ? U.monLabel(U.ym(x.eta), true) : 'Never'}</div></div></div>
            <div class="toolbar" style="margin-top:12px"><button class="btn sm primary" data-add="${x.g.id}" ${x.left <= 0 ? 'disabled' : ''}>${I('plus', 14)}Add money</button><button class="btn sm ghost" data-edit="${x.g.id}">${I('edit', 14)}Edit</button></div>
          </section>`).join('') || `<div class="c12">${LL.emptyState('target', 'No goals yet', 'An emergency fund is a great first goal: three to six months of spending.', '<button class="btn primary" onclick="document.getElementById(\'g-new\').click()">Create a goal</button>')}</div>`}</div>
        ${goals.length ? `<div class="grid" style="margin-top:16px">${LL.card({ cls: 'c8', title: 'Projected progress', icon: 'forecast', sub: 'Saved amount at your planned monthly pace, as % of target', body: '<div id="g-proj"></div>' })}
          ${LL.card({ cls: 'c4', title: 'What if you saved more?', icon: 'sliders', body: `<div class="field"><label for="g-wi">Goal</label><select id="g-wi">${info.filter((x) => x.left > 0).map((x) => `<option value="${x.g.id}">${U.esc(x.g.name)}</option>`).join('')}</select></div><div class="slider-row" style="margin-top:14px"><div class="sl-h"><span>Extra each month</span><b id="g-wv"></b></div><input type="range" id="g-ws" min="0" max="50000" step="500" value="5000"></div><div class="calc-out" style="margin-top:16px" id="g-wo"></div>` })}</div>` : ''}`;
      const edit = (g) => LL.editRecord({ col: 'goals', title: g ? 'Edit goal' : 'New goal', rec: g || { color: 's1', deadline: U.addMonths(S.asOf(), 12), saved: 0 }, fields: [{ key: 'name', label: 'Goal name', required: true }, { key: 'target', label: 'Target amount', type: 'number', required: true, half: true }, { key: 'saved', label: 'Saved so far', type: 'number', half: true }, { key: 'deadline', label: 'Target date', type: 'date', half: true }, { key: 'monthly', label: 'Planned per month', type: 'number', half: true }, { key: 'color', label: 'Colour', type: 'select', options: COLORS, half: true }], onSave: (v) => { v.saved = +v.saved || 0; v.history = v.history || [{ ym: S.curYM(), saved: v.saved }]; return v; } });
      U.$('#g-new', root).onclick = () => edit();
      U.on(root, 'click', '[data-edit]', (e, b) => edit(S.get('goals', b.dataset.edit)));
      U.on(root, 'click', '[data-add]', (e, b) => {
        const g = S.get('goals', b.dataset.add);
        const f = U.form([{ key: 'amount', label: 'Amount to add', type: 'number', required: true, default: g.monthly || '' }, { key: 'from', label: 'Record as transfer from (optional)', type: 'select', options: [{ value: '', label: 'Do not record a transaction' }, ...LL.accOptions((a) => ['bank', 'savings', 'cash', 'wallet'].includes(a.type))] }, { key: 'to', label: 'To account', type: 'select', options: LL.accOptions((a) => a.type !== 'credit') }]);
        U.modal({ title: 'Add to ' + g.name, body: f, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Add', kind: 'primary', onClick: () => {
          if (!f.check()) return false;
          const v = f.read(); const amt = +v.amount;
          g.saved = U.round(g.saved + amt);
          const h = g.history || (g.history = []); const last = h[h.length - 1];
          if (last && last.ym === S.curYM()) last.saved = g.saved; else h.push({ ym: S.curYM(), saved: g.saved });
          if (v.from && v.to && v.from !== v.to) S.upsert('transactions', { type: 'transfer', amount: amt, accountId: v.from, toAccountId: v.to, categoryId: 'cat_transfer', payee: 'Goal: ' + g.name, date: U.today(), time: new Date().toTimeString().slice(0, 5), tags: ['goal'], status: 'cleared' });
          S.touch('goals');
          U.toast(g.saved >= g.target ? 'Goal reached: ' + g.name + '!' : 'Added ' + U.money(amt));
          if (g.saved >= g.target) LL.confetti();
        } }] });
      });
      if (!goals.length) return;
      C.track(() => {
        const ms = [...Array(25).keys()].map((k) => U.ymAdd(S.curYM(), k));
        C.line(U.$('#g-proj', root), { labels: ms.map((m) => U.monLabel(m, true)), series: info.map((x) => ({ name: x.g.name, color: x.g.color, values: ms.map((m, k) => Math.min(100, ((x.g.saved + (x.g.monthly || 0) * k) / x.g.target) * 100)) })), fmt: (v) => v + '%', tipFmt: (v) => v.toFixed(0) + '%', h: 280, zero: true });
      });
      const wi = () => {
        const g = S.get('goals', U.$('#g-wi', root).value); if (!g) return;
        const extra = +U.$('#g-ws', root).value; U.$('#g-wv', root).textContent = U.money(extra);
        const left = g.target - g.saved, base = g.monthly ? left / g.monthly : Infinity, now = left / ((g.monthly || 0) + extra || 1);
        U.$('#g-wo', root).innerHTML = `<div class="kbd-hint">You would reach it in</div><div class="big">${isFinite(now) ? Math.ceil(now) + ' months' : '—'}</div><div class="muted-p">${isFinite(base) ? `${Math.max(0, Math.ceil(base) - Math.ceil(now))} months sooner than your current plan (${U.monLabel(U.ym(U.addMonths(S.asOf(), Math.ceil(now))), true)} instead of ${U.monLabel(U.ym(U.addMonths(S.asOf(), Math.ceil(base))), true)}).` : 'There is no monthly plan for this goal yet.'}</div>`;
      };
      U.$('#g-wi', root) && (U.$('#g-wi', root).onchange = wi, U.$('#g-ws', root).oninput = wi, wi());
    },
  };
  LL.confetti = () => {
    if (U.reduced) return;
    const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;z-index:400;pointer-events:none'; cv.width = innerWidth; cv.height = innerHeight; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const cols = ['--accent', '--s1', '--s2', '--s3', '--s5', '--s7'].map((v) => cs.getPropertyValue(v).trim());
    const ps = [...Array(160)].map(() => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - 0.5) * 16, vy: Math.random() * -14 - 4, r: Math.random() * 6 + 3, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6 }));
    let f = 0; const tick = () => { ctx.clearRect(0, 0, cv.width, cv.height); ps.forEach((p) => { p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.a += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); }); if (f++ < 140) requestAnimationFrame(tick); else cv.remove(); };
    tick();
  };

  /* ===================== DEBTS & LOANS ===================== */
  const simulate = (debts, extra, strategy) => {
    // month-by-month payoff of all owed debts with an extra monthly amount
    let ds = debts.map((d) => ({ id: d.id, name: d.name, bal: S.debtBalance(d), rate: d.rate / 1200, emi: d.emi || d.minPayment || S.debtBalance(d) * 0.03 })).filter((d) => d.bal > 1);
    const out = []; let interest = 0, m = 0;
    const payoff = {};
    while (ds.some((d) => d.bal > 1) && m < 600) {
      m++;
      let pool = extra;
      ds.forEach((d) => { if (d.bal <= 1) { pool += d.emi; return; } const i = d.bal * d.rate; interest += i; d.bal += i; const pay = Math.min(d.bal, d.emi); d.bal -= pay; if (pay < d.emi) pool += d.emi - pay; });
      const order = ds.filter((d) => d.bal > 1).sort((a, b) => (strategy === 'snowball' ? a.bal - b.bal : b.rate - a.rate));
      for (const d of order) { if (pool <= 0) break; const pay = Math.min(pool, d.bal); d.bal -= pay; pool -= pay; }
      ds.forEach((d) => { if (d.bal <= 1 && !payoff[d.id]) payoff[d.id] = m; });
      out.push(U.sum(ds, (d) => Math.max(0, d.bal)));
    }
    return { months: m, interest, series: out, payoff };
  };
  LL.V.debts = {
    title: 'Debts & loans',
    render(root) {
      const owed = S.state.debts.filter((d) => d.kind !== 'lent');
      const lent = S.state.debts.filter((d) => d.kind === 'lent');
      const cards = S.state.accounts.filter((a) => a.type === 'credit' && S.accountBalance(a.id) < 0);
      const totalOwed = U.sum(owed, (d) => S.debtBalance(d)) + S.cardDebt();
      const emis = U.sum(owed.filter((d) => S.debtBalance(d) > 0), (d) => d.emi || 0);
      const base = simulate(owed, 0, 'avalanche');
      const freeDate = U.addMonths(S.asOf(), base.months);
      root.innerHTML = `
        <div class="page-intro"><div><h2>Owe less, sooner</h2><p>Balances follow each loan's amortisation schedule. Use the payoff planner to see how extra payments change your debt-free date and the interest you pay.</p></div><div class="toolbar"><button class="btn primary" id="d-new">${I('plus', 16)}Add loan or IOU</button></div></div>
        <div class="grid">
          ${LL.kpi({ cls: 'c3 hero', label: 'Total owed', icon: 'debt', value: totalOwed, delta: `<span>Loans + ${U.short(S.cardDebt())} on cards</span>` })}
          ${LL.kpi({ cls: 'c3', label: 'Monthly EMIs', icon: 'calendar', value: emis, delta: `<span>${U.pct(emis / (U.avg(S.months(4).slice(0, 3).map((m) => S.month(m).income)) || 1))} of income</span>` })}
          ${LL.kpi({ cls: 'c3', label: 'Interest still to pay', icon: 'alert', value: base.interest })}
          ${LL.kpi({ cls: 'c3', label: 'Debt-free', icon: 'check', kind: 'num', value: Math.round(base.months / 12 * 10) / 10, delta: `<span>years · ${U.monLabel(U.ym(freeDate), true)}</span>` })}
        </div>
        <div class="grid" style="margin-top:16px">${owed.map((d, i) => { const b = S.debtBalance(d), paid = d.principal ? 1 - b / d.principal : 0, sch = S.debtSchedule(d), rem = sch.filter((x) => x.date > S.asOf()); return `
          <section class="card c4 rise tilt" data-id="${d.id}" style="cursor:pointer"><div class="card-h"><span class="ico-wrap">${I(d.type === 'mortgage' ? 'house' : d.type === 'auto' ? 'car' : 'debt', 16)}</span><div><h3>${U.esc(d.name)}</h3><div class="sub">${U.esc(d.lender || '')} · ${d.rate}% · ${U.money(d.emi || 0)}/mo</div></div></div>
          <div class="g-amt" data-count="${b}">${U.money(b)}</div><div class="kbd-hint">left of ${U.money(d.principal)}</div>
          <div class="bar-track" style="margin-top:12px"><div class="bar-fill" style="--w:${paid * 100}%;--c:${C.col(d.color, i)}"></div></div>
          <div class="stats" style="margin-top:12px"><div class="stat"><div class="s-l">Paid off</div><div class="s-v">${U.pct(paid)}</div></div><div class="stat"><div class="s-l">EMIs left</div><div class="s-v">${rem.length}</div></div><div class="stat"><div class="s-l">Ends</div><div class="s-v">${rem.length ? U.monLabel(U.ym(rem[rem.length - 1].date), true) : '—'}</div></div></div></section>`; }).join('')}
          ${cards.map((a) => `<section class="card c4 rise tilt"><div class="card-h"><span class="ico-wrap">${I('card', 16)}</span><div><h3>${U.esc(a.name)}</h3><div class="sub">Credit card · due on the ${a.dueDay || 18}th</div></div></div><div class="g-amt">${U.money(-S.accountBalance(a.id))}</div><div class="kbd-hint">statement balance; pay in full to avoid interest</div></section>`).join('')}
        </div>
        ${owed.length ? `<div class="grid" style="margin-top:16px">
          ${LL.card({ cls: 'c8', title: 'Where each EMI goes', icon: 'bar', sub: 'Principal vs interest per year', right: `<select id="d-sel" style="max-width:200px">${owed.map((d) => `<option value="${d.id}">${U.esc(d.name)}</option>`).join('')}</select>`, body: '<div id="d-amort"></div>' })}
          ${LL.card({ cls: 'c4', title: 'Balance remaining', icon: 'trend', body: '<div id="d-bal"></div>' })}
          ${LL.card({ cls: 'c12', title: 'Payoff planner', icon: 'sliders', sub: 'Add an extra amount each month and choose which loan it attacks first', body: `<div class="grid"><div class="c4"><div class="slider-row"><div class="sl-h"><span>Extra payment per month</span><b id="pp-v"></b></div><input type="range" id="pp-x" min="0" max="60000" step="1000" value="10000"></div><div style="margin-top:14px">${LL.seg('pp-s', [['avalanche', 'Highest interest first'], ['snowball', 'Smallest balance first']], 'avalanche')}</div><div class="calc-out" id="pp-o" style="margin-top:16px"></div></div><div class="c8" id="pp-chart"></div></div>` })}
        </div>` : ''}
        ${lent.length ? `<div class="section-h"><h2>Personal IOUs</h2><p>Money you lent or borrowed from people</p></div><div class="grid">${lent.map((d) => `<section class="card c4 rise" data-id="${d.id}" style="cursor:pointer"><div class="card-h"><span class="ico-wrap">${I('heart', 16)}</span><div><h3>${U.esc(d.name)}</h3><div class="sub">${U.esc(d.notes || '')}</div></div></div><div class="g-amt">${U.money(S.debtBalance(d))}</div><div class="kbd-hint">still owed to you of ${U.money(d.principal)}</div></section>`).join('')}</div>` : ''}`;
      const edit = (d) => LL.editRecord({ col: 'debts', title: d ? 'Edit ' + d.name : 'New loan or IOU', rec: d || { kind: 'owed', type: 'personal', startDate: U.today(), color: 's8' }, fields: [{ key: 'name', label: 'Name', required: true }, { key: 'kind', label: 'Direction', type: 'select', options: [{ value: 'owed', label: 'I owe this' }, { value: 'lent', label: 'Someone owes me' }], half: true }, { key: 'type', label: 'Type', type: 'select', options: [['mortgage', 'Home loan'], ['auto', 'Car loan'], ['education', 'Education loan'], ['personal', 'Personal loan / IOU'], ['other', 'Other']].map(([v, l]) => ({ value: v, label: l })), half: true }, { key: 'lender', label: 'Lender or person', half: true }, { key: 'principal', label: 'Original amount', type: 'number', required: true, half: true }, { key: 'rate', label: 'Interest rate % per year', type: 'number', step: '0.01', half: true, default: 0 }, { key: 'tenure', label: 'Tenure (months, 0 for IOU)', type: 'number', half: true, default: 0 }, { key: 'startDate', label: 'Start date', type: 'date', half: true }, { key: 'balanceManual', label: 'Current balance (for IOUs)', type: 'number', half: true }, { key: 'notes', label: 'Notes', type: 'textarea' }], onSave: (v) => { v.principal = +v.principal; v.rate = +v.rate || 0; v.tenure = +v.tenure || 0; if (v.tenure) { const r = v.rate / 1200; v.emi = Math.round(r ? (v.principal * r * Math.pow(1 + r, v.tenure)) / (Math.pow(1 + r, v.tenure) - 1) : v.principal / v.tenure); delete v.balanceManual; } else if (v.balanceManual == null) v.balanceManual = v.principal; return v; } });
      U.$('#d-new', root).onclick = () => edit();
      U.on(root, 'click', '.card[data-id]', (e, c) => edit(S.get('debts', c.dataset.id)));
      if (!owed.length) return;
      const drawLoan = () => {
        const d = S.get('debts', U.$('#d-sel', root).value), sch = S.debtSchedule(d);
        const years = [...new Set(sch.map((x) => x.date.slice(0, 4)))];
        const pr = years.map((y) => U.sum(sch.filter((x) => x.date.startsWith(y)), (x) => x.principal)), it = years.map((y) => U.sum(sch.filter((x) => x.date.startsWith(y)), (x) => x.interest));
        const nowY = S.asOf().slice(0, 4);
        C.track(() => C.bars(U.$('#d-amort', root), { labels: years.map((y) => "'" + y.slice(2)), tipLabels: years, stacked: true, series: [{ name: 'Principal', values: pr, color: 's3' }, { name: 'Interest', values: it, color: 's2' }], h: 260, highlight: years.indexOf(nowY) }));
        C.track(() => C.line(U.$('#d-bal', root), { labels: years, series: [{ name: 'Balance', values: years.map((y) => { const l = sch.filter((x) => x.date.startsWith(y)); return l.length ? l[l.length - 1].balance : 0; }), color: 's8', area: true }], marker: years.indexOf(nowY), h: 260 }));
      };
      U.$('#d-sel', root).onchange = drawLoan; drawLoan();
      let strat = 'avalanche';
      const plan = () => {
        const x = +U.$('#pp-x', root).value; U.$('#pp-v', root).textContent = U.money(x);
        const sim = simulate(owed, x, strat);
        U.$('#pp-o', root).innerHTML = `<div class="kbd-hint">Debt-free in</div><div class="big">${(sim.months / 12).toFixed(1)} years</div><div class="muted-p">${U.monLabel(U.ym(U.addMonths(S.asOf(), sim.months)), true)} instead of ${U.monLabel(U.ym(freeDate), true)}. You save <b class="up">${U.money(base.interest - sim.interest)}</b> in interest and finish <b>${base.months - sim.months} months</b> sooner.</div><div class="mini-list" style="margin-top:8px">${owed.map((d) => `<div class="ml-row"><span>${U.esc(d.name)}</span><span class="muted">paid off</span><b>${sim.payoff[d.id] ? U.monLabel(U.ym(U.addMonths(S.asOf(), sim.payoff[d.id])), true) : '—'}</b></div>`).join('')}</div>`;
        const n = Math.max(base.series.length, sim.series.length);
        const step = Math.max(1, Math.ceil(n / 60));
        const idx = [...Array(Math.ceil(n / step)).keys()].map((k) => k * step);
        C.track(() => C.line(U.$('#pp-chart', root), { labels: idx.map((k) => U.monLabel(U.ym(U.addMonths(S.asOf(), k)), true)), series: [{ name: 'Current plan', values: idx.map((k) => base.series[k] != null ? base.series[k] : 0), color: 's8' }, { name: 'With extra payments', values: idx.map((k) => sim.series[k] != null ? sim.series[k] : 0), color: 's3', area: true }], h: 280 }));
      };
      U.$('#pp-x', root).oninput = plan;
      LL.wireSeg(root, 'pp-s', (v) => { strat = v; plan(); });
      plan();
    },
  };

  /* ===================== INVESTMENTS ===================== */
  const CLASS = (h) => h.type === 'Crypto' ? 'Crypto' : h.type === 'Gold' ? 'Gold' : ['Fixed Deposit', 'Retirement', 'Bond'].includes(h.type) || h.sector === 'Debt' ? 'Debt' : h.sector === 'International' ? 'Global equity' : 'Equity';
  LL.xirr = (flows) => {
    // flows: [{date, amount}] negative = money in, positive = value out
    if (flows.length < 2) return 0;
    const t0 = U.d(flows[0].date);
    const yrs = flows.map((f) => (U.d(f.date) - t0) / (365.25 * 864e5));
    const npv = (r) => U.sum(flows.map((f, i) => f.amount / Math.pow(1 + r, yrs[i])));
    let lo = -0.95, hi = 5;
    if (npv(lo) * npv(hi) > 0) return 0;
    for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  };
  const hXirr = (h) => { const fl = (h.flows || []).map((f) => ({ date: f.date, amount: -f.amount })).sort((a, b) => (a.date < b.date ? -1 : 1)); fl.push({ date: S.asOf(), amount: S.holdingValue(h) }); return LL.xirr(fl); };
  LL.V.investments = {
    title: 'Investments',
    render(root) {
      const H = S.state.holdings;
      const val = U.sum(H, (h) => S.holdingValue(h)), cost = U.sum(H, (h) => S.holdingCost(h));
      const allFlows = H.flatMap((h) => (h.flows || []).map((f) => ({ date: f.date, amount: -f.amount }))).sort((a, b) => (a.date < b.date ? -1 : 1));
      const port = allFlows.length ? LL.xirr([...allFlows, { date: S.asOf(), amount: val }]) : 0;
      const div12 = U.sum(S.inRange(...S.rangeFor('12m'), (t) => t.categoryId === 'cat_dividends'), (t) => t.amount);
      const meta = S.state.meta; meta.targetAlloc = meta.targetAlloc || { Equity: 55, 'Global equity': 10, Debt: 25, Gold: 7, Crypto: 3 };
      root.innerHTML = `
        <div class="page-intro"><div><h2>Your portfolio</h2><p>Returns are money-weighted (XIRR), so they account for when you invested. Update prices manually; nothing is fetched from the internet.</p></div><div class="toolbar"><button class="btn" id="i-prices">${I('edit', 16)}Update prices</button><button class="btn primary" id="i-new">${I('plus', 16)}Add holding</button></div></div>
        <div class="grid">
          ${LL.kpi({ cls: 'c3 hero', label: 'Portfolio value', icon: 'trend', value: val, spark: C.spark(S.months(12).map((m) => U.sum(H, (h) => S.holdingValue(h, m === S.curYM() ? S.asOf() : m + '-' + U.daysInMonth(m)))), { color: 'var(--accent)' }) })}
          ${LL.kpi({ cls: 'c3', label: 'Total invested', icon: 'coin', value: cost })}
          ${LL.kpi({ cls: 'c3', label: 'Unrealised gain', icon: 'up', value: val - cost, delta: `<span class="${val >= cost ? 'up' : 'down'}">${U.pct(cost ? (val - cost) / cost : 0, 1)} total return</span>` })}
          ${LL.kpi({ cls: 'c3', label: 'XIRR (annualised)', icon: 'spark', kind: 'pct', value: port, delta: `<span>Dividends ${U.short(div12)} in 12 months</span>` })}
          ${LL.card({ cls: 'c8', title: 'Value vs money put in', icon: 'trend', sub: 'The gap is your market gain', body: '<div id="i-line"></div>' })}
          ${LL.card({ cls: 'c4', title: 'Allocation', icon: 'pie', right: LL.seg('i-al', [['class', 'Class'], ['sector', 'Sector'], ['region', 'Region']], 'class'), body: '<div id="i-donut"></div>' })}
          ${LL.card({ cls: 'c12', title: 'Holdings', icon: 'list', body: `<div class="table-wrap"><table class="tbl"><thead><tr><th>Holding</th><th>Class</th><th class="r">Units</th><th class="r">Avg cost</th><th class="r">Price</th><th class="r">Value</th><th class="r">Gain</th><th class="r">XIRR</th><th class="r">Weight</th><th>12-mo price</th></tr></thead><tbody>${H.slice().sort((a, b) => S.holdingValue(b) - S.holdingValue(a)).map((h) => { const v = S.holdingValue(h), c = S.holdingCost(h), x = hXirr(h); return `<tr class="clickable" data-id="${h.id}"><td class="wrap"><b>${U.esc(h.name)}</b><div class="kbd-hint">${U.esc(h.symbol || '')} · ${U.esc(S.acc(h.accountId).name)}</div></td><td>${CLASS(h)}</td><td class="r">${U.num(h.units, h.units < 10 ? 4 : 2)}</td><td class="r">${U.money(h.units ? c / h.units : 0, { dec: 2 })}</td><td class="r">${U.money(h.price, { dec: 2 })}</td><td class="r">${U.money(v)}</td><td class="r ${v >= c ? 'up' : 'down'}">${U.money(v - c, { sign: true })}<div class="kbd-hint">${U.pct(c ? (v - c) / c : 0, 1)}</div></td><td class="r ${x >= 0 ? 'up' : 'down'}">${U.pct(x, 1)}</td><td class="r">${U.pct(v / (val || 1), 1)}</td><td>${C.spark((h.history || []).slice(-12).map((p) => p.price), { w: 90, h: 24, color: v >= c ? 'var(--good)' : 'var(--bad)' })}</td></tr>`; }).join('') || '<tr><td colspan="10"><div class="chart-empty">No holdings yet.</div></td></tr>'}</tbody></table></div>` })}
          ${LL.card({ cls: 'c7', title: 'Risk vs reward', icon: 'spark', sub: 'Bubble size is value · x is portfolio weight · y is XIRR', body: '<div id="i-bub"></div>' })}
          ${LL.card({ cls: 'c5', title: 'Rebalancing', icon: 'sliders', sub: 'Target mix vs actual', right: '<button class="btn sm" id="i-tgt">Edit targets</button>', body: '<div id="i-reb"></div>' })}
        </div>`;
      C.track(() => {
        const ms = S.months();
        C.line(U.$('#i-line', root), { labels: ms.map((m) => U.monLabel(m, true)), series: [{ name: 'Market value', values: ms.map((m) => U.sum(H, (h) => S.holdingValue(h, m === S.curYM() ? S.asOf() : m + '-' + U.daysInMonth(m)))), color: 's1', area: true }, { name: 'Invested', values: ms.map((m) => U.sum(H, (h) => S.holdingCost(h, m === S.curYM() ? S.asOf() : m + '-' + U.daysInMonth(m)))), color: 's7', dash: true }], h: 280 });
      });
      const drawAl = (k) => { const by = {}; H.forEach((h) => { const key = k === 'class' ? CLASS(h) : h[k] || 'Other'; by[key] = (by[key] || 0) + S.holdingValue(h); }); C.donut(U.$('#i-donut', root), Object.entries(by).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value), { centerLabel: 'Portfolio', size: 190, max: 6 }); };
      drawAl('class'); LL.wireSeg(root, 'i-al', drawAl);
      C.track(() => C.scatter(U.$('#i-bub', root), { bubble: true, labels: true, points: H.map((h, i) => { const v = S.holdingValue(h); return { x: (v / (val || 1)) * 100, y: hXirr(h) * 100, r: v, label: h.symbol || h.name, color: C.series(['Equity', 'Global equity', 'Debt', 'Gold', 'Crypto'].indexOf(CLASS(h))), tip: `<div class="tip-sub">${U.esc(h.name)}</div><div class="tip-sub">${U.money(v)} · XIRR ${U.pct(hXirr(h), 1)}</div>` }; }), xfmt: (v) => v + '%', yfmt: (v) => v + '%', xlabel: 'Weight in portfolio →', h: 280 }));
      const drawReb = () => {
        const by = {}; H.forEach((h) => (by[CLASS(h)] = (by[CLASS(h)] || 0) + S.holdingValue(h)));
        const keys = [...new Set([...Object.keys(meta.targetAlloc), ...Object.keys(by)])];
        U.$('#i-reb', root).innerHTML = `<div class="list" style="gap:12px">${keys.map((k, i) => { const act = (by[k] || 0) / (val || 1), tgt = (meta.targetAlloc[k] || 0) / 100, diff = (tgt - act) * val; return `<div><div style="display:flex;justify-content:space-between;gap:8px"><b>${k}</b><span class="num">${U.pct(act)} <span class="muted">/ ${U.pct(tgt)}</span></span></div><div class="bar-track" style="margin-top:6px"><div class="bar-fill" style="--w:${Math.min(100, act * 100)}%;--c:${C.series(i)}"></div><span class="bar-mark" style="--x:${Math.min(100, tgt * 100)}%"></span></div><div class="kbd-hint" style="margin-top:3px">${Math.abs(diff) < val * 0.01 ? 'On target' : (diff > 0 ? 'Buy ' : 'Sell ') + U.money(Math.abs(diff)) + ' to rebalance'}</div></div>`; }).join('')}</div>`;
      };
      drawReb();
      U.$('#i-tgt', root).onclick = () => {
        const keys = ['Equity', 'Global equity', 'Debt', 'Gold', 'Crypto'];
        const f = U.form(keys.map((k) => ({ key: k, label: k + ' %', type: 'number', half: true })), meta.targetAlloc);
        U.modal({ title: 'Target allocation', body: f, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: () => { const v = f.read(); const t = U.sum(Object.values(v), (x) => x || 0); if (Math.round(t) !== 100) { U.toast('Targets add up to ' + t + '%. Make them total 100%.', 'warn'); return false; } S.setMeta({ targetAlloc: v }); } }] });
      };
      const editH = (h) => LL.editRecord({ col: 'holdings', title: h ? h.name : 'New holding', rec: h || { type: 'Mutual Fund', accountId: (S.state.accounts.find((a) => a.type === 'investment') || {}).id, region: 'India' }, fields: [{ key: 'name', label: 'Name', required: true }, { key: 'symbol', label: 'Symbol', half: true }, { key: 'type', label: 'Type', type: 'select', options: ['Mutual Fund', 'Stock', 'ETF', 'Bond', 'Fixed Deposit', 'Retirement', 'Gold', 'Crypto', 'Other'].map((v) => ({ value: v, label: v })), half: true }, { key: 'sector', label: 'Sector', half: true }, { key: 'region', label: 'Region', half: true }, { key: 'accountId', label: 'Held in', type: 'select', options: LL.accOptions((a) => ['investment', 'retirement'].includes(a.type)), half: true }, { key: 'price', label: 'Current price per unit', type: 'number', step: 'any', required: true, half: true }, ...(h ? [] : [{ key: 'buyUnits', label: 'Units bought', type: 'number', step: 'any', half: true }, { key: 'buyPrice', label: 'Buy price per unit', type: 'number', step: 'any', half: true }, { key: 'buyDate', label: 'Buy date', type: 'date', half: true, default: U.today() }])], onSave: (v) => { if (!h) { v.flows = v.buyUnits ? [{ date: v.buyDate, amount: v.buyUnits * v.buyPrice, units: +v.buyUnits, price: +v.buyPrice }] : []; v.units = +v.buyUnits || 0; v.history = [{ ym: S.curYM(), price: +v.price }]; delete v.buyUnits; delete v.buyPrice; delete v.buyDate; } else { const hist = v.history || []; const last = hist[hist.length - 1]; if (last && last.ym === S.curYM()) last.price = +v.price; else hist.push({ ym: S.curYM(), price: +v.price }); v.history = hist; } return v; } });
      U.$('#i-new', root).onclick = () => editH();
      U.on(root, 'click', 'tr[data-id]', (e, tr) => {
        const h = S.get('holdings', tr.dataset.id);
        U.modal({ title: h.name, body: `<div class="stats"><div class="stat"><div class="s-l">Value</div><div class="s-v">${U.money(S.holdingValue(h))}</div></div><div class="stat"><div class="s-l">Invested</div><div class="s-v">${U.money(S.holdingCost(h))}</div></div><div class="stat"><div class="s-l">XIRR</div><div class="s-v">${U.pct(hXirr(h), 1)}</div></div><div class="stat"><div class="s-l">Contributions</div><div class="s-v">${(h.flows || []).length}</div></div></div><div id="hm-chart" style="margin-top:14px"></div>`, wide: true,
          onOpen: (m) => C.line(U.$('#hm-chart', m), { labels: (h.history || []).map((p) => U.monLabel(p.ym, true)), series: [{ name: 'Price', values: (h.history || []).map((p) => p.price), color: 's1', area: true }], zero: false, h: 240, fmt: (v) => U.short(v), tipFmt: (v) => U.money(v, { dec: 2 }) }),
          actions: [{ label: 'Edit details', kind: 'ghost', onClick: () => setTimeout(() => editH(h), 280) }, { label: 'Record buy / sell', kind: 'primary', onClick: () => setTimeout(() => trade(h), 280) }] });
      });
      const trade = (h) => {
        const f = U.form([{ key: 'side', label: 'Action', type: 'select', options: [{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }], half: true }, { key: 'date', label: 'Date', type: 'date', half: true, default: U.today() }, { key: 'units', label: 'Units', type: 'number', step: 'any', required: true, half: true }, { key: 'price', label: 'Price per unit', type: 'number', step: 'any', required: true, half: true, default: h.price }]);
        U.modal({ title: 'Trade · ' + h.name, body: f, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Record', kind: 'primary', onClick: () => { if (!f.check()) return false; const v = f.read(); const u = v.side === 'sell' ? -Math.min(v.units, h.units) : +v.units; const avg = h.units ? S.holdingCost(h) / h.units : v.price; h.flows = h.flows || []; h.flows.push({ date: v.date, amount: u > 0 ? u * v.price : u * avg, units: u, price: +v.price }); h.units = U.round(h.units + u, 6); S.touch('holdings'); U.toast((v.side === 'sell' ? 'Sold ' : 'Bought ') + Math.abs(u) + ' units'); } }] });
      };
      U.$('#i-prices', root).onclick = () => {
        const f = U.form(H.map((h) => ({ key: h.id, label: h.name + (h.symbol ? ' (' + h.symbol + ')' : ''), type: 'number', step: 'any', half: true })), Object.fromEntries(H.map((h) => [h.id, h.price])));
        U.modal({ title: 'Update prices', body: f, wide: true, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save prices', kind: 'primary', onClick: () => { const v = f.read(); H.forEach((h) => { if (v[h.id] != null && v[h.id] !== h.price) { h.price = v[h.id]; const hist = h.history || (h.history = []); const last = hist[hist.length - 1]; if (last && last.ym === S.curYM()) last.price = h.price; else hist.push({ ym: S.curYM(), price: h.price }); } }); S.touch('holdings'); U.toast('Prices updated'); } }] });
      };
    },
  };

  /* ===================== FORECAST & SCENARIOS ===================== */
  LL.baseline = () => {
    const three = S.months(4).slice(0, 3);
    const sal = S.incomes().filter((t) => t.categoryId === 'cat_salary').slice(0, 3).map((t) => t.amount);
    const salary = sal.length ? U.median(sal) : U.avg(three.map((m) => S.month(m).income));
    const otherIncome = U.avg(three.map((m) => S.month(m).income)) - salary;
    const billsMonthly = U.sum(S.state.bills.filter((b) => b.active && !b.transferTo), (b) => S.monthlyCost(b));
    const invest = U.sum(S.state.bills.filter((b) => b.active && b.transferTo), (b) => S.monthlyCost(b));
    const totalSpend = U.avg(three.map((m) => S.month(m).expense));
    const variable = Math.max(0, totalSpend - billsMonthly);
    return { salary, otherIncome: Math.max(0, otherIncome), billsMonthly, invest, variable, totalSpend };
  };
  LL.V.forecast = {
    title: 'Forecast & scenarios',
    render(root) {
      const b = LL.baseline();
      const liquid0 = S.liquid() - S.cardDebt();
      root.innerHTML = `
        <div class="page-intro"><div><h2>See ahead, then test what-ifs</h2><p>The 90-day forecast uses your scheduled bills, your salary date and your average daily spending. The scenario planner projects 24 months under any change you like.</p></div></div>
        <div class="grid">
          ${LL.card({ cls: 'c12', title: 'Next 90 days of cash', icon: 'forecast', sub: 'Bank, savings and cash minus card dues', body: '<div id="f-90"></div><div class="stats" id="f-90s" style="margin-top:12px"></div>' })}
          ${LL.card({ cls: 'c4', title: 'Scenario', icon: 'sliders', sub: 'Drag to change; the charts update live', body: `<div class="list" style="gap:14px">
            ${[['inc', 'Income change', -50, 50, 0, '%'], ['spend', 'Spending change', -40, 60, 0, '%'], ['loss', 'Months without income', 0, 12, 0, ' months'], ['buy', 'One-time purchase', 0, 2000000, 0, ''], ['buyAt', 'Purchase in month', 1, 24, 6, ''], ['inv', 'Extra investing per month', 0, 50000, 0, ''], ['ret', 'Expected investment return', 0, 15, 10, '% / yr']].map(([k, l, mn, mx, v, suf]) => `<div class="slider-row"><div class="sl-h"><span>${l}</span><b id="sv-${k}"></b></div><input type="range" id="s-${k}" min="${mn}" max="${mx}" step="${k === 'buy' ? 10000 : k === 'inv' ? 1000 : 1}" value="${v}" data-suf="${suf}"></div>`).join('')}
            <button class="btn sm ghost" id="s-reset">Reset to baseline</button></div>` })}
          ${LL.card({ cls: 'c8', title: 'Cash over 24 months', icon: 'trend', body: '<div id="f-cash"></div>' })}
          ${LL.card({ cls: 'c6', title: 'Net worth over 24 months', icon: 'layers', body: '<div id="f-nw"></div>' })}
          ${LL.card({ cls: 'c6', title: 'Scenario outcome', icon: 'bolt', body: '<div id="f-out" class="calc-out"></div>' })}
          ${LL.card({ cls: 'c12', title: 'Your baseline month', icon: 'list', sub: 'What the projections assume, from your last three full months', body: `<div class="stats">${[['Salary', b.salary], ['Other income', b.otherIncome], ['Fixed bills & EMIs', b.billsMonthly], ['Variable spending', b.variable], ['Investing (SIPs etc.)', b.invest], ['Left over', b.salary + b.otherIncome - b.billsMonthly - b.variable - b.invest]].map(([l, v]) => `<div class="stat"><div class="s-l">${l}</div><div class="s-v">${U.money(v)}</div></div>`).join('')}</div>` })}
        </div>`;
      // 90-day daily forecast
      C.track(() => {
        const days = 90, out = [], labels = [];
        let bal = liquid0; const daily = b.variable / 30.44;
        const up = S.upcoming(days, U.addDays(S.asOf(), 1));
        let low = { v: bal, d: S.asOf() };
        for (let k = 0; k <= days; k++) {
          const d = U.addDays(S.asOf(), k);
          if (k > 0) { bal -= daily; up.filter((u) => u.date === d).forEach((u) => (bal -= u.amount)); if (d.slice(8) === '01') bal += b.salary + b.otherIncome; }
          out.push(bal); labels.push(U.fmtDate(d, { year: false }));
          if (bal < low.v) low = { v: bal, d };
        }
        C.line(U.$('#f-90', root), { labels, series: [{ name: 'Projected cash', values: out, color: 's3', area: true }], h: 260, zero: false });
        U.$('#f-90s', root).innerHTML = [['Today', U.money(liquid0)], ['In 30 days', U.money(out[30])], ['In 90 days', U.money(out[90])], ['Lowest point', U.money(low.v) + ' · ' + U.fmtDate(low.d, { year: false })], ['Bills in window', U.money(U.sum(up, (u) => u.amount))]].map(([l, v]) => `<div class="stat"><div class="s-l">${l}</div><div class="s-v">${v}</div></div>`).join('');
      });
      const nw0 = S.netWorth().net, inv0 = U.sum(S.state.holdings, (h) => S.holdingValue(h));
      const project = (o) => {
        let cash = liquid0, inv = inv0, other = nw0 - liquid0 - inv0; const cashS = [], nwS = [];
        const debts = S.state.debts.filter((d) => d.kind !== 'lent');
        for (let k = 1; k <= 24; k++) {
          const income = k <= o.loss ? 0 : (b.salary + b.otherIncome) * (1 + o.inc / 100);
          const spend = b.billsMonthly + b.variable * (1 + o.spend / 100);
          const investing = k <= o.loss ? 0 : b.invest + o.inv;
          cash += income - spend - investing - (k === o.buyAt ? o.buy : 0);
          inv = inv * (1 + o.ret / 1200) + investing;
          const debtDrop = U.sum(debts, (d) => S.debtBalance(d, U.addMonths(S.asOf(), k - 1)) - S.debtBalance(d, U.addMonths(S.asOf(), k)));
          other += debtDrop;
          cashS.push(cash); nwS.push(cash + inv + other);
        }
        return { cashS, nwS };
      };
      const val = (k) => +U.$('#s-' + k, root).value;
      const draw = () => {
        ['inc', 'spend', 'loss', 'buy', 'buyAt', 'inv', 'ret'].forEach((k) => { const el = U.$('#s-' + k, root); U.$('#sv-' + k, root).textContent = k === 'buy' || k === 'inv' ? U.money(+el.value) : k === 'buyAt' ? U.monLabel(U.ymAdd(S.curYM(), +el.value), true) : (+el.value > 0 && (k === 'inc' || k === 'spend') ? '+' : '') + el.value + el.dataset.suf; });
        const o = { inc: val('inc'), spend: val('spend'), loss: val('loss'), buy: val('buy'), buyAt: val('buyAt'), inv: val('inv'), ret: val('ret') };
        const base = project({ inc: 0, spend: 0, loss: 0, buy: 0, buyAt: 99, inv: 0, ret: o.ret }), sc = project(o);
        const labels = [...Array(24).keys()].map((k) => U.monLabel(U.ymAdd(S.curYM(), k + 1), true));
        C.line(U.$('#f-cash', root), { labels, series: [{ name: 'Baseline', values: base.cashS, color: 's7', dash: true }, { name: 'Scenario', values: sc.cashS, color: 's2', area: true }], h: 300, zero: false });
        C.line(U.$('#f-nw', root), { labels, series: [{ name: 'Baseline', values: base.nwS, color: 's7', dash: true }, { name: 'Scenario', values: sc.nwS, color: 's1', area: true }], h: 260, zero: false });
        const neg = sc.cashS.findIndex((v) => v < 0);
        const burn = b.billsMonthly + b.variable * (1 + o.spend / 100);
        U.$('#f-out', root).innerHTML = `<div class="kbd-hint">Cash in 24 months</div><div class="big ${sc.cashS[23] >= 0 ? '' : 'down'}">${U.money(sc.cashS[23])}</div><div class="muted-p">${U.money(sc.cashS[23] - base.cashS[23], { sign: true })} versus your baseline. Net worth ends at <b>${U.short(sc.nwS[23])}</b> (${U.money(sc.nwS[23] - base.nwS[23], { sign: true })}).</div>
          <div class="stats" style="margin-top:6px"><div class="stat"><div class="s-l">Runway with no income</div><div class="s-v">${(liquid0 / (burn || 1)).toFixed(1)} months</div></div><div class="stat"><div class="s-l">Cash runs out</div><div class="s-v ${neg >= 0 ? 'down' : 'up'}">${neg >= 0 ? labels[neg] : 'Never in 24 months'}</div></div><div class="stat"><div class="s-l">Lowest cash</div><div class="s-v">${U.short(Math.min(...sc.cashS))}</div></div></div>`;
      };
      U.$$('input[type=range]', root).forEach((r) => r.addEventListener('input', draw));
      U.$('#s-reset', root).onclick = () => { [['inc', 0], ['spend', 0], ['loss', 0], ['buy', 0], ['buyAt', 6], ['inv', 0], ['ret', 10]].forEach(([k, v]) => (U.$('#s-' + k, root).value = v)); draw(); };
      C.track(draw);
    },
  };
})(window.LL);
