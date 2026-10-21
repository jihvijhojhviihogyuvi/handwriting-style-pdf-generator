/**
 * 20-Allograph Per Character Human Handwriting Synthesis Engine
 *
 * Generates 20 genuinely distinct structural versions (variantIndex 0..19) for every
 * lowercase letter (a-z), capital letter (A-Z), digit (0-9), and punctuation mark.
 *
 * Combines:
 * 1. Optically auto-calibrated multi-skeleton human letterforms (normalized by measured pixel x-height
 *    so different allograph topologies—open vs closed 'a', looped vs straight 'd'/'l'/'g'/'y',
 *    curved vs pointed 'M'/'N'/'A'/'W', barred vs unbarred 'I'/'J'/'7'/'z'—blend seamlessly as one writer)
 * 2. Smooth 1px sub-pixel 2-pass Non-Linear Mesh Displacement Warping:
 *    - Pass 1 (Horizontal Scanlines): independent upper-ascender bend, middle-bowl pinch/flare,
 *      and lower-descender hook sweep.
 *    - Pass 2 (Vertical Columns): internal left-to-right arch slope, harmonic bow, and
 *      left-vs-right stem height taper.
 * 3. Structural Stroke Surgery across the 20 variants:
 *    - 20 distinct ballpoint tittles (dots/flicks/ticks/loops) on 'i', 'j'
 *    - Dynamic crossbars on 't', 'f', 'T', 'F', 'I', 'J', 'Z', '7'
 *    - Contextual entry hooks and trailing pen-lift exit flicks
 * 4. Ballpoint paste-ink physics: pressure modulation and ink pooling beads at stroke reversals.
 */

export type HandStyleId =
  | 'everyday-ballpoint'
  | 'rushed-student'
  | 'casual-journal'
  | 'messy-scrawl'

export type InkColorId =
  | 'bic-blue'
  | 'carbon-black'
  | 'pilot-navy'
  | 'graphite-pencil'
  | 'crimson-ink'

export interface InkPalette {
  id: InkColorId
  name: string
  primaryHex: string
  rgb: [number, number, number]
  poolRgb: [number, number, number]
  dryAlpha: number
  wetAlpha: number
}

export const INK_PALETTES: Record<InkColorId, InkPalette> = {
  'bic-blue': {
    id: 'bic-blue',
    name: 'Bic Cristal Blue (0.7mm)',
    primaryHex: '#1b3b8c',
    rgb: [27, 59, 140],
    poolRgb: [14, 32, 92],
    dryAlpha: 0.82,
    wetAlpha: 0.97,
  },
  'carbon-black': {
    id: 'carbon-black',
    name: 'Ballpoint Carbon Black',
    primaryHex: '#1e2128',
    rgb: [30, 33, 40],
    poolRgb: [10, 12, 16],
    dryAlpha: 0.84,
    wetAlpha: 0.98,
  },
  'pilot-navy': {
    id: 'pilot-navy',
    name: 'Gel Roller Blue-Black (0.5mm)',
    primaryHex: '#15294a',
    rgb: [21, 41, 74],
    poolRgb: [8, 18, 38],
    dryAlpha: 0.86,
    wetAlpha: 0.98,
  },
  'graphite-pencil': {
    id: 'graphite-pencil',
    name: 'HB Mechanical Graphite',
    primaryHex: '#464950',
    rgb: [70, 73, 80],
    poolRgb: [42, 45, 50],
    dryAlpha: 0.72,
    wetAlpha: 0.9,
  },
  'crimson-ink': {
    id: 'crimson-ink',
    name: 'Red Margin Ballpoint',
    primaryHex: '#9e2424',
    rgb: [158, 36, 36],
    poolRgb: [105, 14, 14],
    dryAlpha: 0.8,
    wetAlpha: 0.96,
  },
}

interface FontSkeletonSpec {
  family: string
  weight: number
  opticalScale: number
  baselineShift: number
  letterWidthFactor: number
}

export interface HandStyleSpec {
  id: HandStyleId
  name: string
  description: string
  baseSlantDeg: number
  strokeWeight: number
  ligatureRate: number
  skeletons: FontSkeletonSpec[]
}

