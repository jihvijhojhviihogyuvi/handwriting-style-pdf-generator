'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  getAllographDescriptor,
  getOrSynthesizeAllograph,
  HandStyleId,
  InkColorId,
} from '@/lib/allograph-engine'
import { X, Sparkles, Fingerprint } from 'lucide-react'

interface AllographSpecimenModalProps {
  isOpen: boolean
  onClose: () => void
  handStyle: HandStyleId
  inkColor: InkColorId
}

const LOWERCASE_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
const UPPERCASE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function AllographSpecimenModal({
  isOpen,
  onClose,
  handStyle,
  inkColor,
}: AllographSpecimenModalProps) {
  const [selectedChar, setSelectedChar] = useState<string>('e')
  const gridCanvasesRef = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    const renderGrid = async () => {
      if (typeof document !== 'undefined' && document.fonts) {
        try {
          await document.fonts.ready
        } catch {
          // continue
        }
      }
      if (cancelled) return

      for (let v = 0; v < 20; v++) {
        const canvas = gridCanvasesRef.current[v]
        if (!canvas) continue
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        const W = canvas.width
        const H = canvas.height
        ctx.clearRect(0, 0, W, H)

        // Warm paper background
        ctx.fillStyle = '#faf8f2'
        ctx.fillRect(0, 0, W, H)

        // Faint baseline & x-height reference lines
        const baseLineY = Math.round(H * 0.68)
        const xHeightY = Math.round(H * 0.38)
        ctx.strokeStyle = 'rgba(130, 165, 215, 0.38)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, baseLineY)
        ctx.lineTo(W, baseLineY)
        ctx.stroke()

        ctx.setLineDash([3, 3])
        ctx.strokeStyle = 'rgba(180, 160, 130, 0.35)'
        ctx.beginPath()
        ctx.moveTo(0, xHeightY)
        ctx.lineTo(W, xHeightY)
        ctx.stroke()
        ctx.setLineDash([])

        const glyph = getOrSynthesizeAllograph(
          selectedChar,
          v,
          handStyle,
          inkColor,
          64
        )

        ctx.save()
        const centerX = Math.round(W * 0.5 - glyph.advanceWidth * 0.5)
        ctx.translate(centerX, baseLineY)
        ctx.drawImage(glyph.canvas, -glyph.anchorX, -glyph.baselineY)
        ctx.restore()
      }
    }

    renderGrid()
    return () => {
      cancelled = true
    }
  }, [isOpen, selectedChar, handStyle, inkColor])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm no-print"
      role="dialog"
      aria-modal="true"
      aria-label="20-Allograph Character Specimen Matrix"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Fingerprint className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-foreground">
                20× ALLOGRAPH SPECIMEN MATRIX // CHARACTER &lsquo;{selectedChar}&rsquo;
              </h2>
              <p className="text-xs text-muted-foreground">
                Inspecting all 20 distinct non-linear mesh-warped &amp; stroke-modified versions of{' '}
                <span className="font-mono text-primary">
                  {selectedChar >= 'A' && selectedChar <= 'Z' ? 'CAPITAL' : 'LOWERCASE'} &quot;{selectedChar}&quot;
                </span>{' '}
                (1,040 total letter allographs active)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-secondary/60 p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close specimen matrix"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Character Selector Bar */}
        <div className="border-b border-border bg-background/60 px-5 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <span className="mr-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Lowercase (a–z):
            </span>
            {LOWERCASE_LETTERS.map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChar(ch)}
                className={`h-7 w-7 rounded font-mono text-xs font-medium transition-all ${
                  selectedChar === ch
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/40'
                    : 'bg-secondary/60 text-foreground hover:bg-secondary'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Capitals (A–Z):
            </span>
            {UPPERCASE_LETTERS.map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChar(ch)}
                className={`h-7 w-7 rounded font-mono text-xs font-medium transition-all ${
                  selectedChar === ch
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/40'
                    : 'bg-secondary/60 text-foreground hover:bg-secondary'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* 20-Variant Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: 20 }).map((_, vIdx) => {
              const desc = getAllographDescriptor(selectedChar, vIdx, handStyle)
              return (
                <div
                  key={vIdx}
                  className="flex flex-col overflow-hidden rounded-lg border border-border bg-secondary/30 p-2"
                >
                  <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span className="font-semibold text-primary">
                      VAR #{String(vIdx + 1).padStart(2, '0')}
                    </span>
                    <span>
                      {(desc.aspectScaleY * 100).toFixed(0)}% H
                    </span>
                  </div>
                  <div className="relative overflow-hidden rounded border border-border/60 bg-[#faf8f2]">
                    <canvas
                      ref={(el) => {
                        gridCanvasesRef.current[vIdx] = el
                      }}
                      width={160}
                      height={145}
                      className="h-28 w-full object-contain"
                    />
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
                    <span>
                      Slant: {((desc.slantShear * 180) / Math.PI).toFixed(1)}°
                    </span>
                    <span>
                      Arch: {desc.internalSlopePx > 0 ? '+' : ''}
                      {desc.internalSlopePx.toFixed(1)}px
                    </span>
                    <span>
                      Bend: {desc.topBendPx > 0 ? '+' : ''}
                      {desc.topBendPx.toFixed(1)}px
                    </span>
                    <span>
                      Flow: {(desc.pressureWeight * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer Note */}
        <div className="flex items-center justify-between border-t border-border bg-secondary/40 px-5 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>
              Anti-Repetition Scheduler ensures consecutive occurrences of &lsquo;{selectedChar}&rsquo; never reuse the same variant.
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-3.5 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Done Inspecting
          </button>
        </div>
      </div>
    </div>
  )
}
