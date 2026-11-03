/*
 * spider.js — Solitario Spider, todo en cliente, sin back.
 * Módulo montable: Spider.mount(rootEl, opts). Mismos hooks que el clásico:
 *   - valores:   [data-sol="mode|time|moves|draw"]   (draw = palos: «1 palo», «2 palos», «4 palos»)
 *   - acciones:  [data-sol-action="undo|new|hint|help|exit"]
 * Dos barajas (104 cartas). Estado: stock (hasta 50 cartas, se reparten de 10 en 10, una por columna), done[≤8] (escaleras
 * K→A del mismo palo, salen solas del tablero), tableau[10] (4 columnas de 6 + 6 de 5, la última boca arriba).
 * Dificultad = palos: opts.suits (1 · 2 · 4), ?palos=2 en la URL, o el panel ?dev=1. Reutiliza cards.js y styles.css;
 * spider.css añade la rejilla de 10 columnas (mazo en abanico a la izquierda, 8 huecos de escaleras a la derecha).
 * Reglas: una escalera (mismo palo, descendente, boca arriba) va sobre una carta de valor inmediatamente superior de cualquier
 * palo o a una columna vacía. No se reparte con columnas vacías. Un toque mueve si hay un único buen destino; si no, arrastra.
 */
(function () {
  const SAVE_KEY = 'ec-spider-partida-v1';
  const DEFAULTS = { suits: 1, felt: 'azul', red: 'rojo', devPanel: /[?&]dev=1/.test(location.search) };
  const SUITS_BY_LEVEL = { 1: ['s'], 2: ['s', 'h'], 4: ['s', 'h', 'd', 'c'] };
  const COLS = 10, SETS = 8, DEAL = 10;
  const LEVEL_LABEL = n => n === 1 ? '1 palo' : n + ' palos';

  function mount(root, options = {}) {
    const $ = (s, el = root) => el.querySelector(s);
    const qs = new URLSearchParams(location.search);
    const VARIANT = String(window.__solVariant || qs.get('sol') || '');
    const opts = { ...DEFAULTS, ...options };
    const qp = +(qs.get('palos') || (VARIANT.match(/palos(\d)/) || [])[1] || 0); if (SUITS_BY_LEVEL[qp]) opts.suits = qp;
    if (/verde/.test(VARIANT)) opts.felt = 'verde';
    if (opts.devPanel) { try { Object.assign(opts, JSON.parse(localStorage.getItem('spider-proto-opts-v1') || '{}')); } catch {} }
    const saveOpts = () => { try { localStorage.setItem('spider-proto-opts-v1', JSON.stringify({ suits: opts.suits, felt: opts.felt, red: opts.red })); } catch {} };

    root.classList.add('sol', 'sol--spider'); root.dataset.layout = 'top';
    root.innerHTML = `
      <div class="table">
        <section class="zone zone--top" aria-label="Mazo y escaleras completadas">
          <div class="pile pile--stock" role="button" tabindex="0" aria-label="Mazo: repartir una carta en cada columna"></div>
          <div class="piles piles--done" aria-label="Escaleras completadas"></div>
        </section>
        <section class="zone zone--tableau" aria-label="Columnas"></section>
      </div>
      <div class="overlay overlay--end" hidden role="dialog" aria-modal="true">
        <div class="overlay__card">
          <p class="overlay__kicker"></p>
          <h2 class="overlay__title"></h2>
          <p class="overlay__meta"></p>
          <div class="overlay__actions"></div>
        </div>
      </div>
      <div class="overlay overlay--help" hidden role="dialog" aria-modal="true" aria-label="Cómo se juega">
        <div class="overlay__card">
          <h2 class="overlay__title">Cómo se juega</h2>
          <div class="overlay__text">
            <p><b>Objetivo.</b> Formar ocho escaleras del Rey al As del mismo palo. Cada escalera completa sale sola del tablero.</p>
            <p><b>Columnas.</b> Una carta va sobre otra de valor inmediatamente superior, sea del palo que sea: sobre un 8 va un 7. Solo se mueven en grupo las escaleras del mismo palo. Cualquier carta puede ocupar una columna vacía.</p>
            <p><b>Mazo.</b> Toca el mazo para repartir una carta en cada columna. No se puede repartir mientras haya una columna vacía.</p>
            <p><b>Toque y arrastre.</b> Un toque mueve la escalera a su destino si solo hay uno bueno. Si hay varios, arrástrala tú.</p>
            <p><b>Pista y deshacer.</b> La pista te marca una jugada posible. Deshacer no cuenta como jugada.</p>
          </div>
          <div class="overlay__actions"><button class="overlay__btn overlay__btn--primary" type="button" data-close>Entendido</button></div>
        </div>
      </div>`;
    const stockEl = $('.pile--stock'), doneEl = $('.piles--done'), tabEl = $('.zone--tableau');
    const endOv = $('.overlay--end'), helpOv = $('.overlay--help');
    for (let i = 0; i < SETS; i++) { const p = document.createElement('div'); p.className = 'pile pile--done'; p.setAttribute('aria-label', 'Escalera completada ' + (i + 1)); doneEl.appendChild(p); }
    for (let i = 0; i < COLS; i++) { const p = document.createElement('div'); p.className = 'pile pile--column'; p.setAttribute('aria-label', 'Columna ' + (i + 1)); tabEl.appendChild(p); }

    // ---------- hooks externos ----------
    const out = key => document.querySelectorAll(`[data-sol="${key}"]`);
    const setOut = (key, v) => out(key).forEach(e => { e.textContent = v; });
    const actions = key => document.querySelectorAll(`[data-sol-action="${key}"]`);
    const setEnabled = (key, on) => actions(key).forEach(b => { b.disabled = !on; });

    // ---------- estado ----------
    let S = null, history = [], suits = opts.suits, moves = 0, finished = false, busy = false;
    let firstDeal = /[?&]alto=1/.test(location.search) || /alto/.test(VARIANT);
    const dealt = new Set(), justDone = new Set(); // ids que acaban de repartirse (vuelo + giro al llegar) o de completar escalera (vuelo al hueco)
    let timer = { start: null, int: null, elapsed: 0 };
    const els = new Map();
    const clone = st => JSON.parse(JSON.stringify(st));
    const G = () => window.gsap;
    const EASE = 'power2.out';

    function newDeck(level) {
      const list = SUITS_BY_LEVEL[level], d = [];
      for (let k = 0; k < SETS; k++) { const s = list[k % list.length]; for (let r = 0; r < 13; r++) d.push({ id: `${s}${r}_${k}`, s, r, up: false }); }
      for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      return d;
    }
    function deal() {
      const deck = newDeck(suits), tableau = [];
      for (let c = 0; c < COLS; c++) { const n = c < 4 ? 6 : 5; const col = []; for (let k = 0; k < n; k++) { const card = deck.pop(); card.up = k === n - 1; col.push(card); } tableau.push(col); }
      return { stock: deck, done: [], tableau };
    }
    const allCards = () => [...S.stock, ...S.done.flat(), ...S.tableau.flat()];
    // reparto falso para probar la altura: columnas largas con escaleras partidas
    function stressDeal() {
      let n = 0; const mk = (r, s, up) => ({ id: 'f' + (n++), r, s, up });
      const run = (len, from = 12, s = 's') => Array.from({ length: len }, (_, k) => mk(from - k, s, true));
      const spec = [[5, 13], [4, 9], [5, 4], [3, 12], [5, 2], [2, 7], [4, 1], [5, 10], [3, 3], [4, 6]];
      const tableau = spec.map(([d, u], i) => [...Array.from({ length: d }, () => mk(0, 'h', false)), ...run(u, 12, i % 2 ? 'h' : 's')]);
      return { stock: Array.from({ length: 20 }, () => mk(0, 'd', false)), done: [run(13, 12, 's')], tableau };
    }

    // ---------- guardar / retomar ----------
    function save() {
      if (!S || finished || firstDeal || opts.persist === false) return;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ S, suits, moves, elapsed: timer.elapsed, history: history.slice(-40), t: Date.now() })); } catch {}
    }
    function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
    function loadSave() { try { const j = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return j && j.S && j.S.tableau && j.S.tableau.length === COLS ? j : null; } catch { return null; } }

    // ---------- DOM de cartas ----------
    function buildCardEls(animated = false) {
      els.forEach(el => el.remove()); els.clear();
      for (const c of allCards()) {
        const el = document.createElement('div'); el.className = 'card no-anim'; el.dataset.id = c.id;
        el.setAttribute('aria-label', Cards.label(Cards.RANKS[c.r], c.s)); root.appendChild(el); els.set(c.id, el);
      }
      paintFaces();
      if (animated && G()) { dealAnimation(); return; }
      requestAnimationFrame(() => els.forEach(el => el.classList.remove('no-anim')));
    }
    function dealAnimation() {
      busy = true;
      const cw = cardSize(), ch = cw * 1.4; const { up, down } = offsets(ch);
      for (const c of allCards()) { const el = els.get(c.id); const p = stockPos(0); G().set(el, { x: p.x, y: p.y, scale: 1, scaleX: 1 }); if (c.up) { el.innerHTML = Cards.backSVG(); el.dataset.up = 'false'; } }
      els.forEach(el => el.classList.remove('no-anim'));
      S.stock.forEach((c, i) => { const p = stockPos(i); G().set(els.get(c.id), { x: p.x, y: p.y }); els.get(c.id).style.zIndex = 10 + i; });
      const cols = tabEl.querySelectorAll('.pile'); const tl = G().timeline({ delay: 0.12 }); const STEP = 0.11, FLY = 0.42, FAN = 0.05;
      S.tableau.forEach((col, ci) => {
        // de la columna más lejana a la más cercana al mazo: cada paquete vuela sobre huecos vacíos
        const r = rect(cols[ci]); const colEls = col.map(c => els.get(c.id)); const t0 = (COLS - 1 - ci) * STEP;
        tl.add(() => { colEls.forEach((el, i) => { el.style.zIndex = 500 + (COLS - ci) * 20 + i; el.classList.add('is-moving'); }); }, t0);
        tl.to(colEls, { x: r.x, y: r.y, duration: FLY, ease: 'power2.inOut' }, t0);
        tl.to(colEls, { scale: 1.07, duration: FLY * 0.45, ease: 'power1.out' }, t0).to(colEls, { scale: 1, duration: FLY * 0.55, ease: 'power1.in' }, t0 + FLY * 0.45);
        const tArr = t0 + FLY;
        let y = r.y; colEls.forEach((el, i) => { const yy = y; tl.to(el, { y: yy, duration: 0.42, ease: 'back.out(1.6)' }, tArr + 0.06 + i * FAN); y += col[i].up ? up : down; });
        const topEl = colEls[colEls.length - 1]; const tTop = tArr + 0.06 + (col.length - 1) * FAN + 0.18;
        tl.to(topEl, { scale: 1.06, duration: 0.12, ease: 'power2.out' }, tTop).to(topEl, { scale: 1, duration: 0.36, ease: 'back.out(2.4)' }, tTop + 0.12);
        tl.add(() => { colEls.forEach((el, i) => { el.style.zIndex = 10 + i; el.classList.remove('is-moving'); }); const top = col[col.length - 1]; if (top.up) { const el = els.get(top.id); el.dataset.up = 'true'; flip(el, Cards.faceSVG(Cards.RANKS[top.r], top.s)); } }, tTop + 0.02);
      });
      tl.add(() => { paintFaces(); layout(); busy = false; checkState(); }, '+=0.1');
    }
    function paintFaces() {
      if (!S) return;
      const skinKey = document.documentElement.dataset.solMobile === '1' ? 'm' : 'd';
      for (const c of allCards()) {
        const el = els.get(c.id);
        if (dealt.has(c.id)) continue; // recién repartida: gira al aterrizar (ver layout)
        if (el.dataset.up !== String(c.up) || el.dataset.skin !== skinKey) {
          const html = c.up ? Cards.faceSVG(Cards.RANKS[c.r], c.s) : Cards.backSVG();
          if (el.dataset.up === 'false' && c.up && !el.classList.contains('no-anim')) flip(el, html, 'y');
          else el.innerHTML = html;
          el.dataset.up = String(c.up); el.dataset.skin = skinKey;
        }
        el.classList.toggle('is-down', !c.up);
      }
    }

    // ---------- geometría ----------
    // Escritorio (columna de 800): carta 66 fija y 11 huecos iguales = (ancho − 10·66)/11 (12,7 en 800). Tablet estrecha 8 · móvil 4, con la carta que quepa.
    function metrics() {
      const W = root.clientWidth; let cw, gc, pad;
      if (W >= 740) { cw = opts.cardW || 66; gc = (W - COLS * cw) / (COLS + 1); pad = gc; if (gc < 6) { gc = 6; pad = 6; cw = Math.floor((W - (COLS + 1) * gc) / COLS); } }
      else { gc = window.innerWidth < 700 ? 4 : 8; pad = gc; cw = Math.max(26, Math.floor((W - (COLS + 1) * gc) / COLS)); }
      return { cw, gc, pad };
    }
    function cardSize() { return metrics().cw; }
    function applyLayoutMode() {
      const m = metrics(); document.documentElement.dataset.solMobile = window.innerWidth < 700 ? '1' : '0';
      root.style.setProperty('--gap', m.gc.toFixed(2) + 'px'); root.style.setProperty('--gap-l', m.gc.toFixed(2) + 'px'); root.style.setProperty('--pad', m.pad.toFixed(2) + 'px');
      root.style.setProperty('--card-w', m.cw + 'px');
      const ch = m.cw * 1.4; const { up, down } = offsets(ch);
      tabEl.querySelectorAll('.pile').forEach(p => { p.style.minHeight = (5 * down + 13 * up + ch) + 'px'; }); // alto mínimo: 5 tapadas + una escalera entera
    }
    function rect(el) { const r = el.getBoundingClientRect(), t = root.getBoundingClientRect(); return { x: r.left - t.left, y: r.top - t.top, w: r.width, h: r.height }; }
    // solape: el rango (y el palo de esquina) deben verse en cada carta boca arriba; móvil 0,30 · escritorio 0,28. Columnas muy largas: se compacta hasta 0,22
    function offsets(ch) {
      const mobile = window.innerWidth < 700; let up = ch * (mobile ? 0.3 : 0.28), down = ch * (mobile ? 0.1 : 0.08);
      if (S) {
        const MAX = 6.5 * ch;
        const natural = Math.max(...S.tableau.map(col => col.reduce((h, c, i) => h + (i < col.length - 1 ? (c.up ? up : down) : 0), 0) + ch));
        if (natural > MAX) { const k = Math.max(0.5, (MAX - ch) / (natural - ch)); up = Math.max(ch * 0.22, up * k); down = Math.max(ch * 0.06, down * k); }
      }
      return { up, down };
    }
    // mazo en abanico: un paquete de 10 por reparto pendiente, desplazados a la derecha; el de arriba es el próximo en repartirse
    const packetFan = () => cardSize() * 0.22;
    function stockPos(i) { const rs = rect(stockEl); return { x: rs.x + Math.floor(i / DEAL) * packetFan(), y: rs.y }; }

    // ---------- animación ----------
    function place(el, x, y, z, o = {}) {
      if (!G()) { el.style.transform = `translate(${x}px, ${y}px)`; el.style.zIndex = z; if (o.onComplete) o.onComplete(); return; }
      const cx = G().getProperty(el, 'x'), cy = G().getProperty(el, 'y');
      if (o.instant || (Math.abs(cx - x) < 0.5 && Math.abs(cy - y) < 0.5 && !o.lift)) { G().set(el, { x, y }); el.style.zIndex = z; if (o.onComplete) o.onComplete(); return; }
      const d = o.duration ?? 0.38;
      el.style.zIndex = z + 300; el.classList.add('is-moving');
      const tl = G().timeline({ delay: o.delay ?? 0, onComplete: () => { el.style.zIndex = z; el.classList.remove('is-moving'); if (o.onComplete) o.onComplete(); } });
      if (o.lift) { // repartir: sube en Z mientras ya va bajando, y aterriza con rebote
        tl.to(el, { scale: o.lift, x: cx + (x - cx) * 0.45, y: cy + (y - cy) * 0.45, duration: d * 0.45, ease: 'power2.out', overwrite: 'auto' }, 0)
          .to(el, { x, y, duration: d * 0.55, ease: 'power2.inOut' }, d * 0.45)
          .to(el, { scale: 1, duration: d * 0.7, ease: 'back.out(2.2)' }, d * 0.45);
        return;
      }
      tl.to(el, { x, y, duration: d, ease: o.ease ?? 'power2.inOut', overwrite: 'auto' }, 0);
      if (o.flat) return;
      tl.to(el, { scale: 1.06, duration: d * 0.45, ease: 'power1.out' }, 0).to(el, { scale: 1, duration: d * 0.55, ease: 'power1.in' }, d * 0.45);
    }
    function flip(el, html, axis = 'y') {
      if (!G()) { el.innerHTML = html; return; }
      const svg0 = el.querySelector('svg'); if (!svg0) { el.innerHTML = html; return; }
      svg0.classList.add('is-flipping'); el.classList.add('is-flipping');
      const out = axis === 'x' ? { rotationX: 90, transformPerspective: 600 } : { scaleX: 0 };
      const from = axis === 'x' ? { rotationX: -90, transformPerspective: 600 } : { scaleX: 0 };
      const to = axis === 'x' ? { rotationX: 0 } : { scaleX: 1 };
      G().to(svg0, { ...out, duration: axis === 'x' ? 0.18 : 0.13, ease: axis === 'x' ? 'power1.in' : 'power2.in', onComplete: () => {
        el.innerHTML = html; const svg1 = el.querySelector('svg'); svg1.classList.add('is-flipping');
        G().fromTo(svg1, from, { ...to, duration: axis === 'x' ? 0.2 : 0.17, ease: axis === 'x' ? 'power1.out' : 'power2.out', onComplete: () => { svg1.classList.remove('is-flipping'); el.classList.remove('is-flipping'); G().set(svg1, { clearProps: 'transform' }); } });
      } });
    }

    function layout() {
      if (!S) return;
      const cw = cardSize(), ch = cw * 1.4; const { up, down } = offsets(ch);
      // mazo: paquetes de 10 en abanico
      const stockIds = new Set(S.stock.map(c => c.id)); els.forEach((el, id) => el.classList.toggle('is-stock', stockIds.has(id)));
      S.stock.forEach((c, i) => { const p = stockPos(i); const el = els.get(c.id); el.classList.toggle('is-stock-top', i >= S.stock.length - DEAL); place(el, p.x, p.y, 10 + i, { flat: true, duration: 0.3 }); });
      root.querySelectorAll('.card.is-stock-top').forEach(el => { if (!stockIds.has(el.dataset.id)) el.classList.remove('is-stock-top'); });
      stockEl.classList.toggle('is-empty', S.stock.length === 0);
      stockEl.setAttribute('aria-label', S.stock.length ? `Mazo: ${S.stock.length / DEAL} repartos, repartir` : 'Mazo vacío');
      // escaleras completadas: el Rey arriba del todo; la recién completada vuela al hueco en cascada
      doneEl.querySelectorAll('.pile').forEach((p, di) => { const seq = S.done[di]; if (!seq) return; const r = rect(p); seq.forEach((c, i) => { const el = els.get(c.id); if (justDone.has(c.id)) { justDone.delete(c.id); place(el, r.x, r.y, 10 + (12 - i), { duration: 0.45, delay: (12 - i) * 0.03 }); } else place(el, r.x, r.y, 10 + (12 - i), { instant: true }); }); });
      // columnas
      const cols = tabEl.querySelectorAll('.pile'); let maxBottom = ch; let k = 0;
      S.tableau.forEach((col, ci) => {
        const r = rect(cols[ci]); let y = r.y, last = r.y;
        col.forEach((c, i) => {
          const el = els.get(c.id);
          if (dealt.has(c.id)) { dealt.delete(c.id); const face = Cards.faceSVG(Cards.RANKS[c.r], c.s); place(el, r.x, y, 10 + i, { lift: 1.1, duration: 0.42, delay: k++ * 0.06, onComplete: () => { el.dataset.up = 'true'; el.classList.remove('is-down'); flip(el, face, 'y'); } }); }
          else place(els.get(c.id), r.x, y, 10 + i);
          last = y; y += c.up ? up : down;
        });
        maxBottom = Math.max(maxBottom, last - r.y + ch);
      });
      const minH = 5 * down + 13 * up + ch;
      cols.forEach(p => { p.style.minHeight = Math.max(minH, maxBottom) + 'px'; });
    }

    // ---------- reglas ----------
    const top = a => a[a.length - 1];
    // cartas desde idx si forman escalera del mismo palo, descendente y boca arriba
    function runFrom(col, idx) {
      const cards = col.slice(idx); if (!cards.length || cards.some(c => !c.up)) return null;
      for (let k = 1; k < cards.length; k++) if (cards[k].s !== cards[0].s || cards[k].r !== cards[k - 1].r - 1) return null;
      return cards;
    }
    // longitud de la escalera del mismo palo que termina arriba de la columna
    function runLen(col) { let n = 0; for (let i = col.length - 1; i >= 0; i--) { if (!col[i].up) break; if (n && (col[i].s !== col[i + 1].s || col[i].r !== col[i + 1].r + 1)) break; n++; } return n; }
    function canToColumn(cards, col) { if (!col.length) return true; const t = top(col); return t.up && t.r === cards[0].r + 1; }
    function locate(id) { for (let i = 0; i < COLS; i++) { const idx = S.tableau[i].findIndex(c => c.id === id); if (idx >= 0) return { i, idx }; } return null; }
    function draggable(loc) { return loc ? runFrom(S.tableau[loc.i], loc.idx) : null; }
    // jugadas legales con una puntuación de utilidad (pista y detección de bloqueo). No incluye mover una columna entera a una vacía.
    function listMoves() {
      const mv = [];
      S.tableau.forEach((col, i) => {
        let emptySeen = false;
        for (let idx = 0; idx < col.length; idx++) {
          if (!col[idx].up) continue; const cards = runFrom(col, idx); if (!cards) continue;
          const uncovers = idx > 0 && !col[idx - 1].up, frees = idx === 0;
          const breaksRun = idx > 0 && col[idx - 1].up && col[idx - 1].s === cards[0].s && col[idx - 1].r === cards[0].r + 1; // ya estaba bien colocada sobre su palo
          for (let ci = 0; ci < COLS; ci++) {
            if (ci === i) continue; const tcol = S.tableau[ci]; if (!canToColumn(cards, tcol)) continue;
            let score;
            if (!tcol.length) { if (frees || emptySeen) continue; emptySeen = true; score = uncovers ? 1.3 : 0.4; }
            else {
              const same = top(tcol).s === cards[0].s; const rl = runLen(tcol);
              const completes = same && rl + cards.length === 13 && tcol[tcol.length - rl].r === 12;
              score = same ? 2 : 0.8; if (uncovers) score += 1; if (frees) score += 0.5; if (completes) score += 3; if (breaksRun) score -= same ? 0.2 : 1.2;
            }
            mv.push({ loc: { i, idx }, target: ci, score });
          }
        }
      });
      return mv.sort((a, b) => b.score - a.score);
    }
    const hasEmpty = () => S.tableau.some(c => !c.length);
    function canDeal() { return S.stock.length > 0 && !hasEmpty(); }

    function commit() { history.push(clone(S)); setEnabled('undo', true); }
    function afterMove() {
      moves++; setOut('moves', moves); startTimer(); paintFaces(); layout(); save();
      if (collectRuns()) return;
      if (S.done.length === SETS) { win(); return; }
      checkState();
    }
    // escaleras K→A completas: salen de la columna al siguiente hueco y se destapa la carta que quede
    function collectRuns() {
      let found = false;
      S.tableau.forEach(col => {
        if (col.length < 13) return; const seq = runFrom(col, col.length - 13); if (!seq || seq[0].r !== 12) return;
        col.splice(col.length - 13); S.done.push(seq); seq.forEach(c => { justDone.add(c.id); dealt.delete(c.id); const el = els.get(c.id); if (el) { el.dataset.up = 'true'; el.classList.remove('is-down'); } }); if (col.length && !top(col).up) top(col).up = true; found = true;
      });
      if (!found) return false;
      busy = true; paintFaces(); layout(); save();
      setTimeout(() => { busy = false; if (S.done.length === SETS) win(); else checkState(); }, 900);
      return true;
    }
    let checkT = null;
    function checkState() {
      clearTimeout(checkT);
      checkT = setTimeout(() => {
        if (!S || finished || busy || drag) return;
        // bloqueo: sin jugadas y sin reparto posible (mazo vacío, o columnas vacías que ya no se pueden rellenar)
        if (!listMoves().length && !canDeal()) blocked();
      }, 650);
    }
    function moveCards(loc, ci) {
      commit(); const src = S.tableau[loc.i], cards = src.splice(loc.idx);
      S.tableau[ci].push(...cards);
      if (src.length && !top(src).up) top(src).up = true;
      afterMove();
    }
    function dealStock() {
      if (finished || busy || !S.stock.length) return;
      if (hasEmpty()) { toast('Rellena las columnas vacías antes de repartir'); shake(tabEl.querySelectorAll('.pile')[S.tableau.findIndex(c => !c.length)]); return; }
      commit(); busy = true;
      for (let ci = 0; ci < COLS && S.stock.length; ci++) { const c = S.stock.pop(); c.up = true; dealt.add(c.id); S.tableau[ci].push(c); }
      setTimeout(() => { busy = false; checkState(); }, 0.06 * COLS * 1000 + 500);
      afterMove();
    }
    function autoMove(id) {
      const loc = locate(id), cards = draggable(loc); if (!cards) return false;
      const targets = [], same = [];
      for (let ci = 0; ci < COLS; ci++) {
        if (ci === loc.i) continue; const tcol = S.tableau[ci]; if (!canToColumn(cards, tcol)) continue;
        if (!tcol.length) { if (loc.idx === 0) continue; if (targets.some(t => !S.tableau[t].length)) continue; }
        targets.push(ci); if (tcol.length && top(tcol).s === cards[0].s) same.push(ci);
      }
      const pick = same.length === 1 ? same[0] : (targets.length === 1 ? targets[0] : null);
      if (pick === null) return false; moveCards(loc, pick); return true;
    }
    function hint() {
      if (!S || finished || busy) return;
      root.querySelectorAll('.is-hint').forEach(el => el.classList.remove('is-hint'));
      const mv = listMoves()[0];
      if (!mv || mv.score < 0.5) {
        if (S.stock.length) { if (hasEmpty()) toast('Rellena las columnas vacías y reparte del mazo'); else { pulse(els.get(top(S.stock).id)); toast('Reparte del mazo'); } return; }
        if (!mv) { toast('No hay jugadas: deshaz o empieza otra partida'); return; }
      }
      const cards = S.tableau[mv.loc.i].slice(mv.loc.idx); cards.forEach(c => els.get(c.id).classList.add('is-hint'));
      const tcol = S.tableau[mv.target]; (tcol.length ? els.get(top(tcol).id) : tabEl.querySelectorAll('.pile')[mv.target]).classList.add('is-hint'); pulse(els.get(cards[0].id));
      setTimeout(() => root.querySelectorAll('.is-hint').forEach(el => el.classList.remove('is-hint')), 1800);
    }
    function pulse(el) { if (G() && el) G().fromTo(el, { scale: 1 }, { scale: 1.08, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut', onComplete: () => G().set(el, { scale: 1 }) }); }
    function shake(el) { if (G() && el) G().fromTo(el, { x: 0 }, { x: 6, duration: 0.07, yoyo: true, repeat: 5, ease: 'sine.inOut', onComplete: () => G().set(el, { x: 0 }) }); }

    // ---------- drag & drop ----------
    let drag = null;
    function onPointerDown(e) {
      if (!S || finished || busy) return;
      const el = e.target.closest('.card'); if (!el || e.button > 0) return;
      if (el.classList.contains('is-stock')) return;
      const loc = locate(el.dataset.id), cards = draggable(loc); if (!cards) return;
      const items = cards.map(c => { const ce = els.get(c.id); if (G()) G().killTweensOf(ce); const m = new DOMMatrixReadOnly(getComputedStyle(ce).transform); return { c, el: ce, x: m.m41, y: m.m42 }; });
      drag = { loc, cards, items, sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId };
      el.setPointerCapture(e.pointerId); e.preventDefault();
    }
    function onPointerMove(e) {
      if (!drag || e.pointerId !== drag.pid) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) { drag.moved = true; root.classList.add('is-dragging-any'); drag.items.forEach(it => it.el.classList.add('is-dragging')); if (G()) G().to(drag.items.map(it => it.el), { scale: 1.08, duration: 0.14, ease: EASE }); }
      drag.items.forEach((it, k) => { if (G()) G().set(it.el, { x: it.x + dx, y: it.y + dy }); else it.el.style.transform = `translate(${it.x + dx}px, ${it.y + dy}px)`; it.el.style.zIndex = 1000 + k; });
      clearTargets(); const t = hitTarget(e.clientX, e.clientY, drag); if (t !== null) tabEl.querySelectorAll('.pile')[t].classList.add('is-target');
    }
    function onPointerUp(e) {
      if (!drag || e.pointerId !== drag.pid) return;
      const d = drag; drag = null; root.classList.remove('is-dragging-any'); d.items.forEach(it => it.el.classList.remove('is-dragging')); clearTargets();
      if (G()) G().to(d.items.map(it => it.el), { scale: 1, duration: 0.22, ease: 'power2.inOut' });
      if (!d.moved) { if (!autoMove(d.cards[0].id)) layout(); return; }
      const t = hitTarget(e.clientX, e.clientY, d); if (t !== null) moveCards(d.loc, t); else layout();
    }
    function hitTarget(cx, cy, d) {
      const cols = tabEl.querySelectorAll('.pile'), tb = tabEl.getBoundingClientRect();
      for (let ci = 0; ci < COLS; ci++) {
        if (d.loc.i === ci) continue;
        const r = cols[ci].getBoundingClientRect();
        if (cx >= r.left && cx <= r.right && cy >= r.top - 20 && cy <= Math.max(r.bottom, tb.bottom) && canToColumn(d.cards, S.tableau[ci])) return ci;
      }
      return null;
    }
    function clearTargets() { root.querySelectorAll('.is-target').forEach(p => p.classList.remove('is-target')); }

    // ---------- tiempo ----------
    const fmt = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    function startTimer() { if (timer.start || finished) return; timer.start = Date.now() - timer.elapsed; timer.int = setInterval(() => { timer.elapsed = Date.now() - timer.start; setOut('time', fmt(timer.elapsed)); if (Math.floor(timer.elapsed / 1000) % 15 === 0) save(); }, 500); }
    function stopTimer() { clearInterval(timer.int); timer.int = null; }
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (timer.int) { stopTimer(); timer.paused = true; } save(); } else if (timer.paused) { timer.paused = false; timer.start = null; startTimer(); } });

    // ---------- fin de partida ----------
    function showEnd(kicker, title, meta, buttons) {
      $('.overlay__kicker', endOv).textContent = kicker; $('.overlay__title', endOv).textContent = title; $('.overlay__meta', endOv).textContent = meta;
      const box = $('.overlay__actions', endOv); box.innerHTML = '';
      buttons.forEach(([label, fn, primary]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'overlay__btn' + (primary ? ' overlay__btn--primary' : ''); b.textContent = label; b.addEventListener('click', fn); box.appendChild(b); });
      endOv.hidden = false; if (G()) G().from($('.overlay__card', endOv), { y: 24, opacity: 0, duration: 0.35, ease: EASE });
    }
    function win() {
      finished = true; stopTimer(); clearSave(); setOut('mode', 'Completada');
      const show = () => showEnd('Partida libre completada.', '¡Bien jugado!', `${LEVEL_LABEL(suits)} · ${fmt(timer.elapsed)} · ${moves} jugadas`, [['Otra partida', newGame, true]]);
      if (!G()) { show(); return; }
      const cards = [...els.values()].reverse(); const H = root.clientHeight;
      G().to(cards, { y: `+=${H}`, x: () => `+=${G().utils.random(-180, 180)}`, rotation: () => G().utils.random(-120, 120), duration: 0.9, ease: 'power1.in', stagger: 0.012, onComplete: show });
    }
    function blocked() {
      finished = true; stopTimer(); setOut('mode', 'Sin jugadas');
      showEnd('No quedan movimientos.', 'Partida bloqueada', `${fmt(timer.elapsed)} · ${moves} jugadas`, [['Deshacer', () => { endOv.hidden = true; finished = false; undo(); }, false], ['Nueva partida', newGame, true]]);
    }

    // ---------- partida ----------
    function resetMeta() { stopTimer(); timer = { start: null, int: null, elapsed: 0 }; moves = 0; history = []; finished = false; busy = false; dealt.clear(); justDone.clear(); setOut('time', '00:00'); setOut('moves', '0'); setOut('mode', 'Partida libre'); setEnabled('undo', false); endOv.hidden = true; helpOv.hidden = true; }
    function newGame() {
      resetMeta(); clearSave(); suits = opts.suits; setOut('draw', LEVEL_LABEL(suits));
      S = firstDeal ? stressDeal() : deal(); if (firstDeal) setOut('mode', 'Prueba de alto'); firstDeal = false;
      applyLayoutMode(); buildCardEls(true); if (!G()) { layout(); checkState(); }
    }
    function resumeGame(saved) {
      resetMeta(); S = saved.S; suits = saved.suits || 1; opts.suits = suits; moves = saved.moves || 0; history = saved.history || []; timer.elapsed = saved.elapsed || 0;
      setOut('draw', LEVEL_LABEL(suits)); setOut('moves', moves); setOut('time', fmt(timer.elapsed)); setOut('mode', 'Partida retomada'); setEnabled('undo', history.length > 0);
      applyLayoutMode(); buildCardEls(false); layout(); checkState();
    }
    function undo() { if (!history.length || busy) return; S = history.pop(); finished = false; endOv.hidden = true; setEnabled('undo', history.length > 0); paintFaces(); layout(); save(); checkState(); }

    // ---------- eventos ----------
    root.addEventListener('pointerdown', onPointerDown); root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp); root.addEventListener('pointercancel', onPointerUp);
    root.addEventListener('click', e => { if (!S) return; const el = e.target.closest('.card'); if (e.target.closest('.pile--stock') || (el && el.classList.contains('is-stock'))) dealStock(); });
    stockEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dealStock(); } });
    actions('undo').forEach(b => b.addEventListener('click', undo));
    actions('new').forEach(b => b.addEventListener('click', newGame));
    actions('hint').forEach(b => { b.disabled = false; b.addEventListener('click', hint); });
    actions('help').forEach(b => b.addEventListener('click', () => { helpOv.hidden = false; }));
    $('[data-close]', helpOv).addEventListener('click', () => { helpOv.hidden = true; });
    helpOv.addEventListener('click', e => { if (e.target === helpOv) helpOv.hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') helpOv.hidden = true; });
    actions('exit').forEach(b => b.addEventListener('click', () => { save(); if (b.tagName !== 'A') toast('Salir → vuelve a la portada de Juegos. La partida queda guardada.'); }));
    new ResizeObserver(() => { applyLayoutMode(); layout(); }).observe(root);
    window.addEventListener('beforeunload', save);
    function toast(msg) {
      let t = document.querySelector('.sol-toast'); if (!t) { t = document.createElement('div'); t.className = 'sol-toast'; document.body.appendChild(t); }
      t.textContent = msg; t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0F2124;color:#fff;padding:10px 16px;border-radius:4px;font:14px var(--font-sans,sans-serif);z-index:6000;max-width:90vw;text-align:center';
      clearTimeout(t._h); t._h = setTimeout(() => t.remove(), 2600);
    }

    // ---------- panel de exploración (?dev=1) ----------
    if (opts.devPanel) {
      const dev = document.createElement('aside'); dev.className = 'sol-dev' + (window.innerWidth < 700 ? ' is-closed' : '');
      const group = (name, label, items) => `<div class="sol-dev__group"><span class="sol-dev__label">${label}</span>${items.map(([v, t]) => `<label><input type="radio" name="sol-${name}" value="${v}"${String(opts[name]) === String(v) ? ' checked' : ''}> ${t}</label>`).join('')}</div>`;
      dev.innerHTML = `<button class="sol-dev__toggle" type="button">Opciones (prototipo)</button><div class="sol-dev__body">
        ${group('suits', 'Palos (nueva partida)', [[1, '1 palo · fácil'], [2, '2 palos · media'], [4, '4 palos · difícil']])}
        ${group('felt', 'Tapete', [['azul', 'Azul core/azul/700 (final)'], ['verde', 'Verde'], ['gris', 'Gris claro'], ['blanco', 'Blanco']])}
        ${group('red', 'Palo rojo', [['rojo', 'A · rojo #D1322B'], ['ambar', 'D · ámbar core/bronce/700']])}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="sol-dev__btn" type="button" data-stress>Prueba de alto</button><button class="sol-dev__btn" type="button" data-wipe>Borrar partida guardada</button></div></div>`;
      document.body.appendChild(dev);
      dev.querySelector('.sol-dev__toggle').addEventListener('click', () => dev.classList.toggle('is-closed'));
      dev.querySelectorAll('input[type=radio]').forEach(i => i.addEventListener('change', () => { const name = i.name.replace('sol-', ''); opts[name] = name === 'suits' ? +i.value : i.value; saveOpts(); root.dataset.felt = opts.felt; root.dataset.red = opts.red; if (name === 'suits') newGame(); else { paintFaces(); applyLayoutMode(); layout(); } }));
      dev.querySelector('[data-stress]').addEventListener('click', () => { resetMeta(); S = stressDeal(); buildCardEls(); applyLayoutMode(); layout(); setOut('mode', 'Prueba de alto'); });
      dev.querySelector('[data-wipe]').addEventListener('click', () => { clearSave(); toast('Partida guardada borrada'); });
    }

    root.dataset.felt = opts.felt; root.dataset.red = opts.red;
    applyLayoutMode();
    let saved = (firstDeal || opts.persist === false) ? null : loadSave();
    if (saved && SUITS_BY_LEVEL[qp] && saved.suits !== qp) saved = null; // ?palos= explícito distinto de la partida guardada: partida nueva en ese nivel
    const start = () => requestAnimationFrame(() => requestAnimationFrame(() => saved ? resumeGame(saved) : newGame()));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
    const api = { newGame, undo, hint, get state() { return S; }, debug: { listMoves, canDeal, checkState, move: moveCards, deal: dealStock, get busy() { return busy; }, get finished() { return finished; } } };
    window.__sol = api;
    return api;
  }

  window.Spider = { mount, DEFAULTS };
})();
