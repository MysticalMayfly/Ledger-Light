/* Ledgerlight — pattern analysis engine.
   Each analysis returns { headline, detail, severity, metric, render(el) }.
   Everything runs locally on the transactions in the store. */
window.LL = window.LL || {};
(function (LL) {
  'use strict';
  const U = LL.U, S = LL.S, C = LL.C;
  const A = (LL.A = {});

  const FIXED_CATS = new Set(['cat_emi_home', 'cat_emi_car', 'cat_maintenance', 'cat_insurance', 'cat_taxes', 'cat_internet', 'cat_mobile', 'cat_electricity', 'cat_water_gas']);
  A.isFixed = (t) => FIXED_CATS.has(t.categoryId) || S.cat(t.categoryId).group === 'Housing' || S.cat(t.categoryId).group === 'Financial';
  const win = (months = 12) => { const end = S.asOf(); const from = U.ymAdd(U.ym(end), -(months - 1)) + '-01'; return [from, end]; };
  const exp = (months = 12) => { const [a, b] = win(months); return S.expenses().filter((t) => t.date >= a && t.date <= b); };
  const disc = (months = 12) => exp(months).filter((t) => !A.isFixed(t));
  const hour = (t) => +(t.time || '12:00').slice(0, 2);
  const fullMonths = (n) => S.months(n + 1).slice(0, -1); // completed months only
  const catName = (id) => S.cat(id).name;

  /* ---------------- definitions ---------------- */
  const defs = [];
  const def = (id, group, title, question, fn) => defs.push({ id, group, title, question, fn });

  /* 1. weekday x hour heatmap */
  def('when', 'Spending', 'When you spend', 'Which days and hours carry your discretionary spending?', () => {
    const tx = disc();
    const buckets = ['6–9', '9–12', '12–15', '15–18', '18–21', '21–24', '0–6'];
    const bk = (h) => (h < 6 ? 6 : h < 9 ? 0 : h < 12 ? 1 : h < 15 ? 2 : h < 18 ? 3 : h < 21 ? 4 : 5);
    const data = U.DOW.map(() => buckets.map(() => 0));
    tx.forEach((t) => (data[U.dow(t.date)][bk(hour(t))] += t.amount));
    let best = [0, 0]; data.forEach((r, i) => r.forEach((v, j) => { if (v > data[best[0]][best[1]]) best = [i, j]; }));
    const share = data[best[0]][best[1]] / (U.sum(tx, (t) => t.amount) || 1);
    return {
      headline: `${U.DOW[best[0]]} ${buckets[best[1]]}h is your peak spending window`, metric: U.pct(share, 1) + ' of discretionary spend', severity: 'info',
      detail: 'Totals over the last 12 months, excluding EMIs, rent-like costs and insurance. Darker cells mean more money spent in that slot.',
      render: (el) => C.heatmap(el, { rows: U.DOW, cols: buckets, data, cellH: 30, padL: 40 }),
    };
  });

  /* 2. calendar heatmap */
  def('calendar', 'Spending', 'Daily spending calendar', 'How does day-to-day spending look across the year?', () => {
    const tx = disc(); const map = {};
    tx.forEach((t) => (map[t.date] = (map[t.date] || 0) + t.amount));
    const [a, b] = win(12);
    const days = U.daysBetween(a, b) + 1, active = Object.keys(map).length;
    const top = Object.entries(map).sort((x, y) => y[1] - x[1])[0] || ['', 0];
    return {
      headline: `You spent on ${active} of the last ${days} days`, metric: 'Biggest day: ' + U.short(top[1]), severity: 'info',
      detail: top[0] ? `Your heaviest day was ${U.fmtDate(top[0], { weekday: true })} at ${U.money(top[1])}. Hover any square for that day's total.` : '',
      render: (el) => C.calendar(el, { start: a, end: b, values: map }),
    };
  });

  /* 3. day-of-month */
  def('dom', 'Spending', 'Day-of-month rhythm', 'Do you spend more at certain points in the month?', () => {
    const tx = disc(); const tot = Array(31).fill(0);
    tx.forEach((t) => (tot[+t.date.slice(8) - 1] += t.amount));
    const months = 12, avg = tot.map((v) => v / months);
    const first = U.sum(avg.slice(0, 10)), last = U.sum(avg.slice(20));
    const ratio = first / (last || 1);
    return {
      headline: ratio > 1.15 ? `You spend ${U.pct(ratio - 1)} more in the first 10 days than the last 10` : ratio < 0.87 ? 'Spending builds up toward month end' : 'Spending is spread evenly across the month',
      metric: `Days 1–10: ${U.short(first)} · Days 21–31: ${U.short(last)}`, severity: ratio > 1.3 ? 'warn' : 'info',
      detail: 'Average discretionary spend for each calendar day. A front-loaded month often means money disappears soon after payday.',
      render: (el) => C.bars(el, { labels: avg.map((_, i) => String(i + 1)), series: [{ name: 'Average spend', values: avg, color: 's1' }], h: 220 }),
    };
  });

  /* 4. payday effect */
  def('payday', 'Spending', 'Payday effect', 'Does income landing change how fast you spend?', () => {
    const sal = S.incomes().filter((t) => t.categoryId === 'cat_salary').map((t) => t.date);
    const tx = disc(); if (!sal.length) return null;
    const salSet = sal.sort();
    const daysAfter = (d) => { let best = 99; for (const s of salSet) { const k = U.daysBetween(s, d); if (k >= 0 && k < best) best = k; } return best; };
    const bins = Array(5).fill(0), cnt = Array(5).fill(0);
    const labels = ['Days 0–6', '7–13', '14–20', '21–27', '28+'];
    const [a, b] = win(12);
    for (let d = a; d <= b; d = U.addDays(d, 1)) { const k = daysAfter(d); if (k < 99) cnt[Math.min(4, Math.floor(k / 7))]++; }
    tx.forEach((t) => { const k = daysAfter(t.date); if (k < 99) bins[Math.min(4, Math.floor(k / 7))] += t.amount; });
    const perDay = bins.map((v, i) => (cnt[i] ? v / cnt[i] : 0));
    const lift = perDay[0] / (U.avg(perDay.slice(1, 4)) || 1) - 1;
    return {
      headline: lift > 0.1 ? `The week after payday runs ${U.pct(lift)} hotter` : 'Payday barely changes your pace', metric: U.money(perDay[0]) + '/day in week one', severity: lift > 0.25 ? 'warn' : 'good',
      detail: 'Average discretionary spend per day, grouped by how many days have passed since your salary arrived.',
      render: (el) => C.bars(el, { labels, series: [{ name: 'Spend per day', values: perDay, colors: perDay.map((_, i) => (i === 0 ? 's2' : 's1')) }], h: 220 }),
    };
  });

  /* 5. weekend vs weekday */
  def('weekend', 'Spending', 'Weekend vs weekday', 'How different are your weekends?', () => {
    const tx = disc();
    const [a, b] = win(12); let wd = 0, we = 0;
    for (let d = a; d <= b; d = U.addDays(d, 1)) { const k = U.dow(d); k === 0 || k === 6 ? we++ : wd++; }
    const byG = {};
    tx.forEach((t) => { const g = S.cat(t.categoryId).group; const w = [0, 6].includes(U.dow(t.date)); byG[g] = byG[g] || [0, 0]; byG[g][w ? 1 : 0] += t.amount; });
    const groups = Object.keys(byG).sort((x, y) => U.sum(byG[y]) - U.sum(byG[x])).slice(0, 7);
    const wkd = groups.map((g) => byG[g][0] / wd), wke = groups.map((g) => byG[g][1] / we);
    const ratio = U.sum(wke) / (U.sum(wkd) || 1);
    return {
      headline: `A weekend day costs ${ratio.toFixed(1)}× a weekday`, metric: `${U.money(U.sum(wke))} vs ${U.money(U.sum(wkd))} per day`, severity: ratio > 2 ? 'warn' : 'info',
      detail: 'Per-day spend by category group. The biggest weekend gaps usually come from dining, shopping and outings.',
      render: (el) => C.bars(el, { labels: groups, series: [{ name: 'Weekday / day', values: wkd, color: 's1' }, { name: 'Weekend / day', values: wke, color: 's2' }], h: 230 }),
    };
  });

  /* 6. seasonality */
  def('season', 'Spending', 'Seasonality', 'Which months of the year are expensive?', () => {
    const tot = Array(12).fill(0), n = Array(12).fill(0);
    S.months().forEach((ym) => { const m = S.month(ym); if (!m.count) return; const i = +ym.slice(5) - 1; tot[i] += U.sum(Object.entries(m.byCat).filter(([c]) => !FIXED_CATS.has(c)), (x) => x[1]); n[i]++; });
    const avg = tot.map((v, i) => (n[i] ? v / n[i] : 0));
    const mean = U.avg(avg.filter(Boolean));
    const hi = avg.indexOf(Math.max(...avg)), lo = avg.indexOf(Math.min(...avg.filter(Boolean)));
    return {
      headline: `${U.MON[hi]} is your most expensive month`, metric: `${U.pct(avg[hi] / mean - 1)} above a typical month`, severity: 'info',
      detail: `Average variable spending per calendar month across all your history. ${U.MON[lo]} is the lightest. Plan sinking funds for the peaks.`,
      render: (el) => C.bars(el, { labels: U.MON, series: [{ name: 'Average variable spend', values: avg, colors: avg.map((v) => (v > mean * 1.15 ? 's2' : 's1')) }], h: 220 }),
    };
  });

  /* 7. category momentum */
  def('momentum', 'Spending', 'Category momentum', 'Which categories are growing or shrinking?', () => {
    const ms = fullMonths(12);
    const cats = S.expenseCats().filter((c) => !FIXED_CATS.has(c.id));
    const rows = cats.map((c) => { const ys = ms.map((m) => S.month(m).byCat[c.id] || 0); const avg = U.avg(ys); const { slope } = U.linreg(ys); return { c, avg, slope, rel: avg ? (slope * 12) / avg : 0 }; })
      .filter((r) => r.avg > 1000).sort((a, b) => b.rel - a.rel);
    const top = rows.slice(0, 5), bottom = rows.slice(-4).reverse();
    const items = [...top, ...bottom].map((r) => ({ label: r.c.name, value: r.slope * 12, sub: U.pct(r.rel, 0) + ' per year', color: r.slope > 0 ? 'var(--bad)' : 'var(--good)' }));
    return {
      headline: top[0] ? `${top[0].c.name} is climbing fastest (${U.pct(top[0].rel)} a year)` : 'No clear trends yet', metric: top.length + ' rising · ' + rows.filter((r) => r.slope < 0).length + ' falling', severity: top[0] && top[0].rel > 0.3 ? 'warn' : 'info',
      detail: 'Fitted 12-month trend per category, shown as the change in monthly spend over a year. Red is rising, green is falling.',
      render: (el) => C.hbars(el, items, { fmt: (v) => U.money(v, { sign: true }) + '/mo' }),
    };
  });

  /* 8. lifestyle creep */
  def('creep', 'Income', 'Lifestyle creep', 'Is spending growing faster than income?', () => {
    const ms = fullMonths(18);
    if (ms.length < 6) return null;
    const roll = (arr) => arr.map((_, i) => U.avg(arr.slice(Math.max(0, i - 2), i + 1)));
    const inc = roll(ms.map((m) => S.month(m).income));
    const dsp = roll(ms.map((m) => U.sum(Object.entries(S.month(m).byCat).filter(([c]) => !FIXED_CATS.has(c)), (x) => x[1])));
    const idx = (a) => a.map((v) => (a[0] ? (v / a[0]) * 100 : 100));
    const ii = idx(inc), di = idx(dsp);
    const gap = di[di.length - 1] - ii[ii.length - 1];
    return {
      headline: gap > 5 ? `Variable spending grew ${Math.round(gap)} points faster than income` : gap < -5 ? 'Income is outpacing your lifestyle. Nice.' : 'Spending and income are moving together',
      metric: `Spend index ${Math.round(di[di.length - 1])} · Income index ${Math.round(ii[ii.length - 1])}`, severity: gap > 10 ? 'bad' : gap > 5 ? 'warn' : 'good',
      detail: 'Both series are indexed to 100 at the start of the window and smoothed with a 3-month average. When the spending line pulls above the income line, lifestyle creep is eating your raises.',
      render: (el) => C.line(el, { labels: ms.map((m) => U.monLabel(m, true)), series: [{ name: 'Variable spend index', values: di, color: 's2' }, { name: 'Income index', values: ii, color: 's3' }], zero: false, fmt: (v) => Math.round(v), tipFmt: (v) => v.toFixed(0), h: 230 }),
    };
  });

  /* 9. share shift */
  def('shift', 'Spending', 'Where your money moved', 'How did your spending mix change versus the previous quarter?', () => {
    const ms = fullMonths(6), a = ms.slice(0, 3), b = ms.slice(3);
    const sumG = (arr) => { const o = {}; arr.forEach((m) => Object.entries(S.month(m).byGroup).forEach(([g, v]) => (o[g] = (o[g] || 0) + v))); return o; };
    const A1 = sumG(a), B1 = sumG(b);
    const groups = [...new Set([...Object.keys(A1), ...Object.keys(B1)])].sort((x, y) => (B1[y] || 0) - (B1[x] || 0)).slice(0, 8);
    const diffs = groups.map((g) => ({ g, d: (B1[g] || 0) - (A1[g] || 0) })).sort((x, y) => y.d - x.d);
    return {
      headline: diffs[0] && diffs[0].d > 0 ? `${diffs[0].g} took the biggest jump: ${U.money(diffs[0].d, { sign: true })}` : 'Your mix held steady', metric: `${U.monLabel(b[0])}–${U.monLabel(b[2])} vs ${U.monLabel(a[0])}–${U.monLabel(a[2])}`, severity: 'info',
      detail: 'Total spend per category group, latest full quarter against the one before it.',
      render: (el) => C.bars(el, { labels: groups, series: [{ name: 'Previous quarter', values: groups.map((g) => A1[g] || 0), color: 's7' }, { name: 'Latest quarter', values: groups.map((g) => B1[g] || 0), color: 's1' }], h: 230 }),
    };
  });

  /* 10. latte factor */
  def('latte', 'Habits', 'Small-purchase leak', 'How much do small, frequent purchases add up to?', () => {
    const lim = S.state.meta.currency === 'INR' ? 500 : 10;
    const small = disc().filter((t) => t.amount < lim);
    const byC = U.groupBy(small, (t) => t.categoryId);
    const items = [...byC.entries()].map(([c, arr], i) => ({ label: catName(c), value: U.sum(arr, (t) => t.amount), sub: arr.length + ' purchases', color: C.series(i) })).sort((a, b) => b.value - a.value).slice(0, 6);
    const total = U.sum(small, (t) => t.amount);
    return {
      headline: `${small.length} purchases under ${U.money(lim)} added up to ${U.short(total)} this year`, metric: U.money(total / 12) + ' a month', severity: total > 30000 ? 'warn' : 'info',
      detail: `Invested at 12% a year instead, that monthly amount would grow to about ${U.short(A.fv(total / 12, 0.12, 10))} in 10 years.`,
      render: (el) => C.donut(el, items, { centerLabel: 'Small buys / yr', size: 200 }),
    };
  });

  /* 11. late night */
  def('night', 'Habits', 'Late-night spending', 'How much do you spend after 10 pm?', () => {
    const tx = disc(); const night = tx.filter((t) => hour(t) >= 22 || hour(t) < 4);
    const share = U.sum(night, (t) => t.amount) / (U.sum(tx, (t) => t.amount) || 1);
    const byH = Array(24).fill(0); tx.forEach((t) => (byH[hour(t)] += t.amount));
    const order = [...Array(24).keys()].map((k) => (k + 6) % 24);
    const top = [...U.groupBy(night, (t) => t.payee).entries()].sort((a, b) => U.sum(b[1], (t) => t.amount) - U.sum(a[1], (t) => t.amount)).slice(0, 3).map((x) => x[0]);
    return {
      headline: `${U.pct(share)} of discretionary spend happens after 10 pm`, metric: night.length + ' late-night purchases', severity: share > 0.18 ? 'warn' : 'info',
      detail: top.length ? `Most common late-night merchants: ${top.join(', ')}. Late purchases are more often impulse buys, so a 24-hour wishlist rule can help.` : 'Almost nothing after 10 pm.',
      render: (el) => C.bars(el, { labels: order.map((k) => String(k).padStart(2, '0')), series: [{ name: 'Spend by hour', values: order.map((k) => byH[k]), colors: order.map((k) => (k >= 22 || k < 4 ? 's2' : 's1')) }], h: 210 }),
    };
  });

  /* 12. impulse clusters */
  def('bursts', 'Habits', 'Spending bursts', 'Are there days where purchases pile up?', () => {
    const byDay = U.groupBy(disc().filter((t) => !['cat_groceries', 'cat_fuel'].includes(t.categoryId)), (t) => t.date);
    const bursts = [...byDay.entries()].filter(([, a]) => a.length >= 4).map(([d, a]) => ({ d, n: a.length, v: U.sum(a, (t) => t.amount) })).sort((a, b) => b.v - a.v);
    const all = [...byDay.values()].map((a) => a.length);
    const hist = [1, 2, 3, 4, 5, 6].map((k) => all.filter((n) => (k === 6 ? n >= 6 : n === k)).length);
    return {
      headline: bursts.length ? `${bursts.length} burst days with 4 or more non-essential purchases` : 'No spending bursts found', metric: bursts[0] ? 'Largest: ' + U.short(bursts[0].v) + ' on ' + U.fmtDate(bursts[0].d, { year: false }) : '', severity: bursts.length > 15 ? 'warn' : 'info',
      detail: 'Days counted by how many discretionary purchases they held (groceries and fuel excluded). Burst days are where impulse spending clusters.',
      render: (el) => C.bars(el, { labels: ['1', '2', '3', '4', '5', '6+'], series: [{ name: 'Days', values: hist, colors: hist.map((_, i) => (i >= 3 ? 's2' : 's1')) }], fmt: (v) => Math.round(v), tipFmt: (v) => v + ' days', h: 200 }),
    };
  });

  /* 13. no-spend streaks */
  def('nospend', 'Habits', 'No-spend days', 'How often do you go a day without discretionary spending?', () => {
    const set = new Set(disc().filter((t) => t.amount > 0).map((t) => t.date));
    const [a, b] = win(12); let streak = 0, best = 0, bestEnd = '', total = 0;
    const byMonth = {};
    for (let d = a; d <= b; d = U.addDays(d, 1)) {
      const free = !set.has(d);
      if (free) { streak++; total++; byMonth[U.ym(d)] = (byMonth[U.ym(d)] || 0) + 1; if (streak > best) { best = streak; bestEnd = d; } } else streak = 0;
    }
    const ms = S.months(12);
    return {
      headline: `${total} no-spend days in the last year`, metric: `Longest streak: ${best} days`, severity: total > 60 ? 'good' : 'info',
      detail: best ? `Your best run ended on ${U.fmtDate(bestEnd)}. Try for 8 no-spend days a month.` : '',
      render: (el) => C.bars(el, { labels: ms.map((m) => U.monLabel(m)), series: [{ name: 'No-spend days', values: ms.map((m) => byMonth[m] || 0), color: 's3' }], fmt: (v) => Math.round(v), tipFmt: (v) => v + ' days', h: 200 }),
    };
  });

  /* 14. merchant concentration */
  def('pareto', 'Habits', 'Merchant concentration', 'How much of your spend goes to a few merchants?', () => {
    const by = [...U.groupBy(disc(), (t) => t.payee).entries()].map(([p, a]) => ({ p, v: U.sum(a, (t) => t.amount), n: a.length })).sort((a, b) => b.v - a.v);
    const tot = U.sum(by, (x) => x.v); let run = 0;
    const cum = by.map((x) => (run += x.v) / tot);
    const k20 = Math.max(1, Math.round(by.length * 0.2));
    const top20 = cum[k20 - 1] || 0;
    return {
      headline: `Your top ${k20} merchants take ${U.pct(top20)} of discretionary spend`, metric: by.length + ' merchants in total', severity: 'info',
      detail: `Top three: ${by.slice(0, 3).map((x) => `${x.p} (${U.short(x.v)}, ${x.n} visits)`).join(', ')}. Concentrated spending is easier to negotiate or swap.`,
      render: (el) => C.hbars(el, by.slice(0, 8).map((x, i) => ({ label: x.p, value: x.v, sub: x.n + ' visits · ' + U.pct(x.v / tot, 1), color: C.series(i % 3) }))),
    };
  });

  /* 15. size distribution */
  def('sizes', 'Habits', 'Purchase sizes', 'What does a typical purchase look like?', () => {
    const tx = exp(); const edges = S.state.meta.currency === 'INR' ? [100, 250, 500, 1000, 2500, 5000, 10000, 25000, Infinity] : [5, 10, 20, 50, 100, 250, 500, 1000, Infinity];
    const cnt = edges.map(() => 0), vol = edges.map(() => 0);
    tx.forEach((t) => { const i = edges.findIndex((e) => t.amount < e); cnt[i]++; vol[i] += t.amount; });
    const labels = edges.map((e, i) => (i === 0 ? '<' + U.short(e) : e === Infinity ? U.short(edges[i - 1]) + '+' : U.short(edges[i - 1]) + '–' + U.short(e)));
    const med = U.median(tx.map((t) => t.amount));
    const bigShare = (vol[vol.length - 1] + vol[vol.length - 2]) / (U.sum(vol) || 1);
    return {
      headline: `Your median purchase is ${U.money(med)}`, metric: `Purchases above ${U.short(edges[edges.length - 3])} are ${U.pct(bigShare)} of all spend`, severity: 'info',
      detail: 'Bars show how many purchases fall in each size band. Most purchases are small, but a few large ones carry the total.',
      render: (el) => C.bars(el, { labels, series: [{ name: 'Purchases', values: cnt, color: 's1' }], fmt: (v) => Math.round(v), tipFmt: (v) => v + ' purchases', h: 210 }),
    };
  });

  /* 16. food mix */
  def('food', 'Habits', 'Cook vs order', 'How is your food money split?', () => {
    const ms = fullMonths(12);
    const g = (m, c) => S.month(m).byCat['cat_' + c] || 0;
    const groc = ms.map((m) => g(m, 'groceries')), del = ms.map((m) => g(m, 'delivery')), din = ms.map((m) => g(m, 'dining')), cof = ms.map((m) => g(m, 'coffee'));
    const out = U.sum(del) + U.sum(din) + U.sum(cof), home = U.sum(groc);
    const last3 = (U.sum(del.slice(-3)) + U.sum(din.slice(-3))) / (U.sum(groc.slice(-3)) || 1), first3 = (U.sum(del.slice(0, 3)) + U.sum(din.slice(0, 3))) / (U.sum(groc.slice(0, 3)) || 1);
    return {
      headline: `For every ${U.sym()}1 on groceries you spend ${U.sym()}${(out / (home || 1)).toFixed(2)} eating out`, metric: last3 > first3 ? 'Eating out is rising' : 'Eating out is easing', severity: last3 > first3 * 1.15 ? 'warn' : 'info',
      detail: 'Monthly food spending split into groceries, delivery, dining out and coffee or snacks.',
      render: (el) => C.bars(el, { labels: ms.map((m) => U.monLabel(m)), stacked: true, series: [{ name: 'Groceries', values: groc, color: 's3' }, { name: 'Delivery', values: del, color: 's2' }, { name: 'Dining out', values: din, color: 's1' }, { name: 'Coffee & snacks', values: cof, color: 's4' }], h: 240 }),
    };
  });

  /* 17. income stability */
  def('income', 'Income', 'Income stability', 'How predictable is your income?', () => {
    const ms = fullMonths(12);
    const src = S.incomeCats().map((c) => ({ c, values: ms.map((m) => S.month(m).incBy[c.id] || 0) })).filter((s) => U.sum(s.values) > 0).sort((a, b) => U.sum(b.values) - U.sum(a.values));
    const tot = ms.map((m) => S.month(m).income);
    const cv = U.std(tot) / (U.avg(tot) || 1);
    const main = src[0] ? U.sum(src[0].values) / (U.sum(tot) || 1) : 0;
    return {
      headline: cv < 0.12 ? 'Your income is very steady' : cv < 0.25 ? 'Your income varies moderately' : 'Your income swings a lot month to month', metric: `Variation ${U.pct(cv)} · ${src[0] ? src[0].c.name : '—'} is ${U.pct(main)}`, severity: cv < 0.25 ? 'good' : 'warn',
      detail: `${src.length} income sources in the last 12 months. Relying on one source for over 80% of income makes a larger emergency fund worth having.`,
      render: (el) => C.bars(el, { labels: ms.map((m) => U.monLabel(m)), stacked: true, series: src.slice(0, 5).map((s, i) => ({ name: s.c.name, values: s.values, color: 's' + (i + 1) })), h: 240 }),
    };
  });

  /* 18. savings rate */
  def('savings', 'Income', 'Savings rate', 'What share of income are you keeping?', () => {
    const ms = fullMonths(18);
    const rate = ms.map((m) => { const x = S.month(m); return x.income ? (x.income - x.expense) / x.income : 0; });
    const roll = rate.map((_, i) => U.avg(rate.slice(Math.max(0, i - 2), i + 1)));
    const now = roll[roll.length - 1] || 0, then = roll[0] || 0;
    return {
      headline: `You are keeping ${U.pct(now)} of what you earn`, metric: (now >= then ? 'Up ' : 'Down ') + Math.abs(Math.round((now - then) * 100)) + ' pts over 18 months', severity: now >= 0.2 ? 'good' : now >= 0.1 ? 'warn' : 'bad',
      detail: 'Savings rate = (income − spending) ÷ income, per month, with a 3-month rolling average. 20% or more is a healthy target; investments count as saved.',
      render: (el) => C.line(el, { labels: ms.map((m) => U.monLabel(m, true)), series: [{ name: 'Monthly', values: rate.map((v) => v * 100), color: 's7', dash: true }, { name: '3-month average', values: roll.map((v) => v * 100), color: 's3', area: true }], fmt: (v) => v + '%', tipFmt: (v) => v.toFixed(1) + '%', h: 230 }),
    };
  });

  /* 19. spending velocity */
  def('velocity', 'Forecast', 'Month-to-date pace', 'Are you ahead of or behind your usual pace?', () => {
    const ym = S.curYM(), ms = fullMonths(6);
    const days = 31;
    const curve = (m) => { const arr = Array(days).fill(0); S.expenses().filter((t) => U.ym(t.date) === m && !A.isFixed(t)).forEach((t) => (arr[+t.date.slice(8) - 1] += t.amount)); let r = 0; return arr.map((v) => (r += v)); };
    const avg = Array(days).fill(0); ms.forEach((m) => curve(m).forEach((v, i) => (avg[i] += v / ms.length)));
    const cur = curve(ym); const today = +S.asOf().slice(8);
    const curShown = cur.map((v, i) => (i < today ? v : null));
    const diff = cur[today - 1] - avg[today - 1];
    return {
      headline: diff > 0 ? `${U.short(diff)} ahead of your usual pace` : `${U.short(-diff)} under your usual pace`, metric: `Day ${today}: ${U.short(cur[today - 1])} vs typical ${U.short(avg[today - 1])}`, severity: diff > avg[today - 1] * 0.15 ? 'warn' : 'good',
      detail: 'Cumulative variable spending this month against the average of the last six full months.',
      render: (el) => C.line(el, { labels: avg.map((_, i) => String(i + 1)), series: [{ name: '6-month average', values: avg, color: 's7', dash: true }, { name: 'This month', values: curShown, color: 's2', area: true }], marker: today - 1, h: 230 }),
    };
  });

  /* 20. fixed vs variable */
  def('fixedvar', 'Income', 'Fixed vs variable costs', 'How much of your spending is locked in?', () => {
    const ms = fullMonths(12);
    const fx = ms.map((m) => U.sum(Object.entries(S.month(m).byCat).filter(([c]) => FIXED_CATS.has(c) || S.cat(c).group === 'Housing'), (x) => x[1]));
    const vr = ms.map((m, i) => S.month(m).expense - fx[i]);
    const share = U.sum(fx) / (U.sum(fx) + U.sum(vr) || 1);
    return {
      headline: `${U.pct(share)} of your spending is fixed`, metric: U.short(U.avg(fx)) + ' fixed per month', severity: share > 0.55 ? 'warn' : 'info',
      detail: 'Fixed costs are EMIs, housing, insurance, utilities and taxes. A high fixed share leaves less room to absorb a pay cut.',
      render: (el) => C.bars(el, { labels: ms.map((m) => U.monLabel(m)), stacked: true, series: [{ name: 'Fixed', values: fx, color: 's7' }, { name: 'Variable', values: vr, color: 's1' }], h: 230 }),
    };
  });

  /* 21. anomalies */
  def('anomaly', 'Risk', 'Unusual transactions', 'Which purchases were far outside your normal range?', () => {
    const tx = exp(12);
    const byC = U.groupBy(tx, (t) => t.categoryId);
    const flagged = [];
    const gmed = U.median(tx.map((t) => t.amount));
    byC.forEach((arr) => {
      if (arr.length < 5) { arr.forEach((t) => { if (!A.isFixed(t) && t.amount > gmed * 25) flagged.push({ t, z: 99, med: gmed }); }); return; }
      const amts = arr.map((t) => t.amount), med = U.median(amts), mad = U.median(amts.map((a) => Math.abs(a - med))) || med * 0.3;
      arr.forEach((t) => { const z = (0.6745 * (t.amount - med)) / mad; if (z > 6 && t.amount > med * 3) flagged.push({ t, z, med }); });
    });
    flagged.sort((a, b) => b.t.amount - a.t.amount);
    const pts = tx.slice(0, 1500).map((t) => ({ x: U.daysBetween(win(12)[0], t.date), y: t.amount, color: 's1', label: t.payee, tip: `<div class="tip-sub">${U.fmtDate(t.date)} · ${U.money(t.amount)}</div>` }));
    flagged.forEach((f) => pts.push({ x: U.daysBetween(win(12)[0], f.t.date), y: f.t.amount, color: 'var(--bad)', label: f.t.payee, tip: `<div class="tip-sub">${U.fmtDate(f.t.date)} · ${U.money(f.t.amount)} · ${Math.round(f.t.amount / f.med)}× normal</div>` }));
    return {
      headline: flagged.length ? `${flagged.length} transaction${flagged.length > 1 ? 's were' : ' was'} far outside their category's norm` : 'Nothing unusual this year', metric: flagged[0] ? `Largest: ${flagged[0].t.payee} ${U.short(flagged[0].t.amount)}` : '', severity: flagged.length ? 'warn' : 'good',
      detail: flagged.slice(0, 4).map((f) => `${f.t.payee} (${U.money(f.t.amount)}, ${Math.round(f.t.amount / f.med)}× the usual ${catName(f.t.categoryId)} amount)`).join('; ') || 'Uses a robust z-score (median and MAD) per category.',
      render: (el) => C.scatter(el, { points: pts, xfmt: (d) => U.monLabel(U.ym(U.addDays(win(12)[0], d))), xlabel: 'Date →', h: 250 }),
      list: flagged.map((f) => f.t),
    };
  });

  /* 22. recurring detection */
  A.detectRecurring = () => {
    const by = U.groupBy(S.expenses().filter((t) => t.date >= U.addMonths(S.asOf(), -14)), (t) => t.payee);
    const out = [];
    by.forEach((arr, payee) => {
      if (arr.length < 3) return;
      const ms = new Set(arr.map((t) => U.ym(t.date)));
      if (ms.size < 3 || ms.size < arr.length * 0.8) return;
      const amts = arr.map((t) => t.amount), med = U.median(amts);
      const stable = amts.filter((a) => Math.abs(a - med) / med < 0.35).length / amts.length;
      if (stable < 0.75) return;
      const sorted = [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));
      const gaps = sorted.slice(1).map((t, i) => U.daysBetween(sorted[i].date, t.date));
      const g = U.median(gaps);
      const freq = g >= 25 && g <= 35 ? 'monthly' : g >= 350 && g <= 380 ? 'yearly' : g >= 85 && g <= 95 ? 'quarterly' : null;
      if (!freq) return;
      const first = sorted[0].amount, last = sorted[sorted.length - 1].amount;
      out.push({ payee, freq, amount: last, first, change: last - first, count: arr.length, categoryId: sorted[0].categoryId, lastDate: sorted[sorted.length - 1].date, known: S.state.bills.some((b) => b.name === payee) });
    });
    return out.sort((a, b) => S.monthlyCost(b) - S.monthlyCost(a));
  };
  def('recurring', 'Risk', 'Recurring charges found', 'What repeats on your statements?', () => {
    const r = A.detectRecurring();
    const monthly = U.sum(r, (x) => (x.freq === 'yearly' ? x.amount / 12 : x.freq === 'quarterly' ? x.amount / 3 : x.amount));
    const unknown = r.filter((x) => !x.known);
    return {
      headline: `${r.length} recurring charges cost ${U.short(monthly)} a month`, metric: unknown.length ? unknown.length + ' not yet tracked as bills' : 'All tracked', severity: unknown.length ? 'warn' : 'good',
      detail: 'Found by looking for payees that charge on a regular interval with a stable amount.',
      render: (el) => C.hbars(el, r.slice(0, 10).map((x, i) => ({ label: x.payee, value: x.freq === 'yearly' ? x.amount / 12 : x.amount, sub: x.freq + (x.known ? '' : ' · not tracked') + (x.change > 0 ? ' · up ' + U.money(x.change) : ''), color: x.known ? 's1' : 's2' })), { fmt: (v) => U.money(v) + '/mo' }),
    };
  });

  /* 23. price creep */
  def('pricecreep', 'Risk', 'Price increases', 'Which subscriptions quietly got more expensive?', () => {
    const r = A.detectRecurring().filter((x) => x.change > 0);
    const yearly = U.sum(r, (x) => x.change * (x.freq === 'monthly' ? 12 : 1));
    return {
      headline: r.length ? `${r.length} recurring charge${r.length > 1 ? 's' : ''} went up, costing ${U.money(yearly)} more a year` : 'No price increases detected', metric: r[0] ? `${r[0].payee}: ${U.money(r[0].first)} → ${U.money(r[0].amount)}` : '', severity: r.length ? 'warn' : 'good',
      detail: 'Compares the first and latest amount for each detected recurring payee over the last 14 months.',
      render: (el) => r.length ? C.bars(el, { labels: r.map((x) => x.payee.split(' ')[0]), tipLabels: r.map((x) => x.payee), series: [{ name: 'Then', values: r.map((x) => x.first), color: 's7' }, { name: 'Now', values: r.map((x) => x.amount), color: 's2' }], h: 210 }) : C.empty(el, 'No price changes found'),
    };
  });

  /* 24. duplicates */
  def('dupes', 'Risk', 'Possible duplicate charges', 'Were you charged twice for anything?', () => {
    const tx = exp(12).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const seen = new Map(), dup = [];
    tx.forEach((t) => {
      const k = t.payee + '|' + t.amount;
      const prev = seen.get(k);
      if (prev && U.daysBetween(prev.date, t.date) <= 2 && t.amount >= 200) dup.push([prev, t]);
      seen.set(k, t);
    });
    return {
      headline: dup.length ? `${dup.length} possible double charges` : 'No duplicate charges found', metric: dup.length ? U.money(U.sum(dup, (d) => d[1].amount)) + ' to check' : 'All clear', severity: dup.length ? 'warn' : 'good',
      detail: 'Same merchant, same amount, within two days. Some are legitimate (two coffees), others are worth a dispute.',
      render: (el) => { el.innerHTML = dup.length ? `<div class="mini-list">${dup.slice(0, 8).map(([a, b]) => `<div class="ml-row"><span>${U.esc(a.payee)}</span><span class="muted">${U.fmtDate(a.date, { year: false })} & ${U.fmtDate(b.date, { year: false })}</span><b>${U.money(b.amount)}</b></div>`).join('')}</div>` : `<div class="chart-empty">${LL.I('check', 22)}<span>Nothing to review</span></div>`; },
    };
  });

  /* 25. credit utilisation */
  def('utilisation', 'Risk', 'Credit card utilisation', 'How much of your card limits do you use?', () => {
    const cards = S.state.accounts.filter((a) => a.type === 'credit' && a.limit);
    if (!cards.length) return null;
    const ms = S.months(12);
    const lim = U.sum(cards, (c) => c.limit);
    const util = ms.map((m) => { const asOf = m === S.curYM() ? S.asOf() : m + '-' + U.daysInMonth(m); return (U.sum(cards, (c) => Math.max(0, -S.accountBalance(c.id, asOf))) / lim) * 100; });
    const now = util[util.length - 1];
    return {
      headline: `You are using ${now.toFixed(0)}% of your card limits`, metric: `Average ${U.avg(util).toFixed(0)}% · limit ${U.short(lim)}`, severity: now > 30 ? 'warn' : 'good',
      detail: 'Month-end balance across all cards divided by total limit. Below 30% is good for your credit score.',
      render: (el) => C.line(el, { labels: ms.map((m) => U.monLabel(m)), series: [{ name: 'Utilisation', values: util, color: 's5', area: true }], fmt: (v) => v + '%', tipFmt: (v) => v.toFixed(1) + '%', h: 210 }),
    };
  });

  /* 26. runway */
  def('runway', 'Risk', 'Emergency runway', 'How long could you live on your cash?', () => {
    const ms = fullMonths(12);
    const run = ms.map((m) => { const asOf = m + '-' + U.daysInMonth(m); const burn = U.avg(S.months().filter((x) => x <= m).slice(-3).map((x) => S.month(x).expense)) || 1; return S.liquid(asOf) / burn; });
    const now = run[run.length - 1] || 0;
    return {
      headline: `Your cash covers ${now.toFixed(1)} months of spending`, metric: now >= 6 ? 'Above the 6-month target' : `${(6 - now).toFixed(1)} months short of 6`, severity: now >= 6 ? 'good' : now >= 3 ? 'warn' : 'bad',
      detail: 'Bank, savings and cash balances divided by your average spending over the previous three months. Investments are not counted.',
      render: (el) => C.line(el, { labels: ms.map((m) => U.monLabel(m)), series: [{ name: 'Months of runway', values: run, color: 's3', area: true }], fmt: (v) => v.toFixed(0) + 'm', tipFmt: (v) => v.toFixed(1) + ' months', h: 210 }),
    };
  });

  /* 27. category forecast */
  A.forecastCat = (catId) => {
    const ms = fullMonths(6); const ys = ms.map((m) => S.month(m).byCat[catId] || 0);
    const w = [1, 1, 1.5, 1.5, 2, 2.5].slice(-ys.length), wsum = U.sum(w);
    const wma = U.sum(ys.map((y, i) => y * w[i])) / (wsum || 1);
    const { slope } = U.linreg(ys);
    const f = Math.max(0, wma + slope * 0.5), sd = U.std(ys);
    return { f, lo: Math.max(0, f - sd), hi: f + sd };
  };
  def('forecast', 'Forecast', 'Next month forecast', 'What will next month probably cost?', () => {
    const cats = S.expenseCats().map((c) => ({ c, ...A.forecastCat(c.id) })).filter((x) => x.f > 300).sort((a, b) => b.f - a.f);
    const total = U.sum(cats, (x) => x.f), lo = U.sum(cats, (x) => x.lo), hi = U.sum(cats, (x) => x.hi);
    const next = U.ymAdd(S.curYM(), 1);
    return {
      headline: `${U.monLabel(next, true)} will likely cost about ${U.short(total)}`, metric: `Likely range ${U.short(lo)}–${U.short(hi)}`, severity: 'info',
      detail: 'Weighted moving average of the last six full months plus the recent trend, per category. The range is one standard deviation.',
      render: (el) => C.hbars(el, cats.slice(0, 10).map((x, i) => ({ label: x.c.name, value: x.f, sub: U.short(x.lo) + '–' + U.short(x.hi), color: C.series(i % 8) }))),
    };
  });

  /* 28. year-end projection */
  def('yearend', 'Forecast', 'Net worth trajectory', 'Where is your net worth heading?', () => {
    const nw = S.netWorthSeries().map((x) => x.net);
    if (nw.length < 4) return null;
    const recent = nw.slice(-12); const { slope, intercept } = U.linreg(recent);
    const ahead = 12; const labels = S.months().map((m) => U.monLabel(m, true));
    const fut = []; for (let k = 1; k <= ahead; k++) fut.push(intercept + slope * (recent.length - 1 + k));
    const futLabels = []; for (let k = 1; k <= ahead; k++) futLabels.push(U.monLabel(U.ymAdd(S.curYM(), k), true));
    const hist = [...nw, ...Array(ahead).fill(null)], proj = [...Array(nw.length - 1).fill(null), nw[nw.length - 1], ...fut];
    return {
      headline: `On this pace you add ${U.short(slope)} a month`, metric: `In 12 months: ${U.short(fut[fut.length - 1])}`, severity: slope > 0 ? 'good' : 'bad',
      detail: 'Linear trend fitted to the last 12 months of net worth (assets minus loans and card balances), projected one year ahead.',
      render: (el) => C.line(el, { labels: [...labels, ...futLabels], series: [{ name: 'Net worth', values: hist, color: 's1', area: true }, { name: 'Projection', values: proj, color: 's3', dash: true }], marker: nw.length - 1, markerLabel: 'Now', zero: false, h: 240 }),
    };
  });

  /* 29. correlation */
  def('corr', 'Spending', 'Spending that moves together', 'Which categories rise and fall at the same time?', () => {
    const ms = fullMonths(12);
    const cats = S.expenseCats().filter((c) => !FIXED_CATS.has(c.id)).map((c) => ({ c, ys: ms.map((m) => S.month(m).byCat[c.id] || 0) })).filter((x) => U.sum(x.ys) > 6000).sort((a, b) => U.sum(b.ys) - U.sum(a.ys)).slice(0, 7);
    const mat = cats.map((a) => cats.map((b) => U.pearson(a.ys, b.ys)));
    let best = null; cats.forEach((a, i) => cats.forEach((b, j) => { if (j > i && (!best || mat[i][j] > best.r)) best = { a: a.c.name, b: b.c.name, r: mat[i][j] }; }));
    const short = (n) => n.split(' ')[0].replace('&', '');
    return {
      headline: best ? `${best.a} and ${best.b} move together (r = ${best.r.toFixed(2)})` : 'Not enough data', metric: cats.length + ' categories compared', severity: 'info',
      detail: 'Pearson correlation of monthly totals. Blue means they rise together, red means one rises when the other falls. Linked categories can be budgeted together.',
      render: (el) => C.heatmap(el, { rows: cats.map((x) => short(x.c.name)), cols: cats.map((x) => short(x.c.name)), data: mat, diverging: true, showValues: true, fmt: (v) => 'r = ' + v.toFixed(2), padL: 72, cellH: 34 }),
    };
  });

  /* 30. Benford */
  def('benford', 'Risk', 'Data quality check', "Do your amounts follow Benford's law?", () => {
    const tx = S.state.transactions.filter((t) => t.amount >= 10);
    const cnt = Array(9).fill(0); tx.forEach((t) => { const d = +String(Math.floor(t.amount))[0]; if (d) cnt[d - 1]++; });
    const n = U.sum(cnt) || 1, obs = cnt.map((c) => c / n), exp9 = [...Array(9).keys()].map((k) => Math.log10(1 + 1 / (k + 1)));
    const mad = U.avg(obs.map((o, i) => Math.abs(o - exp9[i])));
    return {
      headline: mad < 0.012 ? 'Your amounts look natural' : mad < 0.022 ? 'Your amounts are close to the expected pattern' : 'Your amounts deviate from the expected pattern',
      metric: 'Deviation ' + (mad * 100).toFixed(2) + ' pts', severity: mad < 0.022 ? 'good' : 'warn',
      detail: "In natural financial data, about 30% of amounts start with 1. Large deviations can point to rounded estimates or import errors.",
      render: (el) => C.bars(el, { labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], series: [{ name: 'Your data', values: obs.map((v) => v * 100), color: 's1' }], line: { name: "Benford's expected", values: exp9.map((v) => v * 100), color: 's2' }, fmt: (v) => v + '%', tipFmt: (v) => v.toFixed(1) + '%', lineFmt: (v) => v.toFixed(1) + '%', h: 210 }),
    };
  });

  /* 31. personality radar */
  def('persona', 'Habits', 'Money personality', 'What kind of spender are you?', () => {
    const tx = disc(); const tot = U.sum(tx, (t) => t.amount) || 1;
    const g = (grp) => U.sum(tx.filter((t) => S.cat(t.categoryId).group === grp), (t) => t.amount) / tot;
    const ms = fullMonths(6); const sr = U.avg(ms.map((m) => { const x = S.month(m); return x.income ? (x.income - x.expense) / x.income : 0; }));
    const night = U.sum(tx.filter((t) => hour(t) >= 22 || hour(t) < 4), (t) => t.amount) / tot;
    const bud = S.budgetStatus(U.ymAdd(S.curYM(), -1)); const planner = bud.length ? bud.filter((b) => b.ratio <= 1).length / bud.length : 0.5;
    const axes = ['Foodie', 'Shopper', 'Explorer', 'Commuter', 'Night owl', 'Saver', 'Planner'];
    const vals = [g('Food') / 0.45, g('Shopping') / 0.35, g('Travel') / 0.2, g('Transport') / 0.3, night / 0.25, sr / 0.4, planner].map((v) => U.clamp(v, 0.05, 1));
    const top = axes[vals.indexOf(Math.max(...vals))];
    return {
      headline: `You are mostly a ${top}`, metric: axes.map((a, i) => (vals[i] > 0.6 ? a : null)).filter(Boolean).join(' · ') || 'Balanced', severity: 'info',
      detail: 'Scores compare your spending mix, savings rate, budget discipline and late-night habits against typical benchmarks.',
      render: (el) => C.radar(el, { axes, series: [{ name: 'You', values: vals, color: 's1' }], size: 300 }),
    };
  });

  /* 32. budget adherence */
  def('adherence', 'Spending', 'Budget adherence history', 'Which budgets do you keep breaking?', () => {
    const ms = fullMonths(8);
    if (!S.state.budgets.length) return null;
    const rows = S.state.budgets.map((b) => ({ b, r: ms.map((m) => (S.month(m).byCat[b.categoryId] || 0) / b.amount) }));
    rows.sort((a, b) => U.sum(b.r) - U.sum(a.r));
    const over = rows.map((x) => x.r.filter((v) => v > 1).length);
    const worst = rows[0];
    return {
      headline: worst ? `${catName(worst.b.categoryId)} went over budget in ${worst.r.filter((v) => v > 1).length} of ${ms.length} months` : '', metric: U.sum(over) + ' overruns in ' + ms.length + ' months', severity: U.sum(over) > rows.length * 2 ? 'warn' : 'good',
      detail: 'Each cell is spend as a share of that month’s budget. Dark cells are overruns. Budgets that always break probably need a higher limit.',
      render: (el) => C.heatmap(el, { rows: rows.map((x) => catName(x.b.categoryId)), cols: ms.map((m) => U.monLabel(m)), data: rows.map((x) => x.r), fmt: (v) => U.pct(v) + ' of budget', hue: '--heat-warm', padL: 120, cellH: 22 }),
    };
  });

  /* ---------------- runner ---------------- */
  A.defs = defs;
  A.groups = ['Spending', 'Habits', 'Income', 'Risk', 'Forecast'];
  A.run = (id) => {
    const d = defs.find((x) => x.id === id);
    if (!d) return null;
    const key = 'an_' + id;
    if (S.cache[key] !== undefined) return S.cache[key];
    let r = null;
    try { r = S.state.transactions.length > 20 ? d.fn() : null; } catch (e) { console.warn('analysis failed', id, e); r = null; }
    S.cache[key] = r ? { ...d, ...r } : null;
    return S.cache[key];
  };
  A.all = () => defs.map((d) => A.run(d.id)).filter(Boolean);
  A.insights = (n = 6) => {
    const order = { bad: 0, warn: 1, good: 2, info: 3 };
    return A.all().sort((a, b) => order[a.severity] - order[b.severity]).slice(0, n);
  };

  /* future value of a monthly contribution */
  A.fv = (pmt, rate, years) => { const r = rate / 12, n = years * 12; return r ? pmt * ((Math.pow(1 + r, n) - 1) / r) * (1 + r) : pmt * n; };

  /* ---------------- financial health score ---------------- */
  A.health = () => {
    if (S.cache.health) return S.cache.health;
    const ms = fullMonths(3);
    const inc = U.avg(ms.map((m) => S.month(m).income)), spend = U.avg(ms.map((m) => S.month(m).expense));
    const sr = inc ? (inc - spend) / inc : 0;
    const runway = S.liquid() / (spend || 1);
    const emi = U.sum(S.state.debts.filter((d) => d.kind !== 'lent' && S.debtBalance(d) > 0), (d) => d.emi || 0);
    const dti = inc ? emi / inc : 0;
    const bud = S.budgetStatus(U.ymAdd(S.curYM(), -1));
    const adh = bud.length ? bud.filter((b) => b.ratio <= 1).length / bud.length : 0.7;
    const cards = S.state.accounts.filter((a) => a.type === 'credit' && a.limit);
    const util = cards.length ? S.cardDebt() / U.sum(cards, (c) => c.limit) : 0;
    const nws = S.netWorthSeries(); const nwg = nws.length > 6 ? (nws[nws.length - 1].net - nws[nws.length - 7].net) / Math.abs(nws[nws.length - 7].net || 1) : 0;
    const parts = [
      { k: 'Savings rate', v: U.clamp(sr / 0.3, 0, 1), w: 25, show: U.pct(sr), tip: '30%+ scores full marks' },
      { k: 'Emergency runway', v: U.clamp(runway / 6, 0, 1), w: 20, show: runway.toFixed(1) + ' months', tip: '6 months of spending in cash' },
      { k: 'Debt load (EMI ÷ income)', v: U.clamp(1 - (dti - 0.15) / 0.35, 0, 1), w: 20, show: U.pct(dti), tip: 'Under 15% is ideal, over 50% is risky' },
      { k: 'Budget discipline', v: adh, w: 15, show: U.pct(adh) + ' kept', tip: 'Share of budgets kept last month' },
      { k: 'Card utilisation', v: U.clamp(1 - (util - 0.1) / 0.4, 0, 1), w: 10, show: U.pct(util), tip: 'Under 10% scores full marks' },
      { k: 'Net worth growth (6m)', v: U.clamp(0.5 + nwg * 5, 0, 1), w: 10, show: U.pct(nwg, 1), tip: '+10% in six months scores full marks' },
    ];
    const score = Math.round(U.sum(parts, (p) => p.v * p.w));
    return (S.cache.health = { score, parts, label: score >= 80 ? 'Excellent' : score >= 65 ? 'Healthy' : score >= 45 ? 'Needs attention' : 'At risk' });
  };
})(window.LL);
