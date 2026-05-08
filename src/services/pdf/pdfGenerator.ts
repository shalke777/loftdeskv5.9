/**
 * Client-side PDF generator.
 * Converts a full HTML document string (as produced by documentPreview.ts builders)
 * into a real binary PDF Blob (MIME: application/pdf) via html2canvas + jsPDF.
 *
 * Flow:
 *   HTML string → extract <style> + <body> → mount off-screen div in main DOM
 *   → hide fixed-position CSS footer (conflicts with off-screen layout)
 *   → html2canvas renders the .doc element to one tall canvas
 *   → DOM section boundaries collected for smart page breaking
 *   → jsPDF slices canvas at section boundaries (never mid-section)
 *   → per-page footer bar drawn by jsPDF (company name + page number)
 *   → returns Blob({ type: 'application/pdf' })
 *
 * This function never calls window.print() and never opens a new tab.
 */

const A4_W_MM = 210
const A4_H_MM = 297
/** Width in px used for the off-screen render container — matches the .doc fixed width */
const RENDER_WIDTH_PX = 900
/** Footer bar height in mm — drawn by jsPDF, not CSS */
const FOOTER_H_MM = 9
/** Green accent colour matching CSS --accent: #16A34A */
const FOOTER_RGB = { r: 22, g: 163, b: 74 }
/** Effective content height per page — leaves room for footer + small bottom gap */
const PAGE_CONTENT_H_MM = A4_H_MM - FOOTER_H_MM - 3

function extractStylesAndBody(html: string): { styles: string; body: string } {
  const styles: string[] = []
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    styles.push(m[1])
  }
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return {
    styles: styles.join('\n'),
    body: bodyMatch?.[1] ?? html,
  }
}

/** Extract company name from rendered DOM for footer label. */
function extractCompanyName(root: HTMLElement): string {
  const partyBoxes = root.querySelectorAll('.party-box strong')
  if (partyBoxes.length >= 2) {
    const name = (partyBoxes[partyBoxes.length - 1] as HTMLElement).textContent?.trim()
    if (name) return name
  }
  const topbar = root.querySelector('.topbar__title') as HTMLElement | null
  return topbar?.textContent?.trim() || 'LoftDesk'
}

/**
 * Build page start offsets (in mm into the full document image) snapped to section
 * boundaries so no section is split mid-content across pages.
 */
function buildPageOffsets(totalHeightMm: number, sectionBoundariesMm: number[]): number[] {
  const offsets: number[] = [0]
  let curY = 0
  while (curY < totalHeightMm) {
    const idealEnd = curY + PAGE_CONTENT_H_MM
    if (idealEnd >= totalHeightMm) break
    // Snap to the last section boundary that fits within this page
    const fits = sectionBoundariesMm.filter(b => b > curY && b <= idealEnd)
    const nextStart = fits.length > 0 ? fits[fits.length - 1] : idealEnd
    offsets.push(nextStart)
    curY = nextStart
  }
  return offsets
}

export async function generatePdfBlob(html: string): Promise<Blob> {
  // Lazy-load heavy deps so they don't bloat the initial bundle
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const { styles, body } = extractStylesAndBody(html)

  // Inject document styles + suppress the CSS .footer (we draw it via jsPDF instead)
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-loftdesk-pdf-tmp', '1')
  styleEl.textContent = styles + '\n[data-loftdesk-pdf-tmp] .footer { display: none !important; }'
  document.head.appendChild(styleEl)

  // Mount off-screen container. Must be attached to the real DOM for html2canvas.
  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-loftdesk-pdf-tmp', '1')
  wrapper.style.cssText = [
    'position:absolute',
    'left:-99999px',
    'top:0',
    `width:${RENDER_WIDTH_PX}px`,
    'overflow:visible',
    'pointer-events:none',
  ].join(';')
  wrapper.innerHTML = body
  document.body.appendChild(wrapper)

  try {
    // Wait two animation frames so the browser fully lays out the injected content
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    const target = (wrapper.querySelector('.doc') as HTMLElement | null) ?? wrapper

    // Collect section boundary positions (normalised 0..1) BEFORE rendering
    const BREAK_SELECTORS = '.section, .party-grid, .totals-box, .signature-grid, .checklist'
    const targetBCR = target.getBoundingClientRect()
    const targetH = target.offsetHeight
    const relBoundaries: number[] = []
    for (const el of Array.from(target.querySelectorAll(BREAK_SELECTORS)) as HTMLElement[]) {
      const frac = (el.getBoundingClientRect().bottom - targetBCR.top) / targetH
      if (frac > 0.01 && frac < 0.999) relBoundaries.push(frac)
    }
    relBoundaries.sort((a, b) => a - b)

    const companyName = extractCompanyName(target)

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const imgW = A4_W_MM
    const imgH = (canvas.height / canvas.width) * imgW

    // Convert relative boundaries to mm
    const sectionBoundariesMm = relBoundaries.map(f => f * imgH)
    const pageOffsets = buildPageOffsets(imgH, sectionBoundariesMm)
    const totalPages = pageOffsets.length

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage()
      const yStartMm = pageOffsets[page]

      // Draw the full image shifted so the correct slice appears on this page
      pdf.addImage(dataUrl, 'JPEG', 0, -yStartMm, imgW, imgH)

      // White mask: covers overflow below this page's section boundary
      if (page + 1 < totalPages) {
        const contentEndOnPage = pageOffsets[page + 1] - yStartMm
        const maskH = A4_H_MM - FOOTER_H_MM - contentEndOnPage
        if (maskH > 0) {
          pdf.setFillColor(255, 255, 255)
          pdf.rect(0, contentEndOnPage, A4_W_MM, maskH, 'F')
        }
      }

      // Footer bar
      const footerY = A4_H_MM - FOOTER_H_MM
      pdf.setFillColor(FOOTER_RGB.r, FOOTER_RGB.g, FOOTER_RGB.b)
      pdf.rect(0, footerY, A4_W_MM, FOOTER_H_MM, 'F')

      // Footer text
      const textY = footerY + FOOTER_H_MM / 2 + 1.5
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.text(companyName, A4_W_MM / 2, textY, { align: 'center' })
      pdf.text(`${page + 1} / ${totalPages}`, A4_W_MM - 8, textY, { align: 'right' })
    }

    return pdf.output('blob')
  } finally {
    if (wrapper.parentNode) document.body.removeChild(wrapper)
    if (styleEl.parentNode) document.head.removeChild(styleEl)
  }
}
