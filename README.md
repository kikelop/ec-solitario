# EC Solitario — Solitario clásico (Klondike) para Juegos de El Confidencial

Prototipo funcional y especificación de diseño del Solitario clásico para la sección de Juegos (juegos.elconfidencial.com). Front en vanilla HTML/CSS/JS, sin build; la lógica de back (repartos garantizados, puntuación, persistencia de servidor) queda fuera.

**Diseñado por:** Kike López · Product Design
**Jira:** EINNO-763 (diseño) · EINNO-759 (HU)
**Figma:** `[INNO] Solitario` · `IytFyWTstf48YiPHLafC7K` · página «Diseño final» (escritorio, tablet, móvil y sección «Estados · escritorio» con anotaciones de Dev Mode)
**Prototipo publicado:** https://ec-solitario.vercel.app (pide login de Vercel)

## Qué hay

```
ec-solitario/
├── README.md
├── entregable/
│   ├── ESPECIFICACION.md   ← especificación 1:1 (chasis, tokens, geometría, carta, reglas, animaciones, accesibilidad)
│   └── icons/              ← palos, isotipo EC, renovar mazo e iconos de la fila de controles (SVG)
└── prototipo/
    ├── game.js             ← módulo `Solitaire.mount(root, opts)`: reglas, interacción, animaciones, persistencia  · copiar tal cual
    ├── cards.js            ← render SVG de la carta (cara y dorso)                                                  · copiar tal cual
    ├── styles.css          ← estilos del módulo bajo `.sol`, tokens ec.color.v2 y medidas                          · copiar tal cual
    ├── index.html          ← réplica del chasis de Juegos (cabecera, título, publicidad, meta, controles) con el módulo montado
    ├── chassis.css         ← tokens y reglas copiados del CSS real de Juegos (solo para la réplica)
    ├── live.js             ← inyecta el módulo sobre la página real del crucigrama con Playwright (qué nodos del chasis se reutilizan)
    ├── assets/             ← isotipo EC e icono de renovar mazo
    ├── tools/              ← utilidades de diseño (exportar geometría a Figma, grabar vídeo)
    └── fonts/              ← NO está en el repo (ver abajo)
```

Empieza por `entregable/ESPECIFICACION.md`. Está escrito para leerse entero: todo lo que dice está implementado en `prototipo/` tal cual, y ante cualquier duda el código del prototipo manda.

## Ver en local

```bash
cd prototipo
python3 -m http.server 8787
# → http://localhost:8787/
```

Para verlo sobre la página real de Juegos (necesita Playwright instalado en `node_modules`):

```bash
cd prototipo
node live.js            # escritorio
node live.js --mobile   # emulación iPhone
node live.js --tablet   # 834×1194 táctil
```

## Fuentes

Las fuentes Confi Sans y Confi Serif son propiedad de El Confidencial y **no se publican en el repo**. Para que la réplica se vea como en producción, copia los woff2 en `prototipo/fonts/` (los mismos nombres que usa `chassis.css`: `ConfiSans-400-Regular`, `ConfiSans-500-Medium`, `ConfiSans-700-Bold`, `ConfiSerif-700-Bold`). Sin ellas el juego funciona igual con la fuente de respaldo.

## Integración con el chasis

El módulo no pinta cabecera ni controles: se monta en un contenedor y habla con el chasis a través de atributos `data-sol` (valores de modo, tiempo, jugadas y reparto) y `data-sol-action` (deshacer, pista, nueva partida, salir, cómo se juega). El detalle de hooks, opciones de montaje y qué queda en back está en la especificación. Las animaciones usan GSAP 3.12.5 (cdnjs); sin GSAP todo sigue funcionando sin animar.

## Decisiones abiertas

- Reparto **roba 3**: implementado (abanico del descarte, bloqueo, deshacer) pero el juego va siempre en roba 1 hasta decidir si se ofrece y cómo.
- Si se mantiene permitido bajar cartas de una base al tablero (hoy sí; la pista y la detección de bloqueo no lo contemplan).
- Repartos resolubles garantizados, puntuación y persistencia en servidor: lógica de back.
