/*
 * cards.js — render SVG de las cartas del Solitario EC (diseño final, Figma «Diseño final» 27/10/2026).
 * Caja de dibujo 100 × 140 (ratio 5:7), se escala por CSS. Colores en styles.css (tokens ec.color.v2).
 *   - Cara: rango en Confi Serif Bold arriba-izquierda y espejado abajo-derecha, palo grande centrado (también en J/Q/K).
 *   - Dorso: marco neutral/25 con borde azul/400, interior del color del tapete, isotipo EC.
 * Los iconos de palo son los de Kike ([INNO] Solitario, nodo 10:580), normalizados a una caja 100×100 y centrados.
 */
(function () {
  const SUITS = {
    h: { name: 'corazones', color: 'red', path: 'M17.2199 3.40002C15.4299 3.40002 13.9799 4.30002 13.0199 5.20002C12.4699 5.71002 12.1999 5.97002 11.9999 5.97002C11.7999 5.97002 11.5299 5.71002 10.9699 5.19002C9.84857 4.08085 8.34664 3.44074 6.76993 3.40002C3.43993 3.40002 0.939926 7.20002 2.00993 11.22C2.98993 14.87 8.32993 17.9 11.2099 20.58C11.6099 20.95 11.8099 21.13 11.9999 21.13C12.1899 21.13 12.3999 20.95 12.7999 20.58C15.6699 17.9 21.0099 14.87 21.9899 11.22C23.0599 7.20002 20.5599 3.40002 17.2199 3.40002Z', box: 'translate(-4.250,-5.448) scale(4.5208)' },
    d: { name: 'diamantes', color: 'red', path: 'M14 8L8 15L2 8L8 1L14 8Z', box: 'translate(-7.143,-7.143) scale(7.1429)' },
    c: { name: 'tréboles', color: 'black', path: 'M12 2C14.3 2 16.3 4 16.3 6.2C16.2871 6.97541 16.0717 7.73398 15.6753 8.40053C15.2789 9.06707 14.7152 9.61845 14.04 10C15.04 9.5 16.5 9.5 16.5 9.5C19 9.5 21 11.3 21 13.8C21 16.3 19 18 16.5 18C16.5 18 15 18 13 17C13 17 12.7 19 15 22H9C11.3 19 11 17 11 17C9 18 7.5 18 7.5 18C5 18 3 16.3 3 13.8C3 11.3 5 9.5 7.5 9.5C7.5 9.5 8.96 9.5 9.96 10C9.66 9.83 7.79 8.77 7.7 6.2C7.7 4 9.7 2 12 2Z', box: 'translate(-10.000,-10.000) scale(5.0000)' },
    s: { name: 'picas', color: 'black', path: 'M10.951 15.893C9.94749 16.6193 8.73873 17.007 7.5 17C4.462 17 2 14.761 2 12C2 8.452 5.525 5.911 8.644 3.662C9.92 2.742 11.129 1.872 12 1C12.871 1.871 14.08 2.742 15.356 3.662C18.476 5.911 22 8.452 22 12C22 14.761 19.538 17 16.5 17C15.2613 17.007 14.0525 16.6193 13.049 15.893C13.333 17.539 14.058 18.713 14.843 19.985L15.212 20.587C15.596 21.223 15.125 22 14.382 22H9.618C8.875 22 8.404 21.223 8.788 20.587L9.157 19.985C9.942 18.713 10.667 17.539 10.951 15.893Z', box: 'translate(-7.143,-4.762) scale(4.7619)' },
  };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  // isotipo EC (Figma [INNO] Solitario 13:587), caja 831×526
  const EC_LOGO = 'M415.719 262.597C415.719 98.2176 505.577 0 657.417 0C693.626 0 752.839 11.8476 809.949 29.9525V178.33H784.177L756.327 105.193C732.631 43.903 712.449 27.8753 657.417 27.8753C582.176 27.8753 539.71 112.168 539.71 262.623C539.71 413.078 575.227 497.371 647.672 497.371C708.962 497.371 741.71 456.263 747.274 370.585H830.849C821.104 466.726 750.044 525.22 644.877 525.22C497.909 525.22 415.719 431.183 415.719 262.623M0 491.755L31.3373 486.882C48.0574 484.087 52.2374 477.137 52.2374 450.673V75.9327C52.2374 49.4678 48.0574 42.4926 31.3373 39.6973L0 34.8249V11.1296H360.123V161.585H337.145L320.425 109.347C300.936 48.7498 286.985 39.0049 218.72 39.0049H202C169.97 39.0049 163.687 45.2621 163.687 77.3175V247.288H182.485C224.285 247.288 234.03 241.723 244.467 211.078L260.495 163.021H282.087V359.456H260.495L244.467 311.398C234.03 280.754 224.259 275.189 182.485 275.189H163.687V449.313C163.687 481.343 169.945 487.626 202 487.626H232.645C302.987 487.626 318.322 476.471 334.35 415.873L351.07 351.096H374.047V515.476H0V491.78V491.755Z';

  const suitPath = (s, x, y, size) =>
    `<g transform="translate(${x - size / 2},${y - size / 2}) scale(${size / 100})"><path d="${SUITS[s].path}" transform="${SUITS[s].box}" /></g>`;

  function faceSVG(rank, suit) {
    // móvil (carta de ~47 px): rango 5 px más grande, ~3 px más de aire arriba y abajo y palo 2 px más pequeño (unidades de la caja de 140)
    const mobile = document.documentElement.dataset.solMobile === '1';
    const rankSize = (rank === '10' ? 24 : 27) + (mobile ? 10.8 : 0);
    const nx = rank === 'J' ? -3.35 : 0;            // el gancho de la J sobresale por la izquierda: 2,5 px a la derecha para alinear su tinta con K y Q
    const py = mobile ? 7.2 : 0;
    const pip = mobile ? 48.7 : 53;
    const idx = (x, y, rot) => `<text class="rank" transform="translate(${x},${y}) rotate(${rot})" font-size="${rankSize}" text-anchor="start">${rank}</text>`;
    return `<svg class="face face--${SUITS[suit].color}" viewBox="0 0 100 140" aria-hidden="true">
      <rect class="paper" x="0.5" y="0.5" width="99" height="139" rx="5.33" />
      ${suitPath(suit, 50, 70, pip)}${idx(10.7 - nx, 31.3 + py, 0)}${idx(89.3 + nx, 108.7 - py, 180)}</svg>`;
  }

  function backSVG() {
    return `<svg class="back" viewBox="0 0 100 140" aria-hidden="true">
      <rect class="back-paper" x="0.5" y="0.5" width="99" height="139" rx="5.33" />
      <rect class="back-felt" x="6.67" y="6.67" width="86.67" height="126.67" rx="4" />
      <g transform="translate(23.3,53.1) scale(0.0642)"><path class="back-logo" d="${EC_LOGO}" /></g>
    </svg>`;
  }

  window.Cards = { SUITS, RANKS, faceSVG, backSVG, label: (r, s) => `${r} de ${SUITS[s].name}` };
})();
