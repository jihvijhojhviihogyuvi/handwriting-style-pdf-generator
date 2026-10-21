/**
 * Chirograph 20-Allograph Handwriting Synthesis Engine
 *
 * Synthesizes 20 distinct, organic allograph variations (0..19) for every
 * lowercase (a-z) and capital (A-Z) letter, plus digits and punctuation.
 */

export type HandStyleId =
  | 'everyday-ballpoint'
  | 'rushed-lecture'
  | 'casual-notebook'
  | 'architect-scrawl'

export type InkColorId =
  | 'bic-blue'
  | 'pilot-black'
  | 'gel-navy'
  | 'graphite-pencil'
  | 'red-grading'

export interface HandStyleConfig {
  id: HandStyleId
  name: string
  subtitle: string
  fontPool: string[]
  fontScaleFactors: number[]
  baseSlantDeg: number
  slantSpreadDeg: number
  heightSpread: number
  widthSpread: number
  baselineJitterPx: number
  warpIntensity: number
  kerningTightness: number
  ligatureRate: number
}

export interface InkPalette {
  id: InkColorId
  name: string
  rgb: [number, number, number]
  poolRgb: [number, number, number]
  swatchHex: string
  wetAlpha: number
  dryStreakChance: number
}

export const HAND_STYLES: Record<HandStyleId, HandStyleConfig> = {
  'everyday-ballpoint': {
    id: 'everyday-ballpoint',
    name: 'Everyday Ballpoint Hybrid',
    subtitle: 'Natural cursive-print mix with fluid rhythm & connected pairs',
    fontPool: ['"Caveat"', '"Caveat"', '"Kalam"', '"Caveat"', '"Patrick Hand"'],
    fontScaleFactors: [1.0, 1.03, 0.85, 0.97, 0.89],
    baseSlantDeg: 4.5,
    slantSpreadDeg: 10.5,
    heightSpread: 0.19,
    widthSpread: 0.17,
    baselineJitterPx: 2.7,
    warpIntensity: 1.22,
    kerningTightness: 0.84,
    ligatureRate: 0.46,
  },
  'rushed-lecture': {
    id: 'rushed-lecture',
    name: 'Rushed Lecture / Exam Hand',
    subtitle: 'Fast, angular ballpoint note-taking under time pressure',
    fontPool: ['"Caveat"', '"Shadows Into Light"', '"Caveat"', '"Shadows Into Light"'],
    fontScaleFactors: [1.0, 0.90, 1.04, 0.92],
    baseSlantDeg: 9.0,
    slantSpreadDeg: 12.5,
    heightSpread: 0.23,
    widthSpread: 0.19,
    baselineJitterPx: 3.5,
    warpIntensity: 1.42,
    kerningTightness: 0.85,
    ligatureRate: 0.54,
  },
  'casual-notebook': {
    id: 'casual-notebook',
    name: 'Casual Everyday Notebook',
    subtitle: 'Warm, unpretentious semi-printed desk notes',
    fontPool: ['"Kalam"', '"Kalam"', '"Patrick Hand"', '"Caveat"'],
    fontScaleFactors: [0.88, 0.85, 0.91, 1.0],
    baseSlantDeg: 2.0,
    slantSpreadDeg: 8.5,
    heightSpread: 0.17,
    widthSpread: 0.15,
    baselineJitterPx: 2.3,
    warpIntensity: 1.05,
    kerningTightness: 0.86,
    ligatureRate: 0.36,
  },
  'architect-scrawl': {
    id: 'architect-scrawl',
    name: 'Late-Night Hurried Scrawl',
    subtitle: 'High-entropy, fatigued handwriting with steep drift & bounce',
    fontPool: ['"Caveat"', '"Shadows Into Light"', '"Caveat"', '"Kalam"'],
    fontScaleFactors: [1.02, 0.91, 0.96, 0.85],
    baseSlantDeg: 6.5,
    slantSpreadDeg: 14.0,
    heightSpread: 0.26,
    widthSpread: 0.22,
    baselineJitterPx: 4.2,
    warpIntensity: 1.56,
    kerningTightness: 0.84,
    ligatureRate: 0.50,
  },
}

