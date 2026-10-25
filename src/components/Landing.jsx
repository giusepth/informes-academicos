import { useEffect, useMemo, useState } from 'react'
import { Button } from './ui'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'

/**
 * Landing (Persuade) — the triplicate boletín world the roll locked, lightened
 * per the user's binding constraint: warm paper grounds, powder-blue copy
 * tones, soft slate ink (no near-black, no federal dark blue). Every section
 * is a form surface (rules, fields, stamps); the copy plan owns the strings.
 */

const typed = { fontFamily: "'IBM Plex Mono', monospace" }
const headed = {
  fontFamily: "'Archivo Variable', sans-serif",
  fontVariationSettings: "'wdth' 78, 'wght' 700",
}

// In-page anchors: ids live on the landing sections below.
const NAV_LINKS = [
  ['Cómo funciona', 'pasos'],
  ['Qué hace', 'features'],
  ['Datos', 'datos'],
  ['Para quién', 'quien'],
]

/**
 * Sticky bar over the landing only: thin form surface (paper at 97% + blur) on
 * a double kraft rule. Brand row left; typed anchor links scroll-ended right
 * beside the compact CTA — on <sm they become a horizontal scroll row while
 * the CTA stays pinned. The active section underlines from the observer in
 * Landing (typed 2px form-blue).
 */