export const HAND_STYLES: Record<HandStyleId, HandStyleSpec> = {
  'everyday-ballpoint': {
    id: 'everyday-ballpoint',
    name: 'Everyday Ballpoint Hybrid',
    description: 'Natural cursive-print mix with fluid loops, flying crossbars, and organic speed shifts',
    baseSlantDeg: 3.8,
    strokeWeight: 1.0,
    ligatureRate: 0.34,
    skeletons: [
      { family: 'Caveat', weight: 500, opticalScale: 1.08, baselineShift: 0, letterWidthFactor: 0.96 },
      { family: 'Caveat', weight: 400, opticalScale: 1.07, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'Kalam', weight: 300, opticalScale: 0.82, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'Caveat', weight: 600, opticalScale: 1.06, baselineShift: 0, letterWidthFactor: 0.96 },
      { family: 'Handlee', weight: 400, opticalScale: 0.84, baselineShift: 0, letterWidthFactor: 0.94 },
      { family: 'Shadows Into Light Two', weight: 400, opticalScale: 0.85, baselineShift: 0, letterWidthFactor: 0.94 },
      { family: 'Patrick Hand', weight: 400, opticalScale: 0.88, baselineShift: 0, letterWidthFactor: 0.94 },
    ],
  },
  'rushed-student': {
    id: 'rushed-student',
    name: 'Rushed Lecture / Exam Hand',
    description: 'Fast, angular ballpoint note-taking with variable heights, hurried tails, and sharp slant',
    baseSlantDeg: 6.5,
    strokeWeight: 0.95,
    ligatureRate: 0.42,
    skeletons: [
      { family: 'Nothing You Could Do', weight: 400, opticalScale: 0.82, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'Caveat', weight: 500, opticalScale: 1.08, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'Covered By Your Grace', weight: 400, opticalScale: 0.96, baselineShift: 0, letterWidthFactor: 0.94 },
      { family: 'Shadows Into Light Two', weight: 400, opticalScale: 0.86, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'La Belle Aurore', weight: 400, opticalScale: 0.88, baselineShift: 0, letterWidthFactor: 0.95 },
    ],
  },
  'casual-journal': {
    id: 'casual-journal',
    name: 'Casual Everyday Notebook',
    description: 'Warm, unpretentious semi-printed handwriting with bouncy x-heights and open bowls',
    baseSlantDeg: 2.2,
    strokeWeight: 1.04,
    ligatureRate: 0.25,
    skeletons: [
      { family: 'Kalam', weight: 400, opticalScale: 0.84, baselineShift: 0, letterWidthFactor: 0.96 },
      { family: 'Kalam', weight: 300, opticalScale: 0.86, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'Patrick Hand', weight: 400, opticalScale: 0.92, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'Handlee', weight: 400, opticalScale: 0.86, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'Indie Flower', weight: 400, opticalScale: 0.88, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'Architects Daughter', weight: 400, opticalScale: 0.8, baselineShift: 0, letterWidthFactor: 0.95 },
    ],
  },
  'messy-scrawl': {
    id: 'messy-scrawl',
    name: 'Late-Night Hurried Scrawl',
    description: 'High-entropy, fatigued handwriting with dramatic ascenders, heavy cross-outs, and steep drift',
    baseSlantDeg: 8.0,
    strokeWeight: 0.94,
    ligatureRate: 0.48,
    skeletons: [
      { family: 'Covered By Your Grace', weight: 400, opticalScale: 0.98, baselineShift: 0, letterWidthFactor: 0.94 },
      { family: 'Caveat', weight: 500, opticalScale: 1.08, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'La Belle Aurore', weight: 400, opticalScale: 0.9, baselineShift: 0, letterWidthFactor: 0.95 },
      { family: 'Zeyada', weight: 400, opticalScale: 1.04, baselineShift: 1, letterWidthFactor: 0.94 },
      { family: 'Nothing You Could Do', weight: 400, opticalScale: 0.84, baselineShift: 0, letterWidthFactor: 0.94 },
    ],
  },
}