export const INK_PALETTES: Record<InkColorId, InkPalette> = {
  'bic-blue': {
    id: 'bic-blue',
    name: 'Bic Cristal Blue',
    rgb: [25, 52, 126],
    poolRgb: [10, 24, 78],
    swatchHex: '#19347e',
    wetAlpha: 0.93,
    dryStreakChance: 0.34,
  },
  'pilot-black': {
    id: 'pilot-black',
    name: 'Ballpoint Carbon Black',
    rgb: [30, 32, 37],
    poolRgb: [12, 13, 17],
    swatchHex: '#1e2025',
    wetAlpha: 0.94,
    dryStreakChance: 0.28,
  },
  'gel-navy': {
    id: 'gel-navy',
    name: 'Gel Roller Blue-Black',
    rgb: [20, 39, 68],
    poolRgb: [8, 19, 38],
    swatchHex: '#142744',
    wetAlpha: 0.96,
    dryStreakChance: 0.16,
  },
  'graphite-pencil': {
    id: 'graphite-pencil',
    name: 'HB Mechanical Graphite',
    rgb: [68, 71, 77],
    poolRgb: [42, 44, 49],
    swatchHex: '#44474d',
    wetAlpha: 0.83,
    dryStreakChance: 0.52,
  },
  'red-grading': {
    id: 'red-grading',
    name: 'Red Margin Ballpoint',
    rgb: [148, 32, 34],
    poolRgb: [96, 14, 16],
    swatchHex: '#942022',
    wetAlpha: 0.92,
    dryStreakChance: 0.32,
  },
}

export interface AllographDescriptor {
  char: string
  variantIndex: number // 0..19
  fontFamily: string
  fontScaleFactor: number
  fontWeight: number
  aspectScaleX: number
  aspectScaleY: number
  slantShear: number
  rotationRad: number
  baselineShiftPx: number
  internalSlopePx: number
  topBendPx: number
  bottomBendPx: number
  waistPinchPx: number
  bowlInflation: number
  pressureWeight: number
  warpPhaseX: number
  warpPhaseY: number
  warpAmpX: number
  warpAmpY: number
  hasEntryLead: boolean
  hasExitFlick: boolean
  tCrossbarTilt: number
  tCrossbarYOffset: number
  iDotOffsetX: number
  iDotOffsetY: number
}

export interface SynthesizedAllograph {
  canvas: HTMLCanvasElement
  descriptor: AllographDescriptor
  advanceWidth: number
  baselineY: number
  anchorX: number
}

function hashCharVariant(char: string, variantIndex: number, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < char.length; i++) {
    h ^= char.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= (variantIndex + 1) * 0x9e3779b9
  h = Math.imul(h, 16777619)
  return (h >>> 0) / 4294967295
}

