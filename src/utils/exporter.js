/**
 * Export pipeline: DOM element -> canvas -> PDF, plus ZIP bundling.
 *
 * Heavy libraries (html2canvas-pro, jsPDF, JSZip) are imported on demand so the
 * initial bundle stays small. We use html2canvas-pro (not html2canvas) because
 * it understands the modern color functions (oklch/lab/lch) emitted by Tailwind
 * CSS v4.
 */

let depsPromise

function loadDeps() {
  depsPromise ??= Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
    import('jszip'),
  ]).then(([html2canvasModule, jspdfModule, jszipModule]) => ({
    html2canvas: html2canvasModule.default,
    jsPDF: jspdfModule.jsPDF,
    JSZip: jszipModule.default,
  }))
  return depsPromise
}

const CAPTURE_OPTIONS = {
  scale: 2,
  backgroundColor: '#ffffff',
  useCORS: true,
  logging: false,
}

/** Slugifies a student name into a safe file name. */
export function safeFileName(name) {
  return (
    String(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'estudiante'
  )
}

/** Captures a DOM element into canvas pixels once, so multi-page slices reuse it. */
async function captureCanvas(element) {
  const { html2canvas } = await loadDeps()
  return html2canvas(element, CAPTURE_OPTIONS)
}

/**
 * Draws a canvas into a jsPDF document, slicing it across A4 pages when the
 * content is taller than a single page.
 */
function paintCanvasIntoPdf(pdf, canvas) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const renderedHeight = (canvas.height * pageWidth) / canvas.width

  if (renderedHeight <= pageHeight) {
    pdf.addImage(canvas, 'PNG', 0, 0, pageWidth, renderedHeight, undefined, 'FAST')
    return
  }

  const sliceHeightPx = Math.floor((pageHeight / pageWidth) * canvas.width)
  let offsetY = 0
  let pageIndex = 0

  while (offsetY < canvas.height) {
    const currentSliceHeight = Math.min(sliceHeightPx, canvas.height - offsetY)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = currentSliceHeight

    const context = slice.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, slice.width, slice.height)
    context.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      currentSliceHeight,
      0,
      0,
      canvas.width,
      currentSliceHeight,
    )

    const sliceImageHeight = (currentSliceHeight * pageWidth) / canvas.width
    if (pageIndex > 0) pdf.addPage()
    pdf.addImage(slice, 'PNG', 0, 0, pageWidth, sliceImageHeight, undefined, 'FAST')

    offsetY += currentSliceHeight
    pageIndex += 1
  }
}

/** Renders one report element into a PDF Blob. */
export async function elementToPdfBlob(element) {
  const { jsPDF } = await loadDeps()
  const canvas = await captureCanvas(element)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  paintCanvasIntoPdf(pdf, canvas)
  return pdf.output('blob')
}

/** Triggers a browser download for a Blob. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Downloads a single report element as a PDF file. */
export async function downloadElementPdf(element, fileName) {
  const blob = await elementToPdfBlob(element)
  downloadBlob(blob, fileName)
}

/**
 * Bundles many report elements into a single .zip of PDFs.
 *
 * `getElementFor` must return the live DOM element for a given student id.
 * The caller is responsible for making each student's element the one that is
 * currently rendered before this resolves.
 *
 * @param {Array<{id: string, name: string}>} students
 * @param {(id: string) => Promise<HTMLElement | null>} getElementFor
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function buildPdfZip(students, getElementFor, onProgress) {
  const { JSZip } = await loadDeps()
  const zip = new JSZip()
  let done = 0

  for (const student of students) {
    const element = await getElementFor(student.id)
    if (!element) continue
    const blob = await elementToPdfBlob(element)
    zip.file(`${safeFileName(student.name)}.pdf`, blob)
    done += 1
    onProgress?.(done, students.length)
  }

  return zip.generateAsync({ type: 'blob' })
}
