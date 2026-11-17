export const MAX_RESUME_BYTES = 1_900_000

export function resumeFileError(file: File): string | null {
  const name = file.name.toLowerCase()
  if (!name.endsWith('.pdf') && !name.endsWith('.docx')) return 'Upload your resume as a PDF or Word (.docx) file.'
  if (file.size > MAX_RESUME_BYTES) return 'Choose a resume file under 1.9 MB.'
  return null
}

// Text is pulled out in the browser so the server never has to parse documents.
export async function extractResumeText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  if (file.name.toLowerCase().endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    return result.value.trim()
  }

  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await task.promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items) {
      if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ')
    }
    pages.push(text)
  }
  await task.destroy()
  return pages.join('\n').replace(/[ \t]+/g, ' ').trim()
}
