/**
 * Client-side PDF generator — section-aware, footer on every page.
 *
 * Architecture:
 *   HTML → off-screen DOM render → measure section positions via offsetTop
 *   (viewport-independent) → html2canvas → jsPDF with smart page cuts
 *   that never split a section, table, or party-grid mid-content.
 *   Footer bar (company name + page X/Y) drawn by jsPDF on every page.
 */

const A4_W_MM = 210
const A4_H_MM = 297
const RENDER_WIDTH_PX = 900
const FOOTER_H_MM = 10
const PAGE_TOP_MARGIN_MM = 8   // breathing room at the top of pages 2+
const FOOTER_MARGIN_MM = 6     // white gap between last content line and footer bar
const FOOTER_RGB = { r: 22, g: 163, b: 74 }
/** Usable content height per page (A4 minus footer bar minus top margin minus footer gap) */
const USABLE_H_MM = A4_H_MM - FOOTER_H_MM - PAGE_TOP_MARGIN_MM - FOOTER_MARGIN_MM

/**
 * Get an element's top offset relative to a given ancestor,
 * using offsetTop/offsetParent traversal (works off-screen, viewport-independent).
 */
function absoluteOffsetTopPx(el: HTMLElement): number {
  let top = 0
  let cur: HTMLElement | null = el
  while (cur && cur.tagName !== 'BODY') {
    top += cur.offsetTop
    cur = cur.offsetParent as HTMLElement | null
  }
  return top
}

interface Block { topPx: number; bottomPx: number }

const AVOID_BREAK_SELECTORS =
  // .section is intentionally NOT here — sections (§1, §2 …) can be very tall
  // and keeping them atomic caused entire sections to jump to the next page,
  // leaving large white gaps. Instead we protect individual items:
  //   • li  — a single bullet point stays whole (no mid-bullet cut)
  //   • p   — a single paragraph stays whole (no mid-sentence cut)
  // The algorithm will break BETWEEN paragraphs/bullets, never inside them.
  '.party-grid, .totals-box, .signature-grid, table, .checklist, .check, li, p'

/**
 * Collect "avoid-break" blocks as {topPx, bottomPx} relative to target element.
 * Uses offsetTop traversal — reliable for elements far off-screen.
 */
function collectBlocks(target: HTMLElement): Block[] {
  const targetTopAbs = absoluteOffsetTopPx(target)
  const blocks: Block[] = []
  for (const el of Array.from(target.querySelectorAll(AVOID_BREAK_SELECTORS)) as HTMLElement[]) {
    const topPx = absoluteOffsetTopPx(el) - targetTopAbs
    const bottomPx = topPx + el.offsetHeight
    if (bottomPx > 0 && topPx < target.offsetHeight) {
      blocks.push({ topPx, bottomPx })
    }
  }
  return blocks
}

/**
 * Build page start positions in CSS px that avoid splitting any block.
 *
 * Algorithm per page:
 *   1. Compute ideal cut = curY + pxPerPage
 *   2. Find blocks straddling that cut (topPx < idealCut < bottomPx)
 *   3a. If none straddle → cut at idealCut
 *   3b. If some straddle → cut just before the earliest straddling block's top
 *       (pushes the whole block to the next page)
 *   3c. If the earliest straddling block starts right at curY (block too tall) →
 *       cut after the block's bottom (accept the oversized page)
 */
function buildPageStartsPx(totalHPx: number, blocks: Block[], pxPerPage: number): number[] {
  const starts = [0]
  let curY = 0
  while (curY < totalHPx) {
    const idealCut = curY + pxPerPage
    if (idealCut >= totalHPx) break

    const straddling = blocks.filter(b => b.topPx < idealCut && b.bottomPx > idealCut)
    let next: number
    if (straddling.length === 0) {
      next = idealCut
    } else {
      const earliestTop = Math.min(...straddling.map(b => b.topPx))
      // Guard: ensure at least 40px of progress to avoid infinite loop
      if (earliestTop > curY + 40) {
        next = earliestTop
      } else {
        // Block starts too close to page start (or is taller than a page) — cut after it
        next = Math.max(...straddling.map(b => b.bottomPx))
      }
    }
    starts.push(next)
    curY = next
  }
  return starts
}

function extractStylesAndBody(html: string): { styles: string; body: string } {
  const styles: string[] = []
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    styles.push(m[1])
  }
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return { styles: styles.join('\n'), body: bodyMatch?.[1] ?? html }
}

function extractCompanyName(root: HTMLElement): string {
  const partyBoxes = root.querySelectorAll('.party-box strong')
  if (partyBoxes.length >= 2) {
    const name = (partyBoxes[partyBoxes.length - 1] as HTMLElement).textContent?.trim()
    if (name) return latinizeForPdf(name)
  }
  const topbar = root.querySelector('.topbar__title') as HTMLElement | null
  return latinizeForPdf(topbar?.textContent?.trim() || 'LoftDesk')
}

/**
 * jsPDF built-in fonts (Helvetica/Times/Courier) use Latin-1 encoding.
 * Polish diacritics (Ł Ą Ę Ó Ś Ź Ż Ć Ń and lowercase) are outside that range
 * and get silently dropped. Transliterate them to nearest ASCII equivalents.
 */
