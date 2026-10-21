/**
 * Pure TypeScript Multi-Page PDF 1.4 Binary Compiler
 * Embeds high-DPI rendered handwriting canvases as full-bleed DCTDecode (JPEG) XObjects
 * into a standards-compliant printable PDF document (US Letter 612x792 pt or A4 595.28x841.89 pt).
 */

export interface PdfExportOptions {
  pageSize: 'letter' | 'a4'
  quality?: number
  filename?: string
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64Index = dataUrl.indexOf(';base64,')
  if (base64Index === -1) {
    throw new Error('Invalid image data URL')
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

export function buildPdfFromCanvases(
  canvases: HTMLCanvasElement[],
  options: PdfExportOptions = { pageSize: 'letter', quality: 0.95 }
): Blob {
  const pageWidthPt = options.pageSize === 'a4' ? 595.28 : 612
  const pageHeightPt = options.pageSize === 'a4' ? 841.89 : 792
  const quality = options.quality ?? 0.95

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

  // PDF Header with binary comment marker
  pushString('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')

  const numPages = canvases.length
  // Object allocation plan:
  // 1: Catalog
  // 2: Pages tree
  // For each page i (0 .. numPages - 1):
  //   pageObjId  = 3 + i * 3
  //   contentId  = 4 + i * 3
  //   imageObjId = 5 + i * 3

  // Obj 1: Catalog
  offsets[1] = byteOffset
  pushString('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  // Obj 2: Pages
  const kidsRefs = canvases.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  offsets[2] = byteOffset
  pushString(
    `2 0 obj\n<< /Type /Pages /Kids [ ${kidsRefs} ] /Count ${numPages} >>\nendobj\n`
  )

  for (let i = 0; i < numPages; i++) {
    const canvas = canvases[i]
    const pageObjId = 3 + i * 3
    const contentObjId = 4 + i * 3
    const imageObjId = 5 + i * 3
    const imgName = `/Im${i + 1}`

    const jpegDataUrl = canvas.toDataURL('image/jpeg', quality)
    const jpegBytes = dataUrlToUint8Array(jpegDataUrl)

    // Page Object
    offsets[pageObjId] = byteOffset
    pushString(
      `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R ` +
        `/MediaBox [ 0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)} ] ` +
        `/Resources << /ProcSet [ /PDF /ImageC ] /XObject << ${imgName} ${imageObjId} 0 R >> >> ` +
        `/Contents ${contentObjId} 0 R >>\n` +
        `endobj\n`
    )

    // Content Stream (draws the full-page high-DPI image)
    const contentStream = `q\n${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(2)} 0 0 cm\n${imgName} Do\nQ\n`
    const contentBytes = encoder.encode(contentStream)
    offsets[contentObjId] = byteOffset
    pushString(
      `${contentObjId} 0 obj\n<< /Length ${contentBytes.byteLength} >>\nstream\n`
    )
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

  // Cross-reference table (xref)
  const totalObjects = 2 + numPages * 3
  const xrefOffset = byteOffset
  pushString(`xref\n0 ${totalObjects + 1}\n`)
  pushString('0000000000 65535 f \n')
  for (let objNum = 1; objNum <= totalObjects; objNum++) {
    const padded = String(offsets[objNum]).padStart(10, '0')
    pushString(`${padded} 00000 n \n`)
  }

  // Trailer
  pushString(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  )

  return new Blob(chunks, { type: 'application/pdf' })
}

export function downloadPdfBlob(blob: Blob, filename = 'handwritten-notes.pdf') {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
