/* Ledgerlight — shared helpers: formatting, dates, DOM, motion, modal, toast */
window.LL = window.LL || {};
(function (LL) {
  'use strict';

  const U = (LL.U = {});
  U.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ids & numbers ---------- */
  U.uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  U.round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  U.sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
  U.avg = (arr, f) => (arr.length ? U.sum(arr, f) / arr.length : 0);
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.median = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  U.std = (arr) => {
    if (arr.length < 2) return 0;
    const m = U.avg(arr);
    return Math.sqrt(U.sum(arr, (x) => (x - m) ** 2) / (arr.length - 1));
  };
  U.groupBy = (arr, f) => {
    const m = new Map();
    for (const x of arr) {
      const k = f(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  U.linreg = (ys) => {
    const n = ys.length;
    if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };
    const xs = ys.map((_, i) => i);
    const mx = U.avg(xs), my = U.avg(ys);
    let num = 0, den = 0, tot = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; tot += (ys[i] - my) ** 2; }
    const slope = den ? num / den : 0;
    const intercept = my - slope * mx;
    let res = 0;
    for (let i = 0; i < n; i++) res += (ys[i] - (intercept + slope * xs[i])) ** 2;
    return { slope, intercept, r2: tot ? 1 - res / tot : 0 };
  };
  U.pearson = (a, b) => {
    const n = Math.min(a.length, b.length);
    if (n < 3) return 0;
    const ma = U.avg(a.slice(0, n)), mb = U.avg(b.slice(0, n));
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da && db ? num / Math.sqrt(da * db) : 0;
  };

  /* ---------- money formatting ---------- */
  const CUR = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'AED ' };
  U.currencies = Object.keys(CUR);
  U.sym = () => CUR[(LL.S && LL.S.state.meta.currency) || 'INR'] || '';
  U.locale = () => ((LL.S && LL.S.state.meta.currency) === 'INR' ? 'en-IN' : 'en-US');
  U.money = (n, opts = {}) => {
    if (n == null || isNaN(n)) n = 0;
    const neg = n < 0;
    const abs = Math.abs(n);
    const dec = opts.dec != null ? opts.dec : abs < 100 && abs % 1 ? 2 : 0;
    const s = abs.toLocaleString(U.locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return (neg ? '−' : opts.sign && n > 0 ? '+' : '') + U.sym() + s;
  };
  /* compact: ₹1.2L / ₹3.4Cr for INR, $1.2K / $3.4M otherwise */
  U.short = (n) => {
    if (n == null || isNaN(n)) n = 0;
    const neg = n < 0, a = Math.abs(n), s = U.sym();
    let out;
    if ((LL.S && LL.S.state.meta.currency) === 'INR') {
      if (a >= 1e7) out = (a / 1e7).toFixed(a >= 1e8 ? 1 : 2).replace(/\.0+$/, '') + 'Cr';
      else if (a >= 1e5) out = (a / 1e5).toFixed(a >= 1e6 ? 1 : 2).replace(/\.0+$/, '') + 'L';
      else if (a >= 1e3) out = (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      else out = Math.round(a).toString();
    } else {
      if (a >= 1e9) out = (a / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
      else if (a >= 1e6) out = (a / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      else if (a >= 1e3) out = (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      else out = Math.round(a).toString();
    }
    return (neg ? '−' : '') + s + out;
  };
  U.pct = (n, d = 0) => (isFinite(n) ? (n * 100).toFixed(d) + '%' : '—');
  U.num = (n, d = 0) => (+n || 0).toLocaleString(U.locale(), { maximumFractionDigits: d });

  /* ---------- dates (all ISO yyyy-mm-dd, local) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  U.iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  U.d = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd || 1); };
  U.today = () => U.iso(new Date());
  U.addDays = (s, n) => { const d = U.d(s); d.setDate(d.getDate() + n); return U.iso(d); };
  U.addMonths = (s, n) => {
    const d = U.d(s), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return U.iso(d);
  };
  U.ym = (s) => s.slice(0, 7);
  U.ymAdd = (ym, n) => U.addMonths(ym + '-01', n).slice(0, 7);
  U.monthsBetween = (a, b) => { const out = []; let m = a; while (m <= b) { out.push(m); m = U.ymAdd(m, 1); } return out; };
  U.daysBetween = (a, b) => Math.round((U.d(b) - U.d(a)) / 864e5);
  U.daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  U.MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  U.DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  U.monLabel = (ym, withYear) => { const [y, m] = ym.split('-'); return U.MON[+m - 1] + (withYear ? " '" + y.slice(2) : ''); };
  U.fmtDate = (s, o = {}) => {
    if (!s) return '';
    const d = U.d(s);
    return d.toLocaleDateString(U.locale(), { day: 'numeric', month: 'short', year: o.year === false ? undefined : 'numeric', weekday: o.weekday ? 'short' : undefined });
  };
  U.relDay = (s) => {
    const n = U.daysBetween(U.today(), s);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    return n > 0 ? 'in ' + n + ' days' : -n + ' days ago';
  };
  U.dow = (s) => U.d(s).getDay();

  /* ---------- DOM ---------- */
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  U.on = (root, ev, sel, fn) => root.addEventListener(ev, (e) => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });
  U.debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------- motion ---------- */
  U.ease = (t) => 1 - Math.pow(1 - t, 3);
  U.tween = (dur, step, done) => {
    if (U.reduced) { step(1); done && done(); return; }
    const t0 = performance.now();
    const f = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      step(U.ease(t));
      if (t < 1) requestAnimationFrame(f); else done && done();
    };
    requestAnimationFrame(f);
  };
  /* animate every [data-count] inside root from 0 to its value */
  U.countUp = (root) => {
    U.$$('[data-count]', root).forEach((el) => {
      const v = +el.dataset.count, kind = el.dataset.kind || 'money';
      const fmt = (x) => kind === 'pct' ? (x * 100).toFixed(1) + '%' : kind === 'num' ? U.num(x) : kind === 'short' ? U.short(x) : U.money(x);
      U.tween(1100, (t) => (el.textContent = fmt(v * t)));
    });
  };
  /* stagger children into view */
  U.stagger = (root, sel = '.rise') => {
    U.$$(sel, root).forEach((el, i) => { el.style.animationDelay = Math.min(i * 45, 700) + 'ms'; });
  };
  /* subtle 3D tilt for cards that opt in with .tilt */
  U.tilt = (root) => {
    if (U.reduced) return;
    U.$$('.tilt', root).forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-2px)`;
        el.style.setProperty('--mx', (x + 0.5) * 100 + '%');
        el.style.setProperty('--my', (y + 0.5) * 100 + '%');
      });
      el.addEventListener('pointerleave', () => (el.style.transform = ''));
    });
  };

  /* ---------- toast ---------- */
  U.toast = (msg, kind = 'ok') => {
    let box = U.$('#toasts');
    if (!box) { box = U.h('<div id="toasts" aria-live="polite"></div>'); document.body.appendChild(box); }
    const t = U.h(`<div class="toast ${kind}"><span class="toast-dot"></span><span>${U.esc(msg)}</span></div>`);
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
  };

  /* ---------- modal ---------- */
  U.modal = ({ title, body, wide, actions = [], onOpen }) => {
    const m = U.h(`<div class="modal-wrap" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
      <div class="modal ${wide ? 'wide' : ''}">
        <header class="modal-head"><h3>${U.esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${LL.I ? LL.I('x') : '×'}</button></header>
        <div class="modal-body"></div>
        <footer class="modal-foot"></footer>
      </div></div>`);
    const b = U.$('.modal-body', m);
    if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
    const foot = U.$('.modal-foot', m);
    const close = () => { m.classList.add('out'); setTimeout(() => m.remove(), 260); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    actions.forEach((a) => {
      const btn = U.h(`<button class="btn ${a.kind || ''}">${U.esc(a.label)}</button>`);
      btn.onclick = async () => { const r = a.onClick ? await a.onClick(m, close) : null; if (r !== false) close(); };
      foot.appendChild(btn);
    });
    if (!actions.length) foot.remove();
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(m);
    onOpen && onOpen(m, close);
    const first = U.$('input,select,textarea', b);
    first && setTimeout(() => first.focus(), 60);
    return { el: m, close };
  };
  U.confirm = (title, text, label = 'Confirm', danger = true) =>
    new Promise((res) => {
      U.modal({
        title, body: `<p class="muted-p">${text}</p>`,
        actions: [
          { label: 'Cancel', kind: 'ghost', onClick: () => res(false) },
          { label, kind: danger ? 'danger' : 'primary', onClick: () => res(true) },
        ],
      });
    });

  /* ---------- generic form builder ----------
     fields: [{key,label,type:'text'|'number'|'date'|'select'|'textarea'|'color'|'checkbox'|'tags', options:[{value,label}], step, required, half}] */
  U.form = (fields, values = {}) => {
    const f = U.h('<form class="form-grid" novalidate></form>');
    fields.forEach((fd) => {
      const v = values[fd.key] != null ? values[fd.key] : fd.default != null ? fd.default : '';
      const id = 'f_' + fd.key;
      let input;
      if (fd.type === 'select') {
        input = `<select id="${id}" name="${fd.key}">${fd.options.map((o) => `<option value="${U.esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${U.esc(o.label)}</option>`).join('')}</select>`;
      } else if (fd.type === 'textarea') {
        input = `<textarea id="${id}" name="${fd.key}" rows="2">${U.esc(v)}</textarea>`;
      } else if (fd.type === 'checkbox') {
        input = `<label class="switch"><input type="checkbox" id="${id}" name="${fd.key}" ${v ? 'checked' : ''}><span></span>${U.esc(fd.hint || '')}</label>`;
      } else {
        const val = fd.type === 'tags' ? (v || []).join(', ') : v;
        input = `<input id="${id}" name="${fd.key}" type="${fd.type === 'tags' ? 'text' : fd.type || 'text'}" value="${U.esc(val)}" ${fd.step ? `step="${fd.step}"` : ''} ${fd.list ? `list="${fd.list}"` : ''} ${fd.placeholder ? `placeholder="${U.esc(fd.placeholder)}"` : ''} ${fd.required ? 'required' : ''}>`;
      }
      f.appendChild(U.h(`<div class="field ${fd.half ? 'half' : ''}"><label for="${id}">${U.esc(fd.label)}</label>${input}</div>`));
    });
    f.read = () => {
      const out = {};
      for (const fd of fields) {
        const el = f.elements[fd.key];
        if (!el) continue;
        if (fd.type === 'number') out[fd.key] = el.value === '' ? null : +el.value;
        else if (fd.type === 'checkbox') out[fd.key] = el.checked;
        else if (fd.type === 'tags') out[fd.key] = el.value.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
        else out[fd.key] = el.value.trim();
      }
      return out;
    };
    f.check = () => {
      for (const fd of fields) {
        const el = f.elements[fd.key];
        if (fd.required && el && !String(el.value).trim()) { el.focus(); el.classList.add('bad'); U.toast(fd.label + ' is required', 'warn'); return false; }
      }
      return true;
    };
    f.addEventListener('submit', (e) => e.preventDefault());
    return f;
  };

  /* ---------- files ---------- */
  U.download = (name, text, type = 'application/json') => {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  U.readFile = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
  /* RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF) */
  U.parseCSV = (text) => {
    const rows = [];
    let row = [], cell = '', q = false;
    const delim = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  };
  U.toCSV = (rows) => rows.map((r) => r.map((c) => { const s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');

  /* seeded RNG for the sample generator */
  U.rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})(window.LL);
