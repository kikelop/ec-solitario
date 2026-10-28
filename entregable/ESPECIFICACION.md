# Solitario clásico (Klondike) · Especificación de implementación 1:1

**Diseño:** Kike López (Producto/UX, El Confidencial) · octubre 2026 · tickets EINNO-759 (HU), EINNO-763 (diseño)
**Fuente de verdad del comportamiento:** el prototipo de `prototipo/` (`cards.js`, `game.js`, `styles.css`), vanilla JS sin build. Todo lo que dice este documento está implementado ahí tal cual; ante cualquier duda, **el código del prototipo manda**. Está pensado para que el Claude Code del desarrollador lo lea entero y reproduzca el resultado al píxel y al milisegundo.
**Referencias:** Figma [INNO] Solitario (`IytFyWTstf48YiPHLafC7K`), página «Diseño final» · prototipo publicado https://ec-solitario.vercel.app (pide login de Vercel) · prototipo inyectado sobre producción con `prototipo/live.js`.

---

## 0. Resumen de una línea

Un módulo `Solitaire.mount(root)` que pinta el tablero dentro de la columna principal de la página de Juegos, con las 52 cartas como SVG inline, reglas Klondike completas, animaciones GSAP y persistencia en `localStorage`. El chasis (cabecera, barra de meta, fila de controles) es el de la página de Juegos; el módulo solo escribe en elementos con `data-sol="…"` y escucha botones con `data-sol-action="…"`.

---

## 1. Dónde vive y cómo se conecta al chasis

| | |
|---|---|
| Contenedor | La `section` principal de la página de juego (misma que el crucigrama). El módulo se monta en un `div` vacío entre la **barra de meta** y la **fila de controles**. |
| Barra de meta | 4 valores, mismo componente que el crucigrama: **Modo** · **Tiempo** · **Jugadas** · **Reparto**. El módulo escribe en `[data-sol="mode"]`, `[data-sol="time"]`, `[data-sol="moves"]`, `[data-sol="draw"]`. Textos: `Partida libre` / `Partida retomada` / `Completando…` / `Completada` / `Sin jugadas` · `mm:ss` · entero · `Roba 1` / `Roba 3`. Botón «Cómo se juega» de la barra → `data-sol-action="help"`. |
| Fila de controles | Segmentado de 3 celdas + botón Salir, mismo componente que el crucigrama: **Deshacer** (`undo`) · **Pista** (`hint`) · **Nueva partida** (`new`, celda primaria negra) · **Salir** (`exit`). Deshacer se deshabilita cuando no hay historial. Iconos en `icons/ui-*.svg` (24 px, trazo 2, `currentColor`). |
| Anchos | Escritorio (viewport > 900): columna de **800 px** con publicidad lateral de 320. Tablet (701–900): columna = ancho − 2×24 (**786** a 834). Móvil (≤ 700): el tablero sale **a sangre** al 100 % del ancho de pantalla, saltándose los 16 px de margen de la columna. |

---

## 2. Tokens de color (ec.color.v2)

| Uso | Token | Hex |
|---|---|---|
| Tapete (fondo del tablero) e interior del dorso | `core/azul/700` (= `corporativo/azul-claro`) | `#1D4044` |
| Palos y rangos negros (♣ ♠) | `corporativo/azul-medio` | `#152E32` |
| Palos y rangos rojos (♥ ♦) | ≈ `core/rojo/800` *(no publicado aún en la librería; usar el hex)* | `#D1322B` |
| Alternativa ámbar para los rojos (descartada salvo que se decida) | `core/bronce/700` | `#CC7A4B` |
| Papel de la carta, marco del dorso, isotipo EC | `core/neutral/25` | `#F9F9F9` |
| Borde de la carta (cara y dorso), borde de la carta «renovar» | `core/azul/400` | `#576466` |
| Huecos (mazo, descarte, bases, columnas) | `core/neutral/0` al **14 %** de relleno, borde interior de **1 px** al **32 %** | `#FFFFFF` |
| Pistas de palo en las bases vacías, icono de renovar | `core/neutral/0` al **50 %** | `#FFFFFF` |
| Destino válido al arrastrar | `core/neutral/0`, borde interior 2,5 px | `#FFFFFF` |
| Resalte de pista | `core/neutral/0`, borde 2,5 px fuera de la carta + sombra | `#FFFFFF` |
| Foco de teclado en el mazo | amarillo de la cabecera EC | `#F2C001` |
| Sombras | `core/azul/900` con la opacidad de cada caso (§6) | `#0F2124` |
| Overlays (fin de partida, bloqueo, cómo se juega) | velo `core/azul/900` al 55 %; tarjeta `core/neutral/0`; textos `#121212` / `#737373`; botones como el chasis (borde 0,7 px `#121212`, primario fondo `#121212`) | |

