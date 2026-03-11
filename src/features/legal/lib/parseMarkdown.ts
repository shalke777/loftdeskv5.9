/**
 * Very small subset of Markdown → safe HTML.
 * Only handles the constructs appearing in LoftDesk legal documents.
 * No external dependencies needed.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function parseMarkdown(raw: string): string {
  const lines = raw.split('\n')
  const out: string[] = []
  let inList = false
  let listTag = ''

  const closeList = () => {
    if (inList) {
      out.push(`</${listTag}>`)
      inList = false
      listTag = ''
    }
  }

  const inline = (text: string): string => {
    // Bold+italic ***
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold **
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic *
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Inline code `
    text = text.replace(/`(.+?)`/g, '<code>$1</code>')
    // Links [label](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    return text
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // Heading 4 ####
    if (/^#### /.test(line)) {
      closeList()
      out.push(`<h4>${inline(escapeHtml(line.replace(/^#### /, '')))}</h4>`)
      continue
    }
    // Heading 3 ###
    if (/^### /.test(line)) {
      closeList()
      out.push(`<h3>${inline(escapeHtml(line.replace(/^### /, '')))}</h3>`)
      continue
    }
    // Heading 2 ##
    if (/^## /.test(line)) {
      closeList()
      out.push(`<h2>${inline(escapeHtml(line.replace(/^## /, '')))}</h2>`)
      continue
    }
    // Heading 1 #
    if (/^# /.test(line)) {
      closeList()
      out.push(`<h1>${inline(escapeHtml(line.replace(/^# /, '')))}</h1>`)
      continue
    }
    // Horizontal rule ---
    if (/^[-*_]{3,}$/.test(line.trim())) {
      closeList()
      out.push('<hr />')
      continue
    }
    // Unordered list  - or *
    if (/^[*-] /.test(line)) {
      if (!inList || listTag !== 'ul') {
        closeList()
        out.push('<ul>')
        inList = true
        listTag = 'ul'
      }
      out.push(`<li>${inline(escapeHtml(line.replace(/^[*-] /, '')))}</li>`)
      continue
    }
    // Ordered list  1.
    if (/^\d+\. /.test(line)) {
      if (!inList || listTag !== 'ol') {
        closeList()
        out.push('<ol>')
        inList = true
        listTag = 'ol'
      }
      out.push(`<li>${inline(escapeHtml(line.replace(/^\d+\. /, '')))}</li>`)
      continue
    }
    // Blank line
    if (line.trim() === '') {
      closeList()
      out.push('<br />')
      continue
    }
    // Blockquote >
    if (/^> /.test(line)) {
      closeList()
      out.push(`<blockquote>${inline(escapeHtml(line.replace(/^> /, '')))}</blockquote>`)
      continue
    }
    // Regular paragraph line
    closeList()
    out.push(`<p>${inline(escapeHtml(line))}</p>`)
  }

  closeList()
  return out.join('\n')
}
