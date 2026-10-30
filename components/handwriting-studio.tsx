'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clearAllographCache,
  HAND_STYLES,
  HANDWRITING_FONT_FAMILIES,
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
import { buildPdfFromCanvases, downloadPdfBlob, PdfPageSize } from '@/lib/pdf-builder'
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
  Loader2,
  X,
  Ruler,
} from 'lucide-react'

const SAMPLE_PRESETS: Record<string, { label: string; text: string }> = {
  'personal-note': {
    label: 'Personal Desk Note',
    text: `Hey — I wanted to write this all down by hand before I ~forgt~ forget half of the details from this morning. Everything happened so fast between the ~meting~ meeting at nine and the phone call right after, and I needed a quiet page to actually think through what we should do next.\n\nFirst, please remember that the numbers we looked at yesterday are still incomplete. When Sarah checked the ~secon~ second folder, she noticed three different pages were missing from the original packet. We definitely shouldn't rush into signing anything until we compare every single line together.\n\nAlso, if you get a chance tonight, look over the notes on the back table. I tried to keep them organized, though my handwriting always gets a little ~mesy~ messy when I'm writing quickly without stopping. Call me whenever you wake up tomorrow and we will figure out the rest.`,
  },
  'lecture-notes': {
    label: 'Biology / Lab Observation Notes',
    text: `Observation Log — Session 14 (Cellular ~Membrne~ Membrane Transport & Osmotic Drift)\n\nDuring the first twenty minutes of the trial, the potassium gradient across the semi-permeable barrier shifted much faster than our baseline ~calcultion~ calculation predicted. Temperature remained between 21.4C and 22.1C throughout the entire afternoon, yet the diffusion rate ~doubld~ doubled inside chamber B.\n\nWhy did the secondary sample stabilize early? Two possibilities worth checking before Friday:\n1. The buffer solution from Tuesday's batch was ~slighly~ slightly hypertonic before we diluted it.\n2. Pipette calibration drifted ~durring~ during the third transfer sequence, introducing extra solute into the control vessel.\n\nNeed to repeat the ~experimnt~ experiment tomorrow morning with fresh distilled reagent and compare both curves side by side.`,
  },
  'essay-draft': {
    label: 'Literature Essay Draft',
    text: `In almost every ~chpter~ chapter of the novel, memory functions less like a photograph and more like a ~constntly~ constantly rewritten letter. Characters return to the same childhood house expecting the rooms to feel ~exacly~ exactly the way they left them, only to discover that the proportions have shifted in their absence.\n\nWhat makes this tension feel so ~geniune~ genuine is the author's refusal to tie every ~snetence~ sentence into a neat moral conclusion. Instead, conversations trail off mid-thought, important confessions are ~interupted~ interrupted by ordinary weather, and people misunderstand each other for years at a time.`,
  },
}

const PAPER_OPTIONS: { id: PaperStyleId; label: string; badge: string }[] = [
  { id: 'natural-bond', label: 'Natural Unlined Paper', badge: 'Warm Cotton Sheet' },
  { id: 'ink-only-white', label: 'Print Ink-Only (Pure White)', badge: 'For Real Paper in Printer' },
  { id: 'college-ruled', label: 'College Ruled Notebook', badge: 'Blue Rules + Margin' },
  { id: 'legal-pad', label: 'Canary Legal Pad', badge: 'Yellow Ruled Sheet' },
]

/** Sheet sizes rendered at 200 DPI. */
const PAGE_DIMENSIONS: Record<
  PdfPageSize,
  { width: number; height: number; label: string; shortLabel: string; cssWidthIn: number; cssHeightIn: number }
> = {
  letter: {
    width: 1700,
    height: 2200,
    label: 'US Letter · 8.5 × 11 in',
    shortLabel: 'US LETTER',
    cssWidthIn: 8.5,
    cssHeightIn: 11,
  },
  a4: {
    width: 1654,
    height: 2339,
    label: 'A4 · 210 × 297 mm',
    shortLabel: 'A4',
    cssWidthIn: 8.27,
    cssHeightIn: 11.69,
  },
}

const STORAGE_KEY = 'chirograph.studio.v1'
const MAX_PERSISTED_TEXT = 20000

