/**
 * Realistic Human Writing Mistake & Cross-Out Synthesis Engine
 *
 * Generates authentic false starts, letter transpositions, abandoned words,
 * and interlinear caret (^) superscript corrections, and renders 5 distinct
 * multi-pass ballpoint scratch-out physics styles over the mistaken handwritten glyphs.
 */

import { InkPalette } from './allograph-engine'

export type ScratchStyle =
  | 'dense-zigzag'
  | 'double-slash'
  | 'triple-scratch'
  | 'diagonal-scribble'
  | 'heavy-wave'

export type MistakeKind =
  | 'false-start'
  | 'typo-slip'
  | 'word-restart'
  | 'caret-insert'
  | 'manual-strike'

export interface GeneratedMistake {
  id: string
  mistakenText: string
  intendedWord: string
  kind: MistakeKind
  scratchStyle: ScratchStyle
  isCaretSuperscript: boolean
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

const COMMON_PHONETIC_SLIPS: Record<string, string[]> = {
  because: ['becu', 'beacuse', 'becas'],
  different: ['diffrent', 'diffr', 'difer'],
  something: ['somth', 'somthing', 'soem'],
  everything: ['everyth', 'evryth', 'evert'],
  important: ['impot', 'impor', 'imprt'],
  through: ['thorugh', 'thrugh', 'throu'],
  thought: ['thoght', 'thoug', 'thot'],
  actually: ['actully', 'actu', 'acutally'],
  definitely: ['definately', 'defint', 'defn'],
  probably: ['probaly', 'probly', 'porb'],
  remember: ['rember', 'remeber', 'remem'],
  together: ['togehter', 'togeth', 'toeg'],
  between: ['betwen', 'bewteen', 'betw'],
  without: ['wihtout', 'witho', 'wtih'],
  writing: ['writting', 'wrt', 'writn'],
  handwriting: ['handwr', 'handrit', 'hnad'],
  sentence: ['snetence', 'sentance', 'sentn'],
  separate: ['seperate', 'sepr', 'separ'],
  receive: ['recieve', 'recev', 'reciv'],
  believe: ['beleive', 'beliv', 'belev'],
  always: ['alwyas', 'alwa', 'allways'],
  really: ['realy', 'raelly', 'relly'],
  before: ['befor', 'beofre', 'bfore'],
  should: ['shoud', 'shuold', 'shold'],
  would: ['woud', 'wuold', 'wld'],
  could: ['coud', 'cuold', 'cld'],
  people: ['poeple', 'peop', 'pepel'],
  another: ['antoher', 'anoth', 'anthr'],
  however: ['howver', 'howev', 'hwoever'],
  question: ['qeustion', 'questn', 'qust'],
}

const RESTART_WORDS = ['the', 'that', 'with', 'from', 'when', 'what', 'for', 'and', 'this']

const SCRATCH_STYLES: ScratchStyle[] = [
  'double-slash',
  'dense-zigzag',
  'triple-scratch',
  'diagonal-scribble',
  'heavy-wave',
]

export function synthesizeMistakenText(
  cleanWord: string,
  seed: number
): { mistakenText: string; kind: MistakeKind; isCaretSuperscript: boolean } {
  const lower = cleanWord.toLowerCase().replace(/[^a-z]/g, '')
  const r1 = seededRandom(seed + 11)
  const r2 = seededRandom(seed + 29)
  const r3 = seededRandom(seed + 47)

  if (COMMON_PHONETIC_SLIPS[lower] && r1 < 0.72) {
    const list = COMMON_PHONETIC_SLIPS[lower]
    let picked = list[Math.floor(r2 * list.length)]
    if (cleanWord[0] >= 'A' && cleanWord[0] <= 'Z') {
      picked = picked[0].toUpperCase() + picked.slice(1)
    }
    return {
      mistakenText: picked,
      kind: picked.length < lower.length - 1 ? 'false-start' : 'typo-slip',
      isCaretSuperscript: r3 < 0.15 && cleanWord.length <= 8,
    }
  }

  if (lower.length >= 5 && r1 < 0.55) {
    const cutLen = Math.max(2, Math.min(5, Math.floor(lower.length * (0.42 + r2 * 0.28))))
    let part = cleanWord.slice(0, cutLen)
    if (r3 > 0.45 && part.length >= 3) {
      const wrongEnd = 'aeiorstnlc'[Math.floor(r2 * 10)]
      part = part.slice(0, -1) + wrongEnd
    }
    return {
      mistakenText: part,
      kind: 'false-start',
      isCaretSuperscript: false,
    }
  }

  if (lower.length >= 4 && r1 < 0.84) {
    const idx = Math.max(1, Math.min(cleanWord.length - 2, Math.floor(r2 * (cleanWord.length - 2)) + 1))
    const chars = cleanWord.split('')
    const tmp = chars[idx]
    chars[idx] = chars[idx + 1]
    chars[idx + 1] = tmp
    const swapped = chars.join('').slice(0, Math.max(3, cleanWord.length - (r3 > 0.5 ? 1 : 0)))
    return {
      mistakenText: swapped === cleanWord ? cleanWord.slice(0, -1) : swapped,
      kind: 'typo-slip',
      isCaretSuperscript: r3 < 0.18 && cleanWord.length <= 8,
    }
  }

  const restart = RESTART_WORDS[Math.floor(r2 * RESTART_WORDS.length)]
  return {
    mistakenText: restart === lower ? lower.slice(0, 2) : restart,
    kind: 'word-restart',
    isCaretSuperscript: r3 < 0.18 && cleanWord.length <= 7,
  }
}

export function pickScratchStyle(seed: number, lastStyle?: ScratchStyle): ScratchStyle {
  const idx = Math.floor(seededRandom(seed + 73) * SCRATCH_STYLES.length)
  let picked = SCRATCH_STYLES[idx]
  if (picked === lastStyle) {
    picked = SCRATCH_STYLES[(idx + 1 + Math.floor(seededRandom(seed + 91) * 3)) % SCRATCH_STYLES.length]
  }
  return picked
}

/**
 * Draws an authentic multi-pass ballpoint scratch-out directly over the rendered mistaken word.
 */
export function renderScratchOutOverlay(
  ctx: CanvasRenderingContext2D,
  xStart: number,
  yBaseline: number,
  width: number,
  xHeight: number,
  wordTiltRad: number,
  style: ScratchStyle,
  palette: InkPalette,
  seed: number
) {
  ctx.save()
  ctx.translate(xStart, yBaseline)
  ctx.rotate(wordTiltRad)

  const [r, g, b] = palette.rgb
  const [pr, pg, pb] = palette.poolRgb
  const midY = -xHeight * 0.42
  const padLeft = -xHeight * 0.1
  const padRight = width + xHeight * 0.16
  const spanW = padRight - padLeft
  const baseLineW = Math.max(1.8, xHeight * 0.095)

  const drawOrganicSegment = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    wScale: number,
    alphaScale: number,
    curveBow: number
  ) => {
    const cx = (x0 + x1) * 0.5 + curveBow * 0.25
    const cy = (y0 + y1) * 0.5 + curveBow
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(cx, cy, x1, y1)
    const alpha = Math.min(0.98, palette.wetAlpha * alphaScale)
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
    ctx.lineWidth = baseLineW * wScale
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  if (style === 'dense-zigzag') {
    // Tight horizontal/diagonal zig-zag scratch right through the middle x-height
    const oscillations = Math.max(7, Math.min(15, Math.round(spanW / (xHeight * 0.24))))
    let prevX = padLeft
    let prevY = midY + xHeight * 0.18

    for (let i = 1; i <= oscillations; i++) {
      const t = i / oscillations
      const jitterX = (seededRandom(seed + i * 17) - 0.5) * (xHeight * 0.1)
      const jitterY = (seededRandom(seed + i * 31) - 0.5) * (xHeight * 0.12)
      const isTop = i % 2 === 1
      const amp = xHeight * (0.32 + 0.12 * Math.sin(t * Math.PI))
      const nextX = padLeft + spanW * t + (isTop ? xHeight * 0.14 : -xHeight * 0.04) + jitterX
      const nextY = midY + (isTop ? -amp : amp * 0.85) + jitterY

      drawOrganicSegment(
        prevX,
        prevY,
        nextX,
        nextY,
        0.92 + 0.22 * seededRandom(seed + i * 7),
        0.9 + 0.08 * seededRandom(seed + i * 13),
        isTop ? -1.2 : 1.2
      )

      prevX = nextX
      prevY = nextY
    }
  } else if (style === 'double-slash') {
    // Two quick, non-parallel horizontal/diagonal ballpoint slashes
    const y1Start = midY - xHeight * (0.1 + 0.08 * seededRandom(seed + 3))
    const y1End = midY - xHeight * (0.24 + 0.12 * seededRandom(seed + 5))
    const y2Start = midY + xHeight * (0.14 + 0.08 * seededRandom(seed + 7))
    const y2End = midY + xHeight * (0.02 - 0.12 * seededRandom(seed + 11))

    drawOrganicSegment(padLeft, y1Start, padRight, y1End, 1.15, 0.96, -xHeight * 0.09)
    drawOrganicSegment(padRight, y1End, padLeft + xHeight * 0.08, y2Start, 0.58, 0.48, xHeight * 0.05)
    drawOrganicSegment(padLeft + xHeight * 0.04, y2Start, padRight + xHeight * 0.06, y2End, 1.18, 0.96, -xHeight * 0.07)
  } else if (style === 'triple-scratch') {
    // Three rapid back-and-forth horizontal strike-throughs (L->R, R->L, L->R)
    const p1Y0 = midY - xHeight * 0.18
    const p1Y1 = midY - xHeight * 0.26
    const p2Y1 = midY + xHeight * 0.03
    const p3Y1 = midY + xHeight * 0.18

    drawOrganicSegment(padLeft, p1Y0, padRight, p1Y1, 1.08, 0.95, -xHeight * 0.07)
    drawOrganicSegment(padRight, p1Y1, padLeft - 2, p2Y1, 1.0, 0.88, xHeight * 0.04)
    drawOrganicSegment(padLeft - 2, p2Y1, padRight + 3, p3Y1, 1.14, 0.96, -xHeight * 0.08)

    ctx.beginPath()
    ctx.arc(padRight, p1Y1, baseLineW * 0.55, 0, Math.PI * 2)
    ctx.arc(padLeft - 2, p2Y1, baseLineW * 0.55, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, 0.45)`
    ctx.fill()
  } else if (style === 'diagonal-scribble') {
    // Series of rapid angled forward slashes (/ / / /) connected by light return strokes
    const slashes = Math.max(4, Math.min(9, Math.round(spanW / (xHeight * 0.35))))
    let curX = padLeft
    for (let s = 0; s < slashes; s++) {
      const t = s / slashes
      const sX0 = padLeft + spanW * t - xHeight * 0.06
      const sY0 = midY + xHeight * (0.28 + (seededRandom(seed + s * 11) - 0.5) * 0.12)
      const sX1 = sX0 + xHeight * (0.38 + seededRandom(seed + s * 19) * 0.14)
      const sY1 = midY - xHeight * (0.34 + (seededRandom(seed + s * 23) - 0.5) * 0.14)

      if (s > 0) {
        drawOrganicSegment(curX, midY - xHeight * 0.3, sX0, sY0, 0.65, 0.55, 1.0)
      }
      drawOrganicSegment(sX0, sY0, sX1, sY1, 1.12, 0.95, -1.2)
      curX = sX1
    }
    // plus one horizontal strike across the middle
    drawOrganicSegment(padLeft, midY + 1, padRight, midY - 3, 1.05, 0.92, -2)
  } else {
    // 'heavy-wave': impatient wavy strike + second horizontal slash
    const segments = 6
    let lx = padLeft
    let ly = midY + xHeight * 0.06
    for (let i = 1; i <= segments; i++) {
      const t = i / segments
      const nx = padLeft + spanW * t
      const ny =
        midY +
        (i % 2 === 0 ? xHeight * 0.18 : -xHeight * 0.2) +
        (seededRandom(seed + i * 19) - 0.5) * 3
      drawOrganicSegment(lx, ly, nx, ny, 1.18, 0.96, 1.2)
      lx = nx
      ly = ny
    }
    drawOrganicSegment(
      padLeft + 2,
      midY - xHeight * 0.04,
      padRight + 2,
      midY - xHeight * 0.15,
      1.04,
      0.92,
      -xHeight * 0.06
    )
  }

  ctx.restore()
}

export function renderHandwrittenCaret(
  ctx: CanvasRenderingContext2D,
  xCenter: number,
  yBaseline: number,
  xHeight: number,
  palette: InkPalette,
  seed: number
) {
  const [r, g, b] = palette.rgb
  const halfW = xHeight * 0.25
  const peakH = xHeight * 0.34
  const tilt = (seededRandom(seed + 5) - 0.4) * 2.5

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(xCenter - halfW, yBaseline + xHeight * 0.1)
  ctx.quadraticCurveTo(
    xCenter + tilt * 0.5,
    yBaseline - peakH * 0.6,
    xCenter + tilt,
    yBaseline - peakH
  )
  ctx.lineTo(xCenter + halfW + tilt * 0.4, yBaseline + xHeight * 0.08)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${palette.wetAlpha})`
  ctx.lineWidth = Math.max(1.6, xHeight * 0.085)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
}