---

## 3. Geometría del tablero

### 3.1 Escritorio (columna 800, bases laterales)

- Rejilla de **9 columnas**: mazo+descarte · 7 columnas de juego · bases. Carta **75 × 105** (ratio 5:7).
- **Padding del tablero = calle entre columnas = separación entre filas = (ancho − 9·75) / 10** → **12,5 px** en 800 (13,3 en los 808 del Figma). Todos iguales.
- Columna izquierda: **mazo** arriba, **descarte** debajo (separación = la calle). Columna derecha: las **4 bases** apiladas en vertical, orden fijo ♥ ♦ ♣ ♠, con el palo al 50 % centrado como pista cuando están vacías.
- **Alto del tablero: fijo** = padding + columna más larga posible + padding. Columna más larga posible = 6 tapadas + escalera K→A = `6·down + 12·up + 105` = **537 px** → tablero de **562 px**. Los huecos de columna ocupan siempre ese alto; el contenedor **no cambia de tamaño** durante la partida.
- Solapes en columna: carta **boca arriba 32 px** (0,305 × alto), **boca abajo 8 px** (0,076 × alto).
- Mazo con grosor: la carta de arriba en su sitio y las **dos de debajo asomando 3 px cada una** por abajo (se reduce solo cuando quedan menos de tres). El **descarte** acumula el mismo grosor (en roba 1).
- Radio de carta y de hueco: **4 px**. Sombra base de carta: `0 1px 1.5px rgba(15,33,36,.25)`; las cartas del mazo `0 .5px 1px rgba(15,33,36,.16)`.

### 3.2 Tablet (columna 786, viewport 701–900)

- **Bases arriba a la derecha**, mazo y descarte arriba a la izquierda, 7 columnas debajo (como Google). Rejilla de 7 columnas.
- Padding = calle = **16 px**; carta = `(ancho − 8·16) / 7` → **94 × 131,6** en 786. Fila superior ↔ columnas: calle **+ 6 px** (el grosor del mazo).
- Solapes: arriba **0,32 × alto** (42 px), abajo 0,076 (10 px). Alto fijo con la misma fórmula.

### 3.3 Móvil (≤ 700, a sangre)

- Misma disposición que tablet. Padding = calle = **8 px**; carta = `(ancho − 64) / 7` → **46,6 × 65** en 390. Fila superior ↔ columnas: **8 + 6 px**. Sin radio en el contenedor (va de borde a borde).
- Solapes: arriba **0,34 × alto** (22 px), abajo 0,076 (5 px).
- Tipografía de la carta en móvil: rango **+5 px** sobre su escala, **~3 px más de aire** arriba y abajo, palo **2 px más pequeño** (ver §4).

---

## 4. Anatomía de la carta (caja de dibujo 100 × 140, se escala)

Render de referencia: `prototipo/cards.js` (SVG inline). Reproducir exactamente.

**Cara**
- Papel `rect` 0,5…99,5 con `rx 5.33` (= 4 px a 75 de ancho), relleno `neutral/25`, borde 1 px `azul/400`.
- **Rango** en **Confi Serif Bold**, tamaño **27** (24 para el «10»), color del palo, arriba-izquierda en `translate(10.7, 31.3)` (línea base), y **espejado** abajo-derecha en `translate(89.3, 108.7) rotate(180)`. Medido: la tinta queda a **≈ 9 px** del borde superior e izquierdo a 75 de ancho, igual que el espejo respecto al inferior y derecho.
- **J**: se desplaza **2,5 px a la derecha** (3,35 unidades) porque su gancho sobresale por la izquierda; así la tinta de K, Q, J y 10 arranca en el mismo punto.
- **Palo** grande centrado en (50, 70), tamaño **53** (icono normalizado a caja 100 y centrado; ver `SUITS[*].box`). También en J, Q y K: **no hay figuras**, solo la letra y el palo.
- Móvil: rango `+10.8` unidades, línea base `+7.2` / `−7.2`, palo 48,7.

