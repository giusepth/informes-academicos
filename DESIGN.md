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
0. **Navbar sticky (solo landing)**: barra fina de superficie de formulario — paper al 97% con blur, filo inferior doble kraft `#c9b48f` (3px). Marca `Informes` (Archivo condensada caps 14px, ink-slate) con sub mecanografiado `informes académicos · 2026`; a la derecha, anclas en página (Cómo funciona → `#pasos`, Qué hace → `#features`, Datos → `#datos`, Para quién → `#quien`) + CTA compacto form-blue. Las secciones llevan `id` y `scroll-mt` para que la barra nunca tape un título; el scroll suave vive solo bajo `prefers-reduced-motion: no-preference`. Estado activo por `IntersectionObserver`: subrayado 2px form-blue en voz mecanografiada, sin kickers, anillos `focus-visible`. En <640px las anclas pasan a una fila con scroll horizontal y el CTA permanece fijo.
1. **Hero**: H1 (2–3 líneas, `text-wrap: balance`), support, CTA con microcopio de privacidad debajo (frase A corta) y, bajo él, la **acción quieta del manual**: `Descargar el manual de uso (.md)` como form-link mecanografiado (Plex Mono 13px, `#6f6757`, subrayado que pasa a form-blue en hover, `href="/manual-de-uso.md"` + `download`). El asset del manual se agrega en el PR de `#15`: aquí solo se enlaza, nunca se crea el archivo. Triplicado vivo a la derecha con el **sello REGISTRADO** en la hoja original (ver Movimiento). 
2. **Banda de confianza**: regla doble + `Sin cuentas · Sin servidores · Sin suscripciones · Nada se instala` (Plex Mono); debajo, la línea humana: `hecho para cierres de período sin sobresaltos.` (12.5px, `#6f6757`). Es el único toque humano fuera de la microcopio: contención, no ruido.
3. **Tres pasos**: cajas-numerales 1/2/3 del formulario (la secuencia es información real).
4. **Qué hace**: ledger de filas regladas (título caps + beneficio una línea) — explícitamente NO tarjetas de iconos (craft-floor).
5. **Privacidad**, **Para quién**, cierre + segundo CTA, **footer** con oferta suave (giusepthrivera@gmail.com + micro-disclosure).

## Movimiento / estados
- Momentos autorales: **dos y solo dos, y secuenciales**. (1) `settle` de la hoja ORIGINAL al cargar (640ms, ease `.19 .75 .22 1`, `animation-fill-mode: both`). (2) El **thump del sello REGISTRADO**: aro doble verde oliva `#55704f` rotado -12° en la esquina inferior derecha de la hoja original, texto `REGISTRADO` (Plex Mono 12px caps espaciado) con `4.17` al centro — registra el promedio que sí se ve en la hoja; thump único ~900ms tras el settle (escala 1.35→1, opacity 0→1, 260ms, ease-out exponencial `.16,1,.3,1` — sin rebotes) y queda seco (estático). Solo ≥md: en móvil el sello no se monta para no tapar filas (adaptación responsive declarada). Sangrado de tinta: hairline `box-shadow` inset + gap blanco de 2px entre aros. `aria-hidden` puro (decorativo). `prefers-reduced-motion`: aparece al estado final, sin animar.
- Hover del CTA: `sheet-lift` (−3px). Estados de foco: anillo `focus-visible` en navbar y form-link del manual; `outline` heredado del sistema en el resto.
- Gotcha capturado: **animar las capas traseras impide su pintado en este Chromium/CDP** — quedaron estáticas por diseño (probes en `.impeccable/review/`). Las capturas finales se toman en viewport (no `fullPage`): la captura extendida no repinta de forma fiable absolutos animados.

## Mundo (deuda y escalado)
- `cx()` ahora fusiona con `tailwind-merge` (últimos args ganan) — los overrides de `className` en `<Button>` son ahora deterministas.
- El mundo escala a más páginas reusando `typed`/`headed`/`Rule`/`Field` sin nuevos tokens.
- **Fronteras de PRs paralelos**: el párrafo de oferta del footer y su flujo de contacto pertenecen al PR paralelo de contacto — la navbar ni el sello tocan el footer; el asset `public/manual-de-uso.md` pertenece al PR de `#15`. Este pass: navbar + link manual + sello + línea humana.

## Verificación
- `impeccable detect` limpio (0 anti-patrones, 0 avisos) sobre la página sirviendo. Todo texto nuevo pasa AA: navbar y form-link usan `#6f6757`/`#3e6fa8` (ya verificados en tokens); el verde `#55704f` del sello mide 5.36:1 (AA pleno) y es decorativo `aria-hidden`.
- Capturas: `.impeccable/review/landing-v2-desktop.png`, `landing-v2-mobile.png` (fresh load, settle + thump terminados, 1.5s).
- e2e: `e2e/landing.spec.js` (5 tests) + suite trackeada completa 17/17. (Un `e2e/contact.spec.js` WIP de PR paralelo vive sin trackear; no corre en este gate.)
