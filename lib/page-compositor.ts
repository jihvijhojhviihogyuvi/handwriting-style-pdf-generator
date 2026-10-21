/**
 * Biomechanical Page Layout & Handwriting Compositor
 *
 * Implements multi-scale human handwriting kinematics with full-line lookahead
 * trajectory clearance (so every sentence and word drifts diagonally across the page
 * by a different amount with zero mid-line step jumps and zero line-to-line collisions):
 *
 * 1. Sentence-level non-uniform diagonal trajectory (each sentence drifts at a distinct diagonal slope)
 * 2. Line-level diagonal slope, wrist-pivot curvature, wandering left/right margins, and uneven line spacing
 * 3. Word-level independent diagonal tilt, baseline vertical step, uneven word height scale, and irregular word gaps
 * 4. Character-level uneven height (scaleY), width (scaleX), baseline bounce, 20-allograph variant cycling,
 *    and natural inter-letter cursive ligature connections.
 * 5. Authentic crossed-out mistakes (false starts, phonetic slips, word restarts, and caret ^ superscripts).
 */

import {
  AllographScheduler,
  getOrSynthesizeAllograph,
  HAND_STYLES,
  HandStyleId,
  INK_PALETTES,
  InkColorId,
} from './allograph-engine'
import {
  GeneratedMistake,
  MistakeKind,
  pickScratchStyle,
  renderHandwrittenCaret,
  renderScratchOutOverlay,
  ScratchStyle,
  synthesizeMistakenText,
} from './mistake-generator'

export type PaperStyleId =
  | 'ink-only-white'
  | 'natural-bond'
  | 'college-ruled'
  | 'legal-pad'
  | 'exam-booklet'

export interface CompositorConfig {
  text: string
  handStyle: HandStyleId
  inkColor: InkColorId
  paperStyle: PaperStyleId
  fontSizePx: number
  diagonalDriftIntensity: number
  unevenHeightIntensity: number
  mistakeFrequency: number
  marginWanderIntensity: number
  seed: number
  showForensicGuides?: boolean
}

export interface RenderedMistakeRecord extends GeneratedMistake {
  pageIndex: number
  sentenceIndex: number
}

export interface CompositorTelemetry {
  pageCount: number
  totalWords: number
  totalGlyphs: number
  uniqueAllographsCount: number
  mistakes: RenderedMistakeRecord[]
  sentenceSlopesDeg: number[]
  wordSlopesSampleDeg: number[]
  minCharHeightRatio: number
  maxCharHeightRatio: number
}