**Dorso**
- Papel igual que la cara (`neutral/25`, borde `azul/400` 1 px, `rx 5.33`).
- Interior `rect` inset 6,67 (= 5 px a 75), `rx 4` (= 3 px), relleno **del color del tapete**.
- **Isotipo EC** (`icons/ec-isotipo.svg`, 831×526) en `neutral/25`, a **40 px de ancho** a escala 75, centrado: `translate(23.3, 53.1) scale(0.0642)`.

**Palos**: `icons/palo-*.svg` (los iconos elegidos por Kike: heart-filled, diamond, cards-club, poker-spades-fill), ya normalizados a 100×100.

**Carta «renovar mazo»** (estado del mazo vacío con descarte): carta del color del tapete con borde `azul/400` 1 px y `rx 4`, icono de dos flechas (`icons/renovar-mazo.svg`, 47×32) centrado a **62,7 unidades de ancho** (`translate(18.7,49.2) scale(1.333)`), relleno blanco al **50 %**. Hover (solo puntero fino): el icono escala **1,10** y sube al 85 %, la carta no se mueve.

---

## 5. Reglas de juego e interacción

- Klondike estándar: columnas descendentes alternando color; solo un **K** a columna vacía; bases ascendentes por palo desde el **A**; bases fijas ♥ ♦ ♣ ♠.
- **Reparto**: **siempre `roba 1`** (decisión de Kike, 28/10). El modo `roba 3` está implementado y probado (abanico del descarte, bloqueo, deshacer) pero **desactivado**; queda apuntado para el futuro decidir si se ofrece y cómo (aleatorio con aviso, o selector). La barra de meta muestra «Roba 1».
- **Roba 3** (desactivado, implementado): el descarte muestra las **3 últimas en abanico** (solo la de arriba es jugable): escritorio en vertical bajo el descarte con paso **0,26 × alto** (27 px), tablet/móvil en horizontal hacia la derecha con paso **0,36 × ancho**. Con roba 1 solo se ve la de arriba.
- **Mazo vacío** con descarte: aparece la carta «renovar»; al tocarla el descarte vuelve al mazo boca abajo, en orden inverso. Mazo y descarte vacíos: no hace nada.
- **Toque** sobre una carta jugable: la sube a su base si puede; si no, a una columna **solo cuando hay un único destino válido**. Con varios destinos posibles no hace nada: el jugador arrastra. (Decisión de Kike: el toque no decide por el jugador.)
- **Arrastre** con pointer events (ratón y táctil): se arrastra la carta y todas las que tiene encima (solo si todas están boca arriba). Mientras se arrastra, el hueco o carta destino válido se marca con borde interior **2,5 px blanco** (`neutral/0`). Soltar fuera de un destino válido devuelve las cartas a su sitio (animado). Durante el arrastre el tablero deja de recortar (`overflow: visible`) para que la carta no se corte en el borde.
- Mover una carta de una **base al tablero**: permitido (la pista nunca lo propone). *(Pendiente de decisión.)*
- **Rey de una columna vacía a otra vacía**: no se ofrece por toque ni por pista (no aporta); arrastrarlo sí está permitido.
- **Deshacer**: restaura la foto completa del estado anterior (incluye robar, renovar y autocompletar). **No cuenta como jugada**. Historial completo en memoria; al guardar se conservan las últimas 40.
- **Pista**: elige la mejor jugada con esta prioridad: subir a base (3) · mover que **destapa** una carta (2) · mover que **vacía** una columna (1,5) · del descarte a columna (1,2) · otros movimientos entre columnas (0,5). Marca origen y destino con borde **blanco** 2,5 px + sombra `0 4px 8px rgba(15,33,36,.25)` durante **1,8 s** y hace latir la carta origen (escala 1 → 1,08, 0,18 s, 4 veces, `sine.inOut`). Si no hay jugada pero sí carta jugable robando: late el mazo y toast «Roba del mazo» / «Renueva el mazo». Si no hay nada: toast «No hay jugadas: deshaz o empieza otra partida».
- **Autocompletar**: cuando mazo y descarte están vacíos y todas las cartas del tablero están boca arriba, el módulo sube solas las cartas a las bases, **una cada 110 ms** (tras 250 ms de espera), con Modo = «Completando…», y termina en la victoria.
- **Partida bloqueada**: tras cada jugada (con 650 ms de margen para que acaben las animaciones) se comprueba si existe alguna jugada útil en el tablero o alguna carta jugable **simulando un ciclo completo del mazo** con el reparto actual. Si no hay ninguna: overlay «Partida bloqueada» con **Deshacer** y **Nueva partida**; el tiempo se para.
- **Victoria**: las 52 en las bases → cascada (§6) → overlay «¡Bien jugado!» con tiempo y jugadas y botón «Otra partida». Modo = «Completada».
- **Cómo se juega**: overlay con las reglas (texto en `game.js`), cierre con botón «Entendido», clic fuera o Esc.
- **Tiempo**: arranca con la primera jugada, se **pausa** cuando la pestaña se oculta y sigue al volver. Formato `mm:ss`.
- **Teclado**: el mazo es `role="button"` enfocable; Enter/Espacio roban. Los botones del chasis son botones. Foco visible en el mazo: borde interior 2 px `#F2C001`.
- **Guardar y retomar**: tras cada jugada y cada 15 s se guarda en `localStorage` (`ec-solitario-partida-v1`: estado, reparto, jugadas, tiempo, últimas 40 fotos para deshacer). Al cargar, si hay partida guardada se **retoma sin animación de reparto** (Modo = «Partida retomada»). Se borra al ganar y al pulsar Nueva partida. Salir guarda.
- **Toque sobre una carta que aún vuela** desde el mazo: se ignora (no encola).

