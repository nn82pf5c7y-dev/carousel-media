// Sceny ilustracyjne 920x490. Kazda scena: init(root) buduje DOM, update(root, t) rysuje stan dla czasu t (sekundy).
// Czas jest sterowany z zewnatrz (render.mjs), wiec wynik jest deterministyczny.
(function () {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, s, d) => clamp((t - s) / d);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, x) => a + (b - a) * x;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, x) => {
    const A = hex(a), B = hex(b);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], x))).join(',')})`;
  };
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const el = (tag, cls, parent, st, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (st) Object.assign(e.style, st);
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  };
  const PXKEYS = new Set(['left', 'top', 'right', 'bottom', 'width', 'height', 'fontSize', 'borderRadius', 'gap', 'marginLeft', 'marginBottom', 'marginTop']);
  const px = (o) => {
    for (const k in o) if (typeof o[k] === 'number' && PXKEYS.has(k)) o[k] = o[k] + 'px';
    if (('left' in o || 'top' in o) && !('position' in o)) o.position = 'absolute';
    return o;
  };
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs, parent) => {
    const e = document.createElementNS(SVG, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  const S = {};
  const refs = new WeakMap();

  /* ---------- 1. n8n: przeplyw automatyzacji ---------- */
  S.flow = {
    init(root) {
      const r = {};
      const titles = ['New email', 'Save to sheet', 'Send reply'];
      const subs = ['Trigger', 'Action', 'Action'];
      const xs = [50, 355, 660];
      r.nodes = xs.map((x, i) => {
        const n = el('div', 'node', root, px({ left: x, top: 180 }));
        el('div', 'n', n, null, String(i + 1));
        el('div', 't', n, null, titles[i]);
        el('div', 's', n, null, subs[i]);
        return n;
      });
      const s = svg('svg', { width: 920, height: 490, viewBox: '0 0 920 490' }, root);
      s.style.position = 'absolute'; s.style.left = '0'; s.style.top = '0';
      const segs = [[260, 355], [565, 660]];
      r.segLen = 95;
      r.base = []; r.lit = [];
      segs.forEach(([a, b]) => {
        svg('line', { x1: a, y1: 245, x2: b, y2: 245, stroke: '#32476c', 'stroke-width': 4, 'stroke-dasharray': '8 8' }, s);
        r.lit.push(svg('line', { x1: a, y1: 245, x2: b, y2: 245, stroke: css('--accent'), 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': b - a, 'stroke-dashoffset': b - a }, s));
      });
      r.dot = svg('circle', { r: 9, cx: 260, cy: 245, fill: '#fff', opacity: 0 }, s);
      r.check = el('div', null, root, px({ left: 806, top: 112, width: 56, height: 56, borderRadius: 28, background: css('--accent'),
        color: '#0B1320', fontWeight: 800, fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }), '✓');
      r.status = el('div', null, root, px({ left: 0, width: 920, top: 392, textAlign: 'center', fontSize: 22, fontWeight: 600, letterSpacing: '.16em', color: css('--muted'), textTransform: 'uppercase' }), 'Running');
      refs.set(root, r);
    },
    update(root, t) {
      const r = refs.get(root);
      const litAt = [0.5, 2.0, 3.8];
      r.nodes.forEach((n, i) => {
        const k = easeOut(prog(t, litAt[i], 0.4));
        n.style.borderColor = mix('#2C4066', '#F5A524', k);
        n.style.boxShadow = `0 0 ${Math.round(34 * k)}px rgba(245,165,36,${(0.35 * k).toFixed(3)})`;
        n.firstChild.style.background = mix('#2a3d60', '#F5A524', k);
        n.firstChild.style.color = k > 0.5 ? '#0B1320' : '#fff';
      });
      const p1 = easeInOut(prog(t, 0.8, 1.2)), p2 = easeInOut(prog(t, 2.6, 1.2));
      r.lit[0].style.strokeDashoffset = r.segLen * (1 - p1);
      r.lit[1].style.strokeDashoffset = r.segLen * (1 - p2);
      let dx = null;
      if (t >= 0.8 && t < 2.0) dx = lerp(260, 355, p1);
      else if (t >= 2.6 && t < 3.8) dx = lerp(565, 660, p2);
      r.dot.setAttribute('opacity', dx == null ? 0 : 1);
      if (dx != null) r.dot.setAttribute('cx', dx);
      const c = easeOut(prog(t, 4.2, 0.35));
      r.check.style.opacity = c;
      r.check.style.transform = `scale(${lerp(0.4, 1, c)})`;
      r.status.textContent = t < 3.8 ? 'Running' : 'Done';
      r.status.style.color = t < 3.8 ? css('--muted') : css('--accent');
    },
  };

  /* ---------- 2. Paperless: skan, tagi, wyszukiwanie ---------- */
  S.paper = {
    init(root) {
      const r = {};
      r.doc = el('div', 'doc', root, px({ left: 150, top: 110, width: 220, height: 290 }));
      r.lines = [];
      for (let i = 0; i < 9; i++) {
        const w = i === 0 ? 120 : 150 + ((i * 37) % 40);
        r.lines.push(el('div', 'bar', r.doc, px({ left: 24, top: 28 + i * 28, width: w })));
      }
      r.scan = el('div', null, root, px({ left: 130, width: 260, height: 4, background: css('--accent'), borderRadius: 2,
        boxShadow: '0 0 24px rgba(245,165,36,.9)', opacity: 0 }));
      r.chips = [el('div', 'chip', root, px({ left: 150, top: 418 }), 'Invoice'), el('div', 'chip', root, px({ left: 252, top: 418 }), 'Oct 2026')];
      r.bar = el('div', null, root, px({ left: 480, top: 70, width: 400, height: 64, borderRadius: 18, border: '2px solid ' + css('--panelLine'),
        background: '#1b2a45', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14 }));
      const ic = el('div', null, r.bar, px({ width: 18, height: 18, borderRadius: 9, border: '3px solid ' + css('--muted'), flex: 'none' }));
      r.txt = el('span', null, r.bar, px({ fontSize: 26, fontWeight: 600, color: '#fff' }), '');
      r.caret = el('span', null, r.bar, px({ width: 3, height: 30, background: css('--accent'), marginLeft: -8 }));
      r.rows = ['Invoice 0142.pdf', 'Invoice 0139.pdf', 'Invoice 0131.pdf'].map((nm, i) => {
        const row = el('div', 'row', root, px({ left: 480, top: 168 + i * 78, width: 400, opacity: 0 }));
        el('i', null, row);
        el('span', null, row, null, nm);
        el('small', null, row, null, ['Oct', 'Sep', 'Aug'][i]);
        return row;
      });
      refs.set(root, r);
    },
    update(root, t) {
      const r = refs.get(root);
      const slide = easeOut(prog(t, 0.0, 1.0));
      r.doc.style.left = lerp(-260, 150, slide) + 'px';
      const s = prog(t, 1.0, 1.6);
      const y = lerp(0, 290, s);
      r.scan.style.opacity = s > 0 && s < 1 ? 1 : 0;
      r.scan.style.top = 110 + y + 'px';
      r.lines.forEach((ln, i) => {
        const pass = y > 28 + i * 28 + 6;
        ln.style.background = pass ? '#5b6b8c' : '#cfd6e3';
      });
      r.chips.forEach((c, i) => {
        const k = easeOut(prog(t, 2.8 + i * 0.25, 0.3));
        c.style.opacity = k;
        c.style.transform = `scale(${lerp(0.6, 1, k)})`;
      });
      const word = 'invoice';
      const n = Math.floor(prog(t, 3.8, 1.2) * word.length + 0.0001);
      r.txt.textContent = word.slice(0, n);
      r.caret.style.opacity = t > 3.6 && t < 7.2 && Math.floor(t * 2.5) % 2 === 0 ? 1 : 0;
      r.rows.forEach((row, i) => {
        const k = easeOut(prog(t, 5.4 + i * 0.25, 0.35));
        row.style.opacity = k;
        row.style.transform = `translateY(${lerp(14, 0, k)}px)`;
        const hl = i === 0 ? easeOut(prog(t, 6.1, 0.3)) : 0;
        row.style.borderColor = mix('#2C4066', '#F5A524', hl);
      });
    },
  };

  /* ---------- 3. Whisper: dzwiek na tekst ---------- */
  S.wave = {
    init(root) {
      const r = {};
      r.bars = [];
      for (let i = 0; i < 28; i++) r.bars.push(el('div', null, root, px({ left: 50 + i * 14, width: 8, borderRadius: 4, background: css('--accent') })));
      r.rec = el('div', null, root, px({ left: 50, top: 400, fontSize: 20, fontWeight: 700, letterSpacing: '.16em', color: css('--muted'), textTransform: 'uppercase' }), '');
      const panel = el('div', null, root, px({ left: 490, top: 70, width: 390, height: 350, borderRadius: 22, border: '2px solid ' + css('--panelLine'), background: '#1b2a45', padding: 26 }));
      el('div', null, panel, px({ fontSize: 16, fontWeight: 600, letterSpacing: '.18em', color: css('--muted'), textTransform: 'uppercase', marginBottom: 14 }), 'Transcript');
      const words = ['Thanks', 'for', 'joining.', "Let's", 'move', 'the', 'follow-up', 'call', 'to', 'Thursday.', 'Send', 'the', 'contract', 'to', 'Sam.'];
      const box = el('div', null, panel, px({ fontSize: 31, fontWeight: 600, lineHeight: 1.4, color: '#fff' }));
      r.words = words.map((w) => { const s = el('span', null, box, { opacity: 0 }, w + ' '); return s; });
      refs.set(root, r);
    },
    update(root, t) {
      const r = refs.get(root);
      const decay = 1 - 0.92 * prog(t, 6.3, 0.6);
      const a = (0.3 + 0.7 * Math.abs(Math.sin(t * 1.7)) * Math.abs(Math.sin(t * 0.6 + 1))) * decay;
      r.bars.forEach((b, i) => {
        const center = 1 - Math.abs(i - 13.5) / 19;
        const h = 12 + 200 * a * (0.3 + 0.7 * Math.abs(Math.sin(i * 0.55 + t * 7))) * center;
        b.style.height = h + 'px';
        b.style.top = 245 - h / 2 + 'px';
      });
      const sec = Math.floor(t);
      r.rec.textContent = '● Rec  00:0' + sec;
      const count = Math.floor(prog(t, 1.0, 5.2) * r.words.length + 0.0001);
      r.words.forEach((w, i) => {
        w.style.opacity = i < count ? 1 : 0;
        w.style.color = i === count - 1 && t < 6.4 ? css('--accent') : '#fff';
      });
    },
  };

  /* ---------- 4. Documenso: podpis ---------- */
  S.sign = {
    init(root) {
      const r = {};
      r.doc = el('div', 'doc', root, px({ left: 270, top: 36, width: 380, height: 420 }));
      el('div', null, r.doc, px({ left: 30, top: 28, fontSize: 24, fontWeight: 700, color: '#0B1320' }), 'Service agreement');
      for (let i = 0; i < 7; i++) el('div', 'bar', r.doc, px({ left: 30, top: 84 + i * 30, width: i % 3 === 2 ? 220 : 320 }));
      el('div', null, r.doc, px({ left: 30, top: 372, width: 250, height: 2, background: '#8c97ad' }));
      el('div', null, r.doc, px({ left: 30, top: 380, fontSize: 14, fontWeight: 600, letterSpacing: '.14em', color: '#8c97ad', textTransform: 'uppercase' }), 'Sign here');
      const s = svg('svg', { width: 260, height: 90, viewBox: '0 0 260 90' }, r.doc);
      s.style.position = 'absolute'; s.style.left = '30px'; s.style.top = '280px';
      r.path = svg('path', { d: 'M8 60 C 24 6, 40 84, 58 34 S 92 8, 104 52 S 140 74, 160 28 S 196 18, 206 54 L 246 40', fill: 'none', stroke: '#0B1320', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
      r.len = r.path.getTotalLength();
      r.path.style.strokeDasharray = r.len;
      r.pill = el('div', null, root, px({ left: 690, top: 60, padding: '10px 18px', borderRadius: 999, fontSize: 18, fontWeight: 700,
        letterSpacing: '.08em', textTransform: 'uppercase', border: '2px solid ' + css('--panelLine'), color: css('--muted'), whiteSpace: 'nowrap' }), 'Waiting');
      r.check = el('div', null, root, px({ left: 610, top: 400, width: 74, height: 74, borderRadius: 37, background: css('--accent'), color: '#0B1320',
        fontWeight: 800, fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }), '✓');
      refs.set(root, r);
    },
    update(root, t) {
      const r = refs.get(root);
      const d = easeInOut(prog(t, 1.5, 2.0));
      r.path.style.strokeDashoffset = r.len * (1 - d);
      const done = t >= 3.8;
      r.pill.textContent = done ? 'Completed' : 'Waiting';
      r.pill.style.background = done ? css('--accent') : 'transparent';
      r.pill.style.color = done ? '#0B1320' : css('--muted');
      r.pill.style.borderColor = done ? css('--accent') : css('--panelLine');
      const c = easeOut(prog(t, 3.8, 0.4));
      r.check.style.opacity = c;
      r.check.style.transform = `scale(${lerp(0.4, 1, c)})`;
    },
  };

  /* ---------- 5. Invoice Ninja: faktura ---------- */
  S.invoice = {
    init(root) {
      const r = {};
      r.card = el('div', 'doc', root, px({ left: 240, top: 36, width: 440, height: 420 }));
      el('div', null, r.card, px({ left: 32, top: 28, fontSize: 28, fontWeight: 700, color: '#0B1320' }), 'Invoice #1042');
      el('div', null, r.card, px({ left: 32, top: 68, fontSize: 16, fontWeight: 600, letterSpacing: '.12em', color: '#8c97ad', textTransform: 'uppercase' }), 'Due in 14 days');
      const items = [['Design work', '£450'], ['Hosting', '£90'], ['Consulting', '£300']];
      r.rows = items.map(([a, b], i) => {
        const row = el('div', null, r.card, px({ left: 32, top: 120 + i * 56, width: 376, height: 44, display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', fontSize: 22, fontWeight: 600, color: '#243350', borderBottom: '2px solid #e4e8f0', opacity: 0 }));
        el('span', null, row, null, a); el('span', null, row, null, b);
        return row;
      });
      const tot = el('div', null, r.card, px({ left: 32, top: 312, width: 376, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: '#0B1320' }));
      el('span', null, tot, px({ fontSize: 20, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }), 'Total');
      r.total = el('span', null, tot, px({ fontSize: 44, fontWeight: 800 }), '£0');
      r.stamp = el('div', 'stamp', r.card, px({ left: 262, top: 22, opacity: 0 }), 'PAID');
      refs.set(root, r);
    },
    update(root, t) {
      const r = refs.get(root);
      r.rows.forEach((row, i) => {
        const k = easeOut(prog(t, 1.0 + i * 0.8, 0.4));
        row.style.opacity = k;
        row.style.transform = `translateY(${lerp(14, 0, k)}px)`;
      });
      const v = Math.round(840 * easeOut(prog(t, 3.2, 1.0)));
      r.total.textContent = '£' + v;
      const k = easeOut(prog(t, 4.8, 0.4));
      r.stamp.style.opacity = k;
      r.stamp.style.transform = `rotate(-12deg) scale(${lerp(1.7, 1, k)})`;
    },
  };

  /* ---------- 6. CRM: karta przechodzi przez lejek ---------- */
  S.pipeline = {
    init(root) {
      const r = {};
      const names = ['Lead', 'Proposal', 'Won'];
      const xs = [25, 325, 625];
      xs.forEach((x, i) => {
        const c = el('div', null, root, px({ left: x, top: 40, width: 270, height: 410, borderRadius: 20, border: '2px solid ' + css('--panelLine'), background: '#16233A' }));
        el('div', null, c, px({ left: 22, top: 20, fontSize: 18, fontWeight: 700, letterSpacing: '.16em', color: css('--muted'), textTransform: 'uppercase' }), names[i]);
      });
      const ghost = (x, y) => {
        const g = el('div', null, root, px({ left: x, top: y, width: 230, height: 84, borderRadius: 14, border: '2px solid ' + css('--panelLine'), background: '#1b2a45', opacity: 0.55 }));
        el('div', null, g, px({ left: 16, top: 18, width: 120, height: 14, borderRadius: 7, background: '#32476c' }));
        el('div', null, g, px({ left: 16, top: 46, width: 80, height: 12, borderRadius: 6, background: '#2a3d60' }));
      };
      ghost(45, 200); ghost(45, 300); ghost(345, 270); ghost(645, 200);
      r.card = el('div', null, root, px({ left: 45, top: 90, width: 230, height: 84, borderRadius: 14, border: '2px solid ' + css('--panelLine'), background: '#22345a' }));
      el('div', null, r.card, px({ left: 16, top: 12, fontSize: 24, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }), 'Hartley & Co');
      el('div', null, r.card, px({ left: 16, top: 48, fontSize: 20, fontWeight: 600, color: css('--muted') }), '£1,200');
      r.badge = el('div', null, r.card, px({ left: 0, top: 96, padding: '8px 14px', borderRadius: 999, fontSize: 16, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
        background: css('--accent'), color: '#0B1320', whiteSpace: 'nowrap', opacity: 0 }), 'Follow up: Fri');
      r.check = el('div', null, root, px({ left: 836, top: 88, width: 44, height: 44, borderRadius: 22, background: css('--accent'), color: '#0B1320', fontWeight: 800, fontSize: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }), '✓');
      refs.set(root, r);
    },
    update(root, t) {
      const r = refs.get(root);
      const x = 45 + 300 * easeInOut(prog(t, 1.4, 1.0)) + 300 * easeInOut(prog(t, 4.6, 1.0));
      r.card.style.left = x + 'px';
      const hl = easeOut(prog(t, 5.6, 0.3));
      r.card.style.borderColor = mix('#2C4066', '#F5A524', hl);
      r.card.style.boxShadow = `0 0 ${Math.round(30 * hl)}px rgba(245,165,36,${(0.35 * hl).toFixed(3)})`;
      r.badge.style.opacity = easeOut(prog(t, 2.8, 0.4)) * (1 - prog(t, 4.4, 0.2));
      const c = easeOut(prog(t, 5.7, 0.35));
      r.check.style.opacity = c;
      r.check.style.transform = `scale(${lerp(0.4, 1, c)})`;
    },
  };

  /* ---------- 7. Rezerwacje: klient wybiera wolny termin ---------- */
  S.calendar = {
    init(root) {
      const r = {};
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const busy = ['0,0', '1,1', '2,0', '3,2', '4,1', '1,0', '3,0'];
      r.cells = {};
      days.forEach((d, i) => {
        el('div', null, root, px({ left: 40 + i * 170, top: 28, width: 160, textAlign: 'center', fontSize: 18, fontWeight: 700, letterSpacing: '.16em', color: css('--muted'), textTransform: 'uppercase' }), d);
        for (let j = 0; j < 3; j++) {
          const isBusy = busy.includes(i + ',' + j);
          r.cells[i + ',' + j] = el('div', null, root, px({ left: 40 + i * 170, top: 66 + j * 100, width: 160, height: 88, borderRadius: 14, border: '2px solid ' + css('--panelLine'),
            background: isBusy ? '#2a3d60' : '#16233A', opacity: isBusy ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: '#0B1320', textTransform: 'uppercase', letterSpacing: '.08em' }));
        }
      });
      r.target = r.cells['2,1'];
      r.conf = el('div', null, root, px({ left: 40, top: 400, padding: '12px 22px', borderRadius: 999, border: '2px solid ' + css('--accent'), color: css('--accent'),
        fontSize: 22, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0, whiteSpace: 'nowrap' }), '✓ Confirmation sent');
      r.cursor = el('div', null, root, px({ left: 700, top: 420, width: 26, height: 26, borderRadius: 13, background: '#fff', border: '4px solid ' + css('--accent'), opacity: 0 }));
      refs.set(root, r);
    },
    update(root, t) {
      const r = refs.get(root);
      const m = easeInOut(prog(t, 1.2, 1.6));
      r.cursor.style.opacity = easeOut(prog(t, 0.8, 0.3)) * (1 - prog(t, 3.9, 0.25));
      r.cursor.style.left = lerp(700, 380 + 70, m) + 'px';
      r.cursor.style.top = lerp(420, 166 + 30, m) + 'px';
      const hover = easeOut(prog(t, 2.8, 0.3));
      const book = easeOut(prog(t, 3.6, 0.35));
      r.target.style.borderColor = mix('#2C4066', '#F5A524', Math.max(hover, book));
      r.target.style.background = mix('#16233A', '#F5A524', book);
      r.target.textContent = book > 0.5 ? 'Booked' : '';
      const c = easeOut(prog(t, 4.6, 0.4));
      r.conf.style.opacity = c;
      r.conf.style.transform = `translateY(${lerp(12, 0, c)}px)`;
    },
  };

  /* ---------- 8. Mailing: jedna wiadomosc do wielu osob ---------- */
  S.mail = {
    init(root) {
      const r = {};
      const box = el('div', null, root, px({ left: 40, top: 50, width: 500, height: 390, borderRadius: 22, border: '2px solid ' + css('--panelLine'), background: '#1b2a45' }));
      el('div', null, box, px({ left: 28, top: 24, fontSize: 16, fontWeight: 700, letterSpacing: '.18em', color: css('--muted'), textTransform: 'uppercase' }), 'To: 3 clients');
      el('div', null, box, px({ left: 28, top: 58, width: 444, height: 2, background: css('--panelLine') }));
      r.subj = el('div', null, box, px({ left: 28, top: 74, fontSize: 28, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }), '');
      r.lines = [380, 420, 300, 400, 220].map((w, i) => el('div', null, box, px({ left: 28, top: 140 + i * 34, width: w, height: 12, borderRadius: 6, background: '#5b6b8c', opacity: 0 })));
      r.btn = el('div', null, box, px({ left: 28, top: 330, width: 130, height: 42, borderRadius: 12, background: css('--accent'), color: '#0B1320', fontSize: 20, fontWeight: 800,
        letterSpacing: '.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }), 'Send');
      el('div', null, root, px({ left: 590, top: 50, fontSize: 16, fontWeight: 700, letterSpacing: '.18em', color: css('--muted'), textTransform: 'uppercase' }), 'Delivery');
      r.rows = ['Sam', 'Priya', 'Jon'].map((nm, i) => {
        const row = el('div', 'row', root, px({ left: 590, top: 92 + i * 84, width: 290, opacity: 0 }));
        el('span', null, row, null, nm);
        el('small', null, row, null, 'Sent ✓');
        return row;
      });
      r.count = el('div', null, root, px({ left: 590, top: 380, fontSize: 30, fontWeight: 800, color: css('--muted') }), '');
      refs.set(root, r);
    },
    update(root, t) {
      const r = refs.get(root);
      const full = 'Following up on our call';
      r.subj.textContent = full.slice(0, Math.floor(prog(t, 0.5, 1.6) * full.length + 0.0001));
      r.lines.forEach((l, i) => { l.style.opacity = easeOut(prog(t, 2.1 + i * 0.25, 0.3)); });
      const press = prog(t, 3.8, 0.2) - prog(t, 4.0, 0.2);
      r.btn.style.transform = `scale(${1 - 0.08 * press})`;
      r.rows.forEach((row, i) => {
        const k = easeOut(prog(t, 4.3 + i * 0.5, 0.35));
        row.style.opacity = k;
        row.style.transform = `translateY(${lerp(14, 0, k)}px)`;
      });
      const n = t >= 5.8 ? 3 : t >= 5.3 ? 2 : t >= 4.8 ? 1 : 0;
      r.count.textContent = n ? 'Sent ' + n + '/3' : '';
      r.count.style.color = n === 3 ? css('--accent') : css('--muted');
    },
  };

  window.SCENES = S;
})();