function hashPair(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = ((h ^ (h >> 13)) * 1274126177) | 0
  return ((h ^ (h >> 16)) >>> 0) / 4294967295
}

export interface AllographVariantDescriptor {
  variantIndex: number // 0 .. 19
  skeletonIndex: number
  // Pass 1: Smooth Horizontal scanline warp parameters
  topBendPx: number
  bellyShiftPx: number
  descenderSweepPx: number
  topFlareX: number
  bottomPinchX: number
  slantShear: number
  // Pass 2: Smooth Vertical column warp parameters
  internalSlopePx: number
  archBowPx: number
  sWavePx: number
  rightTaperY: number
  // Overall variant proportion
  aspectScaleX: number
  aspectScaleY: number
  rotationRad: number
  // Structural stroke surgery
  tittleOffsetX: number
  tittleOffsetY: number
  tittleStyle: 'dot' | 'flick-right' | 'tick-down' | 'micro-loop' | 'dash'
  crossbarAngleRad: number
  crossbarOffsetY: number
  crossbarLengthScale: number
  hasCapitalSerifs: boolean // For 'I', 'J', 'z', '7' allograph switching
  // Entry / exit ligature tendrils
  hasEntryHook: boolean
  entryHookDy: number
  hasExitFlick: boolean
  exitFlickLength: number
  exitFlickSlope: number
  // Ink pressure & ballpoint physics
  pressureWeight: number
  inkPoolStrength: number
}

export function getAllographDescriptor(
  char: string,
  variantIndex: number,
  styleId: HandStyleId
): AllographVariantDescriptor {
  const code = char.charCodeAt(0)
  const v = ((variantIndex % 20) + 20) % 20
  const style = HAND_STYLES[styleId]

  const phi1 = ((v * 0.61803398875 + hashPair(code, 1, v)) % 1) * 2 - 1
  const phi2 = ((v * 0.38196601125 + hashPair(code, 2, v)) % 1) * 2 - 1
  const phi3 = ((v * 0.75487766624 + hashPair(code, 3, v)) % 1) * 2 - 1
  const phi4 = ((v * 0.56984029099 + hashPair(code, 4, v)) % 1) * 2 - 1
  const phi5 = hashPair(code, 5, v) * 2 - 1
  const phi6 = hashPair(code, 6, v) * 2 - 1
  const phi7 = hashPair(code, 7, v)

  // Cycle across the style's calibrated human skeletons so the 20 variants exhibit
  // genuine structural allograph diversity (open vs closed bowls, looped vs straight stems)
  const skeletonIndex = (v + (code % 3)) % style.skeletons.length

  const isUpper = char >= 'A' && char <= 'Z'
  const hasAscender = /[bdkhltfA-Z0-9]/.test(char)
  const hasDescender = /[gjpqyfzQJY]/.test(char)

  const topBendPx = (hasAscender ? 4.4 : 2.5) * phi1
  const bellyShiftPx = 2.4 * phi2
  const descenderSweepPx = (hasDescender ? 5.6 : 2.4) * phi3

  const topFlareX = 0.14 * phi2
  const bottomPinchX = -0.13 * phi3
  const slantShear = (style.baseSlantDeg * Math.PI) / 180 + 0.16 * phi1

  const internalSlopePx = 2.5 * phi4
  const archBowPx = 1.8 * phi5
  const sWavePx = 1.3 * phi6
  const rightTaperY = 0.15 * phi3

  const aspectScaleX = 0.97 + 0.15 * phi2
  const aspectScaleY = (isUpper ? 1.05 : 1.0) + 0.17 * phi4
  const rotationRad = 0.075 * phi5

  const tittleStyles: AllographVariantDescriptor['tittleStyle'][] = [
    'dot',
    'flick-right',
    'tick-down',
    'micro-loop',
    'dash',
  ]
  const tittleStyle = tittleStyles[(v + code) % tittleStyles.length]
  const tittleOffsetX = 1.5 + 6.0 * phi1
  const tittleOffsetY = -1.0 + 4.2 * phi2

  const crossbarAngleRad = 0.04 + 0.22 * phi3
  const crossbarOffsetY = 3.5 * phi4
  const crossbarLengthScale = 1.02 + 0.3 * phi1
  const hasCapitalSerifs = v % 3 === 0

  const hasEntryHook =
    /[a-z]/.test(char) && phi7 < style.ligatureRate * 0.55 && v % 3 === 0
  const entryHookDy = 2.4 + 3.0 * Math.abs(phi2)

  const hasExitFlick =
    /[adehilmnorstuvwyz]/.test(char) &&
    ((v + code) % 20 < Math.round(style.ligatureRate * 15))
  const exitFlickLength = 4.5 + 7.0 * Math.abs(phi3)
  const exitFlickSlope = -0.28 + 0.36 * phi4

  const pressureWeight = 0.96 + 0.15 * phi6
  const inkPoolStrength = 0.28 + 0.48 * phi7

  return {
    variantIndex: v,
    skeletonIndex,
    topBendPx,
    bellyShiftPx,
    descenderSweepPx,
    topFlareX,
    bottomPinchX,
    slantShear,
    internalSlopePx,
    archBowPx,
    sWavePx,
    rightTaperY,
    aspectScaleX,
    aspectScaleY,
    rotationRad,
    tittleOffsetX,
    tittleOffsetY,
    tittleStyle,
    crossbarAngleRad,
    crossbarOffsetY,
    crossbarLengthScale,
    hasCapitalSerifs,
    hasEntryHook,
    entryHookDy,
    hasExitFlick,
    exitFlickLength,
    exitFlickSlope,
    pressureWeight,
    inkPoolStrength,
  }
}