export function getAllographDescriptor(
  char: string,
  variantIndex: number,
  styleId: HandStyleId
): AllographDescriptor {
  const style = HAND_STYLES[styleId]
  const v = ((variantIndex % 20) + 20) % 20

  const r1 = hashCharVariant(char, v, 101)
  const r2 = hashCharVariant(char, v, 203)
  const r3 = hashCharVariant(char, v, 307)
  const r4 = hashCharVariant(char, v, 409)
  const r5 = hashCharVariant(char, v, 521)
  const r6 = hashCharVariant(char, v, 631)
  const r7 = hashCharVariant(char, v, 743)
  const r8 = hashCharVariant(char, v, 859)
  const r9 = hashCharVariant(char, v, 971)

  const poolIdx = v % style.fontPool.length
  const fontFamily = style.fontPool[poolIdx]
  const fontScaleFactor = style.fontScaleFactors[poolIdx] ?? 1.0
  const weights = [400, 500, 600, 400, 500]
  const fontWeight = weights[Math.floor(v / 4) % weights.length]

  const golden1 = ((v * 0.61803398875 + r1 * 0.22) % 1) - 0.5
  const golden2 = ((v * 0.38196601125 + r2 * 0.22) % 1) - 0.5
  const golden3 = ((v * 0.75487766625 + r3 * 0.22) % 1) - 0.5

  const isUpper = char >= 'A' && char <= 'Z'
  const heightMult = isUpper ? 1.16 : 1.06

  const aspectScaleY = Math.max(
    0.80,
    Math.min(1.24, 1.0 + golden1 * style.heightSpread * 2.2 * heightMult)
  )
  const aspectScaleX = Math.max(
    0.83,
    Math.min(1.22, 1.0 + golden2 * style.widthSpread * 2.1)
  )

  const slantDeg = style.baseSlantDeg + golden3 * style.slantSpreadDeg * 2.1
  const slantShear = -Math.tan((slantDeg * Math.PI) / 180)
  const rotationRad = (((r4 - 0.5) * 7.5 + golden1 * 2.8) * Math.PI) / 180

  const baselineShiftPx = (r5 - 0.48) * style.baselineJitterPx * 2.1
  const internalSlopePx = (r6 - 0.46) * 4.8 + golden2 * 2.8

  const topBendPx = ((r7 - 0.5) * 8.2 + golden1 * 4.6) * style.warpIntensity
  const bottomBendPx = ((r8 - 0.5) * 7.8 - golden2 * 4.2) * style.warpIntensity
  const waistPinchPx = (r9 - 0.5) * 4.2 * style.warpIntensity
  const bowlInflation = golden3 * 0.56 + (r3 - 0.5) * 0.26

  const pressureWeight = 0.85 + (v % 5) * 0.06 + (r7 - 0.5) * 0.12

  const warpPhaseX = r8 * Math.PI * 2
  const warpPhaseY = r9 * Math.PI * 2
  const warpAmpX = (0.85 + r1 * 1.05) * style.warpIntensity
  const warpAmpY = (0.80 + r2 * 0.95) * style.warpIntensity

  const hasEntryLead = v % 3 === 0 && char >= 'a' && char <= 'z'
  const hasExitFlick = v % 2 === 1 && ((char >= 'a' && char <= 'z') || isUpper)

  const tCrossbarTilt = (r3 - 0.45) * 0.34
  const tCrossbarYOffset = (r4 - 0.5) * 5.2
  const iDotOffsetX = (r5 - 0.35) * 6.5
  const iDotOffsetY = (r6 - 0.5) * 4.8

  return {
    char,
    variantIndex: v,
    fontFamily,
    fontScaleFactor,
    fontWeight,
    aspectScaleX,
    aspectScaleY,
    slantShear,
    rotationRad,
    baselineShiftPx,
    internalSlopePx,
    topBendPx,
    bottomBendPx,
    waistPinchPx,
    bowlInflation,
    pressureWeight,
    warpPhaseX,
    warpPhaseY,
    warpAmpX,
    warpAmpY,
    hasEntryLead,
    hasExitFlick,
    tCrossbarTilt,
    tCrossbarYOffset,
    iDotOffsetX,
    iDotOffsetY,
  }
}

const allographCache = new Map<string, SynthesizedAllograph>()

export function clearAllographCache() {
  allographCache.clear()
}