---

## 6. Animaciones (GSAP 3.12; todas con ease, nunca lineal)

Convención: duraciones en segundos. `scale`/`x`/`y` sobre el contenedor de la carta; los **volteos** giran el `<svg>` interior para no pelearse con la escala del contenedor. Mientras una carta viaja lleva `z-index` +300 (por encima del resto) y sombra de elevación `0 5px 9px rgba(15,33,36,.20)`; mientras gira **no tiene sombra**.

| Momento | Qué pasa | Tiempos y eases |
|---|---|---|
| **Reparto inicial** | Se espera a `document.fonts.ready` + 2 frames + 0,12 s. Las 52 cartas nacen en el mazo boca abajo. Cada columna recibe su **paquete** completo, **de la columna más lejana a la más cercana al mazo** (así ningún paquete vuela sobre columnas ya puestas), una cada **0,16 s**. | Vuelo del paquete: `x,y` 0,42 s `power2.inOut`, con elevación `scale 1 → 1,07` (45 % del vuelo, `power1.out`) `→ 1` (55 %, `power1.in`). Sin rebote al llegar. |
| | Despliegue del paquete hacia abajo, carta a carta, cada **0,05 s**, empezando 0,06 s después de llegar. | `y` 0,42 s `back.out(1.6)`. |
| | La carta de arriba de cada columna rebota en escala y se voltea. | 0,18 s después de su despliegue: `scale 1 → 1,06` (0,12 s `power2.out`) `→ 1` (0,36 s `back.out(2.4)`); volteo lateral (ver «Destapar»). |
| **Mover carta/pila** (toque, arrastre al soltar, deshacer, autocompletar) | Viaje con elevación en Z. | `x,y` 0,38 s `power2.inOut`; `scale 1 → 1,06` (45 % `power1.out`) `→ 1` (55 % `power1.in`). |
| **Robar del mazo** (escritorio) | La carta sube en Z girando sobre su eje **horizontal** («backflip», el borde superior se aleja) mientras ya va bajando, y aterriza en el descarte con rebote. Las cartas que quedan en el mazo se recolocan **al instante** (sin animación). | Total 0,42 s: `scale 1 → 1,14` + 45 % del recorrido (0,19 s `power2.out`) → resto del recorrido (0,23 s `power2.inOut`); `scale → 1` con `back.out(2.2)` (0,29 s). Giro del svg: `rotationX 0 → 90` (0,18 s `power1.in`, perspectiva 600) · cambio de cara · `rotationX −90 → 0` (0,2 s `power1.out`). Con roba 3 las tres cartas hacen lo mismo. |
| **Robar del mazo** (tablet y móvil) | Igual pero el giro es **lateral** (`scaleX`), porque el descarte está al lado. | `scaleX 1 → 0` (0,13 s `power2.in`) · cambio · `0 → 1` (0,17 s `power2.out`). |
| **Destapar** una carta de columna | Giro lateral. | Como el anterior (0,13 + 0,17). |
| **Renovar el mazo** | Las cartas del descarte dan la vuelta (giro lateral) y se colocan **encima del hueco del mazo** sin elevación; al llegar, las **dos de debajo asoman** 3 y 6 px. | Viaje plano 0,36 s `power2.inOut`; asomar: `y +3·profundidad` 0,22 s `power2.out` con retardo 0,06 s por profundidad. |
| **Arrastre** | La pila cogida crece y gana sombra; al soltar vuelve. | `scale → 1,08` 0,14 s `power2.out`, sombra `0 8px 14px rgba(15,33,36,.24)`; al soltar `scale → 1` 0,22 s `power2.inOut`. |
| **Hover** (solo `hover: hover` y `pointer: fine`) | Carta boca arriba o la de arriba del mazo: el dibujo sube **2 px** y la sombra pasa a `0 3px 6px rgba(15,33,36,.2)`. | Transiciones CSS 0,18 s / 0,2 s `ease`. Nada en táctil. |
| **Pista** | Ver §5. | |
| **Victoria** | Las 52 cartas caen en cascada con giro y después entra la tarjeta. | Cada carta `y += alto del tablero`, `x += aleatorio(−180, 180)`, `rotation aleatorio(−120, 120)`, 0,9 s `power1.in`, stagger 0,025 s (orden inverso a la creación). Tarjeta: `y 24 → 0` + opacidad, 0,35 s `power2.out`. |
| **Overlays** | Entrada de la tarjeta. | `y 24 → 0` + opacidad 0,35 s `power2.out`. |

