import type { PDFFont, PDFPage } from 'pdf-lib'

// Document text format (written by the jobpot-resume-cover-letter skill):
//   # Name            ## Section heading      ### Role or subheading
//   - Bullet          blank line = paragraph break      anything else = body text

const PAGE = { width: 612, height: 792, margin: 54 }
const INK = { r: 0.094, g: 0.129, b: 0.239 }
const MUTED = { r: 0.35, g: 0.38, b: 0.48 }
const WIN_ANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'

// The built-in PDF fonts only cover Western characters; swap or drop anything else so the PDF can't fail to build.
function clean(text: string) {
  return [...text.replace(/\*\*|__/g, '').replace(/→/g, '->').replace(/[\u2010-\u2012]/g, '-')]
    .map((ch) => {
      if (ch.charCodeAt(0) < 256 || WIN_ANSI_EXTRAS.includes(ch)) return ch
      const plain = ch.normalize('NFKD').replace(/[^\x20-\x7e]/g, '')
      return plain
    })
    .join('')
    .replace(/\t/g, ' ')
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function documentPdf(content: string, title: string): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  doc.setCreator('Jobpot')
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const width = PAGE.width - PAGE.margin * 2
  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - PAGE.margin

  function ensure(height: number) {
    if (y - height < PAGE.margin) {
      page = doc.addPage([PAGE.width, PAGE.height])
      y = PAGE.height - PAGE.margin
    }
  }

  function text(lines: string[], opts: { font: PDFFont; size: number; x?: number; color?: typeof INK; gap?: number }) {
    const leading = opts.size * 1.32
    const color = opts.color ?? INK
    for (const line of lines) {
      ensure(leading)
      y -= leading
      page.drawText(line, { x: opts.x ?? PAGE.margin, y: y + opts.size * 0.25, size: opts.size, font: opts.font, color: rgb(color.r, color.g, color.b) })
    }
    y -= opts.gap ?? 0
  }

  let afterName = false
  for (const raw of clean(content).split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      y -= 6
      continue
    }
    if (line.startsWith('# ')) {
      text(wrap(line.slice(2), bold, 20, width), { font: bold, size: 20, gap: 2 })
      afterName = true
      continue
    }
    if (afterName) {
      text(wrap(line.trim(), regular, 9.5, width), { font: regular, size: 9.5, color: MUTED, gap: 6 })
      afterName = false
      continue
    }
    if (line.startsWith('## ')) {
      ensure(30)
      y -= 8
      text(wrap(line.slice(3), bold, 11.5, width), { font: bold, size: 11.5, gap: 2 })
      page.drawLine({
        start: { x: PAGE.margin, y: y + 1 },
        end: { x: PAGE.width - PAGE.margin, y: y + 1 },
        thickness: 0.75,
        color: rgb(0.8, 0.83, 0.88),
      })
      y -= 4
      continue
    }
    if (line.startsWith('### ')) {
      ensure(24)
      y -= 3
      text(wrap(line.slice(4), bold, 10.5, width), { font: bold, size: 10.5 })
      continue
    }
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/)
    if (bullet) {
      const indent = 12
      const lines = wrap(bullet[1], regular, 10, width - indent)
      ensure(13.2)
      page.drawText('•', { x: PAGE.margin + 2, y: y - 13.2 + 2.5, size: 10, font: regular, color: rgb(INK.r, INK.g, INK.b) })
      text(lines, { font: regular, size: 10, x: PAGE.margin + indent, gap: 1 })
      continue
    }
    text(wrap(line.trim(), regular, 10, width), { font: regular, size: 10, gap: 1 })
  }

  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export function documentFileName(name: string, company: string, kind: 'resume' | 'cover_letter') {
  const slug = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
  return `${slug(name) || 'Resume'}-${kind === 'resume' ? 'Resume' : 'Cover-Letter'}-${slug(company)}.pdf`
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
