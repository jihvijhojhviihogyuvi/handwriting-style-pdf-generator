/**
 * Pure TypeScript Multi-Page PDF 1.4 Binary Compiler
 *
 * Embeds high-DPI rendered handwriting canvases as full-bleed DCTDecode (JPEG)
 * XObjects into a standards-compliant printable PDF document.
 *
 * Everything here is dependency-free and synchronous: no jsPDF, no worker, no
 * network round-trip. The same module is exercised by `tests/pdf-builder.test.ts`,
 * which validates the generated cross-reference table byte offsets.
 */

export type PdfPageSize = 'letter' | 'a4'

export interface PdfExportOptions {
  pageSize?: PdfPageSize
  quality?: number
  title?: string
  author?: string
}

/** Physical page dimensions in PostScript points (1pt = 1/72in). */
export const PDF_PAGE_SIZES: Record<PdfPageSize, { widthPt: number; heightPt: number }> = {
  letter: { widthPt: 612, heightPt: 792 },
  a4: { widthPt: 595.28, heightPt: 841.89 },
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64Index = dataUrl.indexOf(';base64,')
  if (base64Index === -1) {
    throw new Error('Invalid image data URL: expected a base64 payload')
  }
  const base64 = dataUrl.substring(base64Index + 8)
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/** Escapes the reserved characters of a PDF literal string. */
function pdfString(value: string): string {
  return `(${value.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[\r\n]/g, ' ')})`
}

function pdfDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

export function buildPdfFromCanvases(
  canvases: HTMLCanvasElement[],
  options: PdfExportOptions = {}
): Blob {
  if (!canvases || canvases.length === 0) {
    throw new Error('Cannot build a PDF without at least one rendered page')
  }

  const pageSize = options.pageSize ?? 'letter'
  const { widthPt: pageWidthPt, heightPt: pageHeightPt } = PDF_PAGE_SIZES[pageSize]
  const quality = Math.min(1, Math.max(0.4, options.quality ?? 0.94))
  const now = new Date()

  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  let byteOffset = 0
  const offsets: number[] = [0] // 1-indexed object byte offsets

  const pushString = (str: string) => {
    const bytes = encoder.encode(str)
    chunks.push(bytes)
    byteOffset += bytes.byteLength
  }

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes)
    byteOffset += bytes.byteLength
  }

  const numPages = canvases.length
  const infoObjId = 3 + numPages * 3
  const totalObjects = 2 + numPages * 3 + 1

  // PDF Header. The high-bit comment marks the file as binary for transfer agents.
  pushString('%PDF-1.4\n')
  pushBytes(new Uint8Array([0x25, 0xff, 0xff, 0xff, 0xff, 0x0a]))

  // Object allocation plan:
  // 1: Catalog, 2: Pages tree
  // For each page i: pageObj = 3 + i*3, contentObj = 4 + i*3, imageObj = 5 + i*3
  // Info dictionary is allocated after the pages.

  offsets[1] = byteOffset
  pushString('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  const kidsRefs = canvases.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  offsets[2] = byteOffset
  pushString(
    `2 0 obj\n<< /Type /Pages /Kids [ ${kidsRefs} ] /Count ${numPages} >>\nendobj\n`
  )

  for (let i = 0; i < numPages; i++) {
    const canvas = canvases[i]
    if (!canvas || !canvas.width || !canvas.height) {
      throw new Error(`Page ${i + 1} has not been rendered yet`)
    }
    const pageObjId = 3 + i * 3
    const contentObjId = 4 + i * 3
    const imageObjId = 5 + i * 3
    const imgName = `/Im${i + 1}`

    const jpegBytes = dataUrlToUint8Array(canvas.toDataURL('image/jpeg', quality))

    // Page object — renders the image over the full MediaBox.
    offsets[pageObjId] = byteOffset
    pushString(
      `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R ` +
        `/MediaBox [ 0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)} ] ` +
        `/Resources << /ProcSet [ /PDF /ImageC ] /XObject << ${imgName} ${imageObjId} 0 R >> >> ` +
        `/Contents ${contentObjId} 0 R >>\n` +
        `endobj\n`
    )

    // Content stream (draws the full-page high-DPI image)
    const contentStream = `q\n${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(
      2
    )} 0 0 cm\n${imgName} Do\nQ\n`
    const contentBytes = encoder.encode(contentStream)
    offsets[contentObjId] = byteOffset
    pushString(`${contentObjId} 0 obj\n<< /Length ${contentBytes.byteLength} >>\nstream\n`)
    pushBytes(contentBytes)
    pushString('\nendstream\nendobj\n')

    // Image XObject
    offsets[imageObjId] = byteOffset
    pushString(
      `${imageObjId} 0 obj\n` +
        `<< /Type /XObject /Subtype /Image ` +
        `/Width ${canvas.width} /Height ${canvas.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
        `/Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\n` +
        `stream\n`
    )
    pushBytes(jpegBytes)
    pushString('\nendstream\nendobj\n')
  }

  // Document information dictionary (title/author/producer/dates).
  offsets[infoObjId] = byteOffset
  pushString(
    `${infoObjId} 0 obj\n<< ` +
      `/Title ${pdfString(options.title ?? 'Handwritten document')} ` +
      `/Author ${pdfString(options.author ?? 'Chirograph')} ` +
      `/Creator ${pdfString('Chirograph handwriting synthesis engine')} ` +
      `/Producer ${pdfString('Chirograph PDF 1.4 writer')} ` +
      `/CreationDate ${pdfString(pdfDate(now))} ` +
      `/ModDate ${pdfString(pdfDate(now))} >>\nendobj\n`
  )

  // Cross-reference table
  const xrefOffset = byteOffset
  pushString(`xref\n0 ${totalObjects + 1}\n`)
  pushString('0000000000 65535 f \n')
  for (let objNum = 1; objNum <= totalObjects; objNum++) {
    const offset = offsets[objNum]
    if (offset === undefined) {
      throw new Error(`Internal PDF error: object ${objNum} was never written`)
    }
    pushString(`${String(offset).padStart(10, '0')} 00000 n \n`)
  }

  // Trailer
  pushString(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info ${infoObjId} 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`
  )

  return new Blob(chunks, { type: 'application/pdf' })
}

export function downloadPdfBlob(blob: Blob, filename = 'handwritten-notes.pdf') {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