export function getOrSynthesizeAllograph(
  char: string,
  variantIndex: number,
  styleId: HandStyleId,
  inkId: InkColorId,
  baseFontSizePx: number
): SynthesizedAllograph {
  const v = ((variantIndex % 20) + 20) % 20
  const quantizedSize = Math.round(baseFontSizePx)
  const cacheKey = `${styleId}:${inkId}:${quantizedSize}:${char}:${v}`

  const existing = allographCache.get(cacheKey)
  if (existing) return existing

  const desc = getAllographDescriptor(char, v, styleId)
  const style = HAND_STYLES[styleId]
  const palette = INK_PALETTES[inkId]

  const pad = Math.ceil(quantizedSize * 0.85)
  const cW = Math.ceil(quantizedSize * 1.95) + pad
  const cH = Math.ceil(quantizedSize * 2.45) + pad
  const anchorX = Math.round(cW * 0.34)
  const baselineY = Math.round(cH * 0.62)

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = cW
  srcCanvas.height = cH
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!

  srcCtx.save()
  srcCtx.translate(anchorX, baselineY)
  srcCtx.transform(
    desc.aspectScaleX,
    (desc.internalSlopePx / quantizedSize) * 0.48,
    desc.slantShear * 0.56,
    desc.aspectScaleY,
    0,
    0
  )

  const calibratedFontSize = Math.round(quantizedSize * desc.fontScaleFactor)
  srcCtx.font = `${desc.fontWeight} ${calibratedFontSize}px ${desc.fontFamily}, cursive`
  srcCtx.textBaseline = 'alphabetic'

  const metrics = srcCtx.measureText(char)
  const rawAdvance = Math.max(quantizedSize * 0.22, metrics.width)

  const [r, g, b] = palette.rgb

  srcCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${palette.wetAlpha})`
  srcCtx.fillText(char, 0, 0)

  const needsNibBoost =
    desc.fontFamily.includes('Shadows') ||
    desc.fontFamily.includes('Patrick') ||
    desc.pressureWeight > 0.96

  if (needsNibBoost) {
    srcCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.44)`
    srcCtx.fillText(char, 0.45, 0.18)
  }

  srcCtx.restore()

  const dstCanvas = document.createElement('canvas')
  dstCanvas.width = cW
  dstCanvas.height = cH
  const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true })!

  const srcImg = srcCtx.getImageData(0, 0, cW, cH)
  const dstImg = dstCtx.createImageData(cW, cH)
  const sData = srcImg.data
  const dData = dstImg.data

  const freqX = (Math.PI * 2) / Math.max(22, quantizedSize * 0.72)
  const freqY = (Math.PI * 2) / Math.max(22, quantizedSize * 0.68)
  const streakSeed = hashCharVariant(char, v, 991)

  const bowlCenterX = anchorX + rawAdvance * 0.48
  const bowlCenterY = baselineY - quantizedSize * 0.22
  const bowlRadius = quantizedSize * 0.42

  for (let y = 1; y < cH - 1; y++) {
    const normY = (y - baselineY) / (quantizedSize * 0.75)

    let bendX = 0
    if (normY < -0.15) {
      const t = Math.min(1.4, Math.abs(normY + 0.15))
      bendX = desc.topBendPx * t * t * 0.85
    } else if (normY > 0.12) {
      const t = Math.min(1.4, normY - 0.12)
      bendX = desc.bottomBendPx * t * t * 0.85
    } else {
      bendX = desc.waistPinchPx * (1 - Math.abs(normY) * 2.8)
    }

    const rowWaveX = Math.sin(y * freqY + desc.warpPhaseX) * desc.warpAmpX * 0.68

    for (let x = 1; x < cW - 1; x++) {
      const dxB = x - bowlCenterX
      const dyB = y - bowlCenterY
      const distSq = dxB * dxB + dyB * dyB
      let bowlDx = 0
      let bowlDy = 0
      if (distSq < bowlRadius * bowlRadius) {
        const factor = (1 - Math.sqrt(distSq) / bowlRadius) * desc.bowlInflation
        bowlDx = -dxB * factor * 0.62
        bowlDy = -dyB * factor * 0.55
      }

      const normX = (x - anchorX) / Math.max(12, rawAdvance)
      let exitDy = 0
      if (desc.hasExitFlick && normX > 0.62 && Math.abs(normY) < 0.38) {
        const rt = Math.min(1.2, (normX - 0.62) * 1.8)
        exitDy = (v % 4 === 1 ? 1 : -1) * rt * rt * 2.6
      }

      const colWaveY =
        Math.cos(x * freqX + desc.warpPhaseY) * desc.warpAmpY * 0.62 +
        Math.sin((x + y) * 0.16 + desc.warpPhaseX) * 0.32

      const sx = x + bendX + bowlDx + rowWaveX
      const sy = y + bowlDy + colWaveY + exitDy

      const ix = Math.floor(sx)
      const iy = Math.floor(sy)
      if (ix < 0 || ix >= cW - 1 || iy < 0 || iy >= cH - 1) continue

      const fx = sx - ix
      const fy = sy - iy

      const idx00 = (iy * cW + ix) * 4
      const idx10 = (iy * cW + (ix + 1)) * 4
      const idx01 = ((iy + 1) * cW + ix) * 4
      const idx11 = ((iy + 1) * cW + (ix + 1)) * 4

      const a00 = sData[idx00 + 3]
      const a10 = sData[idx10 + 3]
      const a01 = sData[idx01 + 3]
      const a11 = sData[idx11 + 3]

      if ((a00 | a10 | a01 | a11) === 0) continue

      const aTop = a00 + (a10 - a00) * fx
      const aBot = a01 + (a11 - a01) * fx
      let alpha = aTop + (aBot - aTop) * fy

      if (alpha < 8) continue

      const microGrain =
        Math.sin(x * 1.45 + y * 1.85 + streakSeed * 29) *
        Math.cos(x * 0.85 - y * 1.35 + streakSeed * 17)

      let pr = r
      let pg = g
      let pb = b

      if (alpha > 185 && microGrain < -0.52 && palette.dryStreakChance > 0.2) {
        alpha = Math.round(alpha * (1 - palette.dryStreakChance * 0.42))
      } else if (alpha > 195 && microGrain > 0.62) {
        pr = Math.round(r * 0.62 + palette.poolRgb[0] * 0.38)
        pg = Math.round(g * 0.62 + palette.poolRgb[1] * 0.38)
        pb = Math.round(b * 0.62 + palette.poolRgb[2] * 0.38)
        alpha = Math.min(255, Math.round(alpha * 1.08))
      }

      const dIdx = (y * cW + x) * 4
      dData[dIdx] = pr
      dData[dIdx + 1] = pg
      dData[dIdx + 2] = pb
      dData[dIdx + 3] = Math.min(255, Math.round(alpha))
    }
  }

  dstCtx.putImageData(dstImg, 0, 0)

  let minInkX = cW
  let maxInkX = 0
  for (let y = 0; y < cH; y++) {
    for (let x = 0; x < cW; x++) {
      if (dData[(y * cW + x) * 4 + 3] > 28) {
        if (x < minInkX) minInkX = x
        if (x > maxInkX) maxInkX = x
      }
    }
  }

  let effectiveAdvance = rawAdvance * desc.aspectScaleX * style.kerningTightness
  let effectiveAnchorX = anchorX

  if (maxInkX > minInkX) {
    const measuredSpan = maxInkX - minInkX + 1
    effectiveAnchorX = Math.max(0, minInkX - 1)
    const minCharAdvance =
      /^[iIl1.,!':;|]$/.test(char)
        ? quantizedSize * 0.18
        : quantizedSize * 0.26
    effectiveAdvance = Math.max(
      minCharAdvance,
      measuredSpan * style.kerningTightness
    )
  }

  const result: SynthesizedAllograph = {
    canvas: dstCanvas,
    descriptor: desc,
    advanceWidth: effectiveAdvance,
    baselineY,
    anchorX: effectiveAnchorX,
  }

  allographCache.set(cacheKey, result)
  return result
}

export class AllographSequenceSelector {
  private historyByChar = new Map<string, number[]>()
  private stepCounter = 0
  private seed: number

  constructor(seed = 1337) {
    this.seed = seed
  }

  public nextVariant(char: string): number {
    this.stepCounter++
    const history = this.historyByChar.get(char) || []

    let bestCandidate = 0
    let bestScore = -1

    for (let candidate = 0; candidate < 20; candidate++) {
      if (history.includes(candidate)) continue
      const pseudo = hashCharVariant(
        char,
        candidate,
        this.seed + this.stepCounter * 7919
      )
      if (pseudo > bestScore) {
        bestScore = pseudo
        bestCandidate = candidate
      }
    }

    history.push(bestCandidate)
    if (history.length > 12) {
      history.shift()
    }
    this.historyByChar.set(char, history)

    return bestCandidate
  }
}
