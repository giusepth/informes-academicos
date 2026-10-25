# Landing — Dirección visual documentada

Mundo: **Boletín triplicado** (IMPECCABLE'S PICK, tira `69490acad69c7b91`, key `1a238ff47c9965251fd1065d283f98d4`, pool `c3b204a1eed6`).
Restricción del usuario (vinculante): paleta clara, amable y gentil — nada de azules federales oscuros ni negros casi puros. El registro de tinta del mundo se aclaró sin cambiar su identidad (carbonilla de triplicado, formularios públicos mecanografiados).

## Tokens

| Token | Hex | Uso |
| --- | --- | --- |
| `paper` | `#f7f5ef` | fondo de página (papel cálido) |
| `sheet` | `#fdfcf8` | hoja original / superficies de tarjeta |
| `copy-sky` | `#d8e5f6` | hoja copia (powder blue) |
| `kraft` | `#e3d9c2` | tercera capa del triplicado |
| `kraft-line` | `#d3c8ab` / `#c9b48f` | filos de corte / reglas dobles |
| `ink-slate` | `#33455c` / `#3b4a63` | texto y titulares |
| `typed-ochre` | `#6f6757` | microplanilla mecanografiada (contraste ≥ 4.5:1 verificado) |
| `form-blue` | `#3e6fa8` | CTA y títulos de ledger (AA en texto) |
| `form-blue-lift` | `#4f7bb4` | solo hover de CTA (uso decorativo, no texto) |

## Tipografía (self-hosted vía @fontsource)
- **Titulares/etiquetas**: `Archivo Variable` (`@fontsource-variable/archivo/wdth.css`), eje `wdth 78 wght 700` — condensada de formulario público, sentence case en H1/H2.
- **Datos/campos**: `IBM Plex Mono` 400/600 — la voz mecanografiada del triplicado (labels, confianza, pie).
- Prohibido: em dashes; tracking ancho en texto corrido (solo caps cortas de etiqueta).

## Anatomía de página
1. **Hero**: H1 (2–3 líneas, `text-wrap: balance`), support, CTA con microcopio de privacidad debajo (frase A corta), triplicado vivo a la derecha (kraft/copia/original pasadas con inline `transform: rotate()`; solo la hoja original lleva la animación `settle`). 
2. **Banda de confianza**: regla doble + `Sin cuentas · Sin servidores · Sin suscripciones · Nada se instala` (Plex Mono).
3. **Tres pasos**: cajas-numerales 1/2/3 del formulario (la secuencia es información real).
4. **Qué hace**: ledger de filas regladas (título caps + beneficio una línea) — explícitamente NO tarjetas de iconos (craft-floor).
5. **Privacidad**, **Para quién**, cierre + segundo CTA, **footer** con oferta suave (giusepthrivera@gmail.com + micro-disclosure).

## Movimiento / estados
- Un solo momento autoral: `settle` de la hoja ORIGINAL al cargar (640ms, ease `.19 .75 .22 1`, `animation-fill-mode: both`). `prefers-reduced-motion` lo apaga.
- Hover del CTA: `sheet-lift` (−3px). Estados de foco: outline heredado del sistema.
- Gotcha capturado: **animar las capas traseras impide su pintado en este Chromium/CDP** — quedaron estáticas por diseño (probes en `.impeccable/review/`).

## Mundo (deuda y escalado)
- `cx()` ahora fusiona con `tailwind-merge` (últimos args ganan) — los overrides de `className` en `<Button>` son ahora deterministas.
- El mundo escala a más páginas reusando `typed`/`headed`/`Rule`/`Field` sin nuevos tokens.

## Verificación
- `impeccable detect` limpio (0 anti-patrones, 0 avisos) sobre la página sirviendo.
- Capturas: `.impeccable/review/landing-desktop.png`, `landing-mobile.png` (fresh load, settle terminado).
- e2e: `e2e/landing.spec.js` (3 tests) + flujo `completeFirstRun` tolera la landing; 15/15 suite.