Sin GSAP el juego funciona igual sin animar (posicionamiento directo).

---

## 7. Rendimiento y accesibilidad

- 52 nodos SVG; las sombras van en `box-shadow` del contenedor, **no** en `filter` del SVG (en móvil el `filter` por carta se notaba).
- `will-change: transform` en las cartas; `touch-action: none` en las cartas (arrastre) y `manipulation` en el tablero (sin zoom por doble toque).
- `user-select: none` en el tablero.
- Cada carta lleva `aria-label` «A de corazones»; huecos con `aria-label`; mazo `role="button"` con el número de cartas; overlays `role="dialog" aria-modal`.

---

## 8. Qué queda fuera del front (back / producto)

- Repartos con solución garantizada (hoy aleatorio puro) y puntuación: lógica de back (Luis).
- Spider: misma arquitectura, después del clásico (EINNO-760/765).
- Decisiones abiertas: **si se ofrece roba 3 y cómo** (aleatorio con aviso, selector, o nunca); bajar cartas de una base al tablero (hoy permitido); qué hacer con el toque durante una animación (hoy se ignora).
- Publicar `core/rojo/800` en la librería para dejar de usar el hex `#D1322B`.

---

## 9. Ficheros del entregable

| | |
|---|---|
| `prototipo/cards.js` | Render de la carta (cara, dorso) · **copiar tal cual** |
| `prototipo/game.js` | Reglas, interacción, animaciones, persistencia · **copiar tal cual** y cambiar solo la integración con el chasis |
| `prototipo/styles.css` | Estilos del módulo bajo `.sol`, tokens y medidas · **copiar tal cual** |
| `prototipo/ec-solitario/index.html` | Página aislada publicada en Vercel (muestra cómo se monta el módulo y los hooks `data-sol`) |
| `prototipo/live.js` | Cómo se inyecta sobre la página real (qué nodos del chasis se reutilizan) |
| `entregable/icons/` | Palos, isotipo EC, renovar mazo, iconos de la fila de controles (SVG) |
| Figma «Diseño final» | Escritorio (`23:9837`), tablet (`36:1453`), móvil (`36:2043`), sección «Estados» (roba 3, mazo vacío, pista, bloqueo, victoria, cómo se juega) con anotaciones |
