'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearAllographCache,
  HAND_STYLES,
  HandStyleId,
  INK_PALETTES,
  InkColorId,
} from '@/lib/allograph-engine'
import {
  CompositorConfig,
  CompositorTelemetry,
  PaperStyleId,
  renderHandwrittenDocument,
} from '@/lib/page-compositor'
import { buildPdfFromCanvases, downloadPdfBlob } from '@/lib/pdf-builder'
import { AllographSpecimenModal } from './allograph-specimen-modal'
import {
  Download,
  Printer,
  Shuffle,
  Fingerprint,
  Sliders,
  FileText,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Eye,
  CheckCircle2,
  AlertCircle,
  Compass,
  PenTool,
  RotateCcw,
} from 'lucide-react'

const SAMPLE_PRESETS: Record<string, { label: string; text: string }> = {
  'personal-note': {
    label: 'Personal Desk Note',
    text: `Hey — I wanted to write this all down by hand before I ~forgt~ forget half of the details from this morning. Everything happened so fast between the ~meting~ meeting at nine and the phone call right after, and I needed a quiet page to actually think through what we should do next.

First, please remember that the numbers we looked at yesterday are still incomplete. When Sarah checked the ~secon~ second folder, she noticed three different pages were missing from the original packet. We definitely shouldn't rush into signing anything until we compare every single line together.

Also, if you get a chance tonight, look over the notes on the back table. I tried to keep them organized, though my handwriting always gets a little ~mesy~ messy when I'm writing quickly without stopping. Call me whenever you wake up tomorrow and we will figure out the rest.`,
  },
  'lecture-notes': {
    label: 'Biology / Lab Observation Notes',
    text: `Observation Log — Session 14 (Cellular ~Membrne~ Membrane Transport & Osmotic Drift)

During the first twenty minutes of the trial, the potassium gradient across the semi-permeable barrier shifted much faster than our baseline ~calcultion~ calculation predicted. Temperature remained between 21.4C and 22.1C throughout the entire afternoon, yet the diffusion rate ~doubld~ doubled inside chamber B.

Why did the secondary sample stabilize early? Two possibilities worth checking before Friday:
1. The buffer solution from Tuesday's batch was ~slighly~ slightly hypertonic before we diluted it.
2. Pipette calibration drifted ~durring~ during the third transfer sequence, introducing extra solute into the control vessel.

Need to repeat the ~experimnt~ experiment tomorrow morning with fresh distilled reagent and compare both curves side by side.`,
  },
  'essay-draft': {
    label: 'Literature Essay Draft',
    text: `In almost every ~chpter~ chapter of the novel, memory functions less like a photograph and more like a ~constntly~ constantly rewritten letter. Characters return to the same childhood house expecting the rooms to feel ~exacly~ exactly the way they left them, only to discover that the proportions have shifted in their absence.

What makes this tension feel so ~geniune~ genuine is the author's refusal to tie every ~snetence~ sentence into a neat moral conclusion. Instead, conversations trail off mid-thought, important confessions are ~interupted~ interrupted by ordinary weather, and people misunderstand each other for years at a time.`,
  },
}

const PAPER_OPTIONS: { id: PaperStyleId; label: string; badge: string }[] = [
  {
    id: 'natural-bond',
    label: 'Natural Unlined Paper',
    badge: 'Warm Cotton Sheet',
  },
  {
    id: 'ink-only-white',
    label: 'Print Ink-Only (Pure White)',
    badge: 'For Real Paper in Printer',
  },
  {
    id: 'college-ruled',
    label: 'College Ruled Notebook',
    badge: 'Blue Rules + Margin',
  },
  {
    id: 'legal-pad',
    label: 'Canary Legal Pad',
    badge: 'Yellow Ruled Sheet',
  },
]