function latinizeForPdf(str: string): string {
  const MAP: Record<string, string> = {
    'Ą':'A','ą':'a','Ć':'C','ć':'c','Ę':'E','ę':'e',
    'Ł':'L','ł':'l','Ń':'N','ń':'n','Ó':'O','ó':'o',
    'Ś':'S','ś':'s','Ź':'Z','ź':'z','Ż':'Z','ż':'z',
  }
  return str.replace(/[ĄąĆćĘęŁłŃńÓóŚśŹźŻż]/g, c => MAP[c] ?? c)
}

/**
 * Preprocess <ol> lists before html2canvas rendering.
 *
 * html2canvas renders the CSS `::marker` counter for <ol> items WITHOUT
 * the decimal period (renders "2" instead of "2.") and sometimes without
 * the space gap, merging the number with the text.
 *
 * Fix: remove the default list-style, inject an explicit <span>N.&nbsp;</span>
 * at the start of each <li>. Real DOM text nodes → 100% reliable rendering.
 */
function preprocessListNumbers(root: HTMLElement): void {
  for (const ol of Array.from(root.querySelectorAll('ol'))) {
    const olEl = ol as HTMLElement
    const startAttr = olEl.getAttribute('start')
    let n = startAttr ? parseInt(startAttr, 10) : 1
    olEl.style.listStyle = 'none'
    olEl.style.paddingLeft = '0'
    for (const li of Array.from(ol.querySelectorAll(':scope > li'))) {
      const liEl = li as HTMLElement
      liEl.style.paddingLeft = '28px'
      liEl.style.position = 'relative'
      const numSpan = document.createElement('span')
      numSpan.textContent = `${n}.\u00a0`
      numSpan.style.cssText =
        'position:absolute;left:0;width:24px;font-weight:600;color:#0F172A;'
      liEl.prepend(numSpan)
      n++
    }
  }
}

export async function generatePdfBlob(html: string): Promise<Blob> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const { styles, body } = extractStylesAndBody(html)

  // Inject document styles + hide CSS footer (we draw it per-page via jsPDF)
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-loftdesk-pdf-tmp', '1')
  styleEl.textContent = styles + '\n[data-loftdesk-pdf-tmp] .footer { display: none !important; }'
  document.head.appendChild(styleEl)

  // Off-screen container — must be in real DOM for html2canvas to render
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
    // Wait two frames so browser fully lays out the injected content
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    const target = (wrapper.querySelector('.doc') as HTMLElement | null) ?? wrapper

    // Fix: inject explicit list number spans (html2canvas renders ::marker without period/space)
    preprocessListNumbers(target)

    // Extra frame for browser to re-layout after DOM mutation
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const totalHPx = target.offsetHeight

    // Measure avoid-break blocks using offsetTop (layout-based, viewport-independent)
    const blocks = collectBlocks(target)
    const companyName = extractCompanyName(target)

    // 1 px = A4_W_MM / RENDER_WIDTH_PX mm (rendering at exactly RENDER_WIDTH_PX wide)
    const PX_PER_MM = RENDER_WIDTH_PX / A4_W_MM   // ≈ 4.286 px/mm
    const pxPerPage = Math.round(USABLE_H_MM * PX_PER_MM)

    const pageStartsPx = buildPageStartsPx(totalHPx, blocks, pxPerPage)

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    // Document total height in mm (A4 width = 210mm, scaled by aspect ratio)
    const imgW = A4_W_MM
    const imgH = (canvas.height / canvas.width) * imgW

    // Conversion: CSS px → mm for the rendered image
    const pxToMm = imgH / totalHPx

    const totalPages = pageStartsPx.length
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage()

      const startMm = pageStartsPx[page] * pxToMm
      const endMm   = page + 1 < totalPages ? pageStartsPx[page + 1] * pxToMm : imgH

      // Pages 2+ get a top margin so headings don't start at the very edge
      const topMarginMm = page > 0 ? PAGE_TOP_MARGIN_MM : 0

      // Shift the full-document image so [startMm .. endMm] is visible below the top margin
      pdf.addImage(dataUrl, 'JPEG', 0, topMarginMm - startMm, imgW, imgH)

      // White mask over the top margin area (clean separation from previous page)
      if (topMarginMm > 0) {
        pdf.setFillColor(255, 255, 255)
        pdf.rect(0, 0, imgW, topMarginMm, 'F')
      }

      // White mask: cover the gap between content end and footer bar
      const contentBottom = topMarginMm + (endMm - startMm)
      const gapMm = A4_H_MM - FOOTER_H_MM - contentBottom
      if (gapMm > 0.5) {
        pdf.setFillColor(255, 255, 255)
        pdf.rect(0, contentBottom, imgW, gapMm + 0.5, 'F')
      }

      // Green footer bar
      const footerY = A4_H_MM - FOOTER_H_MM
      pdf.setFillColor(FOOTER_RGB.r, FOOTER_RGB.g, FOOTER_RGB.b)
      pdf.rect(0, footerY, imgW, FOOTER_H_MM, 'F')

      // Footer text: company name centred + page number right
      const textY = footerY + FOOTER_H_MM / 2 + 1.5
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.text(companyName, imgW / 2, textY, { align: 'center' })
      pdf.text(`${page + 1} / ${totalPages}`, imgW - 8, textY, { align: 'right' })
    }

    return pdf.output('blob')
  } finally {
    if (wrapper.parentNode) document.body.removeChild(wrapper)
    if (styleEl.parentNode) document.head.removeChild(styleEl)
  }
}