function pseudoRand(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function signedRand(seed: number, salt: number): number {
  return pseudoRand(seed, salt) * 2 - 1
}

interface WordToken {
  rawText: string
  sentenceIndex: number
  globalIndex: number
  isManualStrike: boolean
  isParagraphBreak?: boolean
  preMistake?: {
    mistakenText: string
    kind: MistakeKind
    scratchStyle: ScratchStyle
    isCaretSuperscript: boolean
    id: string
  }
}

function tokenizeWithMistakes(
  text: string,
  mistakeFrequency: number,
  seed: number
): WordToken[] {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const tokens: WordToken[] = []
  let sentenceCounter = 0
  let globalWordIdx = 0
  let lastScratchStyle: ScratchStyle | undefined
  let cooldown = 0

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx].trim()
    if (!para) {
      tokens.push({
        rawText: '',
        sentenceIndex: sentenceCounter,
        globalIndex: globalWordIdx,
        isManualStrike: false,
        isParagraphBreak: true,
      })
      sentenceCounter++
      continue
    }

    const rawWords = para.split(/\s+/).filter(Boolean)
    for (let wIdx = 0; wIdx < rawWords.length; wIdx++) {
      globalWordIdx++
      const word = rawWords[wIdx]

      if (word.startsWith('~') && word.endsWith('~') && word.length > 2) {
        const inner = word.slice(1, -1)
        const style = pickScratchStyle(seed + globalWordIdx * 37, lastScratchStyle)
        lastScratchStyle = style
        tokens.push({
          rawText: inner,
          sentenceIndex: sentenceCounter,
          globalIndex: globalWordIdx,
          isManualStrike: true,
          preMistake: {
            mistakenText: inner,
            kind: 'manual-strike',
            scratchStyle: style,
            isCaretSuperscript: false,
            id: `manual-${globalWordIdx}`,
          },
        })
        continue
      }

      const cleanAlpha = word.replace(/[^a-zA-Z]/g, '')
      const roll = pseudoRand(seed, globalWordIdx * 53 + 19)

      let preMistake: WordToken['preMistake'] | undefined
      if (cooldown > 0) {
        cooldown--
      } else if (
        mistakeFrequency > 0 &&
        cleanAlpha.length >= 3 &&
        roll < mistakeFrequency
      ) {
        const synth = synthesizeMistakenText(
          cleanAlpha,
          seed + globalWordIdx * 71
        )
        const style = pickScratchStyle(
          seed + globalWordIdx * 89,
          lastScratchStyle
        )
        lastScratchStyle = style
        preMistake = {
          mistakenText: synth.mistakenText,
          kind: synth.kind,
          scratchStyle: style,
          isCaretSuperscript: synth.isCaretSuperscript,
          id: `mistake-${globalWordIdx}`,
        }
        cooldown = 5
      }

      tokens.push({
        rawText: word,
        sentenceIndex: sentenceCounter,
        globalIndex: globalWordIdx,
        isManualStrike: false,
        preMistake,
      })

      if (/[.!?;:]$/.test(word) || (word.endsWith(',') && wIdx % 6 === 5)) {
        sentenceCounter++
      }
    }

    if (pIdx < paragraphs.length - 1) {
      tokens.push({
        rawText: '',
        sentenceIndex: sentenceCounter,
        globalIndex: globalWordIdx,
        isManualStrike: false,
        isParagraphBreak: true,
      })
      sentenceCounter++
    }
  }

  return tokens
}