interface StudioSettings {
  text: string
  handStyle: HandStyleId
  inkColor: InkColorId
  paperStyle: PaperStyleId
  pageSize: PdfPageSize
  fontSizePx: number
  nibFineness: number
  lineSpacing: number
  diagonalDriftIntensity: number
  unevenHeightIntensity: number
  mistakeFrequency: number
  marginWanderIntensity: number
  seed: number
  showForensicGuides: boolean
}

const DEFAULT_SETTINGS: StudioSettings = {
  text: SAMPLE_PRESETS['personal-note'].text,
  handStyle: 'everyday-ballpoint',
  inkColor: 'bic-blue',
  paperStyle: 'natural-bond',
  pageSize: 'letter',
  fontSizePx: 60,
  nibFineness: 1.05,
  lineSpacing: 1.72,
  diagonalDriftIntensity: 1.15,
  unevenHeightIntensity: 1.2,
  mistakeFrequency: 0.08,
  marginWanderIntensity: 1.1,
  seed: 48291,
  showForensicGuides: false,
}

const EMPTY_TELEMETRY: CompositorTelemetry = {
  pageCount: 1,
  totalWords: 0,
  totalGlyphs: 0,
  uniqueAllographsCount: 0,
  mistakes: [],
  sentenceSlopesDeg: [],
  wordSlopesSampleDeg: [],
  minCharHeightRatio: 0.78,
  maxCharHeightRatio: 1.28,
}

type RenderStatus = 'idle' | 'rendering' | 'error'
type Notice = { kind: 'success' | 'error' | 'info'; message: string }

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/** Debounces rapid state changes (typing, slider drags) before an expensive render. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** Copies freshly rendered pages into the on-screen canvases and drops stale ones. */
function syncCanvases(
  sources: HTMLCanvasElement[],
  targets: (HTMLCanvasElement | null)[],
  count: number
) {
  for (let idx = 0; idx < count; idx++) {
    const src = sources[idx]
    const dst = targets[idx]
    if (!src || !dst) continue
    if (dst.width !== src.width || dst.height !== src.height) {
      dst.width = src.width
      dst.height = src.height
    }
    const ctx = dst.getContext('2d')
    if (!ctx) continue
    ctx.clearRect(0, 0, dst.width, dst.height)
    ctx.drawImage(src, 0, 0)
  }
  if (targets.length > count) targets.length = count
}

