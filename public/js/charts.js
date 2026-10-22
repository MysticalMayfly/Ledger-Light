/* Ledgerlight — dependency-free animated SVG charts with hover tooltips.
   Every chart: C.<type>(containerEl, options). Colors come from CSS tokens (--s1..--s8, --good, --bad). */
window.LL = window.LL || {};
(function (LL) {
  'use strict';
  const U = LL.U;
  const C = (LL.C = {});
  const NS = 'http://www.w3.org/2000/svg';
  C.series = (i) => 'var(--s' + ((i % 8) + 1) + ')';
  C.col = (c, i) => (c ? (c.startsWith('s') && c.length <= 2 ? 'var(--' + c + ')' : c) : C.series(i || 0));

  /* ---------- tooltip ---------- */
  let tipEl;
  C.tip = (html, x, y) => {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'chart-tip'; document.body.appendChild(tipEl); }
    tipEl.innerHTML = html; tipEl.classList.add('on');
    const r = tipEl.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 12;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 16;
    tipEl.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };
  C.untip = () => tipEl && tipEl.classList.remove('on');
  const tipRow = (color, label, value) => `<div class="tip-row"><i style="background:${color}"></i><span>${U.esc(label)}</span><b>${value}</b></div>`;
  C.tipRow = tipRow;

  /* ---------- scales ---------- */
  C.nice = (min, max, count = 4) => {
    if (min === max) { max = min + 1; }
    const span = max - min, step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || mag * 10;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return { lo, hi, ticks };
  };
  const svg = (w, h, cls = '') => `<svg class="chart ${cls}" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" role="img">`;
  const size = (el, h) => ({ w: Math.max(240, Math.floor(el.clientWidth || el.getBoundingClientRect().width || 600)), h: h || 240 });
  const legend = (items) => `<div class="legend">${items.map((s, i) => `<span class="lg"><i style="background:${C.col(s.color, i)}"></i>${U.esc(s.name)}</span>`).join('')}</div>`;
  C.legend = legend;
  const empty = (el, msg = 'No data for this period yet') => { el.innerHTML = `<div class="chart-empty">${LL.I('bar', 22)}<span>${msg}</span></div>`; };
  C.empty = empty;

  /* ---------- line / area ---------- */
  C.line = (el, o) => {
    const series = o.series.filter((s) => s.values && s.values.length);
    if (!series.length || !o.labels.length) return empty(el);
    const { w, h } = size(el, o.h);
    const fmt = o.fmt || U.short;
    const padL = 54, padR = 14, padT = 12, padB = 26;
    const all = series.flatMap((s) => s.values.filter((v) => v != null));
    let mn = Math.min(...all), mx = Math.max(...all);
    if (o.zero !== false) mn = Math.min(0, mn);
    const sc = C.nice(mn, mx, 4);
    const n = o.labels.length;
    const X = (i) => padL + (n === 1 ? (w - padL - padR) / 2 : (i * (w - padL - padR)) / (n - 1));
    const Y = (v) => padT + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * (h - padT - padB);
    let s = svg(w, h, 'line-chart');
    sc.ticks.forEach((t) => { s += `<line class="grid" x1="${padL}" x2="${w - padR}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${padL - 8}" y="${Y(t) + 4}" text-anchor="end">${fmt(t)}</text>`; });
    if (sc.lo < 0) s += `<line class="base" x1="${padL}" x2="${w - padR}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    const every = Math.ceil(n / Math.max(2, Math.floor((w - padL) / 64)));
    o.labels.forEach((l, i) => { if (i % every === 0 || i === n - 1) s += `<text class="ax" x="${X(i)}" y="${h - 6}" text-anchor="middle">${U.esc(l)}</text>`; });
    if (o.marker != null) s += `<line class="today" x1="${X(o.marker)}" x2="${X(o.marker)}" y1="${padT}" y2="${h - padB}"/><text class="ax today-l" x="${X(o.marker) + 4}" y="${padT + 10}">${o.markerLabel || 'Today'}</text>`;
    series.forEach((se, si) => {
      const col = C.col(se.color, si);
      const pts = se.values.map((v, i) => (v == null ? null : [X(i), Y(v)]));
      const segs = []; let cur = [];
      pts.forEach((p) => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
      if (cur.length) segs.push(cur);
      segs.forEach((seg) => {
        const d = smooth(seg, o.curve !== false);
        if (se.area || o.area) {
          const gid = 'g' + Math.random().toString(36).slice(2, 8);
          s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${col};stop-opacity:.32"/><stop offset="1" style="stop-color:${col};stop-opacity:0"/></linearGradient></defs>`;
          s += `<path class="area-fill" d="${d} L${seg[seg.length - 1][0]},${Y(Math.max(sc.lo, 0))} L${seg[0][0]},${Y(Math.max(sc.lo, 0))} Z" style="fill:url(#${gid})"/>`;
        }
        s += `<path class="ln draw" pathLength="1" d="${d}" style="stroke:${col};${se.dash ? 'stroke-dasharray:5 5;animation:none;stroke-dashoffset:0' : ''}"/>`;
      });
      const last = [...pts].reverse().find(Boolean);
      if (last && o.endDot !== false) s += `<circle class="end-dot" cx="${last[0]}" cy="${last[1]}" r="4.5" style="fill:${col}"/>`;
    });
    s += `<line class="xhair" x1="0" x2="0" y1="${padT}" y2="${h - padB}" style="opacity:0"/>`;
    s += series.map((se, si) => `<circle class="hover-dot" r="5" cx="-20" cy="-20" style="fill:${C.col(se.color, si)}" data-s="${si}"/>`).join('');
    s += `<rect class="hit" x="${padL}" y="0" width="${w - padL - padR}" height="${h}" style="fill:transparent"/></svg>`;
    el.innerHTML = (series.length > 1 && o.legend !== false ? legend(series) : '') + s;
    const root = el.querySelector('svg'), hair = root.querySelector('.xhair'), dots = root.querySelectorAll('.hover-dot');
    const hit = root.querySelector('.hit');
    hit.addEventListener('pointermove', (e) => {
      const r = root.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * w;
      const i = U.clamp(Math.round(((px - padL) / (w - padL - padR)) * (n - 1)), 0, n - 1);
      hair.setAttribute('x1', X(i)); hair.setAttribute('x2', X(i)); hair.style.opacity = 1;
      dots.forEach((d) => { const v = series[+d.dataset.s].values[i]; if (v == null) { d.setAttribute('cx', -20); return; } d.setAttribute('cx', X(i)); d.setAttribute('cy', Y(v)); });
      C.tip(`<div class="tip-h">${U.esc(o.tipLabels ? o.tipLabels[i] : o.labels[i])}</div>` + series.map((se, si) => se.values[i] == null ? '' : tipRow(C.col(se.color, si), se.name, (o.tipFmt || U.money)(se.values[i]))).join(''), e.clientX, e.clientY);
    });
    hit.addEventListener('pointerleave', () => { hair.style.opacity = 0; dots.forEach((d) => d.setAttribute('cx', -20)); C.untip(); });
    if (o.onClick) hit.addEventListener('click', (e) => { const r = root.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * w; o.onClick(U.clamp(Math.round(((px - padL) / (w - padL - padR)) * (n - 1)), 0, n - 1)); });
  };
  function smooth(p, curve) {
    if (p.length < 2 || !curve) return 'M' + p.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' L');
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const t = 0.18;
      const c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = p1[1] + (p2[1] - p0[1]) * t;
      const c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  /* ---------- vertical bars (grouped or stacked, supports negatives) ---------- */
  C.bars = (el, o) => {
    const series = o.series;
    if (!o.labels.length || !series.length) return empty(el);
    const { w, h } = size(el, o.h);
    const fmt = o.fmt || U.short;
    const padL = 54, padR = 10, padT = 12, padB = 26;
    const n = o.labels.length;
    let mn = 0, mx = 0;
    for (let i = 0; i < n; i++) {
      if (o.stacked) { let pos = 0, neg = 0; series.forEach((se) => { const v = se.values[i] || 0; v >= 0 ? (pos += v) : (neg += v); }); mx = Math.max(mx, pos); mn = Math.min(mn, neg); }
      else series.forEach((se) => { const v = se.values[i] || 0; mx = Math.max(mx, v); mn = Math.min(mn, v); });
    }
    if (o.line) o.line.values.forEach((v) => { mx = Math.max(mx, v); mn = Math.min(mn, v); });
    const sc = C.nice(mn, mx || 1, 4);
    const Y = (v) => padT + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * (h - padT - padB);
    const slot = (w - padL - padR) / n;
    const groupW = Math.min(slot * 0.72, o.stacked ? 46 : 22 * series.length + 8);
    const bw = o.stacked ? groupW : Math.max(3, (groupW - (series.length - 1) * 2) / series.length);
    let s = svg(w, h, 'bar-chart');
    sc.ticks.forEach((t) => { s += `<line class="grid" x1="${padL}" x2="${w - padR}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${padL - 8}" y="${Y(t) + 4}" text-anchor="end">${fmt(t)}</text>`; });
    s += `<line class="base" x1="${padL}" x2="${w - padR}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    const every = Math.ceil(n / Math.max(2, Math.floor((w - padL) / 52)));
    for (let i = 0; i < n; i++) {
      const cx = padL + slot * i + slot / 2;
      if (i % every === 0 || i === n - 1) s += `<text class="ax" x="${cx}" y="${h - 6}" text-anchor="middle">${U.esc(o.labels[i])}</text>`;
      let pos = 0, neg = 0;
      s += `<g class="bar-g" data-i="${i}" style="animation-delay:${Math.min(i * 28, 600)}ms">`;
      series.forEach((se, si) => {
        const v = se.values[i] || 0;
        if (!v) return;
        let y0, y1, x;
        if (o.stacked) { x = cx - bw / 2; if (v >= 0) { y0 = Y(pos); y1 = Y(pos + v); pos += v; } else { y0 = Y(neg + v); y1 = Y(neg); neg += v; } }
        else { x = cx - groupW / 2 + si * (bw + 2); y0 = Y(Math.max(0, v)); y1 = Y(Math.min(0, v)); [y0, y1] = [Math.max(y0, y1), Math.min(y0, y1)]; }
        const top = Math.min(y0, y1), hgt = Math.max(1, Math.abs(y0 - y1) - (o.stacked ? 1.5 : 0));
        const col = se.colors ? C.col(se.colors[i], si) : C.col(se.color, si);
        const dim = o.highlight != null && o.highlight !== i ? 'opacity:.38' : '';
        s += `<rect class="bar ${v < 0 ? 'neg' : ''}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" rx="${Math.min(4, bw / 2)}" style="fill:${col};${dim}"/>`;
      });
      s += `<rect class="hit" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${h - padT - padB}" style="fill:transparent"/></g>`;
    }
    if (o.line) {
      const pts = o.line.values.map((v, i) => [padL + slot * i + slot / 2, Y(v)]);
      s += `<path class="ln draw" pathLength="1" d="${smooth(pts, true)}" style="stroke:${C.col(o.line.color, 7)}"/>`;
      pts.forEach((p) => (s += `<circle cx="${p[0]}" cy="${p[1]}" r="3" style="fill:${C.col(o.line.color, 7)}"/>`));
    }
    s += '</svg>';
    const lg = series.length > 1 || o.line ? legend(o.line ? [...series, o.line] : series) : '';
    el.innerHTML = (o.legend === false ? '' : lg) + s;
    el.querySelectorAll('.bar-g').forEach((g) => {
      const i = +g.dataset.i;
      g.addEventListener('pointermove', (e) => {
        const rows = series.map((se, si) => (se.values[i] ? tipRow(se.colors ? C.col(se.colors[i], si) : C.col(se.color, si), se.name, (o.tipFmt || U.money)(se.values[i])) : '')).join('');
        const tot = o.stacked && series.length > 1 ? `<div class="tip-total">Total <b>${(o.tipFmt || U.money)(U.sum(series, (se) => se.values[i] || 0))}</b></div>` : '';
        const ln = o.line ? tipRow(C.col(o.line.color, 7), o.line.name, (o.lineFmt || U.money)(o.line.values[i])) : '';
        C.tip(`<div class="tip-h">${U.esc(o.tipLabels ? o.tipLabels[i] : o.labels[i])}</div>${rows}${ln}${tot}`, e.clientX, e.clientY);
        g.classList.add('hov');
      });
      g.addEventListener('pointerleave', () => { C.untip(); g.classList.remove('hov'); });
      if (o.onClick) g.addEventListener('click', () => o.onClick(i));
    });
  };

  /* ---------- horizontal bar list (HTML, animated widths) ---------- */
  C.hbars = (el, items, o = {}) => {
    if (!items.length) return empty(el);
    const max = Math.max(...items.map((x) => Math.abs(x.value))) || 1;
    const fmt = o.fmt || U.money;
    el.innerHTML = `<div class="hbars">${items.map((it, i) => `
      <div class="hb-row" data-i="${i}">
        <div class="hb-l"><span class="hb-name">${U.esc(it.label)}</span>${it.sub ? `<span class="hb-sub">${U.esc(it.sub)}</span>` : ''}</div>
        <div class="hb-track"><div class="hb-bar" style="--w:${((Math.abs(it.value) / max) * 100).toFixed(2)}%;background:${C.col(it.color, i)};animation-delay:${i * 40}ms"></div></div>
        <div class="hb-v">${fmt(it.value)}</div>
      </div>`).join('')}</div>`;
    if (o.onClick) el.querySelectorAll('.hb-row').forEach((r) => { r.classList.add('clickable'); r.addEventListener('click', () => o.onClick(items[+r.dataset.i])); });
  };

  /* ---------- donut ---------- */
  C.donut = (el, items, o = {}) => {
    items = items.filter((x) => x.value > 0);
    if (!items.length) return empty(el);
    const total = U.sum(items, (x) => x.value);
    const sz = o.size || 220, r = sz / 2 - 16, sw = o.thick || 26, circ = 2 * Math.PI * r;
    let acc = 0;
    let s = `<svg class="chart donut" viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}" role="img"><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" class="donut-track" style="stroke-width:${sw}"/>`;
    items.forEach((it, i) => {
      const frac = it.value / total, gap = items.length > 1 ? Math.min(2.5, circ * frac * 0.3) : 0;
      const len = Math.max(0.1, circ * frac - gap);
      s += `<circle class="arc" data-i="${i}" cx="${sz / 2}" cy="${sz / 2}" r="${r}" style="stroke:${C.col(it.color, i)};stroke-width:${sw};stroke-dasharray:${len} ${circ - len};--off:${-acc};stroke-dashoffset:${-acc};--len:${len};animation-delay:${i * 60}ms" transform="rotate(-90 ${sz / 2} ${sz / 2})"/>`;
      acc += circ * frac;
    });
    s += '</svg>';
    const center = `<div class="donut-c"><span class="dc-v">${o.centerValue != null ? o.centerValue : U.short(total)}</span><span class="dc-l">${U.esc(o.centerLabel || 'Total')}</span></div>`;
    const lg = o.legend === false ? '' : `<div class="donut-lg">${items.slice(0, o.max || 8).map((it, i) => `<div class="dl-row" data-i="${i}"><i style="background:${C.col(it.color, i)}"></i><span class="dl-n">${U.esc(it.label)}</span><span class="dl-p">${U.pct(it.value / total)}</span><b>${(o.fmt || U.short)(it.value)}</b></div>`).join('')}</div>`;
    el.innerHTML = `<div class="donut-wrap"><div class="donut-box" style="width:${sz}px;height:${sz}px">${s}${center}</div>${lg}</div>`;
    const cv = el.querySelector('.dc-v'), cl = el.querySelector('.dc-l');
    const focus = (i) => {
      el.querySelectorAll('.arc').forEach((a) => a.classList.toggle('dim', i != null && +a.dataset.i !== i));
      el.querySelectorAll('.dl-row').forEach((a) => a.classList.toggle('on', +a.dataset.i === i));
      if (i == null) { cv.textContent = o.centerValue != null ? o.centerValue : U.short(total); cl.textContent = o.centerLabel || 'Total'; }
      else { cv.textContent = U.short(items[i].value); cl.textContent = items[i].label + ' · ' + U.pct(items[i].value / total); }
    };
    el.querySelectorAll('.arc,.dl-row').forEach((a) => {
      a.addEventListener('pointerenter', () => focus(+a.dataset.i));
      a.addEventListener('pointerleave', () => focus(null));
      if (o.onClick) a.addEventListener('click', () => o.onClick(items[+a.dataset.i]));
    });
  };

  /* ---------- ring (single progress) — returns markup ---------- */
  C.ring = (ratio, o = {}) => {
    const sz = o.size || 64, sw = o.sw || 7, r = sz / 2 - sw / 2 - 1, circ = 2 * Math.PI * r;
    const v = U.clamp(ratio, 0, 1), col = o.color || (ratio > 1 ? 'var(--bad)' : ratio > 0.85 ? 'var(--warn)' : 'var(--good)');
    return `<svg class="ring" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" aria-hidden="true"><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" class="ring-track" style="stroke-width:${sw}"/><circle class="ring-arc" cx="${sz / 2}" cy="${sz / 2}" r="${r}" style="stroke:${col};stroke-width:${sw};stroke-dasharray:${circ};--full:${circ};stroke-dashoffset:${circ * (1 - v)};--to:${circ * (1 - v)}" transform="rotate(-90 ${sz / 2} ${sz / 2})"/>${o.label != null ? `<text x="50%" y="50%" dy=".35em" text-anchor="middle" class="ring-t">${o.label}</text>` : ''}</svg>`;
  };

  /* ---------- gauge (semi-circle 0..100) ---------- */
  C.gauge = (el, o) => {
    const w = 240, h = 142, cx = 120, cy = 124, r = 96;
    const v = U.clamp(o.value, 0, 100);
    const arc = (a0, a1) => { const p = (a) => [cx + r * Math.cos(Math.PI * (1 - a)), cy - r * Math.sin(Math.PI * (1 - a))]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`; };
    const col = v >= 70 ? 'var(--good)' : v >= 45 ? 'var(--warn)' : 'var(--bad)';
    let s = `<svg class="chart gauge" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px" role="img">`;
    s += `<path d="${arc(0, 1)}" class="g-track"/>`;
    s += `<path d="${arc(0, Math.max(0.001, v / 100))}" class="g-arc draw" pathLength="1" style="stroke:${col}"/>`;
    [0, 25, 50, 75, 100].forEach((t) => { const a = Math.PI * (1 - t / 100); s += `<text class="ax" x="${cx + (r + 14) * Math.cos(a)}" y="${cy - (r + 14) * Math.sin(a) + 4}" text-anchor="middle">${t}</text>`; });
    s += `<text class="g-v" x="${cx}" y="${cy - 14}" text-anchor="middle" data-count="${v}" data-kind="num">${Math.round(v)}</text><text class="g-l" x="${cx}" y="${cy + 8}" text-anchor="middle">${U.esc(o.label || '')}</text></svg>`;
    el.innerHTML = s;
  };

  /* ---------- heatmap grid ---------- */
  C.heatmap = (el, o) => {
    const rows = o.rows, cols = o.cols, data = o.data;
    const vals = data.flat().filter((v) => v != null);
    if (!vals.length) return empty(el);
    const diverging = o.diverging;
    const mx = Math.max(...vals.map(Math.abs)) || 1, mn = Math.min(...vals);
    const { w } = size(el);
    const padL = o.padL || 46, padT = 20;
    const cw = Math.max(8, (w - padL - 4) / cols.length), ch = o.cellH || Math.min(30, Math.max(14, cw * 0.8));
    const h = padT + ch * rows.length + 6;
    let s = svg(w, h, 'heat');
    const every = Math.ceil(cols.length / Math.floor((w - padL) / 28));
    cols.forEach((c, j) => { if (j % every === 0) s += `<text class="ax" x="${padL + cw * j + cw / 2}" y="12" text-anchor="middle">${U.esc(c)}</text>`; });
    rows.forEach((rname, i) => {
      s += `<text class="ax" x="${padL - 6}" y="${padT + ch * i + ch / 2 + 4}" text-anchor="end">${U.esc(rname)}</text>`;
      cols.forEach((c, j) => {
        const v = data[i][j];
        let style;
        if (v == null) style = 'fill:var(--surface-2)';
        else if (diverging) { const t = v / mx; style = `fill:${t >= 0 ? 'var(--s1)' : 'var(--s8)'};fill-opacity:${(0.12 + Math.abs(t) * 0.85).toFixed(2)}`; }
        else { const t = (v - Math.min(0, mn)) / (mx - Math.min(0, mn) || 1); style = `fill:var(${o.hue || '--heat'});fill-opacity:${(0.06 + t * 0.94).toFixed(2)}`; }
        s += `<rect class="cell" data-i="${i}" data-j="${j}" x="${padL + cw * j + 1}" y="${padT + ch * i + 1}" width="${cw - 2}" height="${ch - 2}" rx="3" style="${style};animation-delay:${(i * cols.length + j) * 4}ms"/>`;
        if (o.showValues && v != null && cw > 34) s += `<text class="cell-t" x="${padL + cw * j + cw / 2}" y="${padT + ch * i + ch / 2 + 4}" text-anchor="middle">${(o.valFmt || ((x) => x.toFixed(2)))(v)}</text>`;
      });
    });
    s += '</svg>';
    el.innerHTML = s;
    el.querySelectorAll('.cell').forEach((c) => {
      c.addEventListener('pointermove', (e) => { const i = +c.dataset.i, j = +c.dataset.j, v = data[i][j]; C.tip(`<div class="tip-h">${U.esc(rows[i])} · ${U.esc(cols[j])}</div><div class="tip-big">${v == null ? '—' : (o.fmt || U.money)(v)}</div>${o.extra ? o.extra(i, j) : ''}`, e.clientX, e.clientY); });
      c.addEventListener('pointerleave', C.untip);
    });
  };

  /* ---------- calendar heatmap (weeks x weekdays) ---------- */
  C.calendar = (el, o) => {
    const start = o.start, end = o.end, map = o.values;
    const vals = Object.values(map); const mx = vals.length ? U.quantile(vals, 0.95) : 1;
    let d = U.addDays(start, -U.dow(start));
    const weeks = [];
    while (d <= end) { const wk = []; for (let k = 0; k < 7; k++) { wk.push(d); d = U.addDays(d, 1); } weeks.push(wk); }
    const { w } = size(el);
    const padL = 30, padT = 18;
    const cs = Math.max(8, Math.min(16, (w - padL) / weeks.length - 2));
    const h = padT + 7 * (cs + 2) + 4;
    let s = svg(Math.max(w, padL + weeks.length * (cs + 2)), h, 'calheat');
    ['Mon', 'Wed', 'Fri'].forEach((l, k) => (s += `<text class="ax" x="${padL - 6}" y="${padT + (k * 2 + 1) * (cs + 2) + cs - 2}" text-anchor="end">${l}</text>`));
    let lastM = '';
    weeks.forEach((wk, i) => {
      const m = wk[0].slice(5, 7);
      if (m !== lastM) { s += `<text class="ax" x="${padL + i * (cs + 2)}" y="11">${U.MON[+m - 1]}</text>`; lastM = m; }
      wk.forEach((day, k) => {
        if (day < start || day > end) return;
        const v = map[day] || 0;
        const t = Math.min(1, v / (mx || 1));
        s += `<rect class="cell" data-d="${day}" x="${padL + i * (cs + 2)}" y="${padT + k * (cs + 2)}" width="${cs}" height="${cs}" rx="2.5" style="fill:${v ? 'var(--heat)' : 'var(--surface-2)'};fill-opacity:${v ? (0.18 + t * 0.82).toFixed(2) : 1};animation-delay:${i * 8}ms"/>`;
      });
    });
    s += '</svg>';
    el.innerHTML = `<div class="scroll-x">${s}</div>`;
    el.querySelectorAll('.cell').forEach((c) => {
      c.addEventListener('pointermove', (e) => C.tip(`<div class="tip-h">${U.fmtDate(c.dataset.d, { weekday: true })}</div><div class="tip-big">${(o.fmt || U.money)(map[c.dataset.d] || 0)}</div>${o.extra ? o.extra(c.dataset.d) : ''}`, e.clientX, e.clientY));
      c.addEventListener('pointerleave', C.untip);
      if (o.onClick) c.addEventListener('click', () => o.onClick(c.dataset.d));
    });
  };
  U.quantile = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] || 0; };

  /* ---------- sankey (sources -> hub -> uses) ---------- */
  C.sankey = (el, o) => {
    const L = o.left.filter((x) => x.value > 0), R = o.right.filter((x) => x.value > 0);
    if (!L.length || !R.length) return empty(el);
    const { w } = size(el);
    const h = o.h || Math.max(260, Math.max(L.length, R.length) * 30 + 30);
    const tl = U.sum(L, (x) => x.value), tr = U.sum(R, (x) => x.value), tot = Math.max(tl, tr);
    const gap = 6, nodeW = 12, hubW = 16;
    const xL = 130, xR = w - 150, xH = w / 2 - hubW / 2;
    const usable = (side) => h - 20 - gap * (side.length - 1);
    const lay = (side) => { let y = 10; const k = usable(side) / tot; return side.map((n) => { const hh = Math.max(2, n.value * k); const r = { ...n, y, hh }; y += hh + gap; return r; }); };
    const Ls = lay(L), Rs = lay(R);
    const hubH = (h - 20) * 0.92, hubY = (h - hubH) / 2, k = hubH / tot;
    let s = svg(w, h, 'sankey');
    let hy = hubY;
    Ls.forEach((n, i) => {
      const hh = n.value * k;
      s += `<path class="flow" data-side="l" data-i="${i}" d="${band(xL + nodeW, n.y, n.hh, xH, hy, hh)}" style="fill:${C.col(n.color, i)};animation-delay:${i * 70}ms"/>`;
      hy += hh;
    });
    hy = hubY;
    Rs.forEach((n, i) => {
      const hh = n.value * k;
      s += `<path class="flow" data-side="r" data-i="${i}" d="${band(xH + hubW, hy, hh, xR, n.y, n.hh)}" style="fill:${C.col(n.color, i + 2)};animation-delay:${300 + i * 50}ms"/>`;
      hy += hh;
    });
    Ls.forEach((n, i) => { s += `<rect x="${xL}" y="${n.y}" width="${nodeW}" height="${n.hh}" rx="3" style="fill:${C.col(n.color, i)}"/><text class="sk-l" x="${xL - 8}" y="${n.y + n.hh / 2 + 4}" text-anchor="end">${U.esc(n.label)}</text><text class="sk-v" x="${xL - 8}" y="${n.y + n.hh / 2 + 17}" text-anchor="end">${U.short(n.value)}</text>`; });
    Rs.forEach((n, i) => { s += `<rect x="${xR}" y="${n.y}" width="${nodeW}" height="${n.hh}" rx="3" style="fill:${C.col(n.color, i + 2)}"/><text class="sk-l" x="${xR + nodeW + 8}" y="${n.y + n.hh / 2 + 4}">${U.esc(n.label)}</text>${n.hh > 22 ? `<text class="sk-v" x="${xR + nodeW + 8}" y="${n.y + n.hh / 2 + 17}">${U.short(n.value)}</text>` : ''}`; });
    s += `<rect x="${xH}" y="${hubY}" width="${hubW}" height="${hubH}" rx="4" class="hub"/><text class="sk-hub" x="${xH + hubW / 2}" y="${hubY - 2}" text-anchor="middle">${U.esc(o.hub || 'Income')}</text></svg>`;
    el.innerHTML = `<div class="scroll-x">${s}</div>`;
    el.querySelectorAll('.flow').forEach((f) => {
      const n = (f.dataset.side === 'l' ? Ls : Rs)[+f.dataset.i];
      f.addEventListener('pointermove', (e) => { f.classList.add('hov'); C.tip(`<div class="tip-h">${U.esc(n.label)}</div><div class="tip-big">${U.money(n.value)}</div><div class="tip-sub">${U.pct(n.value / tot, 1)} of ${U.esc(o.hub || 'income')}</div>`, e.clientX, e.clientY); });
      f.addEventListener('pointerleave', () => { f.classList.remove('hov'); C.untip(); });
    });
  };
  function band(x0, y0, h0, x1, y1, h1) {
    const mx = (x0 + x1) / 2;
    return `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + h1} C${mx},${y1 + h1} ${mx},${y0 + h0} ${x0},${y0 + h0} Z`;
  }

  /* ---------- treemap (squarified) ---------- */
  C.treemap = (el, items, o = {}) => {
    items = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    if (!items.length) return empty(el);
    const { w, h } = size(el, o.h || 300);
    const total = U.sum(items, (x) => x.value);
    const rects = [];
    squarify(items.map((x) => ({ ...x, a: (x.value / total) * w * h })), { x: 0, y: 0, w, h }, rects);
    el.innerHTML = `<div class="treemap" style="height:${h}px">${rects.map((r, i) => `
      <div class="tm-cell" data-i="${i}" style="left:${(r.x / w) * 100}%;top:${(r.y / h) * 100}%;width:${(r.w / w) * 100}%;height:${(r.h / h) * 100}%;--c:${C.col(r.color, i)};animation-delay:${i * 35}ms">
        ${r.w > 70 && r.h > 34 ? `<span class="tm-n">${U.esc(r.label)}</span><span class="tm-v">${U.short(r.value)} · ${U.pct(r.value / total)}</span>` : ''}
      </div>`).join('')}</div>`;
    el.querySelectorAll('.tm-cell').forEach((c) => {
      const r = rects[+c.dataset.i];
      c.addEventListener('pointermove', (e) => C.tip(`<div class="tip-h">${U.esc(r.label)}</div><div class="tip-big">${U.money(r.value)}</div><div class="tip-sub">${U.pct(r.value / total, 1)} of total</div>`, e.clientX, e.clientY));
      c.addEventListener('pointerleave', C.untip);
      if (o.onClick) c.addEventListener('click', () => o.onClick(r));
    });
  };
  function squarify(items, box, out) {
    if (!items.length) return;
    if (items.length === 1) { out.push({ ...items[0], ...box }); return; }
    const short = Math.min(box.w, box.h);
    let row = [items[0]], rest = items.slice(1);
    const worst = (r) => { const s = U.sum(r, (x) => x.a), mx = Math.max(...r.map((x) => x.a)), mn = Math.min(...r.map((x) => x.a)); return Math.max((short * short * mx) / (s * s), (s * s) / (short * short * mn)); };
    while (rest.length && worst([...row, rest[0]]) <= worst(row)) { row.push(rest[0]); rest = rest.slice(1); }
    const s = U.sum(row, (x) => x.a);
    if (box.w >= box.h) {
      const cw = s / box.h; let y = box.y;
      row.forEach((r) => { const hh = r.a / cw; out.push({ ...r, x: box.x, y, w: cw, h: hh }); y += hh; });
      squarify(rest, { x: box.x + cw, y: box.y, w: box.w - cw, h: box.h }, out);
    } else {
      const ch = s / box.w; let x = box.x;
      row.forEach((r) => { const ww = r.a / ch; out.push({ ...r, x, y: box.y, w: ww, h: ch }); x += ww; });
      squarify(rest, { x: box.x, y: box.y + ch, w: box.w, h: box.h - ch }, out);
    }
  }

  /* ---------- radar ---------- */
  C.radar = (el, o) => {
    const sz = o.size || 300, cx = sz / 2, cy = sz / 2, r = sz / 2 - 46, n = o.axes.length;
    const pt = (i, v) => [cx + r * v * Math.sin((2 * Math.PI * i) / n), cy - r * v * Math.cos((2 * Math.PI * i) / n)];
    let s = `<svg class="chart radar" viewBox="0 0 ${sz} ${sz}" width="100%" style="max-width:${sz}px" role="img">`;
    [0.25, 0.5, 0.75, 1].forEach((lv) => (s += `<polygon class="grid" points="${o.axes.map((_, i) => pt(i, lv).join(',')).join(' ')}" style="fill:none"/>`));
    o.axes.forEach((a, i) => { const [x, y] = pt(i, 1); const [lx, ly] = pt(i, 1.2); s += `<line class="grid" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text class="ax" x="${lx}" y="${ly + 4}" text-anchor="middle">${U.esc(a)}</text>`; });
    o.series.forEach((se, si) => {
      const col = C.col(se.color, si);
      s += `<polygon class="radar-shape" points="${se.values.map((v, i) => pt(i, U.clamp(v, 0, 1)).join(',')).join(' ')}" style="fill:${col};fill-opacity:.18;stroke:${col}"/>`;
      se.values.forEach((v, i) => { const [x, y] = pt(i, U.clamp(v, 0, 1)); s += `<circle cx="${x}" cy="${y}" r="3.5" style="fill:${col}"><title>${U.esc(o.axes[i])}: ${Math.round(v * 100)}</title></circle>`; });
    });
    s += '</svg>';
    el.innerHTML = (o.series.length > 1 ? legend(o.series) : '') + `<div class="center">${s}</div>`;
  };

  /* ---------- scatter / bubble ---------- */
  C.scatter = (el, o) => {
    const pts = o.points;
    if (!pts.length) return empty(el);
    const { w, h } = size(el, o.h || 260);
    const padL = 54, padR = 16, padT = 14, padB = 34;
    const xs = C.nice(Math.min(0, ...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)), 5);
    const ys = C.nice(Math.min(0, ...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y)), 4);
    const X = (v) => padL + ((v - xs.lo) / (xs.hi - xs.lo)) * (w - padL - padR);
    const Y = (v) => padT + (1 - (v - ys.lo) / (ys.hi - ys.lo)) * (h - padT - padB);
    const rmax = Math.max(...pts.map((p) => p.r || 1));
    let s = svg(w, h, 'scatter');
    ys.ticks.forEach((t) => (s += `<line class="grid" x1="${padL}" x2="${w - padR}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${padL - 8}" y="${Y(t) + 4}" text-anchor="end">${(o.yfmt || U.short)(t)}</text>`));
    xs.ticks.forEach((t) => (s += `<text class="ax" x="${X(t)}" y="${h - 18}" text-anchor="middle">${(o.xfmt || U.num)(t)}</text>`));
    if (o.xlabel) s += `<text class="ax" x="${(w + padL) / 2}" y="${h - 3}" text-anchor="middle">${U.esc(o.xlabel)}</text>`;
    pts.forEach((p, i) => { const rr = o.bubble ? 5 + 18 * Math.sqrt((p.r || 1) / rmax) : 5; s += `<circle class="dot" data-i="${i}" cx="${X(p.x)}" cy="${Y(p.y)}" r="${rr}" style="fill:${C.col(p.color, i)};fill-opacity:${o.bubble ? 0.55 : 0.75};animation-delay:${i * 12}ms"/>`; });
    if (o.labels) pts.forEach((p) => { if (p.label && o.bubble) s += `<text class="sk-v" x="${X(p.x)}" y="${Y(p.y) - 8 - 18 * Math.sqrt((p.r || 1) / rmax)}" text-anchor="middle">${U.esc(p.label)}</text>`; });
    s += '</svg>';
    el.innerHTML = s;
    el.querySelectorAll('.dot').forEach((d) => {
      const p = pts[+d.dataset.i];
      d.addEventListener('pointermove', (e) => C.tip(`<div class="tip-h">${U.esc(p.label || '')}</div>${p.tip || ''}`, e.clientX, e.clientY));
      d.addEventListener('pointerleave', C.untip);
    });
  };

  /* ---------- waterfall ---------- */
  C.waterfall = (el, steps, o = {}) => {
    if (!steps.length) return empty(el);
    const { w, h } = size(el, o.h || 260);
    const padL = 54, padR = 10, padT = 14, padB = 40;
    let run = 0; const bars = steps.map((s) => { if (s.start) { run = s.value; return { ...s, a: 0, b: run, total: true }; } if (s.total) { const b = { ...s, a: 0, b: run }; return b; } const a = run; run += s.value; return { ...s, a, b: run }; });
    const all = bars.flatMap((b) => [b.a, b.b]);
    const sc = C.nice(Math.min(0, ...all), Math.max(...all), 4);
    const Y = (v) => padT + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * (h - padT - padB);
    const slot = (w - padL - padR) / bars.length, bw = Math.min(46, slot * 0.66);
    let s = svg(w, h, 'waterfall');
    sc.ticks.forEach((t) => (s += `<line class="grid" x1="${padL}" x2="${w - padR}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${padL - 8}" y="${Y(t) + 4}" text-anchor="end">${U.short(t)}</text>`));
    bars.forEach((b, i) => {
      const x = padL + slot * i + (slot - bw) / 2, y0 = Y(Math.max(b.a, b.b)), y1 = Y(Math.min(b.a, b.b));
      const col = b.total ? 'var(--s1)' : b.value >= 0 ? 'var(--good)' : 'var(--bad)';
      s += `<g class="bar-g" data-i="${i}" style="animation-delay:${i * 60}ms"><rect class="bar" x="${x}" y="${y0}" width="${bw}" height="${Math.max(1.5, y1 - y0)}" rx="3" style="fill:${col}"/></g>`;
      if (i < bars.length - 1) s += `<line class="grid" x1="${x + bw}" x2="${x + slot}" y1="${Y(b.b)}" y2="${Y(b.b)}" style="stroke-dasharray:3 3"/>`;
      s += `<text class="ax" x="${x + bw / 2}" y="${h - 22}" text-anchor="middle">${U.esc(b.label.length > 10 ? b.label.slice(0, 9) + '…' : b.label)}</text><text class="ax" x="${x + bw / 2}" y="${h - 8}" text-anchor="middle">${U.short(b.total ? b.b : b.value)}</text>`;
    });
    s += '</svg>';
    el.innerHTML = s;
    el.querySelectorAll('.bar-g').forEach((g) => {
      const b = bars[+g.dataset.i];
      g.addEventListener('pointermove', (e) => C.tip(`<div class="tip-h">${U.esc(b.label)}</div><div class="tip-big">${U.money(b.total ? b.b : b.value, { sign: !b.total })}</div>`, e.clientX, e.clientY));
      g.addEventListener('pointerleave', C.untip);
    });
  };

  /* ---------- sparkline markup ---------- */
  C.spark = (values, o = {}) => {
    if (!values.length) return '';
    const w = o.w || 120, h = o.h || 34;
    const mn = Math.min(...values), mx = Math.max(...values), span = mx - mn || 1;
    const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * (w - 4) + 2, h - 3 - ((v - mn) / span) * (h - 8)]);
    const d = smooth(pts, true);
    const col = o.color || 'var(--accent)';
    const last = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d} L${last[0]},${h} L2,${h} Z" style="fill:${col};fill-opacity:.14"/><path class="ln draw" pathLength="1" d="${d}" style="stroke:${col};stroke-width:1.8"/><circle cx="${last[0]}" cy="${last[1]}" r="2.8" style="fill:${col}"/></svg>`;
  };

  /* ---------- re-render on resize ---------- */
  C.redrawers = [];
  C.track = (fn) => { C.redrawers.push(fn); fn(); };
  C.reset = () => (C.redrawers = []);
  window.addEventListener('resize', U.debounce(() => C.redrawers.forEach((f) => { try { f(); } catch (e) { console.error(e); } }), 180));
})(window.LL);
