/* Ledgerlight — money pages: accounts, transactions, budgets, bills & subscriptions, calendar */
(function (LL) {
  'use strict';
  const U = LL.U, S = LL.S, C = LL.C, A = LL.A, I = LL.I;
  const COLORS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((c, i) => ({ value: c, label: ['Blue', 'Orange', 'Aqua', 'Amber', 'Pink', 'Green', 'Violet', 'Red'][i] }));

  /* ===================== ACCOUNTS ===================== */
  const accFields = (a = {}) => [
    { key: 'name', label: 'Account name', required: true },
    { key: 'type', label: 'Type', type: 'select', options: LL.ACC_TYPES.map(([v, l]) => ({ value: v, label: l })), half: true },
    { key: 'institution', label: 'Bank or provider', half: true },
    { key: 'opening', label: a.type === 'property' || a.type === 'vehicle' ? 'Current value' : 'Opening balance', type: 'number', step: '0.01', half: true, default: 0 },
    { key: 'openingDate', label: 'Opening date', type: 'date', half: true, default: U.today() },
    { key: 'limit', label: 'Credit limit (cards)', type: 'number', half: true },
    { key: 'rate', label: 'Interest rate % (optional)', type: 'number', step: '0.01', half: true },
    { key: 'group', label: 'Group', half: true, default: 'Liquid', placeholder: 'Liquid, Cards, Investments…' },
    { key: 'color', label: 'Colour', type: 'select', options: COLORS, half: true },
    { key: 'includeInNetWorth', label: 'Net worth', type: 'checkbox', hint: 'Include in net worth', default: true },
    { key: 'archived', label: 'Archive', type: 'checkbox', hint: 'Hide this account (history is kept)' },
  ];
  LL.editAccount = (a) => LL.editRecord({ col: 'accounts', title: a ? 'Edit account' : 'New account', fields: accFields(a), rec: a, onSave: (v) => { if ((v.type === 'property' || v.type === 'vehicle') && (!v.valuations || !v.valuations.length)) v.valuations = [{ date: U.today(), value: v.opening }]; return v; } });

  LL.V.accounts = {
    title: 'Accounts',
    render(root, p) {
      const accs = S.state.accounts.filter((a) => !a.archived);
      const groups = [...new Set(accs.map((a) => a.group || 'Other'))];
      const liquid = S.liquid(), cards = S.cardDebt();
      const inv = U.sum(accs.filter((a) => ['investment', 'retirement'].includes(a.type)), (a) => S.accountBalance(a.id));
      const real = U.sum(accs.filter((a) => ['property', 'vehicle', 'asset'].includes(a.type)), (a) => S.accountBalance(a.id));
      root.innerHTML = `
        <div class="page-intro"><div><h2>All your accounts</h2><p>Click an account for its balance history and transactions. Reconcile against a statement to make sure the numbers match your bank.</p></div><div class="toolbar"><button class="btn primary" id="acc-new">${I('plus', 16)}Add account</button></div></div>
        <div class="grid">
          ${LL.kpi({ cls: 'c3', label: 'Cash & bank', icon: 'bank', value: liquid })}
          ${LL.kpi({ cls: 'c3', label: 'Card balances', icon: 'card', value: -cards })}
          ${LL.kpi({ cls: 'c3', label: 'Investments', icon: 'trend', value: inv })}
          ${LL.kpi({ cls: 'c3', label: 'Property & vehicles', icon: 'house', value: real })}
        </div>
        ${groups.map((g) => `<div class="section-h"><h2>${U.esc(g)}</h2><p>${U.money(U.sum(accs.filter((a) => (a.group || 'Other') === g), (a) => S.accountBalance(a.id)))}</p></div>
          <div class="grid">${accs.filter((a) => (a.group || 'Other') === g).map((a) => {
            const bal = S.accountBalance(a.id);
            const tr = S.months(12).map((m) => S.accountBalance(a.id, m === S.curYM() ? S.asOf() : m + '-' + U.daysInMonth(m)));
            const util = a.type === 'credit' && a.limit ? -Math.min(0, bal) / a.limit : null;
            return `<section class="card acc-card c3 rise tilt" data-id="${a.id}" style="--c:var(--${a.color || 's1'})">
              <div class="acc-top"><span class="acc-ico">${I(LL.ACC_ICON[a.type] || 'wallet', 20)}</span><div style="min-width:0"><div class="acc-n">${U.esc(a.name)}</div><div class="acc-i">${U.esc(a.institution || LL.ACC_TYPES.find((x) => x[0] === a.type)?.[1] || '')}</div></div><button class="icon-btn" data-edit="${a.id}" style="margin-left:auto;width:30px;height:30px" aria-label="Edit">${I('edit', 14)}</button></div>
              <div class="acc-bal ${bal < 0 ? 'down' : ''}" data-count="${bal}">${U.money(bal)}</div>
              ${util != null ? `<div><div class="bar-track"><div class="bar-fill" style="--w:${Math.min(100, util * 100)}%;--c:${util > 0.3 ? 'var(--warn)' : 'var(--good)'}"></div></div><div class="kbd-hint" style="margin-top:4px">${U.pct(util)} of ${U.short(a.limit)} limit used</div></div>` : C.spark(tr, { w: 220, h: 40, color: 'var(--' + (a.color || 's1') + ')' })}
            </section>`;
          }).join('')}</div>`).join('')}
        <div class="section-h"><h2>Account detail</h2><select id="acc-sel" style="max-width:280px">${accs.map((a) => `<option value="${a.id}">${U.esc(a.name)}</option>`).join('')}</select><div class="toolbar"><button class="btn sm" id="acc-rec">${I('check', 14)}Reconcile</button><a class="btn sm" id="acc-tx">${I('list', 14)}Transactions</a></div></div>
        <div class="grid">
          ${LL.card({ cls: 'c8', title: 'Balance history', icon: 'trend', body: '<div id="acc-line"></div>' })}
          ${LL.card({ cls: 'c4', title: 'Monthly in & out', icon: 'bar', sub: 'Last 6 months', body: '<div id="acc-io"></div>' })}
        </div>
        ${S.state.accounts.some((a) => a.archived) ? `<div class="section-h"><h2>Archived</h2></div><div class="toolbar">${S.state.accounts.filter((a) => a.archived).map((a) => `<button class="chip" data-edit="${a.id}">${U.esc(a.name)}</button>`).join('')}</div>` : ''}`;
      U.$('#acc-new', root).onclick = () => LL.editAccount();
      U.on(root, 'click', '[data-edit]', (e, b) => { e.stopPropagation(); LL.editAccount(S.get('accounts', b.dataset.edit)); });
      const sel = U.$('#acc-sel', root);
      if (p.id) sel.value = p.id;
      U.on(root, 'click', '.acc-card', (e, c) => { sel.value = c.dataset.id; drawDetail(); U.$('#acc-line', root).scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      const drawDetail = () => {
        const id = sel.value, a = S.acc(id);
        U.$('#acc-tx', root).href = '#transactions?account=' + id;
        const ms = S.months();
        C.track(() => C.line(U.$('#acc-line', root), { labels: ms.map((m) => U.monLabel(m, true)), series: [{ name: a.name, values: ms.map((m) => S.accountBalance(id, m === S.curYM() ? S.asOf() : m + '-' + U.daysInMonth(m))), color: a.color || 's1', area: true }], h: 260 }));
        const six = S.months(6);
        const io = six.map((m) => { let i = 0, o = 0; S.state.transactions.forEach((t) => { if (U.ym(t.date) !== m) return; if (t.toAccountId === id) i += t.amount; else if (t.accountId === id) t.type === 'income' ? (i += t.amount) : (o += t.amount); }); return [i, o]; });
        C.track(() => C.bars(U.$('#acc-io', root), { labels: six.map((m) => U.monLabel(m)), series: [{ name: 'In', values: io.map((x) => x[0]), color: 's3' }, { name: 'Out', values: io.map((x) => x[1]), color: 's2' }], h: 260 }));
      };
      sel.onchange = drawDetail;
      drawDetail();
      U.$('#acc-rec', root).onclick = () => {
        const a = S.acc(sel.value), bal = S.accountBalance(a.id);
        const f = U.form([{ key: 'stmt', label: 'Statement ending balance', type: 'number', step: '0.01', required: true }, { key: 'date', label: 'Statement date', type: 'date', default: S.asOf() }]);
        U.modal({ title: 'Reconcile ' + a.name, body: U.h(`<div><p class="muted-p" style="margin-bottom:12px">Ledgerlight shows <b>${U.money(bal)}</b>. Enter the balance printed on your statement.</p></div>`), onOpen: (m) => U.$('.modal-body > div', m).appendChild(f), actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Reconcile', kind: 'primary', onClick: () => {
          if (!f.check()) return false;
          const v = f.read(); const ours = S.accountBalance(a.id, v.date); const diff = U.round(v.stmt - ours);
          S.state.transactions.forEach((t) => { if ((t.accountId === a.id || t.toAccountId === a.id) && t.date <= v.date && t.status !== 'pending') t.status = 'reconciled'; });
          if (Math.abs(diff) >= 0.01) S.upsert('transactions', { type: diff > 0 ? 'income' : 'expense', amount: Math.abs(diff), accountId: a.id, categoryId: diff > 0 ? 'cat_refunds' : 'cat_fees', payee: 'Balance adjustment', notes: 'Reconciliation on ' + U.fmtDate(v.date), date: v.date, time: '23:59', tags: ['adjustment'], status: 'reconciled' });
          else S.touch('transactions');
          U.toast(Math.abs(diff) < 0.01 ? 'Balanced. Everything matches.' : 'Added a ' + U.money(diff, { sign: true }) + ' adjustment');
        } }] });
      };
    },
  };

  /* ===================== TRANSACTIONS ===================== */
  LL.V.transactions = {
    title: 'Transactions',
    render(root, p) {
      const f = { q: p.q || '', account: p.account || '', category: p.category || '', group: p.group || '', type: p.type || '', month: p.month || '', day: p.day || '', tag: p.tag || '', status: '', min: '', max: '' };
      let sort = { k: 'date', dir: -1 }, limit = 100;
      const picked = new Set();
      const months = S.months().slice().reverse();
      root.innerHTML = `
        <div class="page-intro"><div><h2>Every rupee, searchable</h2><p>Filter, sort, edit in bulk and export. Click any row to edit it.</p></div><div class="toolbar"><button class="btn" id="tx-export">${I('download', 16)}Export CSV</button><a class="btn" href="#data">${I('upload', 16)}Import</a><button class="btn primary" onclick="LL.txForm()">${I('plus', 16)}Add</button></div></div>
        <section class="card rise" style="margin-bottom:16px">
          <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
            <div class="field" style="grid-column:span 2"><label for="tf-q">Search</label><input id="tf-q" type="search" placeholder="Payee, note, tag or amount" value="${U.esc(f.q)}"></div>
            <div class="field half"><label for="tf-account">Account</label><select id="tf-account"><option value="">All accounts</option>${S.state.accounts.map((a) => `<option value="${a.id}" ${f.account === a.id ? 'selected' : ''}>${U.esc(a.name)}</option>`).join('')}</select></div>
            <div class="field half"><label for="tf-category">Category</label><select id="tf-category"><option value="">All categories</option>${S.state.categories.map((c) => `<option value="${c.id}" ${f.category === c.id ? 'selected' : ''}>${U.esc(c.group + ' · ' + c.name)}</option>`).join('')}</select></div>
            <div class="field half"><label for="tf-group">Group</label><select id="tf-group"><option value="">All groups</option>${[...new Set(S.state.categories.map((c) => c.group))].map((g) => `<option ${f.group === g ? 'selected' : ''}>${U.esc(g)}</option>`).join('')}</select></div>
            <div class="field half"><label for="tf-type">Type</label><select id="tf-type"><option value="">All types</option>${['expense', 'income', 'transfer'].map((t) => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            <div class="field half"><label for="tf-month">Month</label><select id="tf-month"><option value="">All months</option>${months.map((m) => `<option value="${m}" ${f.month === m ? 'selected' : ''}>${U.monLabel(m, true)}</option>`).join('')}</select></div>
            <div class="field half"><label for="tf-tag">Tag</label><select id="tf-tag"><option value="">Any tag</option>${S.tags().map(([g, n]) => `<option value="${U.esc(g)}" ${f.tag === g ? 'selected' : ''}>#${U.esc(g)} (${n})</option>`).join('')}</select></div>
            <div class="field half"><label for="tf-status">Status</label><select id="tf-status"><option value="">Any status</option><option value="pending">Pending</option><option value="cleared">Cleared</option><option value="reconciled">Reconciled</option></select></div>
            <div class="field half"><label for="tf-min">Min amount</label><input id="tf-min" type="number"></div>
            <div class="field half"><label for="tf-max">Max amount</label><input id="tf-max" type="number"></div>
          </div>
          <div class="toolbar" style="margin-top:12px">${f.day ? `<span class="chip on">Day: ${U.fmtDate(f.day)} <button class="icon-btn" id="tf-clearday" style="width:20px;height:20px;border:0">${I('x', 12)}</button></span>` : ''}<button class="btn sm ghost" id="tf-reset">${I('x', 14)}Clear filters</button><span class="muted" id="tf-count"></span></div>
        </section>
        <div class="grid" style="margin-bottom:16px">
          <div class="c8 card rise"><div class="card-h"><span class="ico-wrap">${I('bar', 16)}</span><h3>Filtered spending by month</h3></div><div id="tx-chart"></div></div>
          <div class="c4 card rise"><div class="card-h"><span class="ico-wrap">${I('coin', 16)}</span><h3>Summary</h3></div><div class="stats" id="tx-stats"></div></div>
        </div>
        <section class="card rise">
          <div class="toolbar" id="tx-bulk" style="margin-bottom:10px" hidden><b id="tx-picked"></b><select id="bulk-cat" style="max-width:240px"><option value="">Move to category…</option>${LL.catOptions().map((o) => `<option value="${o.value}">${U.esc(o.label)}</option>`).join('')}</select><button class="btn sm" id="bulk-tag">${I('tag', 14)}Add tag</button><button class="btn sm" id="bulk-clear">${I('check', 14)}Mark cleared</button><button class="btn sm danger" id="bulk-del">${I('trash', 14)}Delete</button></div>
          <div class="table-wrap"><table class="tbl" id="tx-tbl"><thead><tr><th class="sel"><input type="checkbox" id="tx-all" aria-label="Select all"></th><th class="sortable" data-k="date">Date</th><th class="sortable" data-k="payee">Payee</th><th class="sortable" data-k="cat">Category</th><th>Account</th><th>Tags</th><th class="sortable r" data-k="amount">Amount</th></tr></thead><tbody></tbody></table></div>
          <div class="center" style="margin-top:12px"><button class="btn" id="tx-more" hidden>Show more</button></div>
        </section>`;
      const filtered = () => {
        const q = f.q.toLowerCase(), num = parseFloat(f.q);
        let out = S.state.transactions.filter((t) => {
          if (f.account && t.accountId !== f.account && t.toAccountId !== f.account) return false;
          if (f.category && t.categoryId !== f.category) return false;
          if (f.group && S.cat(t.categoryId).group !== f.group) return false;
          if (f.type && t.type !== f.type) return false;
          if (f.month && U.ym(t.date) !== f.month) return false;
          if (f.day && t.date !== f.day) return false;
          if (f.tag && !(t.tags || []).includes(f.tag)) return false;
          if (f.status && t.status !== f.status) return false;
          if (f.min !== '' && t.amount < +f.min) return false;
          if (f.max !== '' && t.amount > +f.max) return false;
          if (q && !((t.payee || '').toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q) || (t.tags || []).some((g) => g.toLowerCase().includes(q.replace('#', ''))) || (!isNaN(num) && Math.abs(t.amount - num) < 1))) return false;
          return true;
        });
        const k = sort.k;
        if (k !== 'date' || sort.dir !== -1) out = out.slice().sort((a, b) => { const va = k === 'cat' ? S.cat(a.categoryId).name : a[k], vb = k === 'cat' ? S.cat(b.categoryId).name : b[k]; return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir; });
        return out;
      };
      const draw = () => {
        const rows = filtered();
        const tbody = U.$('#tx-tbl tbody', root);
        tbody.innerHTML = rows.slice(0, limit).map((t, i) => {
          const c = S.cat(t.categoryId);
          const sign = t.type === 'income' ? '+' : t.type === 'transfer' ? '⇄ ' : '−';
          return `<tr class="clickable ${picked.has(t.id) ? 'picked' : ''}" data-id="${t.id}" style="animation:rise .4s ${Math.min(i * 12, 400)}ms both"><td class="sel"><input type="checkbox" data-pick="${t.id}" ${picked.has(t.id) ? 'checked' : ''} aria-label="Select"></td><td>${U.fmtDate(t.date)}<div class="kbd-hint">${t.time || ''}${t.status !== 'cleared' ? ' · ' + t.status : ''}</div></td><td class="wrap"><b>${U.esc(t.payee)}</b>${t.notes ? `<div class="kbd-hint">${U.esc(t.notes)}</div>` : ''}</td><td>${t.type === 'transfer' ? 'Transfer → ' + U.esc(S.acc(t.toAccountId).name) : U.esc(c.name)}</td><td>${U.esc(S.acc(t.accountId).name)}</td><td>${(t.tags || []).map((g) => `<span class="tag">#${U.esc(g)}</span>`).join('')}</td><td class="r ${t.type === 'income' ? 'up' : ''}">${sign}${U.money(t.amount)}</td></tr>`;
        }).join('') || `<tr><td colspan="7"><div class="chart-empty">${I('search', 22)}<span>No transactions match these filters.</span></div></td></tr>`;
        U.$('#tx-more', root).hidden = rows.length <= limit;
        U.$('#tf-count', root).textContent = `${rows.length.toLocaleString()} transactions`;
        const inc = U.sum(rows.filter(S.isIncome), (t) => t.amount), out = U.sum(rows.filter(S.isExpense), (t) => t.amount);
        const exp = rows.filter(S.isExpense);
        U.$('#tx-stats', root).innerHTML = [['Money in', U.money(inc)], ['Money out', U.money(out)], ['Net', U.money(inc - out)], ['Average payment', U.money(exp.length ? out / exp.length : 0)], ['Largest payment', U.money(Math.max(0, ...exp.map((t) => t.amount)))], ['Payees', new Set(rows.map((t) => t.payee)).size]].map(([l, v]) => `<div class="stat"><div class="s-l">${l}</div><div class="s-v">${v}</div></div>`).join('');
        const ms = S.months(); const by = {}; exp.forEach((t) => (by[U.ym(t.date)] = (by[U.ym(t.date)] || 0) + t.amount));
        C.track(() => C.bars(U.$('#tx-chart', root), { labels: ms.map((m) => U.monLabel(m)), tipLabels: ms.map((m) => U.monLabel(m, true)), series: [{ name: 'Spending', values: ms.map((m) => by[m] || 0), colors: ms.map((m) => (f.month === m ? 's2' : 's1')) }], h: 190, onClick: (i) => { f.month = ms[i]; U.$('#tf-month', root).value = f.month; draw(); } }));
        U.$('#tx-bulk', root).hidden = !picked.size;
        U.$('#tx-picked', root).textContent = picked.size + ' selected';
      };
      ['q', 'account', 'category', 'group', 'type', 'month', 'tag', 'status', 'min', 'max'].forEach((k) => {
        const el = U.$('#tf-' + k, root);
        el.addEventListener(k === 'q' || k === 'min' || k === 'max' ? 'input' : 'change', U.debounce(() => { f[k] = el.value; limit = 100; draw(); }, 150));
      });
      U.$('#tf-reset', root).onclick = () => { location.hash = 'transactions'; };
      const cd = U.$('#tf-clearday', root); if (cd) cd.onclick = () => { f.day = ''; cd.closest('.chip').remove(); draw(); };
      U.$('#tx-more', root).onclick = () => { limit += 200; draw(); };
      U.on(root, 'click', 'th.sortable', (e, th) => { const k = th.dataset.k; sort = { k, dir: sort.k === k ? -sort.dir : k === 'date' || k === 'amount' ? -1 : 1 }; draw(); });
      U.on(root, 'click', 'tr.clickable', (e, tr) => { if (e.target.closest('[data-pick]')) return; LL.txForm(S.get('transactions', tr.dataset.id)); });
      U.on(root, 'change', '[data-pick]', (e, cb) => { cb.checked ? picked.add(cb.dataset.pick) : picked.delete(cb.dataset.pick); cb.closest('tr').classList.toggle('picked', cb.checked); U.$('#tx-bulk', root).hidden = !picked.size; U.$('#tx-picked', root).textContent = picked.size + ' selected'; });
      U.$('#tx-all', root).onchange = (e) => { filtered().slice(0, limit).forEach((t) => (e.target.checked ? picked.add(t.id) : picked.delete(t.id))); draw(); };
      U.$('#bulk-cat', root).onchange = (e) => { if (!e.target.value) return; S.state.transactions.forEach((t) => { if (picked.has(t.id)) t.categoryId = e.target.value; }); U.toast(`Moved ${picked.size} transactions to ${S.cat(e.target.value).name}`); picked.clear(); S.touch('transactions'); };
      U.$('#bulk-clear', root).onclick = () => { S.state.transactions.forEach((t) => { if (picked.has(t.id)) t.status = 'cleared'; }); U.toast('Marked as cleared'); picked.clear(); S.touch('transactions'); };
      U.$('#bulk-tag', root).onclick = () => {
        const fm = U.form([{ key: 'tag', label: 'Tag to add', required: true, placeholder: 'e.g. reimbursable' }]);
        U.modal({ title: 'Tag ' + picked.size + ' transactions', body: fm, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Add tag', kind: 'primary', onClick: () => { if (!fm.check()) return false; const g = fm.read().tag.replace(/^#/, ''); S.state.transactions.forEach((t) => { if (picked.has(t.id)) t.tags = [...new Set([...(t.tags || []), g])]; }); picked.clear(); S.touch('transactions'); U.toast('Tagged #' + g); } }] });
      };
      U.$('#bulk-del', root).onclick = async () => { if (await U.confirm('Delete ' + picked.size + ' transactions?', 'They will be removed from your database. A backup is made only when you replace or clear all data, so export first if unsure.', 'Delete')) { S.removeMany('transactions', [...picked]); picked.clear(); U.toast('Deleted'); } };
      U.$('#tx-export', root).onclick = () => {
        const rows = filtered();
        U.download('ledgerlight-transactions-' + U.today() + '.csv', U.toCSV([['Date', 'Time', 'Type', 'Payee', 'Category', 'Group', 'Account', 'To account', 'Amount', 'Tags', 'Notes', 'Status'], ...rows.map((t) => [t.date, t.time || '', t.type, t.payee, S.cat(t.categoryId).name, S.cat(t.categoryId).group, S.acc(t.accountId).name, t.toAccountId ? S.acc(t.toAccountId).name : '', t.type === 'income' ? t.amount : -t.amount, (t.tags || []).join(' '), t.notes || '', t.status])]), 'text/csv');
        U.toast('Exported ' + rows.length + ' transactions');
      };
      draw();
    },
  };

  /* ===================== BUDGETS ===================== */
  LL.V.budgets = {
    title: 'Budgets',
    render(root, p) {
      let ym = p.month || S.curYM();
      let method = 'category';
      root.innerHTML = `
        <div class="page-intro"><div><h2>Plan it, then watch it</h2><p>Monthly limits per category. The thin marker on each bar shows where you should be by today; rollover budgets carry last month's leftover or overspend.</p></div>
          <div class="toolbar"><button class="icon-btn" id="b-prev" aria-label="Previous month">${I('chevron', 16, '')}</button><b id="b-month" style="min-width:90px;text-align:center"></b><button class="icon-btn" id="b-next" aria-label="Next month">${I('chevron', 16)}</button>${LL.seg('b-method', [['category', 'Category'], ['503020', '50/30/20'], ['envelope', 'Envelope']], method)}<button class="btn" id="b-suggest">${I('sparkle', 16)}Suggest budgets</button><button class="btn primary" id="b-new">${I('plus', 16)}New budget</button></div></div>
        <div class="grid" id="b-kpi"></div>
        <div id="b-body" style="margin-top:16px"></div>`;
      U.$('#b-prev', root).firstElementChild.style.transform = 'rotate(180deg)';
      const draw = () => {
        U.$('#b-month', root).textContent = U.monLabel(ym, true);
        const st = S.budgetStatus(ym);
        const m = S.month(ym);
        const tb = U.sum(st, (x) => x.limit), sp = U.sum(st, (x) => x.spent), pr = U.sum(st, (x) => Math.max(x.spent, x.projected));
        const elapsed = ym === S.curYM() ? +S.asOf().slice(8) / U.daysInMonth(ym) : 1;
        U.$('#b-kpi', root).innerHTML = [
          LL.kpi({ cls: 'c3', label: 'Budgeted', icon: 'pie', value: tb, delta: `<span>${st.length} budgets</span>` }),
          LL.kpi({ cls: 'c3', label: 'Spent in budgets', icon: 'receipt', value: sp, delta: `<span>${U.pct(tb ? sp / tb : 0)} used, ${U.pct(elapsed)} of month gone</span>` }),
          LL.kpi({ cls: 'c3 ' + (tb - sp >= 0 ? 'hero' : ''), label: tb - sp >= 0 ? 'Left to spend' : 'Over budget', icon: 'shield', value: Math.abs(tb - sp) }),
          LL.kpi({ cls: 'c3', label: 'Projected month end', icon: 'forecast', value: pr, delta: `<span class="${pr > tb ? 'down' : 'up'}">${pr > tb ? U.short(pr - tb) + ' over' : U.short(tb - pr) + ' under'} at this pace</span>` }),
        ].join('');
        U.countUp(U.$('#b-kpi', root)); U.tilt(U.$('#b-kpi', root));
        const body = U.$('#b-body', root);
        if (method === 'category') {
          body.innerHTML = st.length ? `<div class="grid">${st.sort((a, b) => b.ratio - a.ratio).map((x) => {
            const hist = S.months(7).slice(0, 6).map((mm) => S.month(mm).byCat[x.b.categoryId] || 0);
            const state = x.ratio > 1 ? ['bad', 'Over by ' + U.money(-x.left)] : x.pace > 1.05 ? ['warn', 'Heading ' + U.short(x.projected - x.limit) + ' over'] : ['good', U.money(x.left) + ' left'];
            return `<section class="card c4 rise tilt" data-id="${x.b.id}" style="cursor:pointer"><div class="budget-tile">${C.ring(x.ratio, { label: Math.round(x.ratio * 100) + '%' })}<div style="min-width:0"><div class="bt-n">${U.esc(x.cat.name)} ${x.b.rollover ? '<span class="tag">rollover</span>' : ''}</div><div class="bt-s">${U.money(x.spent)} of ${U.money(x.limit)}${x.limit !== x.b.amount ? ` (base ${U.short(x.b.amount)})` : ''}</div><div style="margin-top:6px"><span class="pill ${state[0]}">${state[1]}</span></div></div></div>
              <div class="bar-track" style="margin-top:14px"><div class="bar-fill" style="--w:${Math.min(100, x.ratio * 100)}%;--c:${x.ratio > 1 ? 'var(--bad)' : x.pace > 1.05 ? 'var(--warn)' : 'var(--good)'}"></div><span class="bar-mark" style="--x:${Math.min(100, elapsed * 100)}%" title="Where you should be today"></span></div>
              <div style="display:flex;justify-content:space-between;align-items:end;margin-top:10px"><span class="kbd-hint">6-month trend</span>${C.spark(hist, { w: 110, h: 28, color: 'var(--s1)' })}</div></section>`;
          }).join('')}</div>
          <div class="grid" style="margin-top:16px">${LL.card({ cls: 'c12', title: 'Budget vs actual', icon: 'bar', body: '<div id="b-bars"></div>' })}</div>` : LL.emptyState('pie', 'No budgets yet', 'Create one per category, or let Ledgerlight suggest limits from your last three months.', `<button class="btn primary" onclick="document.getElementById('b-suggest').click()">${I('sparkle', 16)}Suggest budgets</button>`);
          if (st.length) C.track(() => C.bars(U.$('#b-bars', root), { labels: st.map((x) => x.cat.name.split(' ')[0]), tipLabels: st.map((x) => x.cat.name), series: [{ name: 'Budget', values: st.map((x) => x.limit), color: 's7' }, { name: 'Spent', values: st.map((x) => x.spent), colors: st.map((x) => (x.ratio > 1 ? 'var(--bad)' : 's1')) }], h: 260 }));
        } else if (method === '503020') {
          const needsG = new Set(['Housing', 'Utilities', 'Health', 'Transport', 'Financial']);
          const needCat = new Set(['cat_groceries']);
          let needs = 0, wants = 0;
          Object.entries(m.byCat).forEach(([c, v]) => { const g = S.cat(c).group; if (needsG.has(g) || needCat.has(c)) needs += v; else wants += v; });
          const inc = m.income || U.avg(S.months(4).slice(0, 3).map((x) => S.month(x).income));
          const save = Math.max(0, inc - needs - wants);
          const rows = [['Needs', needs, 0.5, 's1', 'Housing, EMIs, utilities, groceries, transport, health'], ['Wants', wants, 0.3, 's2', 'Dining, delivery, shopping, entertainment, travel'], ['Savings', save, 0.2, 's3', 'Whatever is left after needs and wants']];
          body.innerHTML = `<div class="grid">${rows.map(([n, v, tgt, c, d]) => `<section class="card c4 rise tilt"><div class="card-h"><h3>${n}</h3><span class="right pill ${n === 'Savings' ? (v / inc >= tgt ? 'good' : 'warn') : v / inc <= tgt ? 'good' : 'bad'}">target ${U.pct(tgt)}</span></div><div class="kpi"><div class="k-v" data-count="${v}">${U.money(v)}</div><div class="k-d">${U.pct(inc ? v / inc : 0)} of income · ideal ${U.money(inc * tgt)}</div></div><div class="bar-track" style="margin-top:12px"><div class="bar-fill" style="--w:${Math.min(100, (v / (inc * tgt || 1)) * 100)}%;--c:var(--${c})"></div></div><p class="kbd-hint" style="margin-top:8px">${d}</p></section>`).join('')}
            ${LL.card({ cls: 'c12', title: 'Your split vs 50/30/20', icon: 'pie', body: '<div class="grid"><div class="c6" id="b-503-a"></div><div class="c6" id="b-503-b"></div></div>' })}</div>`;
          C.donut(U.$('#b-503-a', root), rows.map(([n, v, , c]) => ({ label: n, value: v, color: c })), { centerLabel: 'Your split', size: 200 });
          C.donut(U.$('#b-503-b', root), rows.map(([n, , t, c]) => ({ label: n, value: inc * t, color: c })), { centerLabel: 'Ideal split', size: 200 });
        } else {
          const inc = m.income;
          const assigned = U.sum(st, (x) => x.limit) + U.sum(S.state.bills.filter((b) => b.active), (b) => S.monthlyCost(b));
          const free = inc - assigned;
          body.innerHTML = `<div class="grid">${LL.card({ cls: 'c12', title: 'Give every rupee a job', icon: 'layers', sub: 'Envelope view: income minus bills and budgets', body: `<div class="stats"><div class="stat"><div class="s-l">Income this month</div><div class="s-v">${U.money(inc)}</div></div><div class="stat"><div class="s-l">Bills & EMIs (monthly)</div><div class="s-v">${U.money(U.sum(S.state.bills.filter((b) => b.active), (b) => S.monthlyCost(b)))}</div></div><div class="stat"><div class="s-l">Budget envelopes</div><div class="s-v">${U.money(U.sum(st, (x) => x.limit))}</div></div><div class="stat"><div class="s-l">${free >= 0 ? 'Still to assign' : 'Over-assigned'}</div><div class="s-v ${free >= 0 ? 'up' : 'down'}">${U.money(Math.abs(free))}</div></div></div><div id="b-env" style="margin-top:16px"></div>` })}</div>`;
          C.track(() => C.treemap(U.$('#b-env', root), [...st.map((x, i) => ({ label: x.cat.name + ' · ' + U.pct(x.ratio), value: x.limit, color: x.ratio > 1 ? 'var(--bad)' : C.series(i % 8) })), ...S.state.bills.filter((b) => b.active && S.monthlyCost(b) > 400).map((b) => ({ label: b.name, value: S.monthlyCost(b), color: 'var(--surface-3)' })), ...(free > 0 ? [{ label: 'Unassigned', value: free, color: 'var(--good)' }] : [])], { h: 360 }));
        }
        U.stagger(body); U.countUp(body); U.tilt(body);
      };
      U.$('#b-prev', root).onclick = () => { ym = U.ymAdd(ym, -1); draw(); };
      U.$('#b-next', root).onclick = () => { if (ym < S.curYM()) { ym = U.ymAdd(ym, 1); draw(); } };
      LL.wireSeg(root, 'b-method', (v) => { method = v; draw(); });
      const edit = (b) => LL.editRecord({ col: 'budgets', title: b ? 'Edit budget' : 'New budget', rec: b, fields: [{ key: 'categoryId', label: 'Category', type: 'select', options: LL.catOptions('expense') }, { key: 'amount', label: 'Monthly limit', type: 'number', required: true }, { key: 'rollover', label: 'Rollover', type: 'checkbox', hint: 'Carry leftover or overspend into next month' }], onSave: (v) => { v.period = 'monthly'; if (!b && S.state.budgets.some((x) => x.categoryId === v.categoryId)) { U.toast('That category already has a budget', 'warn'); return false; } return v; } });
      U.$('#b-new', root).onclick = () => edit();
      U.on(root, 'click', '.card[data-id]', (e, c) => edit(S.get('budgets', c.dataset.id)));
      U.$('#b-suggest', root).onclick = () => {
        const three = S.months(4).slice(0, 3);
        const have = new Set(S.state.budgets.map((b) => b.categoryId));
        const sug = S.expenseCats().filter((c) => !have.has(c.id) && !A.isFixed({ categoryId: c.id })).map((c) => ({ c, avg: U.avg(three.map((m) => S.month(m).byCat[c.id] || 0)) })).filter((x) => x.avg > 300);
        if (!sug.length) { U.toast('Every regular category already has a budget'); return; }
        const body = U.h(`<div><p class="muted-p" style="margin-bottom:12px">Based on your average over the last three months, rounded up slightly. Untick any you do not want.</p>${sug.map((x, i) => `<label class="switch" style="display:flex;margin:8px 0"><input type="checkbox" checked data-i="${i}"><span></span><b style="flex:1">${U.esc(x.c.name)}</b><span class="num">${U.money(Math.ceil((x.avg * 1.05) / 100) * 100)}</span></label>`).join('')}</div>`);
        U.modal({ title: 'Suggested budgets', body, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Create budgets', kind: 'primary', onClick: () => { let n = 0; U.$$('input[data-i]', body).forEach((cb) => { if (cb.checked) { const x = sug[+cb.dataset.i]; S.state.budgets.push({ id: U.uid('bud'), categoryId: x.c.id, amount: Math.ceil((x.avg * 1.05) / 100) * 100, period: 'monthly', rollover: false }); n++; } }); S.touch('budgets'); U.toast('Created ' + n + ' budgets'); } }] });
      };
      draw();
    },
  };

  /* ===================== BILLS & SUBSCRIPTIONS ===================== */
  const billFields = () => [
    { key: 'name', label: 'Name', required: true },
    { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'bill', label: 'Bill' }, { value: 'subscription', label: 'Subscription' }], half: true },
    { key: 'amount', label: 'Amount', type: 'number', required: true, half: true },
    { key: 'frequency', label: 'Repeats', type: 'select', options: [['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly'], ['weekly', 'Weekly']].map(([v, l]) => ({ value: v, label: l })), half: true },
    { key: 'dueDay', label: 'Due day of month', type: 'number', half: true, default: 1 },
    { key: 'dueMonth', label: 'Due month (1–12, yearly/quarterly)', type: 'number', half: true },
    { key: 'categoryId', label: 'Category', type: 'select', options: LL.catOptions('expense'), half: true },
    { key: 'accountId', label: 'Paid from', type: 'select', options: LL.accOptions(), half: true },
    { key: 'trialEnds', label: 'Free trial ends (optional)', type: 'date', half: true },
    { key: 'autopay', label: 'Autopay', type: 'checkbox', hint: 'Paid automatically' },
    { key: 'active', label: 'Active', type: 'checkbox', hint: 'Still paying for this', default: true },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];
  LL.editBill = (b) => LL.editRecord({ col: 'bills', title: b ? 'Edit ' + b.name : 'New bill or subscription', fields: billFields(), rec: b || { kind: 'subscription', frequency: 'monthly', active: true, startDate: U.today() }, onSave: (v) => { v.dueDay = U.clamp(+v.dueDay || 1, 1, 31); if (v.dueMonth) v.dueMonth = U.clamp(+v.dueMonth, 1, 12); if (!v.startDate) v.startDate = U.today(); return v; } });

  LL.V.bills = {
    title: 'Bills & subscriptions',
    render(root) {
      let kind = 'all';
      const det = A.detectRecurring().filter((x) => !x.known);
      root.innerHTML = `
        <div class="page-intro"><div><h2>Everything that repeats</h2><p>Track due dates, autopay, price increases and free trials. Ledgerlight also scans your history for repeating charges you have not added yet.</p></div><div class="toolbar">${LL.seg('bl-kind', [['all', 'All'], ['bill', 'Bills'], ['subscription', 'Subscriptions']], kind)}<button class="btn primary" id="bl-new">${I('plus', 16)}Add</button></div></div>
        <div class="grid" id="bl-kpi"></div>
        <div class="grid" style="margin-top:16px">
          ${LL.card({ cls: 'c8', title: 'Next 60 days', icon: 'calendar', sub: 'Each bar is one week of bills', body: '<div id="bl-weeks"></div>' })}
          ${LL.card({ cls: 'c4', title: 'Monthly cost by category', icon: 'pie', body: '<div id="bl-donut"></div>' })}
          ${LL.card({ cls: 'c12', title: 'Your bills and subscriptions', icon: 'receipt', body: '<div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Repeats</th><th>Next due</th><th>From</th><th class="r">Amount</th><th class="r">Per year</th><th>Status</th><th></th></tr></thead><tbody id="bl-rows"></tbody></table></div>' })}
          ${det.length ? LL.card({ cls: 'c12', title: 'Found in your history', icon: 'sparkle', sub: 'Repeating charges not tracked yet', body: `<div class="list">${det.map((d, i) => `<div class="row"><div class="av">${I('repeat', 16)}</div><div style="min-width:0"><div class="t1">${U.esc(d.payee)}</div><div class="t2">${d.freq} · ${d.count} charges · last ${U.fmtDate(d.lastDate)}</div></div><div class="amt">${U.money(d.amount)} <button class="btn sm" data-track="${i}">Track it</button></div></div>`).join('')}</div>` }) : ''}
        </div>`;
      const draw = () => {
        const list = S.state.bills.filter((b) => kind === 'all' || b.kind === kind);
        const active = list.filter((b) => b.active);
        const monthly = U.sum(active, (b) => S.monthlyCost(b));
        const subs = active.filter((b) => b.kind === 'subscription');
        const next30 = S.upcoming(30).filter((u) => kind === 'all' || u.bill.kind === kind);
        const unpaid = next30.filter((u) => !S.isBillPaid(u.bill, u.date) && U.daysBetween(S.asOf(), u.date) <= 7);
        U.$('#bl-kpi', root).innerHTML = [
          LL.kpi({ cls: 'c3', label: 'Monthly commitments', icon: 'repeat', value: monthly, delta: `<span>${active.length} active</span>` }),
          LL.kpi({ cls: 'c3', label: 'Subscriptions per year', icon: 'sparkle', value: U.sum(subs, (b) => S.monthlyCost(b) * 12), delta: `<span>${subs.length} subscriptions</span>` }),
          LL.kpi({ cls: 'c3', label: 'Due in next 30 days', icon: 'calendar', value: U.sum(next30, (u) => u.amount), delta: `<span>${next30.length} payments</span>` }),
          LL.kpi({ cls: 'c3', label: 'Due this week, unpaid', icon: 'alert', value: U.sum(unpaid, (u) => u.amount), delta: `<span>${unpaid.length ? unpaid.map((u) => U.esc(u.bill.name)).slice(0, 2).join(', ') : 'Nothing pending'}</span>` }),
        ].join('');
        U.countUp(U.$('#bl-kpi', root)); U.tilt(U.$('#bl-kpi', root));
        const weeks = [...Array(9).keys()].map((k) => U.addDays(S.asOf(), k * 7));
        const up60 = S.upcoming(63).filter((u) => kind === 'all' || u.bill.kind === kind);
        const wv = weeks.map((w) => U.sum(up60.filter((u) => u.date >= w && u.date < U.addDays(w, 7)), (u) => u.amount));
        C.track(() => C.bars(U.$('#bl-weeks', root), { labels: weeks.map((w) => U.fmtDate(w, { year: false })), tipLabels: weeks.map((w) => 'Week of ' + U.fmtDate(w, { year: false })), series: [{ name: 'Due', values: wv, color: 's2' }], h: 230 }));
        const byC = {}; active.forEach((b) => (byC[S.cat(b.categoryId).name] = (byC[S.cat(b.categoryId).name] || 0) + S.monthlyCost(b)));
        C.donut(U.$('#bl-donut', root), Object.entries(byC).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value), { centerLabel: 'Per month', size: 190, max: 6 });
        U.$('#bl-rows', root).innerHTML = list.sort((a, b) => (S.nextDue(a) || 'z') < (S.nextDue(b) || 'z') ? -1 : 1).map((b) => {
          const nd = b.active ? S.nextDue(b) : null;
          const ph = b.priceHistory && b.priceHistory.length > 1 ? b.priceHistory[b.priceHistory.length - 1].amount - b.priceHistory[0].amount : 0;
          const flags = [];
          if (!b.active) flags.push('<span class="pill info">Cancelled</span>');
          if (ph > 0) flags.push(`<span class="pill warn">Up ${U.money(ph)}</span>`);
          if (b.trialEnds && b.trialEnds >= S.asOf()) flags.push(`<span class="pill warn">Trial ends ${U.relDay(b.trialEnds)}</span>`);
          if (b.lastUsed && U.daysBetween(b.lastUsed, S.asOf()) > 30) flags.push(`<span class="pill bad">Unused ${U.daysBetween(b.lastUsed, S.asOf())} days</span>`);
          if (nd && S.isBillPaid(b, nd)) flags.push('<span class="pill good">Paid</span>');
          return `<tr class="clickable" data-id="${b.id}"><td class="wrap"><b>${U.esc(b.name)}</b><div class="kbd-hint">${b.kind === 'subscription' ? 'Subscription' : 'Bill'} · ${U.esc(S.cat(b.categoryId).name)}${b.autopay ? ' · autopay' : ''}</div></td><td>${b.frequency}</td><td>${nd ? U.fmtDate(nd, { year: false }) + ' <span class="kbd-hint">' + U.relDay(nd) + '</span>' : '—'}</td><td>${U.esc(S.acc(b.accountId).name)}</td><td class="r">${U.money(S.billAmount(b))}</td><td class="r">${U.money(S.monthlyCost(b) * 12)}</td><td>${flags.join(' ') || '<span class="pill info">Scheduled</span>'}</td><td>${b.active && nd && !S.isBillPaid(b, nd) ? `<button class="btn sm" data-pay="${b.id}">Mark paid</button>` : ''}</td></tr>`;
        }).join('') || '<tr><td colspan="8"><div class="chart-empty">Nothing here yet. Add your rent, utilities and subscriptions.</div></td></tr>';
      };
      LL.wireSeg(root, 'bl-kind', (v) => { kind = v; draw(); });
      U.$('#bl-new', root).onclick = () => LL.editBill();
      U.on(root, 'click', 'tr[data-id]', (e, tr) => { if (e.target.closest('[data-pay]')) return; LL.editBill(S.get('bills', tr.dataset.id)); });
      U.on(root, 'click', '[data-pay]', (e, b) => { const bill = S.get('bills', b.dataset.pay); const nd = S.nextDue(bill); S.upsert('transactions', { type: 'expense', amount: S.billAmount(bill, nd), accountId: bill.accountId, categoryId: bill.categoryId, payee: bill.name, date: nd > S.asOf() ? S.asOf() : nd, time: new Date().toTimeString().slice(0, 5), tags: bill.tags || [], notes: 'Marked paid from Bills', status: 'cleared', debtId: bill.debtId }); U.toast('Recorded ' + U.money(S.billAmount(bill, nd)) + ' for ' + bill.name); });
      U.on(root, 'click', '[data-track]', (e, b) => { const d = det[+b.dataset.track]; const last = S.state.transactions.find((t) => t.payee === d.payee); LL.editBill({ name: d.payee, kind: 'subscription', amount: d.amount, frequency: d.freq, dueDay: +d.lastDate.slice(8), dueMonth: d.freq === 'yearly' ? +d.lastDate.slice(5, 7) : null, categoryId: d.categoryId, accountId: last ? last.accountId : '', autopay: true, active: true, startDate: U.today() }); });
      draw();
    },
  };

  /* ===================== CALENDAR ===================== */
  LL.V.calendar = {
    title: 'Money calendar',
    render(root) {
      let ym = S.curYM();
      root.innerHTML = `
        <div class="page-intro"><div><h2>Your month, day by day</h2><p>Bills due, income arriving, goal deadlines and what you actually spent. The coloured strip at the bottom of each day shows how heavy spending was.</p></div><div class="toolbar"><button class="icon-btn" id="c-prev" aria-label="Previous month">${I('chevron')}</button><b id="c-m" style="min-width:110px;text-align:center"></b><button class="icon-btn" id="c-next" aria-label="Next month">${I('chevron')}</button><button class="btn sm" id="c-today">Today</button></div></div>
        <div class="grid"><section class="card c9 rise"><div class="cal" id="c-grid"></div></section><section class="card c3 rise"><div class="card-h"><span class="ico-wrap">${I('calendar', 16)}</span><h3>This month</h3></div><div class="stats" id="c-stats" style="grid-template-columns:1fr"></div><div class="section-h" style="margin:18px 0 8px"><h3 style="font-size:14px">Upcoming events</h3></div><div class="list" id="c-events"></div></section></div>`;
      U.$('#c-prev', root).firstElementChild.style.transform = 'rotate(180deg)';
      const draw = () => {
        U.$('#c-m', root).textContent = U.monLabel(ym, true);
        const first = ym + '-01', dim = U.daysInMonth(ym);
        const start = U.addDays(first, -((U.dow(first) + 6) % 7));
        const spend = {}; S.state.transactions.forEach((t) => { if (t.type === 'expense' && t.date.startsWith(ym)) spend[t.date] = (spend[t.date] || 0) + t.amount; });
        const incomeDays = {}; S.state.transactions.forEach((t) => { if (t.type === 'income' && t.date.startsWith(ym)) (incomeDays[t.date] = incomeDays[t.date] || []).push(t); });
        const bills = S.upcoming(dim + 1, first).filter((u) => u.date.startsWith(ym));
        const goals = S.state.goals.filter((g) => g.deadline && g.deadline.startsWith(ym));
        const mx = Math.max(1, ...Object.values(spend).map((v) => Math.min(v, U.quantile(Object.values(spend), 0.9) || v)));
        let html = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="cal-h">${d}</div>`).join('');
        for (let i = 0; i < 42; i++) {
          const d = U.addDays(start, i);
          if (i >= 35 && d.slice(0, 7) !== ym) break;
          const evs = [...bills.filter((b) => b.date === d).map((b) => `<div class="ev bill">${U.esc(b.bill.name)} · ${U.short(b.amount)}</div>`), ...(incomeDays[d] || []).filter((t) => t.amount > 5000).map((t) => `<div class="ev income">+${U.short(t.amount)} ${U.esc(t.payee.split(' ')[0])}</div>`), ...goals.filter((g) => g.deadline === d).map((g) => `<div class="ev goal">${I('target', 10)} ${U.esc(g.name)}</div>`)];
          html += `<div class="cal-d ${d.slice(0, 7) !== ym ? 'out' : ''} ${d === U.today() ? 'today' : ''}" data-d="${d}" style="animation:rise .4s ${i * 10}ms both"><div class="dn"><span>${+d.slice(8)}</span>${spend[d] ? `<span class="kbd-hint">${U.short(spend[d])}</span>` : ''}</div>${evs.slice(0, 3).join('')}${evs.length > 3 ? `<div class="kbd-hint">+${evs.length - 3} more</div>` : ''}${evs.length ? '<span class="evdot"></span>' : ''}${spend[d] ? `<span class="heatbar" style="--o:${(0.25 + 0.75 * Math.min(1, spend[d] / mx)).toFixed(2)}"></span>` : ''}</div>`;
        }
        U.$('#c-grid', root).innerHTML = html;
        const m = S.month(ym);
        U.$('#c-stats', root).innerHTML = [['Spent', U.money(m.expense)], ['Income', U.money(m.income)], ['Bills scheduled', U.money(U.sum(bills, (b) => b.amount)) + ' · ' + bills.length], ['Busiest day', Object.keys(spend).length ? U.fmtDate(Object.entries(spend).sort((a, b) => b[1] - a[1])[0][0], { year: false, weekday: true }) : '—']].map(([l, v]) => `<div class="stat"><div class="s-l">${l}</div><div class="s-v">${v}</div></div>`).join('');
        const evl = S.upcoming(21).slice(0, 8);
        U.$('#c-events', root).innerHTML = evl.map((u) => `<div class="row"><div class="av">${+u.date.slice(8)}</div><div style="min-width:0"><div class="t1">${U.esc(u.bill.name)}</div><div class="t2">${U.relDay(u.date)}</div></div><div class="amt">${U.short(u.amount)}</div></div>`).join('') || '<p class="muted">No events.</p>';
      };
      U.$('#c-prev', root).onclick = () => { ym = U.ymAdd(ym, -1); draw(); };
      U.$('#c-next', root).onclick = () => { ym = U.ymAdd(ym, 1); draw(); };
      U.$('#c-today', root).onclick = () => { ym = S.curYM(); draw(); };
      U.on(root, 'click', '.cal-d', (e, el) => {
        const d = el.dataset.d;
        const tx = S.state.transactions.filter((t) => t.date === d);
        const bl = S.upcoming(1, d).filter((u) => u.date === d);
        U.modal({ title: U.fmtDate(d, { weekday: true }), body: `${bl.length ? `<div class="eyebrow" style="margin-bottom:6px">Due</div><div class="mini-list" style="margin-bottom:14px">${bl.map((u) => `<div class="ml-row"><span>${U.esc(u.bill.name)}</span><span class="muted">${u.bill.autopay ? 'autopay' : 'manual'}</span><b>${U.money(u.amount)}</b></div>`).join('')}</div>` : ''}<div class="eyebrow" style="margin-bottom:6px">${tx.length} transactions · ${U.money(U.sum(tx.filter(S.isExpense), (t) => t.amount))} spent</div><div class="list">${tx.map(LL.txRow).join('') || '<p class="muted">No transactions on this day.</p>'}</div>`, actions: [{ label: 'Add on this day', kind: 'primary', onClick: () => { setTimeout(() => LL.txForm({ type: 'expense', date: d, time: '12:00', accountId: (S.state.accounts[0] || {}).id, categoryId: 'cat_groceries', tags: [] }), 280); } }] });
      });
      draw();
    },
  };
})(window.LL);
