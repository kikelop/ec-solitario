/*
 * Inyecta el solitario en la página real de Juegos (chasis del crucigrama) con Chromium headed.
 * Sustituye el área de juego por el módulo, relabela la barra de meta y la fila de controles,
 * y recarga sola cuando cambian styles.css / cards.js / game.js.
 *
 *   node live.js            -> escritorio (ventana maximizada)
 *   node live.js --mobile   -> emulación iPhone
 *   node live.js --tablet   -> 834×1194 táctil
 *   node live.js --sol=verde | --sol=pad8 | --sol=pad16 | --sol=lateral | --sol=alto | --sol=roba3 | --sol=aleatorio  -> variantes
 */
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const argv = process.argv.slice(2);
const MOBILE = argv.includes('--mobile'), TABLET = argv.includes('--tablet');
const VARIANT = (argv.find(a => a.startsWith('--sol=')) || '--sol=').slice(6); // verde · pad8 · pad16 · lateral (coma para combinar)
const URL = 'https://juegos.elconfidencial.com/crucigrama/diario/facil';
const DIR = __dirname;
const PROFILE = path.join(os.homedir(), '.cache', 'ec-solitario-live-' + (MOBILE ? 'mobile' : TABLET ? 'tablet' : 'desk') + (VARIANT ? '-' + VARIANT.replace(/[^a-z0-9]/g, '') : ''));

function bundle() {
  const assets = {};
  
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8').replace(/@font-face\{[^}]*\}/g, '');
  const js = `window.__solAssets=${JSON.stringify(assets)};window.__solVariant=${JSON.stringify(VARIANT)};\n` + fs.readFileSync(path.join(DIR, 'cards.js'), 'utf8') + '\n' + fs.readFileSync(path.join(DIR, 'game.js'), 'utf8');
  return { css, js };
}

// la URL directa redirige a la selección de modo si no hay partida: pasar consentimiento, «Jugar reto diario» → «Fácil» → «Saltar» tutorial
async function enterGame(page) {
  try { await page.click('#didomi-notice-agree-button', { timeout: 2500 }); } catch {}
  try { await page.getByText('Saltar', { exact: true }).first().click({ timeout: 1500 }); } catch {}
  if (!(await page.$('[class*=_gameArea_]'))) {
    try { await page.getByText('Jugar reto diario').first().click({ timeout: 4000 }); } catch {}
    try { await page.locator('button:has-text("Fácil")').last().click({ timeout: 4000 }); } catch {}
  }
  await page.waitForSelector('[class*=_gameArea_]', { timeout: 15000 });
  try { await page.getByText('Saltar', { exact: true }).first().click({ timeout: 2500 }); } catch {}
}

// cirugía sobre el DOM de producción: se ejecuta en la página
function surgery() {
  const q = s => document.querySelector(s);
  const title = q('[class*=_balconyTitle_]'); if (title) title.textContent = 'Solitario';
  document.title = 'Solitario online gratis · El Confidencial';
  const area = q('[class*=_gameArea_]'); if (!area || area.dataset.sol) return false;
  area.dataset.sol = '1';
  // barra de meta: reutiliza los items existentes
  const meta = area.querySelector('[class*=_meta_]');
  if (meta) {
    const items = [...meta.querySelectorAll('[class*=_item_]')];
    const spec = [['Modo', 'mode', 'Partida libre'], ['Tiempo', 'time', '00:00'], ['Jugadas', 'moves', '0'], ['Reparto', 'draw', 'Roba 1']];
    spec.forEach(([label, key, val], i) => {
      let it = items[i]; if (!it) { it = items[0].cloneNode(true); meta.insertBefore(it, meta.querySelector('[class*=_help_]')); }
      it.querySelector('[class*=_label_]').textContent = label; const v = it.querySelector('[class*=_value_]'); v.textContent = val; v.dataset.sol = key;
    });
    items.slice(spec.length).forEach(it => it.remove());
  }
  // quitar todo lo que no sea la meta ni la fila de controles, y montar el módulo entre ambas
  const row = q('[class*=_row_io3fu_]');
  [...area.children].forEach(ch => { if (ch !== meta && ch !== row) ch.remove(); });
  const mountEl = document.createElement('div'); mountEl.id = 'solitaire';
  if (row && row.parentElement === area) area.insertBefore(mountEl, row); else area.appendChild(mountEl);
  // fila de controles
  if (row) {
    const cells = [...row.querySelectorAll('[class*=_cell_io3fu_]')];
    const set = (cell, label, action, svg, primary) => {
      cell.setAttribute('aria-label', label); cell.dataset.solAction = action; cell.disabled = false;
      cell.querySelector('[class*=_label_]').textContent = label; const b = cell.querySelector('[class*=_badge_]'); if (b) b.remove();
      cell.querySelector('[class*=_ico_]').innerHTML = svg; cell.classList.toggle(cells[2].className.split(' ').find(c => c.includes('_primary_')) || 'x', !!primary);
    };
    const ICON = { undo: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      hint: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
      fresh: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' };
    if (cells.length >= 3) { set(cells[0], 'Deshacer', 'undo', ICON.undo); set(cells[1], 'Pista', 'hint', ICON.hint); set(cells[2], 'Nueva partida', 'new', ICON.fresh, true); }
    const help = (meta || area).querySelector('[class*=_help_]'); if (help) { help.dataset.solAction = 'help'; const h2 = help.cloneNode(true); help.replaceWith(h2); } // clon: quita los handlers de React del tutorial del crucigrama
    const exit = row.querySelector('[class*=_exit_]'); if (exit) exit.dataset.solAction = 'exit';
  }
  Solitaire.mount(mountEl);
  return true;
}

(async () => {
  const opts = MOBILE ? { ...devices['iPhone 13'], headless: false, locale: 'es-ES' }
    : TABLET ? { viewport: { width: 834, height: 1194 }, isMobile: true, hasTouch: true, headless: false, locale: 'es-ES' }
    : { headless: false, viewport: null, locale: 'es-ES', args: ['--start-maximized'] };
  opts.args = [...(opts.args || []), '--disable-blink-features=AutomationControlled'];
  const ctx = await chromium.launchPersistentContext(PROFILE, opts);
  const page = ctx.pages()[0] || await ctx.newPage();

  let injecting = false;
  async function inject(reason) {
    if (injecting) return; injecting = true;
    try {
      await enterGame(page);
      const { css, js } = bundle();
      await page.addStyleTag({ content: css });
      if (!(await page.evaluate(() => !!window.gsap))) await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js' });
      await page.addScriptTag({ content: js });
      const ok = await page.evaluate(surgery);
      console.log('  solitario inyectado ·', reason, ok ? '' : '(ya estaba)');
    } catch (e) { console.log('  fallo al inyectar:', e.message.split('\n')[0]); }
    finally { injecting = false; }
  }

  page.on('load', () => inject('carga de página'));
  console.log('→', URL, MOBILE ? '(móvil)' : TABLET ? '(tablet)' : '(escritorio)');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  let timer = null;
  for (const f of ['styles.css', 'cards.js', 'game.js']) fs.watch(path.join(DIR, f), () => { clearTimeout(timer); timer = setTimeout(() => { console.log('  cambio en', f, '→ recargo'); page.reload(); }, 200); });
  console.log('\n  Guarda styles.css / cards.js / game.js y se recarga sola. Cierra la ventana para terminar.\n');
  await new Promise(r => ctx.on('close', r));
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
