/**
 * Multi-Page Biomechanical Handwriting Compositor
 *
 * Orchestrates:
 * 1. Sentence-level non-uniform diagonal baseline drift (every sentence gets its own
 *    slope angle, quadratic bow/arch, and wrist pivot momentum)
 * 2. Word-level independent diagonal tilt & baseline vertical hop
 * 3. Character-level uneven heights, baseline jitter, and 20-allograph anti-repetition
 * 4. Smooth continuous line clearance guard (advances cursorY monotonically without mid-line cliffs)
 * 5. Natural intra-word ligature bridges & authentic crossed-out mistakes + caret superscripts
 */

import {
  AllographSequenceSelector,
  getOrSynthesizeAllograph,
  HAND_STYLES,
  HandStyleId,
  INK_PALETTES,
  InkColorId,
} from './allograph-engine'
import {
  GeneratedMistake,
  pickScratchStyle,
  renderHandwrittenCaret,
  renderScratchOutOverlay,
  ScratchStyle,
  synthesizeMistakenText,
} from './mistake-generator'

export type PaperStyleId =
  | 'natural-bond'
  | 'ink-only-white'
  | 'college-ruled'
  | 'legal-pad'

export interface CompositorConfig {
  text: string
  handStyle: HandStyleId
  inkColor: InkColorId
  paperStyle: PaperStyleId
  fontSizePx: number
  diagonalDriftIntensity: number // 0.0 .. 2.0
  unevenHeightIntensity: number // 0.0 .. 2.0
  mistakeFrequency: number // 0.0 .. 0.25
  marginWanderIntensity: number // 0.0 .. 2.0
  seed: number
  showForensicGuides: boolean
}

export interface CompositorTelemetry {
  pageCount: number
  totalWords: number
  totalGlyphs: number
  uniqueAllographsCount: number
  mistakes: GeneratedMistake[]
  sentenceSlopesDeg: number[]
  wordSlopesSampleDeg: number[]
  minCharHeightRatio: number
  maxCharHeightRatio: number
}

interface WordToken {
  raw: string
  isExplicitMistake: boolean
  isAutoMistake: boolean
  mistakenText?: string
  scratchStyle?: ScratchStyle
  isCaretSuperscript?: boolean
  sentenceIndex: number
  wordIndexInSentence: number
  isParagraphBreak?: boolean
}

