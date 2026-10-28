/*
 * game.js — Solitario clásico (Klondike), todo en cliente, sin back.
 * Módulo montable: Solitaire.mount(rootEl, opts). El chasis (barra de meta, controles) es externo:
 *   - valores:   [data-sol="mode|time|moves|draw"]
 *   - acciones:  [data-sol-action="undo|new|hint|help|exit"]
 * Estado: stock, waste, foundations[4] (fijas por palo ♥ ♦ ♣ ♠), tableau[7]. Un elemento DOM por carta.
 * Reglas de interacción (27/10): un toque sube la carta a su base o a una columna solo si hay un único destino válido;
 * con varios, el jugador arrastra. Deshacer no cuenta como jugada. La partida se guarda sola y se retoma al volver.
 */
(function () {
  const SUIT_ORDER = ['h', 'd', 'c', 's'];
  const SAVE_KEY = 'ec-solitario-partida-v1';
  const DEFAULTS = { layout: 'auto', draw: '1', felt: 'azul', red: 'rojo', gap: 'auto', compact: 'off', devPanel: /[?&]dev=1/.test(location.search) };

  function mount(root, options = {}) {
    const $ = (s, el = root) => el.querySelector(s);
    const VARIANT = String(window.__solVariant || (new URLSearchParams(location.search).get('sol') || '')).split(',').map(v => v.trim()).filter(Boolean);
    const has = v => VARIANT.includes(v);
    const PAD_EXTRA = has('pad16') ? 16 : has('pad8') ? 8 : 0;
    const LATERAL = has('lateral');
    const opts = { ...DEFAULTS, ...options, ...(has('verde') ? { felt: 'verde' } : {}), ...(has('roba3') ? { draw: '3' } : has('aleatorio') ? { draw: 'random' } : {}), ...(has('ambar') ? { red: 'ambar' } : {}) };
    if (opts.devPanel) { try { Object.assign(opts, JSON.parse(localStorage.getItem('solitario-proto-opts-v4') || '{}')); } catch {} }
    const saveOpts = () => { try { localStorage.setItem('solitario-proto-opts-v4', JSON.stringify({ layout: opts.layout, draw: opts.draw, felt: opts.felt, red: opts.red, gap: opts.gap, compact: opts.compact })); } catch {} };

    root.classList.add('sol');
    root.innerHTML = `
      <div class="table">
        <section class="zone zone--top" aria-label="Mazo y bases">
          <div class="piles piles--stock">
            <div class="pile pile--stock" role="button" tabindex="0" aria-label="Mazo: robar carta"><svg class="recycle" viewBox="0 0 100 140" aria-hidden="true"><rect class="recycle-card" x="0.5" y="0.5" width="99" height="139" rx="5.33"/><g transform="translate(18.7,49.2) scale(1.333)"><g class="recycle-icon"><path d="M35.4582 25.3793L25.4895 31.0894C24.8232 31.4712 24.0707 30.7469 24.4271 30.0665L25.5228 27.9737C17.3109 27.2218 0.871655 24.9789 0.0194258 17.4347C-0.0655564 16.597 0.138606 15.7258 0.553452 15.0018C2.0748 12.3907 5.80636 11.2971 8.5905 10.7508C8.77992 10.7183 8.85305 10.98 8.68138 11.0533C7.92009 11.3712 7.17619 11.7216 6.46368 12.1125C4.86457 12.9875 1.85578 14.9807 2.47563 17.081C3.1178 19.2672 6.81375 20.2915 8.85538 20.7366C14.3077 21.8237 19.9512 21.7447 25.5109 21.4097L24.4352 19.364C24.0772 18.6836 24.8299 17.9577 25.4971 18.3397L35.4582 24.0457C35.9736 24.3409 35.9736 25.0841 35.4582 25.3793Z"/><path d="M11.4699 5.81594L21.4386 0.105815C22.105 -0.276212 22.8574 0.44834 22.5011 1.12879L21.4053 3.22156C29.6173 3.97344 46.0564 6.21636 46.9086 13.7606C46.9936 14.5982 46.7896 15.4694 46.3746 16.1934C44.8535 18.8046 41.1217 19.8982 38.3376 20.4444C38.1483 20.4766 38.0752 20.2153 38.2467 20.142C39.0081 19.8241 39.7518 19.4737 40.4645 19.0827C42.0635 18.2077 45.0724 16.2146 44.4525 14.1142C43.8102 11.9281 40.1144 10.9038 38.0728 10.4584C32.6205 9.3716 26.9769 9.45061 21.4172 9.78556L22.493 11.831C22.8509 12.5117 22.0982 13.2376 21.431 12.8553L11.4699 7.14951C10.9546 6.85433 10.9546 6.11111 11.4699 5.81594Z"/></g></g></svg></div>
            <div class="pile pile--waste"></div>
          </div>
          <div class="piles piles--foundations"></div>
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
            <p><b>Objetivo.</b> Subir las 52 cartas a las cuatro bases, cada palo del As al Rey.</p>
            <p><b>Columnas.</b> Se construyen hacia abajo alternando color: sobre un 8 negro va un 7 rojo. Puedes mover una carta o una escalera completa. Solo un Rey puede ocupar una columna vacía.</p>
            <p><b>Mazo.</b> Toca el mazo para robar. Cuando se acaba, toca el icono para darle la vuelta al descarte.</p>
            <p><b>Toque y arrastre.</b> Un toque sube la carta a su base, o a una columna si solo hay una posible. Si hay varias, arrástrala tú.</p>
            <p><b>Pista y deshacer.</b> La pista te marca una jugada posible. Deshacer no cuenta como jugada.</p>
          </div>
          <div class="overlay__actions"><button class="overlay__btn overlay__btn--primary" type="button" data-close>Entendido</button></div>
        </div>
      </div>`;
    const table = $('.table'), stockEl = $('.pile--stock'), wasteEl = $('.pile--waste'), foundEl = $('.piles--foundations'), tabEl = $('.zone--tableau');
    const endOv = $('.overlay--end'), helpOv = $('.overlay--help');
    for (let i = 0; i < 4; i++) { const p = document.createElement('div'); p.className = 'pile pile--foundation'; p.setAttribute('aria-label', 'Base de ' + Cards.SUITS[SUIT_ORDER[i]].name); p.innerHTML = `<svg class="hint" viewBox="0 0 100 100"><path d="${Cards.SUITS[SUIT_ORDER[i]].path}" transform="${Cards.SUITS[SUIT_ORDER[i]].box}"/></svg>`; foundEl.appendChild(p); }
    for (let i = 0; i < 7; i++) { const p = document.createElement('div'); p.className = 'pile pile--column'; p.setAttribute('aria-label', 'Columna ' + (i + 1)); tabEl.appendChild(p); }

    // ---------- hooks externos ----------
    const out = key => document.querySelectorAll(`[data-sol="${key}"]`);
    const setOut = (key, v) => out(key).forEach(e => { e.textContent = v; });
    const actions = key => document.querySelectorAll(`[data-sol-action="${key}"]`);
    const setEnabled = (key, on) => actions(key).forEach(b => { b.disabled = !on; });

    // ---------- estado ----------
    let S = null, history = [], drawCount = 1, moves = 0, finished = false, busy = false;
    let firstDeal = /[?&]alto=1/.test(location.search) || has('alto');
    const backflip = new Set(), arcIds = new Set(), recycled = new Set();
    let timer = { start: null, int: null, elapsed: 0 };
    const els = new Map();
    const clone = st => JSON.parse(JSON.stringify(st));
    const G = () => window.gsap;
    const EASE = 'power2.out';

    function newDeck() {
      const d = [];
      for (const s of SUIT_ORDER) for (let r = 0; r < 13; r++) d.push({ id: s + r, s, r, up: false });
      for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      return d;
    }
    function deal() {
      const deck = newDeck(), tableau = [];
      for (let c = 0; c < 7; c++) { const col = []; for (let k = 0; k <= c; k++) { const card = deck.pop(); card.up = k === c; col.push(card); } tableau.push(col); }
      return { stock: deck, waste: [], foundations: [[], [], [], []], tableau };
    }
    const allCards = () => [...S.stock, ...S.waste, ...S.foundations.flat(), ...S.tableau.flat()];
    // reparto falso para probar la altura (ids únicos, cartas repetidas)
    function stressDeal() {
      let n = 0; const mk = (r, s, up) => ({ id: 'f' + (n++), r, s, up });
      const run = (len, startRank = 12, startRed = false) => Array.from({ length: len }, (_, k) => mk(startRank - k, (startRed ? k % 2 === 0 : k % 2 === 1) ? 'h' : 's', true));
      const spec = [[0, 13], [1, 10], [2, 8], [3, 6], [4, 4], [5, 3], [6, 13]];
      const tableau = spec.map(([d, u], i) => [...Array.from({ length: d }, () => mk(0, 'c', false)), ...run(u, 12, i % 2 === 0)]);
      return { stock: Array.from({ length: 8 }, () => mk(0, 'd', false)), waste: [mk(7, 'c', true)], foundations: [[mk(0, 'h', true)], [mk(0, 'd', true)], [], []], tableau };
    }

    // ---------- guardar / retomar ----------
    function save() {
      if (!S || finished || firstDeal) return;
      if (opts.persist === false) return;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ S, drawCount, moves, elapsed: timer.elapsed, history: history.slice(-40), t: Date.now() })); } catch {}
    }
    function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
    function loadSave() { try { const j = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return j && j.S && j.S.tableau && j.S.tableau.length === 7 ? j : null; } catch { return null; } }

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
      const rs = rect(stockEl); const cw = cardSize(), ch = cw * 1.4; const { up, down } = offsets(ch);
      for (const c of allCards()) { const el = els.get(c.id); G().set(el, { x: rs.x, y: rs.y, scale: 1, scaleX: 1 }); if (c.up) { el.innerHTML = Cards.backSVG(); el.dataset.up = 'false'; } }
      els.forEach(el => el.classList.remove('no-anim'));
      const rw = rect(wasteEl); S.waste.forEach((c, i) => place(els.get(c.id), rw.x, rw.y, 10 + i, { instant: true }));
      foundEl.querySelectorAll('.pile').forEach((p, fi) => { const r = rect(p); S.foundations[fi].forEach((c, i) => place(els.get(c.id), r.x, r.y, 10 + i, { instant: true })); });
      S.stock.forEach((c, i) => { const depth = Math.min(2, S.stock.length - 1 - i); G().set(els.get(c.id), { x: rs.x, y: rs.y + depth * 3 }); els.get(c.id).style.zIndex = 10 + i; });
      const cols = tabEl.querySelectorAll('.pile'); const tl = G().timeline({ delay: 0.12 }); const STEP = 0.16, FLY = 0.42, FAN = 0.05;
      S.tableau.forEach((col, ci) => {
        // de la columna más lejana a la más cercana al mazo: cada paquete vuela sobre huecos vacíos
        const r = rect(cols[ci]); const colEls = col.map(c => els.get(c.id)); const t0 = (S.tableau.length - 1 - ci) * STEP;
        tl.add(() => { colEls.forEach((el, i) => { el.style.zIndex = 500 + (S.tableau.length - ci) * 20 + i; el.classList.add('is-moving'); }); }, t0);
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
        if (el.dataset.up !== String(c.up) || el.dataset.skin !== skinKey) {
          const html = c.up ? Cards.faceSVG(Cards.RANKS[c.r], c.s) : Cards.backSVG();
          if (el.dataset.up === 'false' && c.up && !el.classList.contains('no-anim')) { flip(el, html, backflip.has(c.id) && layoutMode() === 'rail' ? 'x' : 'y'); backflip.delete(c.id); }
          else if (el.dataset.up === 'true' && !c.up && recycled.has(c.id) && !el.classList.contains('no-anim')) flip(el, html, 'y');
          else el.innerHTML = html;
          el.dataset.up = String(c.up); el.dataset.skin = skinKey;
        }
        el.classList.toggle('is-down', !c.up);
      }
    }

    // ---------- geometría ----------
    function layoutMode() { if (window.innerWidth < 700) return 'top'; return opts.layout === 'auto' ? (window.innerWidth > 900 ? 'rail' : 'top') : opts.layout; }
    // Aire (Figma Diseño final): escritorio con bases laterales = carta 75 fija y aire = (ancho − 9·75)/10 (13,3 en 808); tablet 16; móvil 8. Padding = aire.
    function metrics() {
      const mode = layoutMode(), W = root.clientWidth; let cw, gc, gl, pad;
      if (mode === 'rail') {
        cw = opts.cardW || 75; // cardW: solo para capturas/vídeo a mayor tamaño; el diseño es 75
        if (LATERAL) { gc = 10; pad = 10 + PAD_EXTRA; gl = (W - 2 * pad - 9 * cw - 6 * gc) / 2; }
        else { gc = (W - 2 * PAD_EXTRA - 9 * cw) / 10; pad = gc + PAD_EXTRA; gl = gc; }
        if (gc < 6) { gc = 6; gl = gc; pad = gc + PAD_EXTRA; cw = Math.floor((W - 2 * pad - 8 * gc) / 9); }
      } else {
        gc = window.innerWidth < 700 ? 8 : 16; pad = gc + PAD_EXTRA; gl = gc; cw = Math.max(30, Math.floor((W - 2 * pad - 6 * gc) / 7));
      }
      if (opts.gap !== 'auto' && mode === 'rail') { gc = +opts.gap; gl = gc; pad = gc; cw = Math.floor((W - 2 * pad - 8 * gc) / 9); }
      return { mode, cw, gc, gl, pad };
    }
    const gapPx = () => metrics().gc;
    function cardSize() { return metrics().cw; }
    function applyLayoutMode() {
      const m = metrics(); root.dataset.layout = m.mode; document.documentElement.dataset.solMobile = window.innerWidth < 700 ? '1' : '0';
      root.style.setProperty('--gap', m.gc.toFixed(2) + 'px'); root.style.setProperty('--gap-l', m.gl.toFixed(2) + 'px'); root.style.setProperty('--pad', m.pad.toFixed(2) + 'px');
      root.style.setProperty('--card-w', m.cw + 'px');
      // alto fijo desde el primer frame: columna más larga posible = 6 tapadas + 12 solapes + carta
      const ch = m.cw * 1.4; const { up, down } = offsets(ch);
      tabEl.querySelectorAll('.pile').forEach(p => { p.style.minHeight = (6 * down + 12 * up + ch) + 'px'; });
    }
    function rect(el) { const r = el.getBoundingClientRect(), t = root.getBoundingClientRect(); return { x: r.left - t.left, y: r.top - t.top, w: r.width, h: r.height }; }
    function offsets(ch) {
      const mode = layoutMode(); const upK = window.innerWidth < 700 ? 0.34 : mode === 'top' ? 0.32 : 0.305; let up = ch * upK, down = ch * 0.076;
      if (opts.compact !== 'off' && S) {
        const MAX = 3.3 * ch;
        const natural = Math.max(...S.tableau.map(col => col.reduce((h, c, i) => h + (i < col.length - 1 ? (c.up ? up : down) : 0), 0) + ch));
        if (natural > MAX) { const k = Math.max(0.5, (MAX - ch) / (natural - ch)); up = Math.max(ch * 0.2, up * k); down = Math.max(ch * 0.05, down * k); }
      }
      return { up, down };
    }

    // ---------- animación ----------
    function place(el, x, y, z, o = {}) {
      if (!G()) { el.style.transform = `translate(${x}px, ${y}px)`; el.style.zIndex = z; return; }
      const cx = G().getProperty(el, 'x'), cy = G().getProperty(el, 'y');
      if (o.instant || (Math.abs(cx - x) < 0.5 && Math.abs(cy - y) < 0.5)) { G().set(el, { x, y }); el.style.zIndex = z; return; }
      const d = o.duration ?? 0.38;
      el.style.zIndex = z + 300; el.classList.add('is-moving');
      const tl = G().timeline({ delay: o.delay ?? 0, onComplete: () => { el.style.zIndex = z; el.classList.remove('is-moving'); if (o.onComplete) o.onComplete(); } });
      if (o.lift) { // robar: sube en Z girando mientras ya va bajando, y aterriza con rebote
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
      svg0.classList.add('is-flipping'); el.classList.add('is-flipping'); // mientras gira, la sombra del contenedor no debe delatar un rectángulo quieto
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
      // mazo con grosor: la primera en su sitio y las dos de debajo asomando 3 px
      const rs = rect(stockEl); const n = S.stock.length;
      const stockIds = new Set(S.stock.map(c => c.id)); const wasStock = new Set(); els.forEach((el, id) => { if (el.classList.contains('is-stock')) wasStock.add(id); el.classList.toggle('is-stock', stockIds.has(id)); });
      S.stock.forEach((c, i) => {
        const depth = Math.min(2, n - 1 - i); const el = els.get(c.id); el.classList.toggle('is-stock-top', i === n - 1);
        if (recycled.has(c.id)) { recycled.delete(c.id); place(el, rs.x, rs.y, 10 + i, { flat: true, duration: 0.36, onComplete: () => { if (depth > 0 && G()) G().to(el, { y: rs.y + depth * 3, duration: 0.22, delay: 0.06 * depth, ease: 'power2.out' }); } }); return; }
        place(el, rs.x, rs.y + depth * 3, 10 + i, wasStock.has(c.id) ? { instant: true } : { flat: true, duration: 0.3 });
      });
      root.querySelectorAll('.card.is-stock-top').forEach(el => { if (!S.stock.length || el.dataset.id !== S.stock[S.stock.length - 1].id) el.classList.remove('is-stock-top'); });
      // descarte: con roba 3 las tres últimas en abanico (vertical bajo el mazo en escritorio, horizontal en tablet/móvil); solo la de arriba es jugable
      const rw = rect(wasteEl); const wn = S.waste.length; const fanN = drawCount === 3 ? 3 : 1;
      const fanStep = layoutMode() === 'rail' ? { x: 0, y: ch * 0.26 } : { x: cw * 0.36, y: 0 };
      S.waste.forEach((c, i) => {
        const el = els.get(c.id); const k = Math.max(0, i - (wn - fanN)); let tx = rw.x + k * fanStep.x, ty = rw.y + k * fanStep.y;
        if (fanN === 1) ty += Math.min(2, wn - 1 - i) * 3; // grosor del descarte como el del mazo: las dos de debajo asoman 3 px
        if (arcIds.has(c.id)) { arcIds.delete(c.id); place(el, tx, ty, 10 + i, { lift: 1.14, duration: 0.42 }); } else place(el, tx, ty, 10 + i, { flat: true, duration: 0.25 });
      });
      foundEl.querySelectorAll('.pile').forEach((p, fi) => { const r = rect(p); S.foundations[fi].forEach((c, i) => place(els.get(c.id), r.x, r.y, 10 + i)); });
      const cols = tabEl.querySelectorAll('.pile'); let maxBottom = ch;
      S.tableau.forEach((col, ci) => {
        const r = rect(cols[ci]); let y = r.y, last = r.y;
        col.forEach((c, i) => { place(els.get(c.id), r.x, y, 10 + i); last = y; y += c.up ? up : down; });
        maxBottom = Math.max(maxBottom, last - r.y + ch);
      });
      const maxPossible = 6 * down + 12 * up + ch; // alto fijo: columna más larga posible
      cols.forEach(p => { p.style.minHeight = Math.max(maxPossible, maxBottom) + 'px'; });
      stockEl.classList.toggle('is-empty', S.stock.length === 0);
      stockEl.setAttribute('aria-label', S.stock.length ? `Mazo: ${S.stock.length} cartas, robar` : (S.waste.length ? 'Mazo vacío: renovar con el descarte' : 'Mazo vacío'));
    }

    // ---------- reglas ----------
    const red = s => s === 'h' || s === 'd', top = a => a[a.length - 1];
    function canToTableau(cards, col) { const f = cards[0]; if (!col.length) return f.r === 12; const t = top(col); return t.up && red(t.s) !== red(f.s) && t.r === f.r - 1; }
    function canToFoundation(cards, fi) { if (cards.length !== 1) return false; const c = cards[0]; return c.s === SUIT_ORDER[fi] && S.foundations[fi].length === c.r; }
    function locate(id) {
      for (let i = 0; i < 7; i++) { const idx = S.tableau[i].findIndex(c => c.id === id); if (idx >= 0) return { pile: 'tableau', i, idx }; }
      const wi = S.waste.findIndex(c => c.id === id); if (wi >= 0) return { pile: 'waste', i: 0, idx: wi };
      for (let i = 0; i < 4; i++) { const idx = S.foundations[i].findIndex(c => c.id === id); if (idx >= 0) return { pile: 'foundation', i, idx }; }
      return null;
    }
    const sourceArray = loc => loc.pile === 'tableau' ? S.tableau[loc.i] : loc.pile === 'waste' ? S.waste : S.foundations[loc.i];
    function draggable(loc) {
      if (!loc) return null; const arr = sourceArray(loc);
      if (loc.pile !== 'tableau' && loc.idx !== arr.length - 1) return null;
      const cards = arr.slice(loc.idx); return cards.some(c => !c.up) ? null : cards;
    }
    // movimientos útiles disponibles (para pista y detección de bloqueo)
    function listMoves() {
      const mv = [];
      const tryCards = (loc, cards) => {
        if (cards.length === 1) for (let fi = 0; fi < 4; fi++) if (canToFoundation(cards, fi)) mv.push({ loc, target: { pile: 'foundation', i: fi }, score: 3 });
        for (let ci = 0; ci < 7; ci++) {
          if (loc.pile === 'tableau' && loc.i === ci) continue;
          if (loc.pile === 'tableau' && loc.idx === 0 && !S.tableau[ci].length) continue; // rey de columna vacía a otra vacía: no aporta
          if (loc.pile === 'foundation') continue;                                        // bajar de una base: lo dejamos para el jugador
          if (canToTableau(cards, S.tableau[ci])) {
            const uncovers = loc.pile === 'tableau' && loc.idx > 0 && !S.tableau[loc.i][loc.idx - 1].up; // destapa una carta
            const frees = loc.pile === 'tableau' && loc.idx === 0;                                       // vacía una columna
            mv.push({ loc, target: { pile: 'tableau', i: ci }, score: uncovers ? 2 : frees ? 1.5 : loc.pile === 'waste' ? 1.2 : 0.5 });
          }
        }
      };
      S.tableau.forEach((col, i) => { for (let idx = 0; idx < col.length; idx++) if (col[idx].up) tryCards({ pile: 'tableau', i, idx }, col.slice(idx)); });
      if (S.waste.length) tryCards({ pile: 'waste', i: 0, idx: S.waste.length - 1 }, [top(S.waste)]);
      return mv.sort((a, b) => b.score - a.score);
    }
    // ¿robando se llega a alguna carta jugable? Simula un ciclo completo del mazo con el reparto actual
    function stockHasPlay() {
      if (!S.stock.length && !S.waste.length) return false;
      const stock = [...S.stock], waste = [...S.waste]; const seen = new Set(); let guard = 0;
      const playable = c => { for (let fi = 0; fi < 4; fi++) if (canToFoundation([c], fi)) return true; for (let ci = 0; ci < 7; ci++) if (canToTableau([c], S.tableau[ci])) return true; return false; };
      while (guard++ < 200) {
        if (!stock.length) { if (!waste.length) return false; stock.push(...waste.reverse()); waste.length = 0; }
        for (let k = 0; k < drawCount && stock.length; k++) waste.push(stock.pop());
        const t = top(waste); if (!t) return false; const key = t.id + ':' + stock.length; if (seen.has(key)) return false; seen.add(key);
        if (playable(t)) return true;
      }
      return false;
    }
    function allFaceUp() { return !S.stock.length && !S.waste.length && S.tableau.every(col => col.every(c => c.up)); }

    function commit() { history.push(clone(S)); setEnabled('undo', true); }
    function afterMove() {
      moves++; setOut('moves', moves); startTimer(); paintFaces(); layout(); save();
      if (S.foundations.every(f => f.length === 13)) { win(); return; }
      checkState();
    }
    let checkT = null;
    function checkState() {
      clearTimeout(checkT);
      checkT = setTimeout(() => {
        if (!S || finished || busy || drag) return;
        if (allFaceUp()) { autoComplete(); return; }
        if (!listMoves().length && !stockHasPlay()) blocked();
      }, 650);
    }
    function moveCards(loc, target) {
      commit(); const src = sourceArray(loc), cards = src.splice(loc.idx);
      (target.pile === 'tableau' ? S.tableau[target.i] : S.foundations[target.i]).push(...cards);
      if (loc.pile === 'tableau' && src.length && !top(src).up) top(src).up = true;
      afterMove();
    }
    function drawFromStock() {
      if (finished || busy) return;
      commit();
      if (!S.stock.length) { if (!S.waste.length) { history.pop(); return; } S.stock = S.waste.reverse().map(c => (c.up = false, recycled.add(c.id), c)); S.waste = []; }
      else for (let k = 0; k < drawCount && S.stock.length; k++) { const c = S.stock.pop(); c.up = true; S.waste.push(c); backflip.add(c.id); arcIds.add(c.id); }
      afterMove();
    }
    function autoMove(id) {
      const loc = locate(id), cards = draggable(loc); if (!cards) return false;
      if (cards.length === 1) for (let fi = 0; fi < 4; fi++) if (canToFoundation(cards, fi)) { moveCards(loc, { pile: 'foundation', i: fi }); return true; }
      const targets = [];
      for (let ci = 0; ci < 7; ci++) {
        if (loc.pile === 'tableau' && loc.i === ci) continue;
        if (loc.pile === 'tableau' && loc.idx === 0 && !S.tableau[ci].length) continue;
        if (canToTableau(cards, S.tableau[ci])) targets.push(ci);
      }
      if (targets.length === 1) { moveCards(loc, { pile: 'tableau', i: targets[0] }); return true; }
      return false;
    }
    // todo destapado y sin mazo: las cartas suben solas a las bases
    function autoComplete() {
      if (finished || busy) return; busy = true; setOut('mode', 'Completando…');
      const step = () => {
        for (let ci = 0; ci < 7; ci++) { const col = S.tableau[ci]; if (!col.length) continue; const c = top(col); for (let fi = 0; fi < 4; fi++) if (canToFoundation([c], fi)) { commit(); col.pop(); S.foundations[fi].push(c); moves++; setOut('moves', moves); paintFaces(); layout(); setTimeout(step, 110); return; } }
        busy = false; save(); if (S.foundations.every(f => f.length === 13)) win(); else { setOut('mode', 'Partida libre'); checkState(); }
      };
      setTimeout(step, 250);
    }
    function hint() {
      if (!S || finished || busy) return;
      root.querySelectorAll('.is-hint').forEach(el => el.classList.remove('is-hint'));
      const mv = listMoves()[0];
      if (!mv) { if (stockHasPlay()) { pulse(S.stock.length ? els.get(top(S.stock).id) : stockEl); toast(S.stock.length ? 'Roba del mazo' : 'Renueva el mazo'); } else toast('No hay jugadas: deshaz o empieza otra partida'); return; }
      const cards = sourceArray(mv.loc).slice(mv.loc.idx); cards.forEach(c => els.get(c.id).classList.add('is-hint'));
      const targetEl = mv.target.pile === 'foundation' ? foundEl.querySelectorAll('.pile')[mv.target.i] : (S.tableau[mv.target.i].length ? els.get(top(S.tableau[mv.target.i]).id) : tabEl.querySelectorAll('.pile')[mv.target.i]);
      targetEl.classList.add('is-hint'); pulse(els.get(cards[0].id));
      setTimeout(() => root.querySelectorAll('.is-hint').forEach(el => el.classList.remove('is-hint')), 1800);
    }
    function pulse(el) { if (G() && el) G().fromTo(el, { scale: 1 }, { scale: 1.08, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut', onComplete: () => G().set(el, { scale: 1 }) }); }

    // ---------- drag & drop ----------
    let drag = null;
    function onPointerDown(e) {
      if (!S || finished || busy) return;
      const el = e.target.closest('.card'); if (!el || e.button > 0) return;
      if (S.stock.find(c => c.id === el.dataset.id)) return;
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
      clearTargets(); const t = hitTarget(e.clientX, e.clientY, drag); if (t) pileEl(t).classList.add('is-target');
    }
    function onPointerUp(e) {
      if (!drag || e.pointerId !== drag.pid) return;
      const d = drag; drag = null; root.classList.remove('is-dragging-any'); d.items.forEach(it => it.el.classList.remove('is-dragging')); clearTargets();
      if (G()) G().to(d.items.map(it => it.el), { scale: 1, duration: 0.22, ease: 'power2.inOut' });
      if (!d.moved) { if (!autoMove(d.cards[0].id)) layout(); return; }
      const t = hitTarget(e.clientX, e.clientY, d); if (t) moveCards(d.loc, t); else layout();
    }
    const pileEl = t => (t.pile === 'tableau' ? tabEl : foundEl).querySelectorAll('.pile')[t.i];
    function hitTarget(cx, cy, d) {
      const over = el => { const r = el.getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; };
      const fps = foundEl.querySelectorAll('.pile');
      for (let fi = 0; fi < 4; fi++) if (over(fps[fi]) && canToFoundation(d.cards, fi)) return { pile: 'foundation', i: fi };
      const cols = tabEl.querySelectorAll('.pile'), tb = tabEl.getBoundingClientRect();
      for (let ci = 0; ci < 7; ci++) {
        if (d.loc.pile === 'tableau' && d.loc.i === ci) continue;
        const r = cols[ci].getBoundingClientRect();
        if (cx >= r.left && cx <= r.right && cy >= r.top - 20 && cy <= Math.max(r.bottom, tb.bottom) && canToTableau(d.cards, S.tableau[ci])) return { pile: 'tableau', i: ci };
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
      const show = () => showEnd('Partida libre completada.', '¡Bien jugado!', `${fmt(timer.elapsed)} · ${moves} jugadas`, [['Otra partida', newGame, true]]);
      if (!G()) { show(); return; }
      const cards = [...els.values()].reverse(); const H = root.clientHeight;
      G().to(cards, { y: `+=${H}`, x: () => `+=${G().utils.random(-180, 180)}`, rotation: () => G().utils.random(-120, 120), duration: 0.9, ease: 'power1.in', stagger: 0.025, onComplete: show });
    }
    function blocked() {
      finished = true; stopTimer(); setOut('mode', 'Sin jugadas');
      showEnd('No quedan movimientos.', 'Partida bloqueada', `${fmt(timer.elapsed)} · ${moves} jugadas`, [['Deshacer', () => { endOv.hidden = true; finished = false; undo(); }, false], ['Nueva partida', newGame, true]]);
    }

    // ---------- partida ----------
    function resetMeta() { stopTimer(); timer = { start: null, int: null, elapsed: 0 }; moves = 0; history = []; finished = false; busy = false; setOut('time', '00:00'); setOut('moves', '0'); setOut('mode', 'Partida libre'); setEnabled('undo', false); endOv.hidden = true; helpOv.hidden = true; }
    function newGame() {
      resetMeta(); clearSave();
      drawCount = opts.draw === 'random' ? (Math.random() < 0.5 ? 1 : 3) : +opts.draw; setOut('draw', 'Roba ' + drawCount);
      S = firstDeal ? stressDeal() : deal(); if (firstDeal) setOut('mode', 'Prueba de alto'); firstDeal = false;
      applyLayoutMode(); buildCardEls(true); if (!G()) { layout(); checkState(); }
    }
    function resumeGame(saved) {
      resetMeta(); S = saved.S; drawCount = saved.drawCount || 1; moves = saved.moves || 0; history = saved.history || []; timer.elapsed = saved.elapsed || 0;
      setOut('draw', 'Roba ' + drawCount); setOut('moves', moves); setOut('time', fmt(timer.elapsed)); setOut('mode', 'Partida retomada'); setEnabled('undo', history.length > 0);
      applyLayoutMode(); buildCardEls(false); layout(); checkState();
    }
    function undo() { if (!history.length || busy) return; S = history.pop(); finished = false; endOv.hidden = true; setEnabled('undo', history.length > 0); paintFaces(); layout(); save(); checkState(); }

    // ---------- eventos ----------
    root.addEventListener('pointerdown', onPointerDown); root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp); root.addEventListener('pointercancel', onPointerUp);
    root.addEventListener('click', e => { if (!S) return; const el = e.target.closest('.card'); if (e.target.closest('.pile--stock') || (el && S.stock.find(c => c.id === el.dataset.id))) drawFromStock(); });
    stockEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drawFromStock(); } });
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
      const group = (name, label, items) => `<div class="sol-dev__group"><span class="sol-dev__label">${label}</span>${items.map(([v, t]) => `<label><input type="radio" name="sol-${name}" value="${v}"${opts[name] === v ? ' checked' : ''}> ${t}</label>`).join('')}</div>`;
      dev.innerHTML = `<button class="sol-dev__toggle" type="button">Opciones (prototipo)</button><div class="sol-dev__body">
        ${group('red', 'Palo rojo', [['rojo', 'A · rojo #D1322B'], ['ambar', 'D · ámbar core/bronce/700']])}
        ${group('felt', 'Tapete', [['azul', 'Azul core/azul/700 (final)'], ['verde', 'Verde'], ['gris', 'Gris claro'], ['blanco', 'Blanco']])}
        ${group('layout', 'Bases', [['auto', 'Automático: escritorio lateral · tablet y móvil arriba'], ['top', 'Arriba junto al mazo'], ['rail', 'Lateral derecha']])}
        ${group('draw', 'Reparto', [['random', 'Aleatorio'], ['1', 'Roba 1'], ['3', 'Roba 3']])}
        ${group('gap', 'Aire escritorio', [['auto', 'Auto (13,3 en 808)'], ['12', '12 px'], ['20', '20 px'], ['28', '28 px']])}
        ${group('compact', 'Columnas largas', [['off', 'Sin compactar (Figma)'], ['on', 'Compactar si la más alta pasa de 3,3 cartas']])}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="sol-dev__btn" type="button" data-stress>Prueba de alto</button><button class="sol-dev__btn" type="button" data-wipe>Borrar partida guardada</button></div></div>`;
      document.body.appendChild(dev);
      dev.querySelector('.sol-dev__toggle').addEventListener('click', () => dev.classList.toggle('is-closed'));
      dev.querySelectorAll('input[type=radio]').forEach(i => i.addEventListener('change', () => { const name = i.name.replace('sol-', ''); opts[name] = i.value; saveOpts(); root.dataset.felt = opts.felt; root.dataset.red = opts.red; paintFaces(); applyLayoutMode(); layout(); }));
      dev.querySelector('[data-stress]').addEventListener('click', () => { resetMeta(); S = stressDeal(); buildCardEls(); applyLayoutMode(); layout(); setOut('mode', 'Prueba de alto'); });
      dev.querySelector('[data-wipe]').addEventListener('click', () => { clearSave(); toast('Partida guardada borrada'); });
    }

    root.dataset.felt = opts.felt; root.dataset.red = opts.red;
    applyLayoutMode(); // alto definitivo desde el primer frame
    const saved = (firstDeal || opts.persist === false) ? null : loadSave(); // persist:false (portfolio): partida nueva en cada carga
    const start = () => requestAnimationFrame(() => requestAnimationFrame(() => saved ? resumeGame(saved) : newGame()));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
    const api = { newGame, undo, hint, get state() { return S; }, debug: { allFaceUp, listMoves, stockHasPlay, checkState, get busy() { return busy; }, get finished() { return finished; } } };
    window.__sol = api;
    return api;
  }

  window.Solitaire = { mount, DEFAULTS };
})();
