/**
 * Chirograph 20-Allograph Handwriting Synthesis Engine
 *
 * Synthesizes 20 distinct, organic allograph variations (0..19) for every
 * lowercase (a-z) and capital (A-Z) letter, plus digits and punctuation.
 *
 * Key Realism Architecture:
 * - Single cohesive writer skeleton per hand style (never mixes incompatible fonts inside a word)
 * - 3x3 Distance-Field Morphological Stroke Thinning: shaves outer stroke pixels
 *   cleanly around the 100%-solid centerline spine so light-pressure letters are
 *   genuinely thinner (fine 0.4mm–0.5mm ballpoint look) without ever breaking a stem
 * - Optical X-Height Body Kerning: letters sit naturally next to each other with
 *   clean breathing space and zero collisions or mid-word splits
 * - Colorimetrically calibrated ballpoint, gel, and graphite ink palettes
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
  description: string
  fontFamily: string
  fontWeight: number
  fontScaleFactor: number
  baseSlantDeg: number
  slantSpreadDeg: number
  heightSpread: number
  widthSpread: number
  baselineJitterPx: number
  warpIntensity: number
  letterGapRatio: number
  ligatureRate: number
  baseThinningStrength: number // 0..1 baseline nib fineness for this style
}

export interface InkPalette {
  id: InkColorId
  name: string
  rgb: [number, number, number]
  lightRgb: [number, number, number]
  poolRgb: [number, number, number]
  swatchHex: string
  primaryHex: string
  wetAlpha: number
  dryStreakChance: number
}

export const HAND_STYLES: Record<HandStyleId, HandStyleConfig> = {
  'everyday-ballpoint': {
    id: 'everyday-ballpoint',
    name: 'Everyday 0.5mm Ballpoint',
    subtitle: 'Natural cursive-print hybrid with variable thin/medium pen pressure',
    description: 'Natural cursive-print hybrid with variable thin/medium pen pressure',
    fontFamily: '"Caveat"',
    fontWeight: 400,
    fontScaleFactor: 1.0,
    baseSlantDeg: 3.5,
    slantSpreadDeg: 8.5,
    heightSpread: 0.17,
    widthSpread: 0.15,
    baselineJitterPx: 2.0,
    warpIntensity: 1.05,
    letterGapRatio: 0.028,
    ligatureRate: 0.36,
    baseThinningStrength: 0.58,
  },
  'rushed-lecture': {
    id: 'rushed-lecture',
    name: 'Fast Lecture / Exam Hand',
    subtitle: 'Rapid, slender note-taking with light-pressure skimming strokes',
    description: 'Rapid, slender note-taking with light-pressure skimming strokes',
    fontFamily: '"Nanum Pen Script"',
    fontWeight: 400,
    fontScaleFactor: 1.08,
    baseSlantDeg: 6.5,
    slantSpreadDeg: 10.0,
    heightSpread: 0.20,
    widthSpread: 0.17,
    baselineJitterPx: 2.5,
    warpIntensity: 1.15,
    letterGapRatio: 0.026,
    ligatureRate: 0.42,
    baseThinningStrength: 0.64,
  },
  'casual-notebook': {
    id: 'casual-notebook',
    name: 'Clean Everyday Journal',
    subtitle: 'Crisp, legible fine-liner desk notes with airy letter spacing',
    description: 'Crisp, legible fine-liner desk notes with airy letter spacing',
    fontFamily: '"Shadows Into Light Two"',
    fontWeight: 400,
    fontScaleFactor: 0.88,
    baseSlantDeg: 2.0,
    slantSpreadDeg: 7.0,
    heightSpread: 0.15,
    widthSpread: 0.14,
    baselineJitterPx: 1.8,
    warpIntensity: 0.92,
    letterGapRatio: 0.036,
    ligatureRate: 0.24,
    baseThinningStrength: 0.52,
  },
  'architect-scrawl': {
    id: 'architect-scrawl',
    name: 'Fine Technical Notebook',
    subtitle: 'Light-weight 0.4mm ballpoint print-script with high slope variation',
    description: 'Light-weight 0.4mm ballpoint print-script with high slope variation',
    fontFamily: '"Kalam"',
    fontWeight: 300,
    fontScaleFactor: 0.84,
    baseSlantDeg: 4.5,
    slantSpreadDeg: 10.5,
    heightSpread: 0.19,
    widthSpread: 0.16,
    baselineJitterPx: 2.6,
    warpIntensity: 1.12,
    letterGapRatio: 0.032,
    ligatureRate: 0.30,
    baseThinningStrength: 0.68,
  },
}

export const INK_PALETTES: Record<InkColorId, InkPalette> = {
  'bic-blue': {
    id: 'bic-blue',
    name: 'Bic Cristal Royal Blue',
    rgb: [26, 58, 164],
    lightRgb: [56, 92, 194],
    poolRgb: [12, 28, 106],
    swatchHex: '#1a3aa4',
    primaryHex: '#1a3aa4',
    wetAlpha: 0.94,
    dryStreakChance: 0.26,
  },
  'pilot-black': {
    id: 'pilot-black',
    name: 'Fine Carbon Black',
    rgb: [30, 30, 34],
    lightRgb: [64, 64, 70],
    poolRgb: [12, 12, 15],
    swatchHex: '#1e1e22',
    primaryHex: '#1e1e22',
    wetAlpha: 0.94,
    dryStreakChance: 0.22,
  },
  'gel-navy': {
    id: 'gel-navy',
    name: 'Blue-Black Archival Gel',
    rgb: [20, 48, 92],
    lightRgb: [46, 78, 126],
    poolRgb: [8, 22, 50],
    swatchHex: '#14305c',
    primaryHex: '#14305c',
    wetAlpha: 0.95,
    dryStreakChance: 0.16,
  },
  'graphite-pencil': {
    id: 'graphite-pencil',
    name: '0.5mm HB Graphite Lead',
    rgb: [68, 70, 75],
    lightRgb: [104, 106, 112],
    poolRgb: [44, 46, 50],
    swatchHex: '#44464b',
    primaryHex: '#44464b',
    wetAlpha: 0.87,
    dryStreakChance: 0.44,
  },
  'red-grading': {
    id: 'red-grading',
    name: 'Fine Crimson Ballpoint',
    rgb: [176, 30, 38],
    lightRgb: [204, 62, 70],
    poolRgb: [118, 14, 20],
    swatchHex: '#b01e26',
    primaryHex: '#b01e26',
    wetAlpha: 0.93,
    dryStreakChance: 0.25,
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
  pressureWeight: number // 0.62 (thin light-touch letter) .. 1.04 (firmer letter)
  strokeThinness: number // 0.05 (firmer nib) .. 0.96 (razor-thin light-pressure nib)
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

  const fontFamily = style.fontFamily
  const fontScaleFactor = style.fontScaleFactor
  const fontWeight = style.fontWeight

  // Stratified golden-ratio distribution across the 20 variants (0..19)
  const golden1 = ((v * 0.61803398875 + r1 * 0.2) % 1) - 0.5
  const golden2 = ((v * 0.38196601125 + r2 * 0.2) % 1) - 0.5
  const golden3 = ((v * 0.75487766625 + r3 * 0.2) % 1) - 0.5
  const golden4 = ((v * 0.56984029099 + r7 * 0.18) % 1) // 0..1 pressure tier

  const isUpper = char >= 'A' && char <= 'Z'
  const heightMult = isUpper ? 1.10 : 1.04

  const aspectScaleY = Math.max(
    0.82,
    Math.min(1.22, 1.0 + golden1 * style.heightSpread * 2.0 * heightMult)
  )
  const aspectScaleX = Math.max(
    0.85,
    Math.min(1.18, 1.0 + golden2 * style.widthSpread * 1.9)
  )

  const slantDeg = style.baseSlantDeg + golden3 * style.slantSpreadDeg * 1.85
  const slantShear = -Math.tan((slantDeg * Math.PI) / 180)
  const rotationRad = (((r4 - 0.5) * 4.4 + golden1 * 1.8) * Math.PI) / 180

  const baselineShiftPx = (r5 - 0.48) * style.baselineJitterPx * 1.75
  const internalSlopePx = (r6 - 0.46) * 3.4 + golden2 * 2.0

  const topBendPx = ((r7 - 0.5) * 5.8 + golden1 * 3.4) * style.warpIntensity
  const bottomBendPx = ((r8 - 0.5) * 5.4 - golden2 * 3.2) * style.warpIntensity
  const waistPinchPx = (r9 - 0.5) * 2.8 * style.warpIntensity
  const bowlInflation = golden3 * 0.42 + (r3 - 0.5) * 0.20

  // Stratified Pen Pressure & Stroke Thinness across the 20 variants:
  // ~45% of variants are noticeably thinner/lighter-pressure strokes,
  // ~35% are medium-fine, and ~20% have firmer downstroke pressure.
  const pressureWeight = Number((0.62 + golden4 * 0.42).toFixed(3))
  const strokeThinness = Math.max(0.05, Math.min(0.96, 1.0 - golden4 * 0.94))

  const warpPhaseX = r8 * Math.PI * 2
  const warpPhaseY = r9 * Math.PI * 2
  const warpAmpX = (0.58 + r1 * 0.72) * style.warpIntensity
  const warpAmpY = (0.54 + r2 * 0.68) * style.warpIntensity

  const hasEntryLead = v % 3 === 0 && char >= 'a' && char <= 'z'
  const hasExitFlick = v % 2 === 1 && ((char >= 'a' && char <= 'z') || isUpper)

  const tCrossbarTilt = (r3 - 0.45) * 0.28
  const tCrossbarYOffset = (r4 - 0.5) * 3.8
  const iDotOffsetX = (r5 - 0.35) * 5.0
  const iDotOffsetY = (r6 - 0.5) * 3.6

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
    strokeThinness,
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
  baseFontSizePx: number,
  nibFineness = 1.0 // 0.6 (extra thin 0.38mm) .. 1.4 (broader 0.7mm)
): SynthesizedAllograph {
  const v = ((variantIndex % 20) + 20) % 20
  const quantizedSize = Math.round(baseFontSizePx)
  const finenessKey = Math.round(nibFineness * 20)
  const cacheKey = `${styleId}:${inkId}:${quantizedSize}:${finenessKey}:${char}:${v}`

  const existing = allographCache.get(cacheKey)
  if (existing) return existing

  const desc = getAllographDescriptor(char, v, styleId)
  const style = HAND_STYLES[styleId]
  const palette = INK_PALETTES[inkId]

  const pad = Math.ceil(quantizedSize * 0.9)
  const cW = Math.ceil(quantizedSize * 2.1) + pad
  const cH = Math.ceil(quantizedSize * 2.5) + pad
  const anchorX = Math.round(cW * 0.32)
  const baselineY = Math.round(cH * 0.62)

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = cW
  srcCanvas.height = cH
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!

  srcCtx.save()
  srcCtx.translate(anchorX, baselineY)
  srcCtx.rotate(desc.rotationRad)
  srcCtx.transform(
    desc.aspectScaleX,
    (desc.internalSlopePx / quantizedSize) * 0.38,
    desc.slantShear * 0.48,
    desc.aspectScaleY,
    0,
    0
  )

  const calibratedFontSize = Math.round(quantizedSize * desc.fontScaleFactor)
  srcCtx.font = `${desc.fontWeight} ${calibratedFontSize}px ${desc.fontFamily}, cursive`
  srcCtx.textBaseline = 'alphabetic'

  const metrics = srcCtx.measureText(char)
  const rawAdvance = Math.max(quantizedSize * 0.20, metrics.width)

  const [r, g, b] = palette.rgb
  const [lr, lg, lb] = palette.lightRgb

  srcCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 1.0)`
  srcCtx.fillText(char, 0, 0)
  srcCtx.restore()

  const dstCanvas = document.createElement('canvas')
  dstCanvas.width = cW
  dstCanvas.height = cH
  const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true })!

  const srcImg = srcCtx.getImageData(0, 0, cW, cH)
  const dstImg = dstCtx.createImageData(cW, cH)
  const sData = srcImg.data
  const dData = dstImg.data

  const freqX = (Math.PI * 2) / Math.max(24, quantizedSize * 0.76)
  const freqY = (Math.PI * 2) / Math.max(24, quantizedSize * 0.72)
  const streakSeed = hashCharVariant(char, v, 991)

  const bowlCenterX = anchorX + rawAdvance * 0.46
  const bowlCenterY = baselineY - quantizedSize * 0.22
  const bowlRadius = quantizedSize * 0.40

  // Combine style thinning, variant strokeThinness, and user nibFineness setting
  const effectiveThinning = Math.max(
    0.05,
    Math.min(
      0.95,
      (style.baseThinningStrength * 0.55 + desc.strokeThinness * 0.65) *
        nibFineness
    )
  )

  for (let y = 1; y < cH - 1; y++) {
    const normY = (y - baselineY) / (quantizedSize * 0.75)

    let bendX = 0
    if (normY < -0.15) {
      const t = Math.min(1.3, Math.abs(normY + 0.15))
      bendX = desc.topBendPx * t * t * 0.70
    } else if (normY > 0.12) {
      const t = Math.min(1.3, normY - 0.12)
      bendX = desc.bottomBendPx * t * t * 0.70
    } else {
      bendX = desc.waistPinchPx * (1 - Math.abs(normY) * 2.8)
    }

    const rowWaveX = Math.sin(y * freqY + desc.warpPhaseX) * desc.warpAmpX * 0.50

    for (let x = 1; x < cW - 1; x++) {
      const dxB = x - bowlCenterX
      const dyB = y - bowlCenterY
      const distSq = dxB * dxB + dyB * dyB
      let bowlDx = 0
      let bowlDy = 0
      if (distSq < bowlRadius * bowlRadius) {
        const factor = (1 - Math.sqrt(distSq) / bowlRadius) * desc.bowlInflation
        bowlDx = -dxB * factor * 0.46
        bowlDy = -dyB * factor * 0.42
      }

      const normX = (x - anchorX) / Math.max(12, rawAdvance)
      let exitDy = 0
      if (desc.hasExitFlick && normX > 0.65 && Math.abs(normY) < 0.35) {
        const rt = Math.min(1.1, (normX - 0.65) * 1.6)
        exitDy = (v % 4 === 1 ? 1 : -1) * rt * rt * 1.8
      }

      const colWaveY =
        Math.cos(x * freqX + desc.warpPhaseY) * desc.warpAmpY * 0.46 +
        Math.sin((x + y) * 0.15 + desc.warpPhaseX) * 0.20

      const sx = x + bendX + bowlDx + rowWaveX
      const sy = y + bowlDy + colWaveY + exitDy

      const ix = Math.floor(sx)
      const iy = Math.floor(sy)
      if (ix < 1 || ix >= cW - 2 || iy < 1 || iy >= cH - 2) continue

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
      const bilinearAlpha = aTop + (aBot - aTop) * fy

      if (bilinearAlpha < 12) continue

      // Distance-Field Morphological Stroke Thinning:
      // Sample the 4-connected cross neighbors around (ix, iy) to know how deep
      // inside the stroke spine this pixel lies.
      const aLeft = sData[(iy * cW + (ix - 1)) * 4 + 3]
      const aRight = sData[(iy * cW + (ix + 1)) * 4 + 3]
      const aUp = sData[((iy - 1) * cW + ix) * 4 + 3]
      const aDown = sData[((iy + 1) * cW + ix) * 4 + 3]
      const minCross = Math.min(aLeft, aRight, aUp, aDown)

      // Anisotropic exit/upstroke taper (strokes get slightly thinner toward exits & ascender tops)
      const localThinning = Math.min(
        0.96,
        effectiveThinning +
          Math.max(0, normX - 0.5) * 0.18 +
          Math.max(0, -normY - 0.35) * 0.14
      )

      // Blend between raw bilinear alpha and eroded cross-minimum alpha:
      // If `minCross` is high, we are in the core spine of the stroke -> stays 100% solid!
      // If `minCross` is low, we are on the outer perimeter -> shaved down smoothly according to `localThinning`!
      const eroded =
        bilinearAlpha * (1 - localThinning * 0.58) +
        minCross * (localThinning * 0.58)
      const gamma = 1.0 + localThinning * 1.15
      const shapedAlpha = Math.pow(Math.max(0, eroded / 255), gamma) * 255

      const pressureOpacity =
        palette.wetAlpha * (0.84 + desc.pressureWeight * 0.16)
      let alpha = shapedAlpha * pressureOpacity

      if (alpha < 14) continue

      const microGrain =
        Math.sin(x * 1.45 + y * 1.85 + streakSeed * 29) *
        Math.cos(x * 0.85 - y * 1.35 + streakSeed * 17)

      // Subtle color shading between deep core ink and lighter skimming ink on thin variants
      const lightMix = Math.max(
        0,
        Math.min(
          0.48,
          desc.strokeThinness * 0.36 + (1.0 - shapedAlpha / 255) * 0.24
        )
      )
      let pr = Math.round(r * (1 - lightMix) + lr * lightMix)
      let pg = Math.round(g * (1 - lightMix) + lg * lightMix)
      let pb = Math.round(b * (1 - lightMix) + lb * lightMix)

      if (alpha > 165 && microGrain < -0.52 && palette.dryStreakChance > 0.15) {
        alpha = Math.round(alpha * (1 - palette.dryStreakChance * 0.32))
      } else if (
        alpha > 185 &&
        microGrain > 0.60 &&
        desc.pressureWeight > 0.80
      ) {
        pr = Math.round(pr * 0.62 + palette.poolRgb[0] * 0.38)
        pg = Math.round(pg * 0.62 + palette.poolRgb[1] * 0.38)
        pb = Math.round(pb * 0.62 + palette.poolRgb[2] * 0.38)
        alpha = Math.min(255, Math.round(alpha * 1.06))
      }

      const dIdx = (y * cW + x) * 4
      dData[dIdx] = pr
      dData[dIdx + 1] = pg
      dData[dIdx + 2] = pb
      dData[dIdx + 3] = Math.min(255, Math.round(alpha))
    }
  }

  dstCtx.putImageData(dstImg, 0, 0)

  // Optical X-Height Body Bounding Box Measurement
  let minFullX = cW
  let maxFullX = 0
  let minBodyX = cW
  let maxBodyX = 0

  const bodyTopY = Math.max(0, Math.floor(baselineY - quantizedSize * 0.50))
  const bodyBotY = Math.min(cH - 1, Math.ceil(baselineY + quantizedSize * 0.12))

  for (let y = 0; y < cH; y++) {
    const inBodyBand = y >= bodyTopY && y <= bodyBotY
    for (let x = 0; x < cW; x++) {
      if (dData[(y * cW + x) * 4 + 3] > 20) {
        if (x < minFullX) minFullX = x
        if (x > maxFullX) maxFullX = x
        if (inBodyBand) {
          if (x < minBodyX) minBodyX = x
          if (x > maxBodyX) maxBodyX = x
        }
      }
    }
  }

  let effectiveAdvance = rawAdvance * desc.aspectScaleX
  let effectiveAnchorX = anchorX

  if (maxFullX >= minFullX) {
    const fullSpan = maxFullX - minFullX + 1
    const hasBodySpan = maxBodyX >= minBodyX
    const bodySpan = hasBodySpan ? maxBodyX - minBodyX + 1 : fullSpan

    effectiveAnchorX = hasBodySpan
      ? Math.round(minBodyX * 0.60 + minFullX * 0.40)
      : minFullX

    const opticalSpan = hasBodySpan
      ? bodySpan * 0.68 + fullSpan * 0.32
      : fullSpan

    const isNarrowGlyph = /^[iIl1.,!':;|]$/.test(char)
    const minCharAdvance = isNarrowGlyph
      ? quantizedSize * 0.14
      : quantizedSize * 0.22

    effectiveAdvance = Math.max(minCharAdvance, opticalSpan)
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
