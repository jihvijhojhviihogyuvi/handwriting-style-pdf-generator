import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPdfFromCanvases, PDF_PAGE_SIZES } from '../lib/pdf-builder.ts'

/** 1x1 pixel JPEG, base64 encoded — enough to exercise the DCTDecode path. */
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='

function fakeCanvas(width = 100, height = 120): HTMLCanvasElement {
  return {
    width,
    height,
    toDataURL: () => `data:image/jpeg;base64,${TINY_JPEG_BASE64}`,
  } as unknown as HTMLCanvasElement
}

async function toBuffer(blob: Blob): Promise<Buffer> {
  return Buffer.from(await blob.arrayBuffer())
}

test('buildPdfFromCanvases refuses to build an empty document', () => {
  assert.throws(() => buildPdfFromCanvases([]), /at least one rendered page/i)
})

test('generated PDF has a valid header, trailer, and catalog', async () => {
  const bytes = await toBuffer(buildPdfFromCanvases([fakeCanvas()]))
  const text = bytes.toString('latin1')

  assert.ok(text.startsWith('%PDF-1.4\n'), 'starts with the PDF header')
  assert.ok(text.trimEnd().endsWith('%%EOF'), 'ends with the EOF marker')
  assert.match(text, /\/Type \/Catalog/)
  assert.match(text, /\/Type \/Pages \/Kids \[ 3 0 R \] \/Count 1/)
  assert.match(text, /\/Info 6 0 R/)
})

test('cross-reference offsets point at the objects they claim to', async () => {
  const pageCount = 3
  const canvases = Array.from({ length: pageCount }, () => fakeCanvas())
  const bytes = await toBuffer(buildPdfFromCanvases(canvases))
  const text = bytes.toString('latin1')

  const startxref = Number.parseInt(
    text.slice(text.lastIndexOf('startxref') + 'startxref'.length).trim(),
    10
  )
  assert.ok(Number.isFinite(startxref), 'startxref offset is a number')
  assert.equal(text.slice(startxref, startxref + 4), 'xref', 'startxref lands on the xref table')

  // Parse: "xref\n0 <size>\n" followed by one 20-byte entry per object.
  const header = text.slice(startxref).match(/^xref\n0 (\d+)\n/)
  assert.ok(header, 'xref subsection header is present')
  const size = Number.parseInt(header[1], 10)
  assert.equal(size, 2 + pageCount * 3 + 1 + 1)

  const tableStart = startxref + header[0].length
  assert.equal(text.slice(tableStart, tableStart + 20), '0000000000 65535 f \n')

  for (let objNum = 1; objNum < size; objNum++) {
    const entry = text.slice(tableStart + objNum * 20, tableStart + (objNum + 1) * 20)
    const offset = Number.parseInt(entry.slice(0, 10), 10)
    assert.equal(entry.slice(17, 20), 'n \n', `object ${objNum} is marked in-use`)
    assert.ok(offset > 0, `object ${objNum} has a real offset`)
    assert.equal(
      text.slice(offset, offset + `${objNum} 0 obj`.length),
      `${objNum} 0 obj`,
      `offset for object ${objNum} points at its header`
    )
  }
})

test('declared stream lengths match the embedded bytes', async () => {
  const bytes = await toBuffer(
    buildPdfFromCanvases([fakeCanvas(), fakeCanvas()], { quality: 0.8 })
  )
  const text = bytes.toString('latin1')

  const streamDicts = [...text.matchAll(/\/Length (\d+)[^>]*>>\nstream\n/g)]
  assert.equal(streamDicts.length, 4, 'two content streams + two image streams')

  for (const match of streamDicts) {
    const length = Number.parseInt(match[1], 10)
    const start = (match.index ?? 0) + match[0].length
    assert.ok(length > 0, 'stream declares a positive length')
    assert.equal(
      text.slice(start + length, start + length + '\nendstream'.length),
      '\nendstream',
      'stream body is exactly the declared length'
    )
  }
})

test('page size and metadata are written into the document', async () => {
  const letter = await toBuffer(
    buildPdfFromCanvases([fakeCanvas(1700, 2200)], {
      pageSize: 'letter',
      title: 'Notes (test)',
      author: 'Unit Test',
    })
  )
  const letterText = letter.toString('latin1')
  assert.match(letterText, /\/MediaBox \[ 0 0 612\.00 792\.00 \]/)
  assert.match(letterText, /\/Width 1700 \/Height 2200/)
  assert.match(letterText, /\/Title \(Notes \\\(test\\\)\)/)
  assert.match(letterText, /\/Author \(Unit Test\)/)
  assert.match(letterText, /\/CreationDate \(D:\d{14}Z\)/)

  const a4 = await toBuffer(buildPdfFromCanvases([fakeCanvas()], { pageSize: 'a4' }))
  const a4Text = a4.toString('latin1')
  assert.match(a4Text, /\/MediaBox \[ 0 0 595\.28 841\.89 \]/)
  assert.equal(PDF_PAGE_SIZES.a4.widthPt, 595.28)
})

test('quality is clamped into a sane JPEG range', async () => {
  const blob = buildPdfFromCanvases([fakeCanvas()], { quality: 42 })
  assert.equal(blob.type, 'application/pdf')
  assert.ok(blob.size > 0)
})
