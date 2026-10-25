# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users: rectores, coordinadores académicos y docentes de colegios de pequeña y mediana envergadura (LatAm, Colombia especially), [inferred from the site-features request and existing docs]. Their job: produce end-of-period performance reports WITHOUT hand-building every formula in Excel. Secondary audience: the same schools seeking custom software implementations (soft services offer, non-invasive; explicitly requested by the owner).

## Product Purpose

Turn the school's existing grades spreadsheet (.xlsx) into compute-ready printable student performance reports: averages, Bajo/Básico/Alto/Superior bands (decimal 1.0–5.0 or centesimal 1–100 institutional scale), per-student A4 report with crest watermark + PDF export, consolidated quinto informe with editable per-subject desempeño, multi-period sessions, and full .xlsx backup round-trip. Success = the rector prints or exports everything in minutes and trust in numbers is kept.

## Positioning

Calculated, private, and school-flavored reports with zero accounts: the entire workload lives inside the browser tab (sessionStorage), nothing touches a server, and Excel is both the input and the backup medium. No cloud service could truthfully copy "los datos del colegio nunca salen del colegio".

## Operating Context

- One browser tab is the session: data is volatile by design (RNF-01); the export/import .xlsx backup (informes-backup-YYYY-MM-DD.xlsx) is the persistence ritual.
- Excel is the lingua franca of input (RF-02): the sheet layout teachers already use, teacher-per-subject columns, unaccented header tolerance.
- Deployment: static SPA (Vercel). Docs: docs/manual-de-uso.md (teacher-facing), module docs under docs/.

## Capabilities and Constraints

- Confirmed: xlsx import (scores + docente per subject + desempeño), manual entry with insane clamps per scale, editable qualitative band ranges, scale switch decimal/centesimal at setup, performance-matrix text pre-load filling ONLY empty cells, final consolidated report, per-student printable A4 + PDF, pagination-safe multi-page export, .xlsx backup export/import, all client-side (react + vite + tailwind + sheetjs + jspdf + html2canvas-pro + jszip).
- Hard constraint: NO backend, NO accounts, NO analytics/telemetry of any kind. Accessibility: keyboard-reachability and semantic semantics per RF/RNF of docs/spec.md; Spanish-first UI copy (Rioplatense voseo is the established app voice).
- Undecided/none: marketing assets (no logo beyond school crests, no testimonials — must NOT be fabricated).

## Brand Commitments

- App name in UI copy: "Informes" (tool), repo name informes-academicos. Voice: cálido, sin superlativos, frases cortas; Spanish school vocabulary (informe, desempeño, asignatura, valoración, estudiante, pestaña, respaldo).
- Visual identity of the TOOL (incumbent): light slate neutrals, white rounded-2xl panels on a soft gray page, restrained accent colors for performance bands, education-card styling. See docs/manual-de-uso.md screenshots section and src/components for the honest system.

## Evidence on Hand

- Working product + full e2e suite (12 playwright specs) and CI green on main 2b59ba6.
- No marketing testimonials, logos, or benchmarks exist yet; landing copy must not manufacture proof it doesn't have. Only truthful capability claims are allowed.

## Product Principles

1. Data sovereignty first: school data never leaves the tab; every copy line about privacy is literal, not aspirational.
2. Teacher judgment wins: the tool pre-fills, the docent decides (matrix fills only empty cells).
3. Start from the sheet the school already uses: no re-keying demanded, no new formats invented.
4. Finish the job: printable output is the deliverable, on-screen clarity is the means.