function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function tokenizeInputWithMistakes(
  text: string,
  mistakeFrequency: number,
  seed: number
): { tokens: WordToken[]; mistakes: GeneratedMistake[] } {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const tokens: WordToken[] = []
  const mistakes: GeneratedMistake[] = []

  let sentenceIndex = 0
  let wordInSentence = 0
  let globalWordCounter = 0
  let lastScratch: ScratchStyle | undefined
  let lastAutoMistakeWordIdx = -10

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx]
    if (pIdx > 0) {
      tokens.push({
        raw: '',
        isExplicitMistake: false,
        isAutoMistake: false,
        sentenceIndex,
        wordIndexInSentence: wordInSentence,
        isParagraphBreak: true,
      })
    }

    const rawWords = para.split(/\s+/).filter((w) => w.length > 0)
    for (let wIdx = 0; wIdx < rawWords.length; wIdx++) {
      const word = rawWords[wIdx]
      globalWordCounter++

      const explicitMatch =
        word.match(/^~(.+)~$/) || word.match(/^~~(.+)~~$/)
      if (explicitMatch && explicitMatch[1].length > 0) {
        const inner = explicitMatch[1]
        const style = pickScratchStyle(
          seed + globalWordCounter * 37,
          lastScratch
        )
        lastScratch = style
        tokens.push({
          raw: inner,
          isExplicitMistake: true,
          isAutoMistake: false,
          mistakenText: inner,
          scratchStyle: style,
          sentenceIndex,
          wordIndexInSentence: wordInSentence,
        })
        mistakes.push({
          id: `m-exp-${globalWordCounter}`,
          mistakenText: inner,
          intendedWord: '(manual cross-out)',
          kind: 'manual-strike',
          scratchStyle: style,
          isCaretSuperscript: false,
        })
        wordInSentence++
        continue
      }

      const cleanAlpha = word.replace(/[^a-zA-Z]/g, '')
      const rMistake = seededRand(seed + globalWordCounter * 113)
      const nextRaw = rawWords[wIdx + 1] || ''
      const prevWasExplicit =
        wIdx > 0 && /^~.+~$/.test(rawWords[wIdx - 1])
      const nextIsExplicit = /^~.+~$/.test(nextRaw)

      if (
        mistakeFrequency > 0 &&
        cleanAlpha.length >= 4 &&
        !prevWasExplicit &&
        !nextIsExplicit &&
        globalWordCounter - lastAutoMistakeWordIdx >= 7 &&
        rMistake < mistakeFrequency
      ) {
        lastAutoMistakeWordIdx = globalWordCounter
        const synth = synthesizeMistakenText(
          cleanAlpha,
          seed + globalWordCounter * 251
        )
        const style = pickScratchStyle(
          seed + globalWordCounter * 389,
          lastScratch
        )
        lastScratch = style

        tokens.push({
          raw: word,
          isExplicitMistake: false,
          isAutoMistake: true,
          mistakenText: synth.mistakenText,
          scratchStyle: style,
          isCaretSuperscript: synth.isCaretSuperscript,
          sentenceIndex,
          wordIndexInSentence: wordInSentence,
        })

        mistakes.push({
          id: `m-auto-${globalWordCounter}`,
          mistakenText: synth.mistakenText,
          intendedWord: word,
          kind: synth.kind,
          scratchStyle: style,
          isCaretSuperscript: synth.isCaretSuperscript,
        })
      } else {
        tokens.push({
          raw: word,
          isExplicitMistake: false,
          isAutoMistake: false,
          sentenceIndex,
          wordIndexInSentence: wordInSentence,
        })
      }

      wordInSentence++

      if (/[.!?]["')]*$/.test(word)) {
        sentenceIndex++
        wordInSentence = 0
      }
    }
  }

  return { tokens, mistakes }
}

function drawPaperSurface(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  paperStyle: PaperStyleId,
  pageIndex: number,
  seed: number
) {
  ctx.save()

  if (paperStyle === 'ink-only-white') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
    return
  }

  if (paperStyle === 'legal-pad') {
    ctx.fillStyle = '#fbf5d9'
  } else if (paperStyle === 'college-ruled') {
    ctx.fillStyle = '#fcfbf7'
  } else {
    ctx.fillStyle = '#faf7f0'
  }
  ctx.fillRect(0, 0, width, height)

  const grad = ctx.createRadialGradient(
    width * 0.48,
    height * 0.46,
    width * 0.1,
    width * 0.5,
    height * 0.5,
    width * 0.85
  )
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)')
  grad.addColorStop(1, 'rgba(175, 160, 132, 0.12)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  ctx.lineWidth = 0.65
  for (let i = 0; i < 420; i++) {
    const r1 = seededRand(seed + pageIndex * 1000 + i * 3)
    const r2 = seededRand(seed + pageIndex * 1000 + i * 3 + 1)
    const r3 = seededRand(seed + pageIndex * 1000 + i * 3 + 2)
    const fx = r1 * width
    const fy = r2 * height
    const len = 3 + r3 * 9
    const ang = r1 * Math.PI * 2
    ctx.strokeStyle =
      i % 2 === 0
        ? 'rgba(140, 128, 108, 0.045)'
        : 'rgba(255, 255, 255, 0.06)'
    ctx.beginPath()
    ctx.moveTo(fx, fy)
    ctx.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len)
    ctx.stroke()
  }

  if (paperStyle === 'college-ruled' || paperStyle === 'legal-pad') {
    const topMargin = height * 0.085
    const lineSpacing = height * 0.031
    ctx.strokeStyle =
      paperStyle === 'legal-pad'
        ? 'rgba(135, 175, 210, 0.42)'
        : 'rgba(145, 182, 228, 0.38)'
    ctx.lineWidth = 1.2

    for (let y = topMargin; y < height - height * 0.05; y += lineSpacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    const marginX = width * 0.105
    ctx.strokeStyle = 'rgba(218, 108, 108, 0.42)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(marginX, 0)
    ctx.lineTo(marginX, height)
    ctx.stroke()
  }

  ctx.restore()
}