function renderPaperSurface(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  paperStyle: PaperStyleId,
  seed: number
) {
  ctx.save()

  if (paperStyle === 'ink-only-white') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
    return
  }

  if (paperStyle === 'natural-bond' || paperStyle === 'exam-booklet') {
    const grad = ctx.createLinearGradient(0, 0, width, height)
    if (paperStyle === 'natural-bond') {
      grad.addColorStop(0, '#fcfbf7')
      grad.addColorStop(0.5, '#f8f6f0')
      grad.addColorStop(1, '#f3efe6')
    } else {
      grad.addColorStop(0, '#f7f5ec')
      grad.addColorStop(1, '#eeeadd')
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  } else if (paperStyle === 'college-ruled') {
    ctx.fillStyle = '#fbfaf6'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(125, 168, 224, 0.36)'
    ctx.lineWidth = 1.4
    const topMargin = Math.round(height * 0.1)
    const ruleGap = Math.round(height * 0.036)
    for (let y = topMargin; y < height - height * 0.05; y += ruleGap) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    const marginX = Math.round(width * 0.115)
    ctx.strokeStyle = 'rgba(218, 108, 118, 0.42)'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(marginX, 0)
    ctx.lineTo(marginX, height)
    ctx.stroke()
  } else if (paperStyle === 'legal-pad') {
    const grad = ctx.createLinearGradient(0, 0, 0, height)
    grad.addColorStop(0, '#fef9d8')
    grad.addColorStop(1, '#f9f1be')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(110, 158, 210, 0.38)'
    ctx.lineWidth = 1.4
    const topMargin = Math.round(height * 0.105)
    const ruleGap = Math.round(height * 0.038)
    for (let y = topMargin; y < height - height * 0.05; y += ruleGap) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    const mX = Math.round(width * 0.12)
    ctx.strokeStyle = 'rgba(210, 85, 85, 0.45)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(mX, 0)
    ctx.lineTo(mX, height)
    ctx.moveTo(mX + 8, 0)
    ctx.lineTo(mX + 8, height)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(110, 100, 85, 0.022)'
  for (let i = 0; i < 280; i++) {
    const gx = pseudoRand(seed, i * 3 + 1) * width
    const gy = pseudoRand(seed, i * 3 + 2) * height
    const gw = 1 + pseudoRand(seed, i * 3 + 3) * 3
    ctx.fillRect(gx, gy, gw, 1.2)
  }

  ctx.restore()
}

function renderHandwrittenWord(
  ctx: CanvasRenderingContext2D,
  wordText: string,
  startX: number,
  startY: number,
  wordTiltRad: number,
  wordHeightScale: number,
  config: CompositorConfig,
  scheduler: AllographScheduler,
  usedAllographs: Set<string>,
  wordSeed: number,
  telemetryBounds: { minH: number; maxH: number }
): { advanceX: number; endBaselineY: number; glyphsDrawn: number } {
  const chars = Array.from(wordText)
  const palette = INK_PALETTES[config.inkColor]
  const style = HAND_STYLES[config.handStyle]
  const [r, g, b] = palette.rgb

  let localX = 0
  let prevExitX: number | null = null
  let prevExitY: number | null = null
  let prevCanConnect = false
  let glyphsDrawn = 0

  ctx.save()
  ctx.translate(startX, startY)
  ctx.rotate(wordTiltRad)

  for (let cIdx = 0; cIdx < chars.length; cIdx++) {
    const ch = chars[cIdx]
    const pos: 'initial' | 'medial' | 'final' | 'single' =
      chars.length === 1
        ? 'single'
        : cIdx === 0
          ? 'initial'
          : cIdx === chars.length - 1
            ? 'final'
            : 'medial'

    const variantIdx = scheduler.nextVariant(ch, pos)
    usedAllographs.add(`${ch}:${variantIdx}`)

    const glyph = getOrSynthesizeAllograph(
      ch,
      variantIdx,
      config.handStyle,
      config.inkColor,
      config.fontSizePx
    )

    const hInt = config.unevenHeightIntensity
    const charWave = Math.sin(cIdx * 1.4 + wordSeed * 0.7)
    const charRandY = signedRand(wordSeed, cIdx * 31 + 7)
    const charRandX = signedRand(wordSeed, cIdx * 43 + 13)
    const charBounceRand = signedRand(wordSeed, cIdx * 59 + 23)
    const charRotRand = signedRand(wordSeed, cIdx * 67 + 29)

    // Uneven letter height within the word
    const charHeightScale = Math.max(
      0.68,
      Math.min(
        1.42,
        wordHeightScale *
          (1.0 + hInt * (0.15 * charRandY + 0.08 * charWave))
      )
    )
    const charWidthScale = Math.max(
      0.84,
      Math.min(1.22, 1.0 + hInt * 0.09 * charRandX)
    )

    if (/[a-zA-Z]/.test(ch)) {
      telemetryBounds.minH = Math.min(telemetryBounds.minH, charHeightScale)
      telemetryBounds.maxH = Math.max(telemetryBounds.maxH, charHeightScale)
    }

    // Per-character vertical bounce off the word's diagonal baseline
    const charBounceY =
      hInt * (charBounceRand * config.fontSizePx * 0.072)

    const charRotRad =
      charRotRand * 0.055 * Math.max(0.4, config.diagonalDriftIntensity * 0.75)

    ctx.save()
    ctx.translate(localX, charBounceY)
    ctx.rotate(charRotRad)
    ctx.scale(charWidthScale, charHeightScale)
    ctx.drawImage(glyph.canvas, -glyph.anchorX, -glyph.baselineY)
    ctx.restore()

    const currentCanReceive = /[a-z]/.test(ch) && ch !== 'x' && ch !== 'z'
    if (
      prevCanConnect &&
      currentCanReceive &&
      prevExitX !== null &&
      prevExitY !== null &&
      pseudoRand(wordSeed, cIdx * 83) < style.ligatureRate
    ) {
      const entryX = localX + config.fontSizePx * 0.05
      const entryY = charBounceY - config.fontSizePx * 0.15 * charHeightScale
      const midX = (prevExitX + entryX) * 0.5
      const midY = Math.max(prevExitY, entryY) + config.fontSizePx * 0.04

      ctx.beginPath()
      ctx.moveTo(prevExitX, prevExitY)
      ctx.quadraticCurveTo(midX, midY, entryX, entryY)
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(palette.dryAlpha * 0.65).toFixed(3)})`
      ctx.lineWidth = Math.max(1.2, (config.fontSizePx / 28) * style.strokeWeight)
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    const kernJitter =
      signedRand(wordSeed, cIdx * 97 + 41) * config.fontSizePx * 0.032
    const stepX = Math.max(
      config.fontSizePx * 0.22,
      glyph.advanceWidth * charWidthScale * 0.93 + kernJitter
    )

    prevExitX = localX + stepX * 0.88
    prevExitY = charBounceY - config.fontSizePx * 0.14 * charHeightScale
    prevCanConnect = /[acdehilmnorstuvwy]/.test(ch)

    localX += stepX
    glyphsDrawn++
  }

  ctx.restore()

  const advanceX = Math.cos(wordTiltRad) * localX
  const endBaselineY = startY + Math.sin(wordTiltRad) * localX

  return {
    advanceX: Math.max(config.fontSizePx * 0.28, advanceX),
    endBaselineY,
    glyphsDrawn,
  }
}

function estimateWordWidth(wordText: string, fontSizePx: number): number {
  return wordText.length * fontSizePx * 0.48
}

export function renderHandwrittenDocument(
  canvases: HTMLCanvasElement[],
  config: CompositorConfig,
  pageWidthPx = 1700,
  pageHeightPx = 2200
): {
  activePages: HTMLCanvasElement[]
  telemetry: CompositorTelemetry
} {
  const tokens = tokenizeWithMistakes(
    config.text,
    config.mistakeFrequency,
    config.seed
  )
  const scheduler = new AllographScheduler(config.seed)
  const usedAllographs = new Set<string>()
  const mistakes: RenderedMistakeRecord[] = []
  const sentenceSlopesDeg: number[] = []
  const wordSlopesSampleDeg: number[] = []
  const telemetryBounds = { minH: 1.0, maxH: 1.0 }

  // Non-uniform Sentence-Level Diagonal Drift Profiles
  const sentenceProfiles = new Map<
    number,
    { slopeRad: number; sentenceHeightBias: number }
  >()

  let prevSign = -1
  for (let s = 0; s <= 300; s++) {
    const rMag = 0.3 + 0.7 * pseudoRand(config.seed, s * 41 + 7)
    const flipRoll = pseudoRand(config.seed, s * 67 + 13)
    const sign = flipRoll < 0.6 ? -prevSign : prevSign
    prevSign = sign

    // Diagonal slope in degrees: e.g. -4.5° to +4.8° scaled by diagonalDriftIntensity
    const deg =
      sign *
      (1.3 + 3.1 * rMag) *
      Math.max(0.15, config.diagonalDriftIntensity)
    const slopeRad = (deg * Math.PI) / 180
    const sentenceHeightBias =
      1.0 +
      signedRand(config.seed, s * 103 + 37) *
        0.15 *
        config.unevenHeightIntensity

    sentenceProfiles.set(s, { slopeRad, sentenceHeightBias })
    if (s < 24) {
      sentenceSlopesDeg.push(Number(deg.toFixed(1)))
    }
  }

  // Group tokens into lines first so each line's full diagonal trajectory can be
  // positioned safely below the previous line without mid-line vertical jumps!
  const baseLeftMargin =
    config.paperStyle === 'college-ruled' || config.paperStyle === 'legal-pad'
      ? Math.round(pageWidthPx * 0.135)
      : Math.round(pageWidthPx * 0.088)
  const baseRightLimit = Math.round(pageWidthPx * 0.915)

  interface PlannedLine {
    tokens: WordToken[]
    isParaStart: boolean
    lineIndex: number
    startX: number
    lineSlopeRad: number
    wristArcAmp: number
  }

  const plannedLines: PlannedLine[] = []
  let currentLineTokens: WordToken[] = []
  let isNextParaStart = false
  let lineCounter = 0

  const createPlannedLineMeta = (lIdx: number, isPara: boolean) => {
    const leftWander =
      (signedRand(config.seed, lIdx * 61 + 3) * 0.85 +
        Math.sin(lIdx * 0.7) * 0.45) *
      config.fontSizePx *
      0.85 *
      config.marginWanderIntensity
    const paraIndent = isPara
      ? config.fontSizePx * (0.9 + 0.45 * pseudoRand(config.seed, lIdx * 23))
      : 0
    const startX = Math.max(
      pageWidthPx * 0.045,
      baseLeftMargin + leftWander + paraIndent
    )
    const lineDeg =
      signedRand(config.seed, lIdx * 79 + 17) *
      3.2 *
      config.diagonalDriftIntensity
    const wristArcAmp =
      signedRand(config.seed, lIdx * 93 + 31) *
      config.fontSizePx *
      0.42 *
      config.diagonalDriftIntensity
    return {
      startX,
      lineSlopeRad: (lineDeg * Math.PI) / 180,
      wristArcAmp,
    }
  }

  let curMeta = createPlannedLineMeta(0, false)
  let simX = curMeta.startX

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok.isParagraphBreak) {
      if (currentLineTokens.length > 0) {
        plannedLines.push({
          tokens: currentLineTokens,
          isParaStart: isNextParaStart,
          lineIndex: lineCounter,
          ...curMeta,
        })
        currentLineTokens = []
        lineCounter++
      }
      isNextParaStart = true
      curMeta = createPlannedLineMeta(lineCounter, true)
      simX = curMeta.startX
      continue
    }

    const lineRightLimit =
      baseRightLimit +
      signedRand(config.seed, lineCounter * 97 + 5) *
        config.fontSizePx *
        1.25 *
        config.marginWanderIntensity

    const estW =
      estimateWordWidth(tok.rawText, config.fontSizePx) +
      (tok.preMistake && !tok.isManualStrike
        ? estimateWordWidth(tok.preMistake.mistakenText, config.fontSizePx) +
          config.fontSizePx * 0.65
        : 0)

    if (
      simX + estW > lineRightLimit &&
      currentLineTokens.length > 0
    ) {
      plannedLines.push({
        tokens: currentLineTokens,
        isParaStart: isNextParaStart,
        lineIndex: lineCounter,
        ...curMeta,
      })
      currentLineTokens = [tok]
      isNextParaStart = false
      lineCounter++
      curMeta = createPlannedLineMeta(lineCounter, false)
      simX = curMeta.startX + estW + config.fontSizePx * 0.45
    } else {
      currentLineTokens.push(tok)
      simX += estW + config.fontSizePx * 0.45
    }
  }

  if (currentLineTokens.length > 0) {
    plannedLines.push({
      tokens: currentLineTokens,
      isParaStart: isNextParaStart,
      lineIndex: lineCounter,
      ...curMeta,
    })
  }

  const ensureCanvasPage = (pageIndex: number): HTMLCanvasElement => {
    while (canvases.length <= pageIndex) {
      const c = document.createElement('canvas')
      c.width = pageWidthPx
      c.height = pageHeightPx
      canvases.push(c)
    }
    const c = canvases[pageIndex]
    if (c.width !== pageWidthPx || c.height !== pageHeightPx) {
      c.width = pageWidthPx
      c.height = pageHeightPx
    }
    const ctx = c.getContext('2d')!
    renderPaperSurface(
      ctx,
      pageWidthPx,
      pageHeightPx,
      config.paperStyle,
      config.seed + pageIndex * 101
    )
    return c
  }

  let currentPageIdx = 0
  let currentCanvas = ensureCanvasPage(0)
  let ctx = currentCanvas.getContext('2d')!

  const topStart = Math.round(pageHeightPx * 0.1)
  const bottomLimit = Math.round(pageHeightPx * 0.915)
  const baseLineHeight = Math.round(config.fontSizePx * 1.72)
  const minLineClearance = Math.round(config.fontSizePx * 1.32)

  const NUM_BUCKETS = 34
  let prevLineFloorByBucket = new Array<number>(NUM_BUCKETS).fill(
    topStart - baseLineHeight
  )

  let totalWords = 0
  let totalGlyphs = 0
  const palette = INK_PALETTES[config.inkColor]

  for (let lIdx = 0; lIdx < plannedLines.length; lIdx++) {
    const line = plannedLines[lIdx]
    const extraParaGap =
      line.isParaStart && lIdx > 0 ? config.fontSizePx * 0.65 : 0
    const lineGapJitter =
      signedRand(config.seed, lIdx * 47 + 9) *
      config.fontSizePx *
      0.26 *
      config.unevenHeightIntensity

    // Lookahead pass: trace the relative vertical offset of this line across X buckets
    // so we can choose a single clean starting Y that never collides with the previous line!
    const relYByBucket = new Array<number>(NUM_BUCKETS).fill(0)
    let lookX = line.startX
    let lookRelY = 0
    for (const tok of line.tokens) {
      const sProf =
        sentenceProfiles.get(tok.sentenceIndex) ?? sentenceProfiles.get(0)!
      const slopeRad = sProf.slopeRad * 0.65 + line.lineSlopeRad * 0.55
      const wEst =
        estimateWordWidth(tok.rawText, config.fontSizePx) +
        (tok.preMistake && !tok.isManualStrike
          ? estimateWordWidth(tok.preMistake.mistakenText, config.fontSizePx) +
            config.fontSizePx * 0.65
          : 0)
      const prog = Math.max(
        0,
        Math.min(1, (lookX - baseLeftMargin) / (baseRightLimit - baseLeftMargin))
      )
      const arcDy = Math.sin(prog * Math.PI) * line.wristArcAmp
      const b0 = Math.max(
        0,
        Math.min(NUM_BUCKETS - 1, Math.floor((lookX / pageWidthPx) * NUM_BUCKETS))
      )
      const b1 = Math.max(
        0,
        Math.min(
          NUM_BUCKETS - 1,
          Math.floor(((lookX + wEst) / pageWidthPx) * NUM_BUCKETS)
        )
      )
      for (let b = b0; b <= b1; b++) {
        relYByBucket[b] = Math.min(relYByBucket[b], lookRelY + arcDy)
      }
      const step = wEst + config.fontSizePx * 0.45
      lookX += step
      lookRelY += step * Math.tan(slopeRad)
    }

    // Find required starting Y so every bucket clears prevLineFloorByBucket
    let requiredStartY =
      prevLineFloorByBucket[2] + baseLineHeight * 0.85 + extraParaGap + lineGapJitter
    for (let b = 0; b < NUM_BUCKETS; b++) {
      const neededAtB =
        prevLineFloorByBucket[b] +
        minLineClearance +
        extraParaGap -
        relYByBucket[b]
      if (neededAtB > requiredStartY) {
        requiredStartY = neededAtB
      }
    }

    if (requiredStartY > bottomLimit) {
      currentPageIdx++
      currentCanvas = ensureCanvasPage(currentPageIdx)
      ctx = currentCanvas.getContext('2d')!
      requiredStartY =
        topStart +
        signedRand(config.seed, currentPageIdx * 71) *
          config.fontSizePx *
          0.3
      prevLineFloorByBucket = new Array<number>(NUM_BUCKETS).fill(
        requiredStartY - baseLineHeight
      )
    }

    const currentLineFloor = new Array<number>(NUM_BUCKETS).fill(requiredStartY)
    const recordSpan = (x0: number, x1: number, y0: number, y1: number) => {
      const b0 = Math.max(
        0,
        Math.min(NUM_BUCKETS - 1, Math.floor((x0 / pageWidthPx) * NUM_BUCKETS))
      )
      const b1 = Math.max(
        0,
        Math.min(NUM_BUCKETS - 1, Math.floor((x1 / pageWidthPx) * NUM_BUCKETS))
      )
      const floorY = Math.max(y0, y1) + config.fontSizePx * 0.22
      for (let b = b0; b <= b1; b++) {
        currentLineFloor[b] = Math.max(currentLineFloor[b], floorY)
      }
    }

    let cursorX = line.startX
    let runningDeltaY = 0

    for (let wIdx = 0; wIdx < line.tokens.length; wIdx++) {
      const token = line.tokens[wIdx]
      const wordSeed = config.seed + token.globalIndex * 131 + 17
      const sProfile =
        sentenceProfiles.get(token.sentenceIndex) ?? sentenceProfiles.get(0)!

      const activeTrajectoryRad =
        sProfile.slopeRad * 0.65 + line.lineSlopeRad * 0.55

      const progressX = Math.max(
        0,
        Math.min(
          1,
          (cursorX - baseLeftMargin) / (baseRightLimit - baseLeftMargin)
        )
      )
      const wristArcOffset = Math.sin(progressX * Math.PI) * line.wristArcAmp
      const wordVerticalStep =
        signedRand(wordSeed, 19) *
        config.fontSizePx *
        0.13 *
        config.diagonalDriftIntensity

      const wordBaselineY =
        requiredStartY + runningDeltaY + wristArcOffset + wordVerticalStep

      // Each individual word has its own independent diagonal tilt angle!
      const wordLocalTiltDeg =
        (activeTrajectoryRad * 180) / Math.PI +
        signedRand(wordSeed, 29) * 4.2 * config.diagonalDriftIntensity
      const wordTiltRad = (wordLocalTiltDeg * Math.PI) / 180

      if (wordSlopesSampleDeg.length < 36) {
        wordSlopesSampleDeg.push(Number(wordLocalTiltDeg.toFixed(1)))
      }

      // Each individual word has its own UNEVEN HEIGHT SCALE
      const wordHeightJitter =
        signedRand(wordSeed, 43) * 0.22 * config.unevenHeightIntensity
      const wordHeightScale = Math.max(
        0.72,
        Math.min(1.36, sProfile.sentenceHeightBias + wordHeightJitter)
      )

      const estMainW = estimateWordWidth(token.rawText, config.fontSizePx)

      if (config.showForensicGuides) {
        ctx.save()
        ctx.strokeStyle = 'rgba(224, 159, 62, 0.55)'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(cursorX, wordBaselineY)
        ctx.lineTo(
          cursorX + Math.cos(wordTiltRad) * estMainW,
          wordBaselineY + Math.sin(wordTiltRad) * estMainW
        )
        ctx.stroke()
        ctx.restore()
      }

      // 1. Render crossed-out mistake if present
      if (token.preMistake) {
        const m = token.preMistake
        const mistakeTiltRad =
          wordTiltRad + signedRand(wordSeed, 61) * 0.045
        const mistakeHeightScale =
          wordHeightScale * (0.94 + 0.1 * pseudoRand(wordSeed, 67))

        const mRes = renderHandwrittenWord(
          ctx,
          m.mistakenText,
          cursorX,
          wordBaselineY,
          mistakeTiltRad,
          mistakeHeightScale,
          config,
          scheduler,
          usedAllographs,
          wordSeed + 503,
          telemetryBounds
        )

        renderScratchOutOverlay(
          ctx,
          cursorX,
          wordBaselineY,
          mRes.advanceX,
          config.fontSizePx * 0.54 * mistakeHeightScale,
          mistakeTiltRad,
          m.scratchStyle,
          palette,
          wordSeed + 709
        )

        recordSpan(
          cursorX,
          cursorX + mRes.advanceX,
          wordBaselineY,
          mRes.endBaselineY
        )

        mistakes.push({
          id: m.id,
          mistakenText: m.mistakenText,
          intendedWord: token.rawText,
          kind: m.kind,
          scratchStyle: m.scratchStyle,
          isCaretSuperscript: m.isCaretSuperscript,
          pageIndex: currentPageIdx,
          sentenceIndex: token.sentenceIndex,
        })

        totalGlyphs += mRes.glyphsDrawn

        const mGap =
          config.fontSizePx * (0.44 + 0.22 * pseudoRand(wordSeed, 83))
        const totalStepX = mRes.advanceX + mGap

        cursorX += totalStepX
        runningDeltaY += totalStepX * Math.tan(activeTrajectoryRad)

        if (token.isManualStrike) {
          totalWords++
          continue
        }

        if (m.isCaretSuperscript) {
          const caretX = cursorX - mGap * 0.45
          renderHandwrittenCaret(
            ctx,
            caretX,
            wordBaselineY + config.fontSizePx * 0.05,
            config.fontSizePx * 0.5,
            palette,
            wordSeed + 811
          )

          const superY = wordBaselineY - config.fontSizePx * 0.52
          const superX = caretX - config.fontSizePx * 0.18
          const superRes = renderHandwrittenWord(
            ctx,
            token.rawText,
            superX,
            superY,
            wordTiltRad - 0.03,
            wordHeightScale * 0.78,
            config,
            scheduler,
            usedAllographs,
            wordSeed + 919,
            telemetryBounds
          )
          totalGlyphs += superRes.glyphsDrawn
          totalWords++
          cursorX += superRes.advanceX * 0.8
          continue
        }
      }

      const mainWordY =
        requiredStartY + runningDeltaY + wristArcOffset + wordVerticalStep

      // 2. Render the intended word
      const mainRes = renderHandwrittenWord(
        ctx,
        token.rawText,
        cursorX,
        mainWordY,
        wordTiltRad,
        wordHeightScale,
        config,
        scheduler,
        usedAllographs,
        wordSeed,
        telemetryBounds
      )

      recordSpan(
        cursorX,
        cursorX + mainRes.advanceX,
        mainWordY,
        mainRes.endBaselineY
      )

      totalWords++
      totalGlyphs += mainRes.glyphsDrawn

      const isSentenceEnd = /[.!?;:]$/.test(token.rawText)
      const baseGap = isSentenceEnd
        ? config.fontSizePx * 0.68
        : config.fontSizePx * 0.44
      const gapVariance =
        signedRand(wordSeed, 109) *
        config.fontSizePx *
        0.18 *
        Math.max(0.5, config.diagonalDriftIntensity)

      const stepX =
        mainRes.advanceX +
        Math.max(config.fontSizePx * 0.28, baseGap + gapVariance)

      cursorX += stepX
      runningDeltaY += stepX * Math.tan(activeTrajectoryRad)
    }

    prevLineFloorByBucket = currentLineFloor
  }

  const activePages = canvases.slice(0, currentPageIdx + 1)

  return {
    activePages,
    telemetry: {
      pageCount: activePages.length,
      totalWords,
      totalGlyphs,
      uniqueAllographsCount: usedAllographs.size,
      mistakes,
      sentenceSlopesDeg,
      wordSlopesSampleDeg,
      minCharHeightRatio: Number(telemetryBounds.minH.toFixed(2)),
      maxCharHeightRatio: Number(telemetryBounds.maxH.toFixed(2)),
    },
  }
}
