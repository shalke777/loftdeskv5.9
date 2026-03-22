/**
 * Download or share a Blob file.
 *
 * On iOS/Android (Capacitor native): <a download> is ignored by WKWebView.
 * Instead we write the file to the device cache directory via Capacitor
 * Filesystem and then open the iOS share sheet via Capacitor Share.
 *
 * On web / PWA: standard anchor-with-blob approach.
 */
export async function downloadBlob(filename: string, blob: Blob): Promise<void> {
  // Keep legacy sync callers working — the async path is transparent to callers
  // that don't await (fire-and-forget).
  const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.())

  if (isNative) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')

      // Convert Blob → base64 string
      const base64 = await blobToBase64(blob)

      // Write to cache directory
      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      })

      // Resolve the file URI (needed for Share)
      const { uri } = await Filesystem.getUri({
        path: filename,
        directory: Directory.Cache,
      })

      await Share.share({ title: filename, url: uri, dialogTitle: 'Zapisz lub udostępnij plik' })
    } catch (err) {
      console.error('[LoftDesk] Native share failed — falling back to blob download', err)
      _webDownload(filename, blob)
    }
    return
  }

  _webDownload(filename, blob)
}

function _webDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // result is "data:mime/type;base64,<data>" — strip prefix for Capacitor
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function ascii(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()\\]/g, '')
}

export function createSimplePdfBlob(title: string, body: string) {
  const chunked = body.match(/.{1,90}(\s|$)/g)?.map((line) => line.trim()).filter(Boolean) ?? []
  const lines = [title, '', ...chunked].slice(0, 40)
  let content = 'BT\n/F1 16 Tf\n50 780 Td\n'
  lines.forEach((line, index) => {
    const safe = ascii(line)
    content += `${index === 0 ? '' : '0 -18 Td\n'}(${safe}) Tj\n`
  })
  content += 'ET'
  const stream = content
  const objs = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objs) {
    offsets.push(pdf.length)
    pdf += obj + '\n'
  }
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}