export function HandwritingStudio() {
  const [text, setText] = useState<string>(SAMPLE_PRESETS['personal-note'].text)
  const [handStyle, setHandStyle] = useState<HandStyleId>('everyday-ballpoint')
  const [inkColor, setInkColor] = useState<InkColorId>('bic-blue')
  const [paperStyle, setPaperStyle] = useState<PaperStyleId>('natural-bond')
  const [fontSizePx, setFontSizePx] = useState<number>(48)
  const [diagonalDriftIntensity, setDiagonalDriftIntensity] = useState<number>(1.25)
  const [unevenHeightIntensity, setUnevenHeightIntensity] = useState<number>(1.3)
  const [mistakeFrequency, setMistakeFrequency] = useState<number>(0.08)
  const [marginWanderIntensity, setMarginWanderIntensity] = useState<number>(1.15)
  const [seed, setSeed] = useState<number>(48291)
  const [showForensicGuides, setShowForensicGuides] = useState<boolean>(false)

  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [loupeEnabled, setLoupeEnabled] = useState<boolean>(false)
  const [loupeState, setLoupeState] = useState<{
    visible: boolean
    x: number
    y: number
    pageIdx: number
  }>({ visible: false, x: 0, y: 0, pageIdx: 0 })

  const [isSpecimenModalOpen, setIsSpecimenModalOpen] = useState<boolean>(false)
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false)
  const [fontsLoaded, setFontsLoaded] = useState<boolean>(false)
  const [telemetry, setTelemetry] = useState<CompositorTelemetry>({
    pageCount: 1,
    totalWords: 0,
    totalGlyphs: 0,
    uniqueAllographsCount: 0,
    mistakes: [],
    sentenceSlopesDeg: [],
    wordSlopesSampleDeg: [],
    minCharHeightRatio: 0.78,
    maxCharHeightRatio: 1.28,
  })

  // Offscreen high-DPI source canvases (1700 x 2200 = 200 DPI US Letter)
  const offscreenPagesRef = useRef<HTMLCanvasElement[]>([])
  // Visible display canvas refs in the preview stage
  const displayCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  // Print-only canvas refs
  const printCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  // Loupe canvas ref
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Ensure Google handwriting fonts are loaded before first render pass
  useEffect(() => {
    let mounted = true
    const loadHandwritingFonts = async () => {
      if (typeof document !== 'undefined' && document.fonts) {
        try {
          await Promise.allSettled([
            document.fonts.load('400 48px "Caveat"'),
            document.fonts.load('500 48px "Caveat"'),
            document.fonts.load('600 48px "Caveat"'),
            document.fonts.load('400 48px "Kalam"'),
            document.fonts.load('300 48px "Kalam"'),
            document.fonts.load('400 48px "Shadows Into Light Two"'),
            document.fonts.load('400 48px "Nothing You Could Do"'),
            document.fonts.load('400 48px "Reenie Beanie"'),
            document.fonts.load('400 48px "Nanum Pen Script"'),
            document.fonts.load('400 48px "Patrick Hand"'),
            document.fonts.load('400 48px "Zeyada"'),
            document.fonts.load('400 48px "La Belle Aurore"'),
            document.fonts.load('400 48px "Handlee"'),
            document.fonts.load('400 48px "Indie Flower"'),
          ])
          await document.fonts.ready
        } catch {
          // continue with available fonts
        }
      }
      if (mounted) {
        clearAllographCache()
        setFontsLoaded(true)
      }
    }
    loadHandwritingFonts()
    return () => {
      mounted = false
    }
  }, [])

  // Render document whenever settings or text change
  const renderAllPages = useCallback(() => {
    if (typeof document === 'undefined') return

    const config: CompositorConfig = {
      text: text || ' ',
      handStyle,
      inkColor,
      paperStyle,
      fontSizePx,
      diagonalDriftIntensity,
      unevenHeightIntensity,
      mistakeFrequency,
      marginWanderIntensity,
      seed,
      showForensicGuides,
    }

    const { activePages, telemetry: newTelemetry } = renderHandwrittenDocument(
      offscreenPagesRef.current,
      config,
      1700,
      2200
    )

    setTelemetry(newTelemetry)

    // Sync to visible display canvases & print canvases after state update
    requestAnimationFrame(() => {
      activePages.forEach((srcCanvas, idx) => {
        const disp = displayCanvasRefs.current[idx]
        if (disp) {
          if (disp.width !== srcCanvas.width || disp.height !== srcCanvas.height) {
            disp.width = srcCanvas.width
            disp.height = srcCanvas.height
          }
          const dCtx = disp.getContext('2d')
          if (dCtx) {
            dCtx.clearRect(0, 0, disp.width, disp.height)
            dCtx.drawImage(srcCanvas, 0, 0)
          }
        }

        const prn = printCanvasRefs.current[idx]
        if (prn) {
          if (prn.width !== srcCanvas.width || prn.height !== srcCanvas.height) {
            prn.width = srcCanvas.width
            prn.height = srcCanvas.height
          }
          const pCtx = prn.getContext('2d')
          if (pCtx) {
            pCtx.clearRect(0, 0, prn.width, prn.height)
            pCtx.drawImage(srcCanvas, 0, 0)
          }
        }
      })
    })
  }, [
    text,
    handStyle,
    inkColor,
    paperStyle,
    fontSizePx,
    diagonalDriftIntensity,
    unevenHeightIntensity,
    mistakeFrequency,
    marginWanderIntensity,
    seed,
    showForensicGuides,
  ])

  useEffect(() => {
    renderAllPages()
  }, [renderAllPages, fontsLoaded])

  // Handle optical loupe magnification on hover
  const handleCanvasMouseMove = (
    e: React.MouseEvent<HTMLCanvasElement>,
    pageIdx: number
  ) => {
    if (!loupeEnabled) return
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const relY = (e.clientY - rect.top) / rect.height

    setLoupeState({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pageIdx,
    })

    const loupeCanvas = loupeCanvasRef.current
    const srcCanvas = offscreenPagesRef.current[pageIdx]
    if (loupeCanvas && srcCanvas) {
      const lCtx = loupeCanvas.getContext('2d')
      if (lCtx) {
        const srcX = relX * srcCanvas.width
        const srcY = relY * srcCanvas.height
        const sampleW = 240
        const sampleH = 240
        lCtx.clearRect(0, 0, loupeCanvas.width, loupeCanvas.height)
        lCtx.fillStyle = '#faf8f2'
        lCtx.fillRect(0, 0, loupeCanvas.width, loupeCanvas.height)
        lCtx.drawImage(
          srcCanvas,
          srcX - sampleW / 2,
          srcY - sampleH / 2,
          sampleW,
          sampleH,
          0,
          0,
          loupeCanvas.width,
          loupeCanvas.height
        )
      }
    }
  }

  const handleExportPdf = async () => {
    setIsExportingPdf(true)
    try {
      const activeCanvases = offscreenPagesRef.current.slice(0, telemetry.pageCount)
      if (activeCanvases.length === 0) return
      const pdfBlob = buildPdfFromCanvases(activeCanvases, {
        pageSize: 'letter',
        quality: 0.95,
      })
      downloadPdfBlob(pdfBlob, `handwritten-document-${seed}.pdf`)
    } finally {
      setTimeout(() => setIsExportingPdf(false), 400)
    }
  }

  const handleDirectPrint = () => {
    window.print()
  }

  const handleRandomizeSeed = () => {
    setSeed(Math.floor(10000 + Math.random() * 89999))
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Studio Header Bar */}
      <header className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-md lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/15 text-primary shadow-sm">
            <PenTool className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground">
                CHIROGRAPH
              </h1>
              <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                20× ALLOGRAPH ENGINE
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              20 variants per lowercase &amp; capital letter • Organic crossed-out mistakes • Non-uniform diagonal sentence &amp; word drift
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsSpecimenModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Fingerprint className="h-3.5 w-3.5 text-primary" />
            <span>Inspect 20× Letter Variants</span>
          </button>

          <button
            onClick={handleRandomizeSeed}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            title="Re-roll allograph choices, diagonal slopes, heights, and crossed-out mistakes"
          >
            <Shuffle className="h-3.5 w-3.5 text-primary" />
            <span>Re-Write Page (#{seed})</span>
          </button>

          <button
            onClick={handleDirectPrint}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Page</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:opacity-95 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            <span>
              {isExportingPdf ? 'Compiling PDF...' : 'Download Printable PDF'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Split Workbench */}
      <main className="no-print flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* Left Instrument & Editor Column (5 cols on lg) */}
        <aside className="lg:col-span-5 xl:col-span-4 flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-card/60 overflow-y-auto lg:max-h-[calc(100vh-61px)]">
          {/* Section 1: Paste Your Text */}
          <div className="border-b border-border p-4 lg:p-5">
            <div className="mb-2.5 flex items-center justify-between">
              <label
                htmlFor="handwriting-source-text"
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>1. Paste or Write Text</span>
              </label>
              <div className="flex items-center gap-1">
                {Object.entries(SAMPLE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setText(preset.text)}
                    className="rounded border border-border bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {preset.label.split(' ')[0]}
                  </button>
                ))}
                <button
                  onClick={() => setText('')}
                  className="rounded border border-border bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </div>

            <textarea
              id="handwriting-source-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste any text here to write it out into realistic human handwriting..."
              className="w-full rounded-lg border border-border bg-background/90 p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />

            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Tip: Wrap any word in <code className="rounded bg-secondary px-1 py-0.5 font-mono text-primary">~tilde~</code> to force a custom crossed-out mistake, plus automatic false-starts.
              </span>
            </div>
          </div>

          {/* Section 2: Hand Archetype, Ink & Paper Surface */}
          <div className="border-b border-border p-4 lg:p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
              <PenTool className="h-3.5 w-3.5 text-primary" />
              <span>2. Writer Hand, Pen Ink &amp; Paper</span>
            </div>

            {/* Writer Hand Selection */}
            <div className="mb-3.5">
              <span className="mb-1.5 block text-xs text-muted-foreground">
                Handwriting Motor Profile (20 Allographs / Letter)
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(HAND_STYLES) as HandStyleId[]).map((id) => {
                  const spec = HAND_STYLES[id]
                  const active = handStyle === id
                  return (
                    <button
                      key={id}
                      onClick={() => setHandStyle(id)}
                      className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                        active
                          ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`}
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {spec.name}
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                        {spec.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Pen Ink Color */}
            <div className="mb-3.5">
              <span className="mb-1.5 block text-xs text-muted-foreground">
                Ballpoint / Gel Ink Paste Formula
              </span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(INK_PALETTES) as InkColorId[]).map((id) => {
                  const pal = INK_PALETTES[id]
                  const active = inkColor === id
                  return (
                    <button
                      key={id}
                      onClick={() => setInkColor(id)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
                        active
                          ? 'border-primary bg-primary/15 text-foreground font-medium'
                          : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: pal.primaryHex }}
                      />
                      <span>{pal.name.split(' (')[0]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Paper Surface */}
            <div>
              <span className="mb-1.5 block text-xs text-muted-foreground">
                Paper Surface Mode
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PAPER_OPTIONS.map((opt) => {
                  const active = paperStyle === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setPaperStyle(opt.id)}
                      className={`flex flex-col items-start rounded-lg border p-2 text-left transition-all ${
                        active
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`}
                    >
                      <span className="text-xs font-medium text-foreground">
                        {opt.label}
                      </span>
                      <span className="font-mono text-[10px] text-primary">
                        {opt.badge}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Biomechanical Imperfection & Diagonal Drift Controls */}
          <div className="border-b border-border p-4 lg:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>3. Biomechanics &amp; Imperfections</span>
              </div>
              <button
                onClick={() => {
                  setDiagonalDriftIntensity(1.25)
                  setUnevenHeightIntensity(1.3)
                  setMistakeFrequency(0.08)
                  setMarginWanderIntensity(1.15)
                  setFontSizePx(48)
                }}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="flex flex-col gap-3.5">
              {/* Diagonal Sentence & Word Drift Slider */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Diagonal Page Drift (Per-Sentence &amp; Per-Word Slope)
                  </span>
                  <span className="font-mono text-primary">
                    {Math.round(diagonalDriftIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2.0}
                  step={0.05}
                  value={diagonalDriftIntensity}
                  onChange={(e) => setDiagonalDriftIntensity(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Each sentence and word tilts at a different diagonal angle across the page
                </p>
              </div>

              {/* Uneven Letter & Word Height Slider */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Uneven Letter &amp; Word Height Variance
                  </span>
                  <span className="font-mono text-primary">
                    {Math.round(unevenHeightIntensity * 100)}% ({telemetry.minCharHeightRatio}×–{telemetry.maxCharHeightRatio}×)
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2.0}
                  step={0.05}
                  value={unevenHeightIntensity}
                  onChange={(e) => setUnevenHeightIntensity(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Fluctuates character &amp; word heights organically so no two words share the same height
                </p>
              </div>

              {/* Crossed-Out Mistake Frequency */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Crossed-Out Mistakes &amp; False-Starts
                  </span>
                  <span className="font-mono text-primary">
                    {Math.round(mistakeFrequency * 100)}% ({telemetry.mistakes.length} on page)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.22}
                  step={0.01}
                  value={mistakeFrequency}
                  onChange={(e) => setMistakeFrequency(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Injects mid-word false starts, letter slips, zig-zag scribbles, slashes &amp; caret (^) inserts
                </p>
              </div>

              {/* Left/Right Margin Wander & Size */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Margin Wander</span>
                    <span className="font-mono text-foreground">
                      {Math.round(marginWanderIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={2.0}
                    step={0.05}
                    value={marginWanderIntensity}
                    onChange={(e) => setMarginWanderIntensity(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Writing Size</span>
                    <span className="font-mono text-foreground">{fontSizePx}pt</span>
                  </div>
                  <input
                    type="range"
                    min={36}
                    max={64}
                    step={2}
                    value={fontSizePx}
                    onChange={(e) => {
                      clearAllographCache()
                      setFontSizePx(parseInt(e.target.value, 10))
                    }}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Live Biomechanical Telemetry & Crossed-Out Mistake Log */}
          <div className="p-4 lg:p-5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                <Compass className="h-3.5 w-3.5 text-primary" />
                <span>4. Forensic Realism Telemetry</span>
              </div>
              <button
                onClick={() => setShowForensicGuides((v) => !v)}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                  showForensicGuides
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {showForensicGuides ? 'Hide Slope Vectors' : 'Show Slope Vectors'}
              </button>
            </div>

            {/* Key Metrics Grid */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-secondary/30 p-2">
                <div className="font-mono text-[10px] text-muted-foreground">
                  UNIQUE ALLOGRAPHS
                </div>
                <div className="font-mono text-sm font-bold text-primary">
                  {telemetry.uniqueAllographsCount}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {' '}/ {telemetry.totalGlyphs} chars
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-2">
                <div className="font-mono text-[10px] text-muted-foreground">
                  HEIGHT UNEVENNESS
                </div>
                <div className="font-mono text-sm font-bold text-foreground">
                  {telemetry.minCharHeightRatio}× – {telemetry.maxCharHeightRatio}×
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-2">
                <div className="font-mono text-[10px] text-muted-foreground">
                  MISTAKES SCRATCHED
                </div>
                <div className="font-mono text-sm font-bold text-foreground">
                  {telemetry.mistakes.length} errors
                </div>
              </div>
            </div>

            {/* Non-Uniform Sentence Diagonal Slopes Readout */}
            <div className="mb-3 rounded-lg border border-border bg-background/60 p-2.5">
              <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>PER-SENTENCE DIAGONAL DRIFT ANGLES (NEVER UNIFORM):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {telemetry.sentenceSlopesDeg.slice(0, 10).map((deg, idx) => (
                  <span
                    key={idx}
                    className="rounded border border-border/80 bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                  >
                    S{idx + 1}:{' '}
                    <strong className={deg > 0 ? 'text-primary' : 'text-blue-400'}>
                      {deg > 0 ? `+${deg}° ↗` : `${deg}° ↘`}
                    </strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Active Crossed-Out Mistakes List */}
            <div className="rounded-lg border border-border bg-background/60 p-2.5">
              <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>ACTIVE CROSSED-OUT MISTAKES ON PAGE:</span>
                <button
                  onClick={handleRandomizeSeed}
                  className="text-primary hover:underline"
                >
                  Re-roll mistakes
                </button>
              </div>
              {telemetry.mistakes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No crossed-out mistakes active. Increase slider above or wrap a word in ~tildes~.
                </p>
              ) : (
                <div className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-1">
                  {telemetry.mistakes.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded border border-border/60 bg-secondary/30 px-2 py-1 text-xs"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-destructive line-through">
                          {m.mistakenText}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-foreground">
                          {m.isCaretSuperscript ? `^${m.intendedWord}` : m.intendedWord}
                        </span>
                      </div>
                      <span className="ml-2 shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {m.scratchStyle}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Right Live Paper Inspection Stage (7 cols on lg) */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col bg-[#0b0d11] lg:max-h-[calc(100vh-61px)] overflow-hidden">
          {/* Stage Top Inspection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/80 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                Live Print Preview ({telemetry.pageCount}{' '}
                {telemetry.pageCount === 1 ? 'Page' : 'Pages'} • 200 DPI Render •{' '}
                {telemetry.totalWords} Words)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setLoupeEnabled((v) => !v)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  loupeEnabled
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border bg-secondary/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{loupeEnabled ? '2.5× Loupe ON' : '2.5× Loupe Inspect'}</span>
              </button>

              <div className="flex items-center rounded-md border border-border bg-secondary/50 p-0.5">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-2 font-mono text-xs text-foreground">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2.25, +(z + 0.25).toFixed(2)))}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Desk Surface Holding the Physical Paper Sheet(s) */}
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center gap-8">
            {Array.from({ length: telemetry.pageCount }).map((_, pageIdx) => (
              <div
                key={pageIdx}
                className="relative transition-all duration-150"
                style={{
                  width: `${Math.round(720 * zoomLevel)}px`,
                  maxWidth: zoomLevel === 1 ? '100%' : 'none',
                }}
              >
                {/* Page Badge */}
                <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span>
                    SHEET {String(pageIdx + 1).padStart(2, '0')} OF{' '}
                    {String(telemetry.pageCount).padStart(2, '0')} // US LETTER (8.5&quot; × 11&quot;)
                  </span>
                  <span>
                    20 ALLOGRAPHS/CHAR • DIAGONAL SENTENCE DRIFT ACTIVE
                  </span>
                </div>

                {/* Tactile Paper Sheet Container */}
                <div className="relative overflow-hidden rounded-sm shadow-[0_24px_60px_rgba(0,0,0,0.75)] ring-1 ring-white/10">
                  <canvas
                    ref={(el) => {
                      displayCanvasRefs.current[pageIdx] = el
                    }}
                    width={1700}
                    height={2200}
                    onMouseMove={(e) => handleCanvasMouseMove(e, pageIdx)}
                    onMouseLeave={() =>
                      setLoupeState((s) => ({ ...s, visible: false }))
                    }
                    className={`block h-auto w-full bg-[#fcfbf7] ${
                      loupeEnabled ? 'cursor-crosshair' : 'cursor-default'
                    }`}
                  />

                  {/* Optical Magnifier Loupe Overlay */}
                  {loupeEnabled &&
                    loupeState.visible &&
                    loupeState.pageIdx === pageIdx && (
                      <div
                        className="pointer-events-none absolute z-20 h-44 w-44 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 border-primary shadow-2xl ring-4 ring-black/50"
                        style={{
                          left: `${loupeState.x}px`,
                          top: `${loupeState.y}px`,
                        }}
                      >
                        <canvas
                          ref={loupeCanvasRef}
                          width={260}
                          height={260}
                          className="h-full w-full"
                        />
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[9px] text-primary">
                          2.5× INK LOUPE
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Print-Only Full Bleed Pages for Native Browser Printing */}
      <div className="print-only-pages hidden">
        {Array.from({ length: telemetry.pageCount }).map((_, pageIdx) => (
          <canvas
            key={pageIdx}
            ref={(el) => {
              printCanvasRefs.current[pageIdx] = el
            }}
            width={1700}
            height={2200}
            className="print-page-canvas"
          />
        ))}
      </div>

      {/* 20-Allograph Specimen Inspector Modal */}
      <AllographSpecimenModal
        isOpen={isSpecimenModalOpen}
        onClose={() => setIsSpecimenModalOpen(false)}
        handStyle={handStyle}
        inkColor={inkColor}
      />
    </div>
  )
}
