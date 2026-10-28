/*
 * Exporta la geometría del tablero del prototipo (una configuración dada) a JSON para reconstruirlo en Figma.
 *   node tools/export-layout.js [--stress] [--width=800] > layout.json
 */
const { chromium } = require('playwright');
const path = require('path');
const argv = process.argv.slice(2);
const opt = k => (argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const WIDTH = +(opt('width') || 800), STRESS = argv.includes('--stress');
const OPTS = { skin: opt('skin') || '1', layout: opt('layout') || 'rail', draw: '1', back: opt('back') || 'plain', felt: opt('felt') || 'verde', compact: 'on' };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(o => localStorage.setItem('solitario-proto-opts', JSON.stringify(o)), OPTS); await p.reload(); await p.waitForTimeout(500);
  if (STRESS) { await p.evaluate(() => document.querySelector('[data-stress]').click()); await p.waitForTimeout(500); }
  const data = await p.evaluate((W) => {
    const root = document.querySelector('.sol'); const R = root.getBoundingClientRect();
    const rel = el => { const r = el.getBoundingClientRect(); return { x: +(r.left - R.left).toFixed(2), y: +(r.top - R.top).toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) }; };
    const piles = { stock: rel(root.querySelector('.pile--stock')), waste: rel(root.querySelector('.pile--waste')),
      foundations: [...root.querySelectorAll('.pile--foundation')].map(rel), columns: [...root.querySelectorAll('.pile--column')].map(rel) };
    const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const cards = [...root.querySelectorAll('.card')].map(el => { const r = rel(el); const m = new DOMMatrixReadOnly(getComputedStyle(el).transform); const g = parseFloat(getComputedStyle(root).getPropertyValue('--gap'));
      return { id: el.dataset.id, up: el.dataset.up === 'true', x: +(m.m41 + g).toFixed(2), y: +(m.m42 + g).toFixed(2), w: r.w, h: r.h, z: +el.style.zIndex || 0, label: el.getAttribute('aria-label') }; });
    const faces = {}; [...root.querySelectorAll('.card')].forEach(el => { if (el.dataset.up === 'true') faces[el.dataset.id] = el.innerHTML; });
    return { root: { w: R.width, h: R.height, radius: 4, padding: parseFloat(getComputedStyle(root).getPropertyValue('--gap')) }, cardW: parseFloat(getComputedStyle(root).getPropertyValue('--card-w')), piles, cards, layout: root.dataset.layout, skin: root.dataset.skin, felt: getComputedStyle(root).backgroundColor };
  }, WIDTH);
  // rango/palo a partir del aria-label
  const SUITS = { corazones: 'h', diamantes: 'd', 'tréboles': 'c', picas: 's' };
  data.cards.forEach(c => { const m = c.label.match(/^(\S+) de (\S+)$/); c.rank = m[1]; c.suit = SUITS[m[2]]; });
  process.stdout.write(JSON.stringify(data));
  await b.close();
})();
