// Vídeo 1920×1080 de la versión portfolio para X: reparto + ~28 s de juego automático.
// Reloj del navegador controlado fotograma a fotograma (30 fps exactos, sin saltos), cursor dibujado en la página
// y ratón "humano" (trayectorias curvas, aceleración, pausas de pensar). Los PNG van por pipe a ffmpeg (hace falta ffmpeg).
// Uso: node tools/record-video.js [salida.mp4]   → por defecto tools/solitario-x.mp4
// Requiere prototipo/fonts (copia de las Confi Sans/Serif, gitignored); record.html usa la opción cardW:131 del juego.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const W = 1920, H = 1080, FPS = 30, FRAME = 1000 / FPS, TOTAL_MS = 30000;
const PAGE = 'file://' + path.resolve(__dirname, 'record.html');
const OUT = process.argv[2] || path.resolve(__dirname, 'solitario-x.mp4');
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const between = (a, b) => a + (b - a) * rnd();
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const CURSOR = `<svg width="44" height="44" viewBox="0 0 24 24"><path d="M5.5 3.2 18.2 13.4c.5.4.2 1.2-.4 1.2h-6.1l3.3 6.4c.2.4 0 .9-.4 1.1l-1.9.9c-.4.2-.9 0-1.1-.4l-3.2-6.5-4.3 4.3c-.4.4-1.1.1-1.1-.5V3.7c0-.6.6-.9 1-.5z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const HAND = `<svg width="44" height="44" viewBox="0 0 24 24"><path d="M8 11V7.5a1.5 1.5 0 0 1 3 0V11m0-4.5v-1a1.5 1.5 0 0 1 3 0V11m0-3.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.6a6 6 0 0 1-4.9-2.5L5 14.6a1.6 1.6 0 0 1 2.6-1.9L8 13.5" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;