function LandingNavbar({ onOpen, activeSection }) {
  const linkClass = (id) =>
    `block shrink-0 whitespace-nowrap border-b-2 px-0.5 py-1 text-[12.5px] tracking-[0.05em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3e6fa8] ${
      activeSection === id
        ? 'border-[#3e6fa8] text-[#3e6fa8]'
        : 'border-transparent text-[#6f6757] hover:text-[#3e6fa8]'
    }`
  return (
    <header
      className="sticky top-0 z-40 border-b-[3px] border-double border-[#c9b48f] backdrop-blur-[3px]"
      style={{ backgroundColor: 'rgba(247,245,239,0.97)' }}
    >
      {/* One visual row only when the anchors genuinely fit (lg). Below that:
          brand + CTA on the first row, anchors on their own scrollable row —
          DOM stays brand → nav → CTA so tab order and semantics never depend
          on CSS `order`. The subline hides on the tiniest screens (360–384px)
          so the CTA never wraps to a third row. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 lg:flex-nowrap lg:gap-5 lg:px-6">
        <div className="flex shrink-0 flex-col leading-[1.05]">
          <span style={headed} className="text-[14px] uppercase tracking-[0.08em] text-[#33455c]">
            Informes
          </span>
          <span style={typed} className="mt-0.5 hidden text-[12px] tracking-[0.02em] text-[#6f6757] min-[420px]:block">
            informes académicos · 2026
          </span>
        </div>
        <nav
          aria-label="Secciones de la página"
          className="order-3 -mx-1 flex w-full basis-full gap-3 overflow-x-auto px-1 pb-1 pt-1 lg:order-none lg:mx-0 lg:w-auto lg:basis-auto lg:flex-1 lg:justify-end lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0.5 lg:pt-1"
        >
          {NAV_LINKS.map(([label, id]) => (
            <a
              key={id}
              href={`#${id}`}
              style={typed}
              aria-current={activeSection === id ? 'location' : undefined}
              className={linkClass(id)}
            >
              {label}
            </a>
          ))}
        </nav>
        <Button
          onClick={onOpen}
          className="sheet-lift ml-auto shrink-0 whitespace-nowrap rounded-[3px] bg-[#3e6fa8] px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-[2px_3px_0_#adc6e4] hover:bg-[#345f92] sm:px-4 sm:py-2 sm:text-[13.5px]"
        >
          Abrir la herramienta
        </Button>
      </div>
    </header>
  )
}

function Rule() {
  return <div className="border-t-[3px] border-double border-[#c9b48f]" />
}

function Field({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#d8cfb8] px-5 py-3">
      <span style={typed} className="text-[13px] tracking-[0.08em] text-[#6f6757]">
        {label}
      </span>
      <span style={typed} className="shrink-0 text-[13px] font-semibold text-[#44506a]">
        {value}
      </span>
    </div>
  )
}

export default function Landing({ onOpen }) {
  // Which anchored section currently sits in the reading band: drives the
  // typed underline in the navbar (one observer, four sections).
  const [activeSection, setActiveSection] = useState('')

  const features = useMemo(
    () => [
      ['Promedios automáticos', 'El promedio de cada estudiante sale de la planilla, sin escribir una fórmula a mano.'],
      ['De Bajo a Superior', 'Escala decimal 1.0–5.0 o centesimal 1–100; cada nota cae en la valoración que le corresponde.'],
      ['Informe por estudiante', 'Una página A4 lista para imprimir o exportar a PDF, con el escudo del colegio como marca de agua.'],
      ['Quinto informe consolidado', 'El consolidado final con el desempeño escrito y editable de cada asignatura, listo para el cierre del año.'],
      ['Matriz de desempeños', 'Carga descripciones desde una matriz Asignatura×Banda, pero solo llena las celdas vacías: la última palabra es del docente.'],
      ['Sesiones por período', 'Cada periodo académico se guarda en su propia sesión: abre y sigue donde quedó.'],
    ],
    [],
  )

  // Navbar underline: track the four anchors once; the topmost section inside
  // the reading band (-15% / -60% margins) wins.
  useEffect(() => {
    const ids = NAV_LINKS.map(([, id]) => id)
    const visible = new Set()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        const current = ids.filter((id) => visible.has(id)).at(-1)
        if (current) setActiveSection(current)
      },
      { rootMargin: '-15% 0px -60% 0px' },
    )
    for (const id of ids) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing-world min-h-screen bg-[#f7f5ef] text-[#33455c]">
      <style>{`
        .landing-world ::selection { background: #cfe0f2; color: #33455c; }
        .sheet-lift { transition: transform 220ms cubic-bezier(.2,.6,.2,1); }
        .cta-sheet:hover .sheet-lift { transform: translateY(-3px); }
        .sheet-settle { animation: settle 640ms cubic-bezier(.19,.75,.22,1) both; }
        @keyframes settle {
          from { opacity: 0; transform: translateY(14px) rotate(var(--rot, 0deg)) scale(1.012); }
          to { opacity: 1; transform: translateY(0) rotate(var(--rot, 0deg)) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sheet-settle { animation: none; }
          .cta-sheet:hover .sheet-lift, .sheet-lift:hover { transform: none; }
        }
        /* Register stamp: one thump after the settle, then ink-dry static. */
        .stamp-thumps-in {
          opacity: 0;
          transform: rotate(-12deg) scale(1.35);
          animation: stamp-thump 260ms cubic-bezier(.16,1,.3,1) 900ms forwards;
        }
        @keyframes stamp-thump {
          from { opacity: 0; transform: rotate(-12deg) scale(1.35); }
          to { opacity: 1; transform: rotate(-12deg) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stamp-thumps-in { opacity: 1; transform: rotate(-12deg) scale(1); animation: none; }
        }
        .landing-world p, .landing-world h1 { text-wrap: pretty; }
        .landing-world h1, .landing-world h2 { text-wrap: balance; }
        @media (prefers-reduced-motion: no-preference) {
          html { scroll-behavior: smooth; }
        }
      `}</style>

      <LandingNavbar onOpen={onOpen} activeSection={activeSection} />

      {/* Hero: title-left, working triplicate-right. */}
      <section className="mx-auto max-w-6xl px-6 pb-14 pt-16 md:pt-24">
        <div className="flex flex-col gap-12 md:flex-row md:items-start">
          <div className="md:w-[54%]">
            <h1 style={headed} className="text-[42px] leading-[1.06] tracking-[-0.02em] text-[#3b4a63] md:text-[56px]">
              De la planilla de notas a los informes listos para imprimir.
            </h1>
            <p className="mt-5 max-w-[58ch] text-[17px] leading-[1.55] text-[#5d6a85]">
              Informes calcula promedios, asigna las valoraciones Bajo/Básico/Alto/Superior y arma el
              quinto informe: todo en tu navegador, sin que un solo dato salga del colegio.
            </p>
            <div className="cta-sheet mt-8 inline-block">
              <Button
                onClick={onOpen}
                className="sheet-lift rounded-[3px] bg-[#3e6fa8] px-8 py-4 text-[17px] font-semibold text-white shadow-[3px_4px_0_#adc6e4] hover:bg-[#4f7bb4]"
              >
                Abrir la herramienta
              </Button>
              <p style={typed} className="mt-3 text-[12.5px] tracking-[0.03em] text-[#6f6757]">
                Sin cuentas ni servidores: todo sucede en tu navegador y nada sale del colegio.
              </p>
              <a
                href="/manual-de-uso.md"
                download
                style={typed}
                className="mt-4 inline-block text-[13px] text-[#6f6757] underline decoration-[#8a7d63] underline-offset-4 transition-colors hover:decoration-[#3e6fa8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3e6fa8]"
              >
                Descargar el manual de uso (.md)
              </a>
            </div>
          </div>

          {/* Triplicate: kraft behind, copia mid, original on top — stacked in
              flow with negative margins so every layer peeks at the edges. */}
          <div className="mx-auto mt-2 w-full max-w-[520px] md:mt-8 md:w-[46%]" aria-hidden="true">
            <div
              className="hidden aspect-[1.55/1] rounded-[2px] border border-[#d3c8ab] bg-[#e3d9c2] shadow-[2px_3px_10px_rgba(120,110,80,0.22)] md:block"
              style={{ '--rot': '1.9deg', animationDelay: '160ms', transform: 'rotate(1.9deg)' }}
            />
            <div
              className="-mt-[27%] mr-[6%] hidden aspect-[1.55/1] rounded-[2px] border border-[#c3d5ec] bg-[#d8e5f6] shadow-[2px_3px_10px_rgba(90,120,160,0.2)] md:block"
              style={{ transform: 'rotate(-2.2deg)' }}
            />
            <div
              className="sheet-settle relative -ml-3 mt-[1rem] flex aspect-[1.55/1] flex-col rounded-[2px] bg-[#fdfcf8] shadow-[4px_6px_16px_rgba(120,110,80,0.28)] md:mt-[-36%]"
              style={{ '--rot': '0deg' }}
            >
              <div className="flex items-center justify-between border-b-2 border-[#3e6fa8] px-5 py-3">
                <span style={typed} className="text-[13px] font-semibold tracking-[0.06em] text-[#3e6fa8]">
                  ORIGINAL · COLEGIO
                </span>
                <span style={typed} className="text-[12px] text-[#6f6757]">
                  PERÍODO 4 · 2026
                </span>
              </div>
              <Field label="ESTUDIANTE" value="ANA GÓMEZ · 5° A" />
              <Field label="MATEMÁTICAS" value="4.5 · Alto" />
              <Field label="CIENCIAS" value="4.2 · Alto" />
              <Field label="ESPAÑOL" value="3.8 · Básico" />
              <div className="mt-auto flex items-center justify-between px-5 py-4 text-[12px] text-[#6f6757] md:pr-28">
                <span>Informe A4 · una página por estudiante</span>
                <span style={typed}>PROM 4.17</span>
              </div>
              {/* Register stamp: the authored moment. Double olive ring on the
                  original sheet corner — echoes the PROM 4.17 it registers. */}
              <span
                data-stamp
                aria-hidden="true"
                style={{ ...typed, boxShadow: 'inset 0 0 0 0.5px rgba(93,125,90,0.35)' }}
                className="stamp-thumps-in pointer-events-none absolute bottom-2.5 right-2.5 hidden select-none rounded-full md:flex border-2 border-[#55704f] p-[2px] h-[104px] w-[104px]"
              >
                <span className="flex w-full flex-col items-center justify-center rounded-full border-[1.5px] border-[#55704f] text-[#55704f]">
                  <span className="text-[12px] uppercase leading-none tracking-[0.02em] md:tracking-[0.04em]">
                    Registrado
                  </span>
                  <span className="mt-[4px] text-[13px] font-semibold leading-none tracking-[0.04em]">
                    4.17
                  </span>
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip: ruled form divider band. */}
      <section className="mx-auto max-w-6xl px-6">
        <Rule />
        <p style={typed} className="py-4 text-center text-[12.5px] text-[#6f6757]">
          Sin cuentas · Sin servidores · Sin suscripciones · Nada se instala
        </p>
        <Rule />
        <p style={typed} className="pt-3 text-center text-[12.5px] text-[#6f6757]">
          hecho para cierres de período sin sobresaltos.
        </p>
      </section>

      {/* Steps: numbered form boxes, sequence carries real information. */}
      <section id="pasos" className="mx-auto max-w-6xl scroll-mt-28 lg:scroll-mt-24 px-6 py-16">
        <h2 style={headed} className="text-[26px] leading-snug text-[#3b4a63] md:text-[30px]">
          De la planilla al informe impreso, en tres pasos
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            ['1', 'Carga la planilla', 'Sube el .xlsx de notas que el colegio ya usa; promedios y valoraciones aparecen al instante.'],
            ['2', 'Revisa los desempeños', 'Ajusta lo que haga falta y completa los desempeños con la matriz que solo llena celdas vacías.'],
            ['3', 'Imprime y respalda', 'Informes A4 por estudiante o PDF de varias páginas; exporta un .xlsx para conservar el trabajo.'],
          ].map(([number, title, line]) => (
            <div key={number} className="border border-[#d8cfb8] bg-[#fdfcf8] p-5">
              <span
                style={typed}
                className="mb-3 inline-block border border-[#3e6fa8] px-2 py-0.5 text-[12px] font-semibold text-[#3e6fa8]"
              >
                {number}
              </span>
              <h3 style={headed} className="text-[17px] text-[#3b4a63]">
                {title}
              </h3>
              <p className="mt-2 text-[14.5px] leading-[1.55] text-[#5d6a85]">{line}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features: ruled form ledger rows, not icon cards. */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-28 lg:scroll-mt-24 px-6 pb-16">
        <Rule />
        <h2 style={headed} className="pb-6 pt-8 text-[26px] text-[#3b4a63] md:text-[30px]">
          Qué hace, en concreto
        </h2>
        <div className="border border-[#d8cfb8] bg-[#fdfcf8]">
          {features.map(([title, line], index) => (
            <div
              key={title}
              className={`grid gap-1 p-5 md:grid-cols-[240px_1fr] md:gap-6 ${index ? 'border-t border-[#e4dbc4]' : ''}`}
            >
              <h3 style={headed} className="text-[14px] uppercase tracking-[0.06em] text-[#3e6fa8]">
                {title}
              </h3>
              <p className="text-[14.5px] leading-[1.55] text-[#5d6a85]">{line}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy: a stamped side-note block. */}
      <section id="datos" className="mx-auto max-w-6xl scroll-mt-28 lg:scroll-mt-24 px-6 pb-16">
        <div className="border-l-[3px] border-[#ece5d3] bg-[#fdfcf8] p-6">
          <h2 style={headed} className="text-[24px] text-[#3b4a63] md:text-[28px]">
            Los datos son del colegio
          </h2>
          <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.65] text-[#5d6a85]">
            Los datos viven solo en el navegador de la pestaña que tienes abierta: no hay cuentas,
            no hay servidores y, al cerrar la pestaña, la información se borra de la computadora.
            Para conservar el trabajo, exporta el respaldo completo en Excel (.xlsx) y vuelve a
            importarlo cuando abras la herramienta de nuevo.
          </p>
        </div>
      </section>

      {/* Audience: honest targeting. */}
      <section id="quien" className="mx-auto max-w-6xl scroll-mt-28 lg:scroll-mt-24 px-6 pb-16">
        <h2 style={headed} className="text-[24px] text-[#3b4a63] md:text-[28px]">
          ¿Para quién es?
        </h2>
        <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.65] text-[#5d6a85]">
          Para rectores, coordinadores académicos y docentes de colegios pequeños y medianos que
          hoy arman a mano los boletines en Excel: promedios, valoraciones y quinto informe piden
          noches enteras. Esta herramienta se abre, calcula, se imprime y se cierra.
        </p>
      </section>

      {/* Closing line + last CTA. */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Rule />
        <p style={headed} className="pt-10 text-[22px] leading-[1.4] text-[#3b4a63] md:text-[26px]">
          Que el cierre de período sea de informes impresos,
          <br className="hidden md:block" /> no de noches con Excel.
        </p>
        <div className="cta-sheet mt-7 inline-block">
          <Button
            onClick={onOpen}
            className="sheet-lift rounded-[3px] bg-[#3e6fa8] px-8 py-4 text-[17px] font-semibold text-white shadow-[3px_4px_0_#adc6e4] hover:bg-[#4f7bb4]"
          >
            Abrir la herramienta
          </Button>
        </div>
      </section>

      {/* Footer: identity + soft offer, non-invasive. */}
      <footer className="mx-auto max-w-6xl px-6 pb-12">
        <Rule />
        <p style={typed} className="pt-6 text-[12.5px] text-[#6f6757]">
          Informes — herramienta de informes académicos para colegios. Se ejecuta en el navegador.
        </p>
        <p className="mt-3 text-[13.5px] text-[#5d6a85]">
          Además: si tu colegio necesita una versión a medida, escríbenos a{' '}
          <a
            href="mailto:giusepthrivera@gmail.com"
            className="text-[#3e6fa8] underline decoration-[#cfe0f2] underline-offset-2 hover:decoration-[#3e6fa8]"
          >
            giusepthrivera@gmail.com
          </a>
          .
        </p>
        <p className="mt-2 text-[13.5px] text-[#5d6a85]">
          ¿Prefieres un formulario? Abre el{' '}
          <a
            href="#/contacto"
            className="inline-flex min-h-11 items-center text-[#3e6fa8] underline decoration-[#cfe0f2] underline-offset-2 hover:decoration-[#3e6fa8]"
          >
            formulario de contacto
          </a>
          .
        </p>
        <p className="mt-2 text-[11.5px] text-[#6f6757]">
          Servicio de desarrollo a medida para colegios de pequeña y mediana envergadura.
        </p>
      </footer>
    </div>
  )
}