export function HandwritingStudio() {
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS)
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [loupeEnabled, setLoupeEnabled] = useState<boolean>(false)
  const [loupeState, setLoupeState] = useState<{
    visible: boolean
    x: number
    y: number
    pageIdx: number
  }>({ visible: false, x: 0, y: 0, pageIdx: 0 })
  const [isSpecimenModalOpen, setIsSpecimenModalOpen] = useState<boolean>(false)
  const [fontsLoaded, setFontsLoaded] = useState<boolean>(false)
  const [status, setStatus] = useState<RenderStatus>('rendering')
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [renderToken, setRenderToken] = useState<number>(0)
  const [lastRenderMs, setLastRenderMs] = useState<number>(0)
  const [telemetry, setTelemetry] = useState<CompositorTelemetry>(EMPTY_TELEMETRY)

  // Offscreen high-DPI source canvases, pooled across renders.
  const offscreenPagesRef = useRef<HTMLCanvasElement[]>([])
  const renderedPagesRef = useRef<HTMLCanvasElement[]>([])
  const displayCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const printCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const update = useCallback(
    <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const dims = PAGE_DIMENSIONS[settings.pageSize]
  const debouncedSettings = useDebouncedValue(settings, 160)

  const wordCount = useMemo(
    () => settings.text.trim().split(/\s+/).filter(Boolean).length,
    [settings.text]
  )
  const manualMistakeCount = useMemo(
    () => (settings.text.match(/~[^~\s]+~/g) || []).length,
    [settings.text]
  )

  // Restore the previous session's studio settings.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<StudioSettings>
      setSettings((prev) => ({
        ...prev,
        ...saved,
        text:
          typeof saved.text === 'string' ? saved.text.slice(0, MAX_PERSISTED_TEXT) : prev.text,
        handStyle:
          saved.handStyle && saved.handStyle in HAND_STYLES ? saved.handStyle : prev.handStyle,
        inkColor:
          saved.inkColor && saved.inkColor in INK_PALETTES ? saved.inkColor : prev.inkColor,
        paperStyle:
          saved.paperStyle && PAPER_OPTIONS.some((p) => p.id === saved.paperStyle)
            ? saved.paperStyle
            : prev.paperStyle,
        pageSize:
          saved.pageSize && saved.pageSize in PAGE_DIMENSIONS ? saved.pageSize : prev.pageSize,
        fontSizePx: clampNumber(saved.fontSizePx, 34, 80, prev.fontSizePx),
        nibFineness: clampNumber(saved.nibFineness, 0.5, 1.5, prev.nibFineness),
        lineSpacing: clampNumber(saved.lineSpacing, 1.3, 2.6, prev.lineSpacing),
        diagonalDriftIntensity: clampNumber(
          saved.diagonalDriftIntensity,
          0.2,
          2,
          prev.diagonalDriftIntensity
        ),
        unevenHeightIntensity: clampNumber(
          saved.unevenHeightIntensity,
          0.2,
          2,
          prev.unevenHeightIntensity
        ),
        mistakeFrequency: clampNumber(saved.mistakeFrequency, 0, 0.22, prev.mistakeFrequency),
        marginWanderIntensity: clampNumber(
          saved.marginWanderIntensity,
          0.1,
          2,
          prev.marginWanderIntensity
        ),
        seed: Math.round(clampNumber(saved.seed, 1, 999999, prev.seed)),
        showForensicGuides: Boolean(saved.showForensicGuides),
      }))
    } catch {
      // Corrupt or unavailable storage — fall back to defaults silently.
    }
  }, [])

  // Persist settings (debounced) so a refresh keeps the writer's setup.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...settings, text: settings.text.slice(0, MAX_PERSISTED_TEXT) })
        )
      } catch {
        // Storage full or disabled — not fatal.
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [settings])

  // Preload every handwriting family before the first synthesis pass.
  useEffect(() => {
    let mounted = true
    const loadHandwritingFonts = async () => {
      if (typeof document !== 'undefined' && document.fonts) {
        try {
          await Promise.allSettled(
            HANDWRITING_FONT_FAMILIES.flatMap((family) => [
              document.fonts.load(`400 42px "${family}"`),
              document.fonts.load(`300 42px "${family}"`),
            ])
          )
          await document.fonts.ready
        } catch {
          // Continue with whatever fonts the browser has.
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

  // Render the document. Debounced so typing and slider drags stay responsive, and
  // deferred by one frame so the "rendering" state is painted before the work starts.
  useEffect(() => {
    if (!fontsLoaded) return
    let cancelled = false
    setStatus('rendering')

    const timer = window.setTimeout(() => {
      if (cancelled) return
      const startedAt = performance.now()
      try {
        const config: CompositorConfig = {
          text: debouncedSettings.text || ' ',
          handStyle: debouncedSettings.handStyle,
          inkColor: debouncedSettings.inkColor,
          paperStyle: debouncedSettings.paperStyle,
          fontSizePx: debouncedSettings.fontSizePx,
          nibFineness: debouncedSettings.nibFineness,
          lineSpacing: debouncedSettings.lineSpacing,
          diagonalDriftIntensity: debouncedSettings.diagonalDriftIntensity,
          unevenHeightIntensity: debouncedSettings.unevenHeightIntensity,
          mistakeFrequency: debouncedSettings.mistakeFrequency,
          marginWanderIntensity: debouncedSettings.marginWanderIntensity,
          seed: debouncedSettings.seed,
          showForensicGuides: debouncedSettings.showForensicGuides,
        }
        const targetDims = PAGE_DIMENSIONS[debouncedSettings.pageSize]

        const { activePages, telemetry: newTelemetry } = renderHandwrittenDocument(
          offscreenPagesRef.current,
          config,
          targetDims.width,
          targetDims.height
        )

        // Release page canvases this shorter document no longer needs.
        offscreenPagesRef.current.length = activePages.length
        renderedPagesRef.current = activePages

        setTelemetry(newTelemetry)
        setLastRenderMs(Math.max(1, Math.round(performance.now() - startedAt)))
        setStatus('idle')
        setRenderToken((token) => token + 1)
      } catch (error) {
        console.error(error)
        setStatus('error')
        setNotice({
          kind: 'error',
          message: 'The page could not be rendered. Try a shorter text or a different hand.',
        })
      }
    }, 24)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [debouncedSettings, fontsLoaded])

  // Copy finished pages into the visible preview and the print-only canvases.
  useEffect(() => {
    if (renderToken === 0) return
    const pages = renderedPagesRef.current
    syncCanvases(pages, displayCanvasRefs.current, telemetry.pageCount)
    syncCanvases(pages, printCanvasRefs.current, telemetry.pageCount)
  }, [renderToken, telemetry.pageCount, dims.width, dims.height])

  // Auto-dismiss status notices.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, pageIdx: number) => {
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
    const srcCanvas = renderedPagesRef.current[pageIdx]
    if (!loupeCanvas || !srcCanvas) return

    const lCtx = loupeCanvas.getContext('2d')
    if (!lCtx) return

    // 2.5x magnification relative to what is actually on screen at this zoom level.
    const onScreenScale = rect.width / srcCanvas.width || 1
    const loupeCssDiameter = 176
    const sampleSize = Math.max(48, Math.round(loupeCssDiameter / (2.5 * onScreenScale)))
    const srcX = relX * srcCanvas.width
    const srcY = relY * srcCanvas.height

    lCtx.clearRect(0, 0, loupeCanvas.width, loupeCanvas.height)
    lCtx.fillStyle = '#faf8f2'
    lCtx.fillRect(0, 0, loupeCanvas.width, loupeCanvas.height)
    lCtx.drawImage(
      srcCanvas,
      srcX - sampleSize / 2,
      srcY - sampleSize / 2,
      sampleSize,
      sampleSize,
      0,
      0,
      loupeCanvas.width,
      loupeCanvas.height
    )
  }

  const handleExportPdf = useCallback(async () => {
    if (isExporting) return
    setIsExporting(true)
    await nextFrame()
    try {
      const pages = renderedPagesRef.current.slice(0, telemetry.pageCount)
      if (pages.length === 0) throw new Error('No rendered pages yet')
      const blob = buildPdfFromCanvases(pages, {
        pageSize: settings.pageSize,
        quality: 0.94,
        title: `Handwritten notes (${HAND_STYLES[settings.handStyle].name})`,
        author: 'Chirograph',
      })
      downloadPdfBlob(blob, `handwritten-document-${settings.seed}.pdf`)
      setNotice({
        kind: 'success',
        message: `Saved ${pages.length}-page PDF · ${formatBytes(blob.size)}`,
      })
    } catch (error) {
      console.error(error)
      setNotice({
        kind: 'error',
        message: 'PDF export failed. Try re-rendering the page, or use fewer pages.',
      })
    } finally {
      setIsExporting(false)
    }
  }, [isExporting, settings.handStyle, settings.pageSize, settings.seed, telemetry.pageCount])

  const handleDirectPrint = useCallback(() => {
    syncCanvases(renderedPagesRef.current, printCanvasRefs.current, telemetry.pageCount)
    // Let the browser lay out the print canvases before opening the dialog.
    window.setTimeout(() => window.print(), 60)
  }, [telemetry.pageCount])

  const handleOpenSpecimens = useCallback(() => setIsSpecimenModalOpen(true), [])
  const handleCloseSpecimens = useCallback(() => setIsSpecimenModalOpen(false), [])

  const handleRandomizeSeed = useCallback(() => {
    setSettings((prev) => ({ ...prev, seed: Math.floor(10000 + Math.random() * 89999) }))
  }, [])

  const handleResetBiomechanics = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      diagonalDriftIntensity: DEFAULT_SETTINGS.diagonalDriftIntensity,
      unevenHeightIntensity: DEFAULT_SETTINGS.unevenHeightIntensity,
      mistakeFrequency: DEFAULT_SETTINGS.mistakeFrequency,
      marginWanderIntensity: DEFAULT_SETTINGS.marginWanderIntensity,
      lineSpacing: DEFAULT_SETTINGS.lineSpacing,
      fontSizePx: DEFAULT_SETTINGS.fontSizePx,
    }))
  }, [])

  // Keyboard shortcuts: ⌘/Ctrl+S exports, ⌘/Ctrl+Enter rewrites the page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const withModifier = event.metaKey || event.ctrlKey
      if (!withModifier) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        void handleExportPdf()
      } else if (key === 'enter') {
        event.preventDefault()
        handleRandomizeSeed()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleExportPdf, handleRandomizeSeed])

  const isBusy = status === 'rendering' || isExporting

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Studio Header Bar */}
      <header className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-md lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/15 text-primary shadow-sm">
            <PenTool className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground">CHIROGRAPH</h1>
              <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                20× ALLOGRAPH ENGINE
              </span>
              <span
                aria-live="polite"
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                  status === 'error'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : isBusy
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {isBusy ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                )}
                {isExporting
                  ? 'EXPORTING'
                  : status === 'rendering'
                    ? 'RENDERING'
                    : status === 'error'
                      ? 'RENDER ERROR'
                      : `READY ${lastRenderMs}ms`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              20 variants per lowercase &amp; capital letter • Organic crossed-out mistakes •
              Non-uniform diagonal sentence &amp; word drift
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenSpecimens}
            className={`flex items-center gap-1.5 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary ${FOCUS_RING}`}
          >
            <Fingerprint className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Inspect 20× Letter Variants</span>
          </button>

          <button
            type="button"
            onClick={handleRandomizeSeed}
            className={`flex items-center gap-1.5 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary ${FOCUS_RING}`}
            title="Re-roll allograph choices, diagonal slopes, heights, and crossed-out mistakes (⌘/Ctrl + Enter)"
          >
            <Shuffle className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Re-Write Page (#{settings.seed})</span>
          </button>

          <button
            type="button"
            onClick={handleDirectPrint}
            className={`flex items-center gap-1.5 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary ${FOCUS_RING}`}
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Print Page</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={isExporting || telemetry.pageCount === 0}
            title="Download a print-ready PDF (⌘/Ctrl + S)"
            className={`flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:opacity-95 disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{isExporting ? 'Compiling PDF...' : 'Download Printable PDF'}</span>
          </button>
        </div>
      </header>

      {/* Main Split Workbench */}
      <main className="no-print flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* Left Instrument & Editor Column */}
        <aside className="lg:col-span-5 xl:col-span-4 flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-card/60 overflow-y-auto lg:max-h-[calc(100vh-61px)]">
          {/* Section 1: Paste Your Text */}
          <div className="border-b border-border p-4 lg:p-5">
            <div className="mb-2.5 flex items-center justify-between">
              <label
                htmlFor="handwriting-source-text"
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                <FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>1. Paste or Write Text</span>
              </label>
              <div className="flex items-center gap-1">
                {Object.entries(SAMPLE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update('text', preset.text)}
                    title={`Load the “${preset.label}” sample`}
                    className={`rounded border border-border bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${FOCUS_RING}`}
                  >
                    {preset.label.split(' ')[0]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => update('text', '')}
                  className={`rounded border border-border bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${FOCUS_RING}`}
                >
                  Clear
                </button>
              </div>
            </div>

            <textarea
              id="handwriting-source-text"
              value={settings.text}
              onChange={(e) => update('text', e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder="Paste any text here to write it out into realistic human handwriting..."
              className="w-full resize-y rounded-lg border border-border bg-background/90 p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                Tip: wrap a word in{' '}
                <code className="rounded bg-secondary px-1 py-0.5 font-mono text-primary">~tildes~</code>{' '}
                to force a crossed-out mistake.
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {wordCount} words · {settings.text.length} chars
                {manualMistakeCount > 0 ? ` · ${manualMistakeCount} manual` : ''}
              </span>
            </div>
          </div>

          {/* Section 2: Hand Archetype, Ink & Paper Surface */}
          <div className="border-b border-border p-4 lg:p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
              <PenTool className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>2. Writer Hand, Pen Ink &amp; Paper</span>
            </div>

            {/* Writer Hand Selection */}
            <fieldset className="mb-3.5">
              <legend className="mb-1.5 block text-xs text-muted-foreground">
                Handwriting Motor Profile (20 Allographs / Letter)
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(HAND_STYLES) as HandStyleId[]).map((id) => {
                  const spec = HAND_STYLES[id]
                  const active = settings.handStyle === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update('handStyle', id)}
                      aria-pressed={active}
                      className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${FOCUS_RING} ${
                        active
                          ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`}
                    >
                      <span className="text-xs font-semibold text-foreground">{spec.name}</span>
                      <span className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                        {spec.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {/* Pen Ink Color */}
            <fieldset className="mb-3.5">
              <legend className="mb-1.5 block text-xs text-muted-foreground">
                Ballpoint / Gel Ink Paste Formula
              </legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(INK_PALETTES) as InkColorId[]).map((id) => {
                  const pal = INK_PALETTES[id]
                  const active = settings.inkColor === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update('inkColor', id)}
                      aria-pressed={active}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${FOCUS_RING} ${
                        active
                          ? 'border-primary bg-primary/15 font-medium text-foreground'
                          : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: pal.primaryHex }}
                        aria-hidden="true"
                      />
                      <span>{pal.name.split(' (')[0]}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {/* Paper Surface */}
            <fieldset>
              <legend className="mb-1.5 block text-xs text-muted-foreground">Paper Surface Mode</legend>
              <div className="grid grid-cols-2 gap-2">
                {PAPER_OPTIONS.map((opt) => {
                  const active = settings.paperStyle === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => update('paperStyle', opt.id)}
                      aria-pressed={active}
                      className={`flex flex-col items-start rounded-lg border p-2 text-left transition-all ${FOCUS_RING} ${
                        active
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`}
                    >
                      <span className="text-xs font-medium text-foreground">{opt.label}</span>
                      <span className="font-mono text-[10px] text-primary">{opt.badge}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {/* Sheet Size */}
            <fieldset className="mt-3.5">
              <legend className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Ruler className="h-3 w-3" aria-hidden="true" />
                Sheet Size
              </legend>
              <div className="flex gap-2">
                {(Object.keys(PAGE_DIMENSIONS) as PdfPageSize[]).map((id) => {
                  const active = settings.pageSize === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update('pageSize', id)}
                      aria-pressed={active}
                      className={`flex-1 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-all ${FOCUS_RING} ${
                        active
                          ? 'border-primary bg-primary/10 font-medium text-foreground'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`}
                    >
                      {PAGE_DIMENSIONS[id].label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </div>

          {/* Section 3: Biomechanical Imperfection & Diagonal Drift Controls */}
          <div className="border-b border-border p-4 lg:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                <Sliders className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>3. Biomechanics &amp; Imperfections</span>
              </div>
              <button
                type="button"
                onClick={handleResetBiomechanics}
                className={`flex items-center gap-1 rounded px-1 text-[11px] text-muted-foreground hover:text-foreground ${FOCUS_RING}`}
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </div>

            <div className="flex flex-col gap-3.5">
              {/* Diagonal Sentence & Word Drift Slider */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor="drift-slider" className="font-medium text-foreground">
                    Diagonal Page Drift (Per-Sentence &amp; Per-Word Slope)
                  </label>
                  <span className="font-mono text-primary">
                    {Math.round(settings.diagonalDriftIntensity * 100)}%
                  </span>
                </div>
                <input
                  id="drift-slider"
                  type="range"
                  min={0.2}
                  max={2.0}
                  step={0.05}
                  value={settings.diagonalDriftIntensity}
                  onChange={(e) => update('diagonalDriftIntensity', parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Each sentence and word tilts at a different diagonal angle across the page
                </p>
              </div>

              {/* Uneven Letter & Word Height Slider */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor="height-slider" className="font-medium text-foreground">
                    Uneven Letter &amp; Word Height Variance
                  </label>
                  <span className="font-mono text-primary">
                    {Math.round(settings.unevenHeightIntensity * 100)}% ({telemetry.minCharHeightRatio}
                    ×–{telemetry.maxCharHeightRatio}×)
                  </span>
                </div>
                <input
                  id="height-slider"
                  type="range"
                  min={0.2}
                  max={2.0}
                  step={0.05}
                  value={settings.unevenHeightIntensity}
                  onChange={(e) => update('unevenHeightIntensity', parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Fluctuates character &amp; word heights organically so no two words share the same
                  height
                </p>
              </div>

              {/* Crossed-Out Mistake Frequency */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor="mistake-slider" className="font-medium text-foreground">
                    Crossed-Out Mistakes &amp; False-Starts
                  </label>
                  <span className="font-mono text-primary">
                    {Math.round(settings.mistakeFrequency * 100)}% ({telemetry.mistakes.length} on
                    page)
                  </span>
                </div>
                <input
                  id="mistake-slider"
                  type="range"
                  min={0}
                  max={0.22}
                  step={0.01}
                  value={settings.mistakeFrequency}
                  onChange={(e) => update('mistakeFrequency', parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Injects mid-word false starts, letter slips, zig-zag scribbles, slashes &amp; caret
                  (^) inserts
                </p>
              </div>

              {/* Left/Right Margin Wander, Pen Nib Fineness & Size */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor="nib-slider" className="text-muted-foreground">
                      Nib
                    </label>
                    <span className="font-mono text-foreground">
                      {Math.round(settings.nibFineness * 100)}%
                    </span>
                  </div>
                  <input
                    id="nib-slider"
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    value={settings.nibFineness}
                    onChange={(e) => update('nibFineness', parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor="margin-slider" className="text-muted-foreground">
                      Margin
                    </label>
                    <span className="font-mono text-foreground">
                      {Math.round(settings.marginWanderIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    id="margin-slider"
                    type="range"
                    min={0.1}
                    max={2.0}
                    step={0.05}
                    value={settings.marginWanderIntensity}
                    onChange={(e) => update('marginWanderIntensity', parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor="size-slider" className="text-muted-foreground">
                      Size
                    </label>
                    <span className="font-mono text-foreground">{settings.fontSizePx}pt</span>
                  </div>
                  <input
                    id="size-slider"
                    type="range"
                    min={34}
                    max={80}
                    step={2}
                    value={settings.fontSizePx}
                    onChange={(e) => update('fontSizePx', parseInt(e.target.value, 10))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor="spacing-slider" className="text-muted-foreground">
                      Leading
                    </label>
                    <span className="font-mono text-foreground">
                      {settings.lineSpacing.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    id="spacing-slider"
                    type="range"
                    min={1.3}
                    max={2.6}
                    step={0.02}
                    value={settings.lineSpacing}
                    onChange={(e) => update('lineSpacing', parseFloat(e.target.value))}
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
                <Compass className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>4. Forensic Realism Telemetry</span>
              </div>
              <button
                type="button"
                onClick={() => update('showForensicGuides', !settings.showForensicGuides)}
                aria-pressed={settings.showForensicGuides}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${FOCUS_RING} ${
                  settings.showForensicGuides
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {settings.showForensicGuides ? 'Hide Slope Vectors' : 'Show Slope Vectors'}
              </button>
            </div>

            {/* Key Metrics Grid */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-secondary/30 p-2">
                <div className="font-mono text-[10px] text-muted-foreground">UNIQUE ALLOGRAPHS</div>
                <div className="font-mono text-sm font-bold text-primary">
                  {telemetry.uniqueAllographsCount}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {' '}
                    / {telemetry.totalGlyphs} chars
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-2">
                <div className="font-mono text-[10px] text-muted-foreground">HEIGHT UNEVENNESS</div>
                <div className="font-mono text-sm font-bold text-foreground">
                  {telemetry.minCharHeightRatio}× – {telemetry.maxCharHeightRatio}×
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-2">
                <div className="font-mono text-[10px] text-muted-foreground">MISTAKES SCRATCHED</div>
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
                  type="button"
                  onClick={handleRandomizeSeed}
                  className={`text-primary hover:underline ${FOCUS_RING}`}
                >
                  Re-write page
                </button>
              </div>
              {telemetry.mistakes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No crossed-out mistakes active. Increase the slider above or wrap a word in
                  ~tildes~.
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

        {/* Right Live Paper Inspection Stage */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col bg-[#0b0d11] lg:max-h-[calc(100vh-61px)] overflow-hidden">
          {/* Stage Top Inspection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/80 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {status === 'error' ? (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              )}
              <span aria-live="polite">
                Live Print Preview ({telemetry.pageCount}{' '}
                {telemetry.pageCount === 1 ? 'Page' : 'Pages'} • 200 DPI Render •{' '}
                {telemetry.totalWords} Words)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLoupeEnabled((v) => !v)}
                aria-pressed={loupeEnabled}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${FOCUS_RING} ${
                  loupeEnabled
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border bg-secondary/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{loupeEnabled ? '2.5× Loupe ON' : '2.5× Loupe Inspect'}</span>
              </button>

              <div className="flex items-center rounded-md border border-border bg-secondary/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                  className={`rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground ${FOCUS_RING}`}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span className="px-2 font-mono text-xs text-foreground">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(2.25, +(z + 0.25).toFixed(2)))}
                  className={`rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground ${FOCUS_RING}`}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Desk Surface Holding the Physical Paper Sheet(s) */}
          <div className="relative flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center gap-8">
            {status === 'rendering' && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center pt-3"
                role="status"
                aria-live="polite"
              >
                <span className="flex items-center gap-2 rounded-full border border-primary/30 bg-background/90 px-3 py-1 font-mono text-[10px] text-primary shadow-lg backdrop-blur">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  SYNTHESIZING ALLOGRAPHS…
                </span>
              </div>
            )}

            {Array.from({ length: telemetry.pageCount }).map((_, pageIdx) => (
              <div
                key={pageIdx}
                className="relative transition-all duration-150"
                style={{
                  width: `${Math.round(720 * zoomLevel * (dims.width / 1700))}px`,
                  maxWidth: zoomLevel <= 1 ? '100%' : 'none',
                }}
              >
                {/* Page Badge */}
                <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span>
                    SHEET {String(pageIdx + 1).padStart(2, '0')} OF{' '}
                    {String(telemetry.pageCount).padStart(2, '0')} // {dims.shortLabel}
                  </span>
                  <span className="hidden sm:inline">
                    20 ALLOGRAPHS/CHAR • DIAGONAL SENTENCE DRIFT ACTIVE
                  </span>
                </div>

                {/* Tactile Paper Sheet Container */}
                <div className="relative overflow-hidden rounded-sm shadow-[0_24px_60px_rgba(0,0,0,0.75)] ring-1 ring-white/10">
                  <canvas
                    ref={(el) => {
                      displayCanvasRefs.current[pageIdx] = el
                    }}
                    width={dims.width}
                    height={dims.height}
                    onMouseMove={(e) => handleCanvasMouseMove(e, pageIdx)}
                    onMouseLeave={() => setLoupeState((s) => ({ ...s, visible: false }))}
                    aria-label={`Handwritten page ${pageIdx + 1} preview`}
                    role="img"
                    className={`block h-auto w-full bg-[#fcfbf7] ${
                      loupeEnabled ? 'cursor-crosshair' : 'cursor-default'
                    }`}
                  />

                  {/* Optical Magnifier Loupe Overlay */}
                  {loupeEnabled && loupeState.visible && loupeState.pageIdx === pageIdx && (
                    <div
                      className="pointer-events-none absolute z-20 h-44 w-44 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 border-primary shadow-2xl ring-4 ring-black/50"
                      style={{ left: `${loupeState.x}px`, top: `${loupeState.y}px` }}
                    >
                      <canvas ref={loupeCanvasRef} width={260} height={260} className="h-full w-full" />
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
      {/*
        The @page rule is generated from the selected sheet size so the browser does
        not scale or letterbox the page, and each canvas is sized in physical inches.
      */}
      <style>{`@media print { @page { size: ${dims.cssWidthIn}in ${dims.cssHeightIn}in; margin: 0 } }`}</style>
      <div className="print-only-pages hidden" aria-hidden="true">
        {Array.from({ length: telemetry.pageCount }).map((_, pageIdx) => (
          <canvas
            key={pageIdx}
            ref={(el) => {
              printCanvasRefs.current[pageIdx] = el
            }}
            width={dims.width}
            height={dims.height}
            style={{ width: `${dims.cssWidthIn}in`, height: `${dims.cssHeightIn}in` }}
            className="print-page-canvas"
          />
        ))}
      </div>

      {/* 20-Allograph Specimen Inspector Modal */}
      <AllographSpecimenModal
        isOpen={isSpecimenModalOpen}
        onClose={handleCloseSpecimens}
        handStyle={settings.handStyle}
        inkColor={settings.inkColor}
      />

      {/* Transient status notice */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`no-print fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur ${
            notice.kind === 'error'
              ? 'border-destructive/50 bg-destructive/15 text-destructive'
              : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
          }`}
        >
          {notice.kind === 'error' ? (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="flex-1">{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
            className={`rounded p-0.5 opacity-70 transition-opacity hover:opacity-100 ${FOCUS_RING}`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