(async () => {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', OUT]);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.clock.install({ time: new Date('2026-10-27T12:00:00') });
  await p.goto(PAGE, { waitUntil: 'load' });
  await p.clock.pauseAt(new Date('2026-10-27T12:00:01')); // el tiempo solo avanza con runFor → 30 fps exactos
  await p.evaluate(({ CURSOR, HAND }) => {
    const c = document.createElement('div'); c.id = 'cur';
    c.style.cssText = 'position:fixed;left:-100px;top:-100px;width:44px;height:44px;pointer-events:none;z-index:99999;transform-origin:6px 4px;transition:transform .08s ease;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))';
    c.innerHTML = CURSOR; document.body.appendChild(c);
    const place = e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; };
    document.addEventListener('pointermove', place, true);
    document.addEventListener('pointerdown', e => { place(e); c.style.transform = 'scale(.88)'; }, true);
    document.addEventListener('pointerup', e => { place(e); c.style.transform = 'scale(1)'; c.innerHTML = CURSOR; }, true);
    new MutationObserver(() => { const d = document.querySelector('.sol').classList.contains('is-dragging-any'); c.innerHTML = d ? HAND : CURSOR; c.style.transformOrigin = d ? '12px 14px' : '6px 4px'; }).observe(document.querySelector('.sol'), { attributes: true, attributeFilter: ['class'] });
  }, { CURSOR, HAND });

  let frames = 0; const t = () => frames * FRAME;
  const frame = async () => { await p.clock.runFor(FRAME); const buf = await p.screenshot({ type: 'png' }); ff.stdin.write(buf); frames++; };
  const wait = async ms => { for (let i = 0; i < Math.round(ms / FRAME); i++) await frame(); };
  let mouse = { x: W - 120, y: H - 80 };
  // movimiento humano: curva cuadrática con control desplazado en perpendicular, easing in-out y un pelín de ruido
  const moveTo = async (to, ms) => {
    const from = { ...mouse }; const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    if (![to.x, to.y, from.x, from.y].every(Number.isFinite)) throw new Error('bad coords ' + JSON.stringify({ from, to }));
    const n = Math.max(2, Math.round(ms / FRAME)); const bend = between(-0.18, 0.18) * d; const cx = (from.x + to.x) / 2 - dy / d * bend, cy = (from.y + to.y) / 2 + dx / d * bend;
    for (let i = 1; i <= n; i++) {
      const k = easeInOut(i / n), j = i < n ? between(-0.6, 0.6) : 0;
      const x = (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * cx + k * k * to.x + j, y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * cy + k * k * to.y + j;
      await p.mouse.move(x, y); mouse = { x, y }; await frame();
    }
    await p.mouse.move(to.x, to.y); mouse = { ...to };
  };
  const travel = d => Math.min(820, 260 + d * 0.42); // ms según distancia
  const dist = to => Math.hypot(to.x - mouse.x, to.y - mouse.y);
  const rect = async sel => p.evaluate(s => document.querySelector(s).getBoundingClientRect().toJSON(), sel);
  const cardPoint = async id => { const r = await rect(`.card[data-id="${id}"]`); return { x: r.x + r.width * between(0.4, 0.6), y: r.y + Math.min(r.height / 2, 26) + between(-3, 3) }; };
  const pileCenter = async sel => { const r = await rect(sel); return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 40) }; };
  const click = async () => { await p.mouse.down(); await wait(between(70, 110)); await p.mouse.up(); };

  // cursor en reposo mientras reparte
  await p.mouse.move(mouse.x, mouse.y);
  while (!(await p.evaluate(() => window.__sol && window.__sol.state && !window.__sol.debug.busy))) await frame();
  await wait(between(500, 800));
  const recent = []; const log = [];
  while (t() < TOTAL_MS - 2500) {
    while (await p.evaluate(() => window.__sol.debug.busy)) await frame();
    const mv = await p.evaluate(recent => { const ms = window.__sol.debug.listMoves(); const S = window.__sol.state; const idOf = m => m.loc.pile === 'waste' ? S.waste[S.waste.length - 1].id : S.tableau[m.loc.i][m.loc.idx].id; const m = ms.find(m => m.score >= 1 && !recent.includes(idOf(m))); if (!m) return null; const col = S.tableau[m.target.i]; return { id: idOf(m), target: m.target, targetTopId: m.target.pile === 'tableau' && col.length ? col[col.length - 1].id : null }; }, recent);
    await wait(between(350, 900)); // "pensar"
    if (mv) {
      recent.push(mv.id); if (recent.length > 3) recent.shift();
      const from = await cardPoint(mv.id);
      const to = mv.target.pile === 'foundation' ? await pileCenter(`.piles--foundations .pile:nth-child(${mv.target.i + 1})`) : mv.targetTopId ? await cardPoint(mv.targetTopId) : await pileCenter(`.zone--tableau .pile:nth-child(${mv.target.i + 1})`);
      await moveTo(from, travel(dist(from))); await wait(between(90, 160));
      if (mv.target.pile === 'foundation' && rnd() < 0.45) { await click(); log.push('tap ' + mv.id); }
      else {
        await p.mouse.down(); await wait(between(80, 140));
        await moveTo(to, travel(dist(to)) + 120); await wait(between(60, 120)); await p.mouse.up(); log.push(`drag ${mv.id} -> ${mv.target.pile}${mv.target.i}`);
      }
      await wait(between(250, 450));
    } else {
      const st = await pileCenter('.pile--stock'); await moveTo(st, travel(dist(st))); await wait(between(80, 140)); await click(); log.push('draw'); await wait(between(380, 650));
    }
  }
  // final: el cursor se aparta un poco y se mantiene el plano
  await moveTo({ x: mouse.x + between(60, 120), y: mouse.y + between(60, 120) }, 420);
  while (t() < TOTAL_MS) await frame();
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
  console.log(JSON.stringify({ out: OUT, seconds: frames / FPS, log }));
})();
