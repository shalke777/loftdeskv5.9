/**
 * Client-side PDF generator.
 * Converts a full HTML document string (as produced by documentPreview.ts builders)
 * into a real binary PDF Blob (MIME: application/pdf) via html2canvas + jsPDF.
 *
 * Flow:
 *   HTML string → extract <style> + <body> → mount off-screen div in main DOM
 *   → html2canvas renders the .doc element to canvas
 *   → jsPDF slices canvas into A4 pages
 *   → returns Blob({ type: 'application/pdf' })
 *
 * This function never calls window.print() and never opens a new tab.
 */

const A4_W_MM = 210
const A4_H_MM = 297
/** Width in px used for the off-screen render container — matches the .doc fixed width */
const RENDER_WIDTH_PX = 900

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

export async function generatePdfBlob(html: string): Promise<Blob> {
  // Lazy-load heavy deps so they don't bloat the initial bundle
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const { styles, body } = extractStylesAndBody(html)

  // Temporarily inject the document styles into the main page head
  // so they apply to our off-screen container (which lives in the main DOM).
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-loftdesk-pdf-tmp', '1')
  styleEl.textContent = styles
  document.head.appendChild(styleEl)

  // Mount off-screen container. Must be attached to the real DOM for html2canvas.
  // Use absolute positioning far left so it's invisible but fully laid-out.
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

    // Target the main .doc container if present (gives cleaner output than full body)
    const target = (wrapper.querySelector('.doc') as HTMLElement | null) ?? wrapper

    const canvas = await html2canvas(target, {
      scale: 2,           // 2× for crisp text / retina quality
      useCORS: true,      // allow cross-origin images (company logos)
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    // --- Build multi-page A4 PDF ---
    // Strategy: the entire document is one tall image; we slice it into A4 pages.
    const imgW = A4_W_MM
    const imgH = (canvas.height / canvas.width) * imgW

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    // Each page shows a A4_H_MM-tall window of the full image.
    // addImage with a negative Y offset shifts the image up, revealing the next slice.
    let yOffset = 0
    for (let page = 0; ; page++) {
      if (page > 0) pdf.addPage()
      pdf.addImage(dataUrl, 'JPEG', 0, -yOffset, imgW, imgH)
      yOffset += A4_H_MM
      if (yOffset >= imgH) break
    }

    return pdf.output('blob')
  } finally {
    // Always clean up – even on error
    if (wrapper.parentNode) document.body.removeChild(wrapper)
    if (styleEl.parentNode) document.head.removeChild(styleEl)
  }
}