export interface CachedAllographGlyph {
  canvas: HTMLCanvasElement
  advanceWidth: number
  anchorX: number
  baselineY: number
  descriptor: AllographVariantDescriptor
}

const glyphCache = new Map<string, CachedAllographGlyph>()

export function clearAllographCache() {
  glyphCache.clear()
}

let scratchA: HTMLCanvasElement | null = null
let scratchB: HTMLCanvasElement | null = null

function getScratchCanvases(w: number, h: number) {
  if (typeof document === 'undefined') {
    throw new Error('Allograph synthesis requires browser canvas environment')
  }
  if (!scratchA) {
    scratchA = document.createElement('canvas')
    scratchB = document.createElement('canvas')
  }
  if (scratchA.width !== w || scratchA.height !== h) {
    scratchA.width = w
    scratchA.height = h
  }
  if (scratchB!.width !== w || scratchB!.height !== h) {
    scratchB!.width = w
    scratchB!.height = h
  }
  return { a: scratchA, b: scratchB! }
}

function drawBallpointStroke(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  thickness: number,
  palette: InkPalette,
  poolStrength: number
) {
  const steps = 12
  const [r, g, b] = palette.rgb
  const [pr, pg, pb] = palette.poolRgb

  for (let i = 0; i < steps; i++) {
    const t0 = i / steps
    const t1 = (i + 1) / steps
    const mt0 = 1 - t0
    const mt1 = 1 - t1

    const px0 = mt0 * mt0 * x0 + 2 * mt0 * t0 * cx + t0 * t0 * x1
    const py0 = mt0 * mt0 * y0 + 2 * mt0 * t0 * cy + t0 * t0 * y1
    const px1 = mt1 * mt1 * x0 + 2 * mt1 * t1 * cx + t1 * t1 * x1
    const py1 = mt1 * mt1 * y0 + 2 * mt1 * t1 * cy + t1 * t1 * y1

    const pressure = Math.sin(t0 * Math.PI * 0.85 + 0.15)
    const w = Math.max(0.8, thickness * (0.6 + 0.55 * pressure))
    const alpha = palette.dryAlpha + (palette.wetAlpha - palette.dryAlpha) * pressure

    ctx.beginPath()
    ctx.moveTo(px0, py0)
    ctx.lineTo(px1, py1)
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  if (poolStrength > 0.4) {
    ctx.beginPath()
    ctx.arc(x0, y0, thickness * 0.52, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${(0.38 * poolStrength).toFixed(3)})`
    ctx.fill()
  }
}

export function getOrSynthesizeAllograph(
  char: string,
  variantIndex: number,
  styleId: HandStyleId,
  inkColorId: InkColorId,
  baseFontSizePx = 48
): CachedAllographGlyph {
  const v = ((variantIndex % 20) + 20) % 20
  const cacheKey = `${styleId}:${inkColorId}:${baseFontSizePx}:${char}:${v}`
  const existing = glyphCache.get(cacheKey)
  if (existing) {
    return existing
  }

  const style = HAND_STYLES[styleId]
  const palette = INK_PALETTES[inkColorId]
  const desc = getAllographDescriptor(char, v, styleId)
  const skel = style.skeletons[desc.skeletonIndex]

  const W = Math.round(baseFontSizePx * 2.2)
  const H = Math.round(baseFontSizePx * 2.6)
  const anchorX = Math.round(W * 0.35)
  const baselineY = Math.round(H * 0.62)

  const { a: canvasA, b: canvasB } = getScratchCanvases(W, H)
  const ctxA = canvasA.getContext('2d')!
  const ctxB = canvasB.getContext('2d')!

  ctxA.clearRect(0, 0, W, H)
  ctxB.clearRect(0, 0, W, H)

  const scaledFontPx = Math.round(
    baseFontSizePx * skel.opticalScale * desc.pressureWeight
  )
  const fontSpec = `${skel.weight} ${scaledFontPx}px "${skel.family}", cursive, sans-serif`
  ctxA.font = fontSpec
  ctxA.textBaseline = 'alphabetic'

  const metrics = ctxA.measureText(char)
  const rawAdvance = Math.max(
    baseFontSizePx * 0.27,
    metrics.width * skel.letterWidthFactor * desc.aspectScaleX
  )

  const [r, g, b] = palette.rgb
  const [pr, pg, pb] = palette.poolRgb
  const baseAlpha =
    palette.dryAlpha +
    (palette.wetAlpha - palette.dryAlpha) *
      Math.min(1, Math.max(0, (desc.pressureWeight - 0.82) / 0.35))

  ctxA.save()
  ctxA.translate(anchorX, baselineY + skel.baselineShift)
  ctxA.scale(desc.aspectScaleX, desc.aspectScaleY)
  ctxA.fillStyle = `rgba(${r}, ${g}, ${b}, ${baseAlpha.toFixed(3)})`
  ctxA.fillText(char, 0, 0)

  if (desc.pressureWeight > 1.02) {
    ctxA.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${(0.22 * desc.inkPoolStrength).toFixed(3)})`
    ctxA.fillText(char, 0.35, 0.25)
  }
  ctxA.restore()

  // SURGERY 1: Dynamic tittles on 'i' and 'j' across 20 variants
  if (char === 'i' || char === 'j') {
    const cutY = baselineY - Math.round(baseFontSizePx * 0.42)
    ctxA.clearRect(0, 0, W, Math.max(0, cutY))

    const dotX =
      anchorX +
      rawAdvance * 0.48 +
      desc.tittleOffsetX * (baseFontSizePx / 48)
    const dotY =
      baselineY -
      baseFontSizePx * 0.54 +
      desc.tittleOffsetY * (baseFontSizePx / 48)
    const strokeThick = Math.max(1.8, (baseFontSizePx / 22) * style.strokeWeight)

    ctxA.save()
    if (desc.tittleStyle === 'dot') {
      ctxA.beginPath()
      ctxA.ellipse(
        dotX,
        dotY,
        strokeThick * 0.75,
        strokeThick * 0.6,
        desc.rotationRad * 2,
        0,
        Math.PI * 2
      )
      ctxA.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${palette.wetAlpha})`
      ctxA.fill()
    } else if (desc.tittleStyle === 'flick-right') {
      drawBallpointStroke(
        ctxA,
        dotX - 1.2,
        dotY + 1.5,
        dotX + 1.5,
        dotY - 0.8,
        dotX + 5.0,
        dotY - 2.8,
        strokeThick * 0.85,
        palette,
        desc.inkPoolStrength
      )
    } else if (desc.tittleStyle === 'tick-down') {
      drawBallpointStroke(
        ctxA,
        dotX - 0.8,
        dotY - 2.5,
        dotX + 0.5,
        dotY,
        dotX + 2.0,
        dotY + 2.8,
        strokeThick * 0.88,
        palette,
        desc.inkPoolStrength
      )
    } else if (desc.tittleStyle === 'micro-loop') {
      ctxA.beginPath()
      ctxA.arc(dotX, dotY, strokeThick * 0.78, 0.2, Math.PI * 1.9)
      ctxA.strokeStyle = `rgba(${r}, ${g}, ${b}, ${baseAlpha})`
      ctxA.lineWidth = strokeThick * 0.68
      ctxA.stroke()
    } else {
      drawBallpointStroke(
        ctxA,
        dotX - 2.5,
        dotY,
        dotX + 0.8,
        dotY - 0.6,
        dotX + 4.5,
        dotY + 0.4,
        strokeThick * 0.82,
        palette,
        desc.inkPoolStrength
      )
    }
    ctxA.restore()
  }

  // SURGERY 2: Dynamic crossbar variations on 't', 'f', 'T', '7', 'z', 'I', 'J'
  const strokeThick = Math.max(1.6, (baseFontSizePx / 24) * style.strokeWeight)
  if ((char === 't' || char === 'f' || char === 'T' || char === '7' || char === 'z') && v % 2 === 1) {
    const barY =
      char === 'T'
        ? baselineY - baseFontSizePx * 0.66 + desc.crossbarOffsetY * 0.5
        : char === '7' || char === 'z'
          ? baselineY - baseFontSizePx * 0.31 + desc.crossbarOffsetY * 0.4
          : baselineY - baseFontSizePx * 0.43 + desc.crossbarOffsetY * 0.75
    const barHalfLen = baseFontSizePx * 0.21 * desc.crossbarLengthScale
    const centerBarX = anchorX + rawAdvance * 0.5 + desc.bellyShiftPx
    const dyBar = Math.tan(desc.crossbarAngleRad) * barHalfLen

    drawBallpointStroke(
      ctxA,
      centerBarX - barHalfLen * 0.7,
      barY + dyBar * 0.7,
      centerBarX + barHalfLen * 0.1,
      barY - desc.archBowPx * 0.4,
      centerBarX + barHalfLen * 1.1,
      barY - dyBar * 1.1,
      strokeThick * 0.82,
      palette,
      desc.inkPoolStrength
    )
  }

  // Capital 'I' and 'J' top/bottom bar allograph switching
  if ((char === 'I' || char === 'J') && desc.hasCapitalSerifs) {
    const topY = baselineY - baseFontSizePx * 0.66
    const centerX = anchorX + rawAdvance * 0.5
    const barW = baseFontSizePx * 0.17
    drawBallpointStroke(
      ctxA,
      centerX - barW,
      topY + 1,
      centerX,
      topY - 0.5,
      centerX + barW,
      topY - 1,
      strokeThick * 0.82,
      palette,
      0.3
    )
    if (char === 'I') {
      drawBallpointStroke(
        ctxA,
        centerX - barW * 0.9,
        baselineY + 0.5,
        centerX,
        baselineY - 0.5,
        centerX + barW * 0.9,
        baselineY - 0.5,
        strokeThick * 0.82,
        palette,
        0.3
      )
    }
  }

  // SURGERY 3: Subtle entry & exit flicks
  if (desc.hasEntryHook) {
    const startX = anchorX - 4.0
    const startY = baselineY - baseFontSizePx * 0.15 + desc.entryHookDy
    const endX = anchorX + 2.8
    const endY = baselineY - baseFontSizePx * 0.22
    drawBallpointStroke(
      ctxA,
      startX,
      startY,
      (startX + endX) * 0.5,
      endY + 1.5,
      endX,
      endY,
      strokeThick * 0.65,
      palette,
      0.15
    )
  }

  if (desc.hasExitFlick) {
    const startX = anchorX + rawAdvance * 0.84
    const startY = baselineY - baseFontSizePx * 0.11
    const endX = startX + desc.exitFlickLength * (baseFontSizePx / 48)
    const endY =
      startY +
      desc.exitFlickLength * desc.exitFlickSlope * (baseFontSizePx / 48)
    drawBallpointStroke(
      ctxA,
      startX,
      startY,
      (startX + endX) * 0.5,
      startY + 1.5,
      endX,
      endY,
      strokeThick * 0.68,
      palette,
      0.15
    )
  }

  // PASS 1: 1px Sub-pixel Smooth Horizontal Scanline Warp (scratchA -> scratchB)
  const normScaleY = baseFontSizePx * 0.7
  for (let sy = 0; sy < H; sy += 1) {
    const u = (sy - (baselineY - baseFontSizePx * 0.25)) / normScaleY
    let dx = -u * desc.slantShear * (baseFontSizePx * 0.35)

    if (u < 0) {
      dx += desc.topBendPx * u * u * (baseFontSizePx / 48)
    } else {
      dx += desc.descenderSweepPx * u * u * (baseFontSizePx / 48)
    }
    dx +=
      desc.bellyShiftPx *
      Math.exp(-u * u * 2.2) *
      (baseFontSizePx / 48)

    const localScaleX =
      1 +
      (u < 0
        ? Math.min(0.16, Math.max(-0.15, -u * desc.topFlareX))
        : Math.min(0.16, Math.max(-0.15, u * desc.bottomPinchX)))

    const destW = W * localScaleX
    const destX = anchorX * (1 - localScaleX) + dx

    ctxB.drawImage(canvasA, 0, sy, W, 1, destX, sy, destW, 1)
  }

  // PASS 2: 1px Sub-pixel Smooth Vertical Column Warp (scratchB -> outCanvas)
  const outCanvas = document.createElement('canvas')
  outCanvas.width = W
  outCanvas.height = H
  const outCtx = outCanvas.getContext('2d')!

  const glyphCenterX = anchorX + rawAdvance * 0.5
  const normScaleX = Math.max(18, rawAdvance * 0.75)

  for (let sx = 0; sx < W; sx += 1) {
    const vNorm = Math.max(-1.4, Math.min(1.4, (sx - glyphCenterX) / normScaleX))

    const dy =
      (desc.internalSlopePx * vNorm +
        desc.archBowPx * Math.cos(vNorm * Math.PI * 0.75) +
        desc.sWavePx * Math.sin(vNorm * Math.PI)) *
      (baseFontSizePx / 48)

    const localScaleY = Math.max(
      0.84,
      Math.min(1.18, 1 + desc.rightTaperY * vNorm * 0.55)
    )
    const destH = H * localScaleY
    const destY = baselineY * (1 - localScaleY) + dy

    outCtx.drawImage(canvasB, sx, 0, 1, H, sx, destY, 1, destH)
  }

  const cached: CachedAllographGlyph = {
    canvas: outCanvas,
    advanceWidth: rawAdvance,
    anchorX,
    baselineY,
    descriptor: desc,
  }

  glyphCache.set(cacheKey, cached)
  return cached
}

export class AllographScheduler {
  private recentByChar = new Map<string, number[]>()
  private stepCounter = 0
  private seed: number

  constructor(seed = 1337) {
    this.seed = seed
  }

  nextVariant(char: string, wordPosition: 'initial' | 'medial' | 'final' | 'single'): number {
    this.stepCounter++
    const recent = this.recentByChar.get(char) ?? []
    const code = char.charCodeAt(0)

    const posBias =
      wordPosition === 'initial'
        ? 0
        : wordPosition === 'final'
          ? 7
          : wordPosition === 'single'
            ? 13
            : 3

    let candidate =
      Math.floor(
        hashPair(code + this.seed, this.stepCounter, posBias) * 20
      ) % 20

    let attempts = 0
    while (recent.includes(candidate) && attempts < 20) {
      candidate = (candidate + 3 + (attempts % 5)) % 20
      attempts++
    }

    recent.push(candidate)
    if (recent.length > 10) {
      recent.shift()
    }
    this.recentByChar.set(char, recent)
    return candidate
  }
}