export function renderHandwrittenDocument(
  canvases: HTMLCanvasElement[],
  config: CompositorConfig,
  pageWidth = 1700,
  pageHeight = 2200
): {
  activePages: HTMLCanvasElement[]
  telemetry: CompositorTelemetry
} {
  const style = HAND_STYLES[config.handStyle]
  const palette = INK_PALETTES[config.inkColor]
  const selector = new AllographSequenceSelector(config.seed)
  const usedAllographKeys = new Set<string>()

  const { tokens, mistakes } = tokenizeInputWithMistakes(
    config.text,
    config.mistakeFrequency,
    config.seed
  )

  const sentenceKinematics = new Map<
    number,
    {
      slopeRad: number
      slopeDeg: number
      quadArchFactor: number
      wordStepBiasY: number
    }
  >()

  const getSentenceKinematics = (sIdx: number) => {
    const existing = sentenceKinematics.get(sIdx)
    if (existing) return existing

    const r1 = seededRand(config.seed + sIdx * 97 + 13)
    const r2 = seededRand(config.seed + sIdx * 193 + 29)
    const r3 = seededRand(config.seed + sIdx * 311 + 47)

    const dir = sIdx % 3 === 0 ? -1 : sIdx % 3 === 1 ? 1 : r1 > 0.48 ? 1 : -1
    const baseAngleDeg =
      dir * (0.85 + r1 * 2.95) * config.diagonalDriftIntensity +
      (r2 - 0.5) * 1.4 * config.diagonalDriftIntensity
    const slopeRad = (baseAngleDeg * Math.PI) / 180
    const quadArchFactor =
      (r2 - 0.46) * 0.00018 * config.diagonalDriftIntensity
    const wordStepBiasY = (r3 - 0.48) * 2.2 * config.diagonalDriftIntensity

    const kin = {
      slopeRad,
      slopeDeg: baseAngleDeg,
      quadArchFactor,
      wordStepBiasY,
    }
    sentenceKinematics.set(sIdx, kin)
    return kin
  }

  const ensurePage = (idx: number): HTMLCanvasElement => {
    while (canvases.length <= idx) {
      const c = document.createElement('canvas')
      c.width = pageWidth
      c.height = pageHeight
      canvases.push(c)
    }
    const pageCanvas = canvases[idx]
    if (pageCanvas.width !== pageWidth || pageCanvas.height !== pageHeight) {
      pageCanvas.width = pageWidth
      pageCanvas.height = pageHeight
    }
    const ctx = pageCanvas.getContext('2d')!
    drawPaperSurface(
      ctx,
      pageWidth,
      pageHeight,
      config.paperStyle,
      idx,
      config.seed
    )
    return pageCanvas
  }

  let currentPageIdx = 0
  let currentCanvas = ensurePage(0)
  let ctx = currentCanvas.getContext('2d')!

  const baseLeftMargin =
    config.paperStyle === 'college-ruled' || config.paperStyle === 'legal-pad'
      ? pageWidth * 0.12
      : pageWidth * 0.082
  const baseRightMargin = pageWidth * 0.925
  const topStart = pageHeight * 0.095
  const bottomLimit = pageHeight * 0.92
  const baseLineSpacing = config.fontSizePx * 1.65

  let lineNumberOnPage = 0
  let cursorY = topStart
  let prevLineActualYProfile: Float32Array | null = null

  const getLineMargins = (lineNum: number) => {
    const r1 = seededRand(
      config.seed + currentPageIdx * 500 + lineNum * 41
    )
    const r2 = seededRand(
      config.seed + currentPageIdx * 500 + lineNum * 73
    )

    const fatigueDrift = lineNum * 1.15 * config.marginWanderIntensity
    const waveLeft =
      Math.sin(lineNum * 0.55 + config.seed) *
        20 *
        config.marginWanderIntensity +
      (r1 - 0.45) * 24 * config.marginWanderIntensity
    const waveRight =
      Math.cos(lineNum * 0.48 + config.seed * 0.5) *
        30 *
        config.marginWanderIntensity +
      (r2 - 0.5) * 38 * config.marginWanderIntensity

    return {
      left: Math.max(
        pageWidth * 0.045,
        baseLeftMargin + fatigueDrift + waveLeft
      ),
      right: Math.min(pageWidth * 0.96, baseRightMargin + waveRight),
    }
  }

  let currentMargins = getLineMargins(0)
  let cursorX = currentMargins.left
  let lineStartOriginX = cursorX
  let currentLineDriftY = 0

  let totalWordsCount = 0
  let totalGlyphsCount = 0
  const wordSlopesSampleDeg: number[] = []
  let minHeightSeen = 1.0
  let maxHeightSeen = 1.0

  const startNewLine = (extraGapMultiplier = 1.0) => {
    lineNumberOnPage++
    const rGap = seededRand(
      config.seed + currentPageIdx * 313 + lineNumberOnPage * 89
    )
    const gapJitter =
      (rGap - 0.45) *
      config.fontSizePx *
      0.32 *
      (0.5 + config.diagonalDriftIntensity * 0.5)

    let minAllowedY = cursorY + baseLineSpacing * extraGapMultiplier + gapJitter
    if (prevLineActualYProfile !== null) {
      let maxPrevLineY = 0
      for (let i = 0; i < prevLineActualYProfile.length; i++) {
        if (prevLineActualYProfile[i] > maxPrevLineY) {
          maxPrevLineY = prevLineActualYProfile[i]
        }
      }
      if (maxPrevLineY > 0) {
        minAllowedY = Math.max(
          minAllowedY,
          maxPrevLineY + config.fontSizePx * 1.14
        )
      }
    }

    cursorY = minAllowedY

    if (cursorY > bottomLimit) {
      currentPageIdx++
      currentCanvas = ensurePage(currentPageIdx)
      ctx = currentCanvas.getContext('2d')!
      lineNumberOnPage = 0
      cursorY =
        topStart +
        (seededRand(config.seed + currentPageIdx * 17) - 0.5) * 18
      prevLineActualYProfile = null
    }

    currentMargins = getLineMargins(lineNumberOnPage)
    cursorX = currentMargins.left
    lineStartOriginX = cursorX
    currentLineDriftY = 0
  }

  const renderWordUnit = (
    wordStr: string,
    xPos: number,
    yPos: number,
    sentenceIdx: number,
    wordSalt: number,
    scaleMultiplier = 1.0
  ): {
    width: number
    wordTiltRad: number
    endBaselineY: number
  } => {
    const rw1 = seededRand(config.seed + wordSalt * 53)
    const rw2 = seededRand(config.seed + wordSalt * 97)

    const sKin = getSentenceKinematics(sentenceIdx)

    const wordSlopeDeltaDeg =
      ((rw1 - 0.48) * 5.4 + Math.sin(wordSalt * 1.7) * 2.2) *
      config.diagonalDriftIntensity
    const totalWordAngleDeg =
      (sKin.slopeRad * 180) / Math.PI * 0.45 + wordSlopeDeltaDeg
    const wordTiltRad = (totalWordAngleDeg * Math.PI) / 180

    if (wordSlopesSampleDeg.length < 32 && scaleMultiplier === 1.0) {
      wordSlopesSampleDeg.push(Number(totalWordAngleDeg.toFixed(2)))
    }

    const wordBaselineHop =
      (rw2 - 0.48) * 5.8 * config.diagonalDriftIntensity
    const effectiveFontSize = Math.round(config.fontSizePx * scaleMultiplier)

    let localX = 0
    const chars = Array.from(wordStr)
    const [inkR, inkG, inkB] = palette.rgb
    let prevCharExitX: number | null = null
    let prevCharExitY: number | null = null

    for (let cIdx = 0; cIdx < chars.length; cIdx++) {
      const ch = chars[cIdx]
      const variantIdx = selector.nextVariant(ch)
      usedAllographKeys.add(`${ch}#${variantIdx}`)

      const glyph = getOrSynthesizeAllograph(
        ch,
        variantIdx,
        config.handStyle,
        config.inkColor,
        effectiveFontSize
      )

      const rc1 = seededRand(config.seed + wordSalt * 31 + cIdx * 17)
      const rc2 = seededRand(config.seed + wordSalt * 67 + cIdx * 29)

      const extraScaleY =
        1.0 +
        (rc1 - 0.48) * 0.24 * config.unevenHeightIntensity +
        (glyph.descriptor.aspectScaleY - 1.0) *
          0.35 *
          (config.unevenHeightIntensity - 1.0)

      const totalHeightRatio = glyph.descriptor.aspectScaleY * extraScaleY
      if (totalHeightRatio < minHeightSeen) minHeightSeen = totalHeightRatio
      if (totalHeightRatio > maxHeightSeen) maxHeightSeen = totalHeightRatio

      const charBounceY =
        glyph.descriptor.baselineShiftPx *
          (0.65 + config.unevenHeightIntensity * 0.45) +
        (rc2 - 0.5) * 2.8 * config.unevenHeightIntensity

      const wordInternalDy = Math.tan(wordTiltRad) * localX

      const gx = xPos + localX
      const gy = Math.max(
        68,
        Math.min(
          pageHeight - 68,
          yPos + wordBaselineHop + wordInternalDy + charBounceY
        )
      )

      ctx.save()
      ctx.translate(gx, gy)
      ctx.rotate(glyph.descriptor.rotationRad)
      ctx.scale(1.0, extraScaleY)
      ctx.drawImage(glyph.canvas, -glyph.anchorX, -glyph.baselineY)
      ctx.restore()

      if (
        cIdx > 0 &&
        prevCharExitX !== null &&
        prevCharExitY !== null &&
        ch >= 'a' &&
        ch <= 'z' &&
        chars[cIdx - 1] >= 'a' &&
        chars[cIdx - 1] <= 'z' &&
        rc1 < style.ligatureRate
      ) {
        const entryX = gx + 2
        const entryY = gy - effectiveFontSize * (0.14 + rc2 * 0.08)
        if (entryX > prevCharExitX - 4 && entryX - prevCharExitX < 18) {
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(prevCharExitX, prevCharExitY)
          const midX = (prevCharExitX + entryX) * 0.5
          const midY = Math.max(prevCharExitY, entryY) + 1.4
          ctx.quadraticCurveTo(midX, midY, entryX, entryY)
          ctx.strokeStyle = `rgba(${inkR}, ${inkG}, ${inkB}, ${(
            palette.wetAlpha * 0.52
          ).toFixed(3)})`
          ctx.lineWidth = Math.max(1.2, effectiveFontSize * 0.036)
          ctx.lineCap = 'round'
          ctx.stroke()
          ctx.restore()
        }
      }

      prevCharExitX = gx + glyph.advanceWidth * 0.88
      prevCharExitY = gy - effectiveFontSize * (0.12 + rc1 * 0.1)

      if (config.showForensicGuides) {
        ctx.save()
        ctx.fillStyle = 'rgba(217, 119, 6, 0.78)'
        ctx.font = '500 9px monospace'
        ctx.fillText(
          `v${variantIdx + 1}`,
          gx,
          gy + effectiveFontSize * 0.36
        )
        ctx.restore()
      }

      const kernJitter = (rc1 - 0.52) * (effectiveFontSize * 0.04)
      localX += Math.max(
        effectiveFontSize * 0.15,
        glyph.advanceWidth * 0.90 + kernJitter
      )
      totalGlyphsCount++
    }

    const endBaselineY =
      yPos + wordBaselineHop + Math.tan(wordTiltRad) * localX

    if (config.showForensicGuides) {
      ctx.save()
      ctx.strokeStyle = 'rgba(22, 163, 74, 0.55)'
      ctx.lineWidth = 1.2
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(xPos, yPos + wordBaselineHop)
      ctx.lineTo(xPos + localX, endBaselineY)
      ctx.stroke()
      ctx.restore()
    }

    return {
      width: localX,
      wordTiltRad,
      endBaselineY,
    }
  }

  const estimateWordWidth = (wordStr: string) =>
    wordStr.length * config.fontSizePx * 0.38

  let currentLineYProfile = new Float32Array(pageWidth)

  for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
    const token = tokens[tIdx]

    if (token.isParagraphBreak) {
      prevLineActualYProfile = currentLineYProfile
      currentLineYProfile = new Float32Array(pageWidth)
      startNewLine(1.36)
      continue
    }

    const sKin = getSentenceKinematics(token.sentenceIndex)

    /**
     * Computes the active baseline Y at `atX` using continuous incremental drift
     * so starting a new sentence mid-line transitions its slope angle smoothly
     * from the hand's current vertical position without any mid-line cliff!
     */
    const calcActiveY = (atX: number) => {
      const clampedDrift = Math.max(-28, Math.min(32, currentLineDriftY))
      let yVal = cursorY + clampedDrift

      if (prevLineActualYProfile !== null) {
        const colIdx = Math.max(
          0,
          Math.min(pageWidth - 1, Math.floor(atX))
        )
        const prevY = prevLineActualYProfile[colIdx]
        const minGap = config.fontSizePx * 1.15
        if (prevY > 0 && yVal - prevY < minGap) {
          const pushDown = prevY + minGap - yVal
          cursorY += pushDown
          yVal += pushDown
        }
      }

      return Math.max(72, Math.min(pageHeight - 72, yVal))
    }

    const advanceSentenceDrift = (stepDx: number) => {
      const slopeStep = Math.tan(sKin.slopeRad) * stepDx * 0.62
      const archStep =
        sKin.quadArchFactor * stepDx * (cursorX - lineStartOriginX - 350)
      currentLineDriftY = Math.max(
        -28,
        Math.min(
          32,
          currentLineDriftY + slopeStep + archStep + sKin.wordStepBiasY * 0.45
        )
      )
    }

    const recordSpanInLineProfile = (x0: number, x1: number, yVal: number) => {
      const i0 = Math.max(0, Math.floor(x0 - 8))
      const i1 = Math.min(pageWidth - 1, Math.ceil(x1 + 8))
      for (let px = i0; px <= i1; px++) {
        if (yVal > currentLineYProfile[px]) {
          currentLineYProfile[px] = yVal
        }
      }
    }

    // 1. Explicit ~mistake~ token
    if (token.isExplicitMistake && token.mistakenText && token.scratchStyle) {
      const estW = estimateWordWidth(token.mistakenText)
      if (
        cursorX + estW > currentMargins.right &&
        cursorX > currentMargins.left + 20
      ) {
        prevLineActualYProfile = currentLineYProfile
        currentLineYProfile = new Float32Array(pageWidth)
        startNewLine(1.0)
      }

      const activeY = calcActiveY(cursorX)
      const rendered = renderWordUnit(
        token.mistakenText,
        cursorX,
        activeY,
        token.sentenceIndex,
        tIdx * 19 + 3
      )

      renderScratchOutOverlay(
        ctx,
        cursorX,
        activeY,
        rendered.width,
        config.fontSizePx * 0.48,
        rendered.wordTiltRad,
        token.scratchStyle,
        palette,
        config.seed + tIdx * 101
      )

      recordSpanInLineProfile(
        cursorX,
        cursorX + rendered.width,
        Math.max(activeY, rendered.endBaselineY)
      )

      const spaceGap =
        config.fontSizePx *
        (0.42 + seededRand(config.seed + tIdx * 71) * 0.34)
      const stepDx = rendered.width + spaceGap
      cursorX += stepDx
      advanceSentenceDrift(stepDx)
      totalWordsCount++
      continue
    }

    // 2. Automatic human mistake (false-start + scratch-out + correction)
    if (token.isAutoMistake && token.mistakenText && token.scratchStyle) {
      const estMistakeW = estimateWordWidth(token.mistakenText)
      const estSuperW = token.isCaretSuperscript
        ? estimateWordWidth(token.raw) * 0.78
        : 0
      if (
        cursorX + estMistakeW + estSuperW > currentMargins.right &&
        cursorX > currentMargins.left + 20
      ) {
        prevLineActualYProfile = currentLineYProfile
        currentLineYProfile = new Float32Array(pageWidth)
        startNewLine(1.0)
      }

      const mistakeY = calcActiveY(cursorX)
      const mistakeRender = renderWordUnit(
        token.mistakenText,
        cursorX,
        mistakeY,
        token.sentenceIndex,
        tIdx * 23 + 7
      )

      renderScratchOutOverlay(
        ctx,
        cursorX,
        mistakeY,
        mistakeRender.width,
        config.fontSizePx * 0.48,
        mistakeRender.wordTiltRad,
        token.scratchStyle,
        palette,
        config.seed + tIdx * 137
      )

      recordSpanInLineProfile(
        cursorX,
        cursorX + mistakeRender.width,
        Math.max(mistakeY, mistakeRender.endBaselineY)
      )

      if (token.isCaretSuperscript) {
        const caretX =
          cursorX + mistakeRender.width + config.fontSizePx * 0.24
        renderHandwrittenCaret(
          ctx,
          caretX,
          mistakeY + 4,
          config.fontSizePx * 0.45,
          palette,
          config.seed + tIdx * 199
        )

        const superX = caretX - config.fontSizePx * 0.18
        const superY = Math.max(
          68,
          mistakeY - config.fontSizePx * 0.68
        )
        const superRender = renderWordUnit(
          token.raw,
          superX,
          superY,
          token.sentenceIndex,
          tIdx * 29 + 11,
          0.76
        )

        const afterSpace =
          config.fontSizePx *
          (0.36 + seededRand(config.seed + tIdx * 83) * 0.24)
        const nextCursorX = Math.max(
          cursorX + mistakeRender.width + config.fontSizePx * 0.55,
          superX + superRender.width + afterSpace
        )
        const stepDx = nextCursorX - cursorX
        cursorX = nextCursorX
        advanceSentenceDrift(stepDx)
        totalWordsCount += 2
        continue
      } else {
        const pauseGap =
          config.fontSizePx *
          (0.40 + seededRand(config.seed + tIdx * 59) * 0.28)
        const stepDx = mistakeRender.width + pauseGap
        cursorX += stepDx
        advanceSentenceDrift(stepDx)
        totalWordsCount++
      }
    }

    // 3. Intended word
    const estW = estimateWordWidth(token.raw)
    if (
      cursorX + estW > currentMargins.right &&
      cursorX > currentMargins.left + 20
    ) {
      prevLineActualYProfile = currentLineYProfile
      currentLineYProfile = new Float32Array(pageWidth)
      startNewLine(1.0)
    }

    const wordY = calcActiveY(cursorX)
    const rendered = renderWordUnit(
      token.raw,
      cursorX,
      wordY,
      token.sentenceIndex,
      tIdx * 37 + 17
    )

    recordSpanInLineProfile(
      cursorX,
      cursorX + rendered.width,
      Math.max(wordY, rendered.endBaselineY)
    )

    const rSpace = seededRand(config.seed + tIdx * 109)
    const isSentenceEnd = /[.!?]["')]*$/.test(token.raw)
    const isClausePause = /[,;:—-]$/.test(token.raw)
    const baseWordSpace =
      config.fontSizePx *
      (0.38 +
        rSpace * 0.28 +
        (isSentenceEnd ? 0.28 : isClausePause ? 0.14 : 0))

    const stepDx = rendered.width + baseWordSpace
    cursorX += stepDx
    advanceSentenceDrift(stepDx)
    totalWordsCount++
  }

  const activePages = canvases.slice(0, currentPageIdx + 1)
  const sentenceSlopesDeg = Array.from(sentenceKinematics.values()).map((k) =>
    Number(k.slopeDeg.toFixed(2))
  )

  return {
    activePages,
    telemetry: {
      pageCount: activePages.length,
      totalWords: totalWordsCount,
      totalGlyphs: totalGlyphsCount,
      uniqueAllographsCount: usedAllographKeys.size,
      mistakes,
      sentenceSlopesDeg,
      wordSlopesSampleDeg,
      minCharHeightRatio: Number(minHeightSeen.toFixed(2)),
      maxCharHeightRatio: Number(maxHeightSeen.toFixed(2)),
    },
  }
}
