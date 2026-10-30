# Chirograph

A handwriting-style PDF generator. Paste text, pick a writer's hand, ink and paper, then
export a multi-page PDF or print it — rendered on a 200 DPI canvas so it holds up at
arm's length and under a printer.

## Features

- **20 allograph variants per letter.** Every lowercase and capital letter is
  synthesized in twenty distinct versions (mesh-warped, stroke-thinned, slanted and
  bowed), and an anti-repetition scheduler stops the same variant from appearing twice
  in a row.
- **Four writer hands** — everyday ballpoint, fast lecture hand, clean journal, fine
  technical print — each with its own slant, spacing, ligature rate and pen pressure.
- **Five inks** (royal blue, carbon black, archival navy, graphite, crimson) with
  wet/dry ballpoint grain, ink pooling and lighter "skimming" strokes.
- **Four paper surfaces** — warm natural bond, pure-white ink-only (for printing onto
  real paper), college ruled, and canary legal pad. On ruled paper the printed rules are
  generated from the same baseline grid the compositor writes on, so the handwriting
  genuinely sits on the lines.
- **Biomechanical imperfection controls** — per-sentence and per-word diagonal drift,
  uneven letter heights, margin wander, line leading, nib thickness and writing size.
- **Organic mistakes** — false starts, letter slips, transpositions and caret (`^`)
  superscript corrections, each crossed out with five different multi-pass scratch
  styles. Wrap a word in `~tildes~` to force one where you want it.
- **Print-ready export** — a dependency-free PDF 1.4 writer with real metadata, Letter
  and A4 page sizes, plus native browser printing at true physical size.
- **Inspector tools** — a 2.5× ink loupe, zoom, forensic slope vectors, and a specimen
  matrix for comparing all twenty variants of any character.

## Usage

1. Paste or edit text in the workbench (or load one of the samples).
2. Pick a hand, ink colour, paper surface and sheet size.
3. Tune the biomechanics sliders and watch the live preview.
4. Re-write the page with a new seed until it looks right.
5. Download the PDF or print it.

Settings (including your draft text) are saved to `localStorage`, so a refresh keeps
your setup.

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + S` | Download the PDF |
| `⌘/Ctrl + Enter` | Re-write the page with a new seed |
| `Esc` | Close the specimen inspector |

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build
pnpm start      # serve the production build
pnpm typecheck  # tsc --noEmit
pnpm test       # node --test (no test framework dependency)
```

The production build does not need network access: UI and handwriting fonts are loaded
in the browser from the Google Fonts stylesheet in `app/layout.tsx`, so `next build`
works in offline CI.

## Project structure

| Path | Responsibility |
| --- | --- |
| `app/` | App Router entry points, metadata, global and print styles |
| `components/handwriting-studio.tsx` | Studio UI, debounced render pipeline, export/print |
| `components/allograph-specimen-modal.tsx` | 20-variant character inspector |
| `lib/allograph-engine.ts` | Glyph synthesis: per-pixel warp, stroke thinning, LRU cache |
| `lib/page-compositor.ts` | Text tokenizing, layout, page breaking, paper rendering |
| `lib/mistake-generator.ts` | Mistake synthesis and crossed-out scratch rendering |
| `lib/pdf-builder.ts` | Dependency-free PDF 1.4 writer |
| `tests/` | Unit tests for the PDF writer and the pure layout/tokenizer logic |

## Notes on the rendering model

- Glyphs are rendered once per `(character, variant, style, ink, size, nib)` tuple and
  cached in a least-recently-used map capped at 900 entries, which keeps memory bounded
  even while the size and nib sliders are being dragged.
- The compositor owns line breaking: words are measured against real font metrics, the
  remaining space on the current line is tracked per pixel column to prevent overlapping
  lines, and paragraphs are never orphaned onto the last line of a page.
- PDF export embeds each 1700 × 2200 page as a JPEG (`DCTDecode`) XObject, so a
  3-page document is a few hundred kilobytes instead of tens of megabytes.

## Testing

`pnpm test` runs on Node's built-in test runner with native TypeScript support — no
Vitest, Jest or ts-node. `tests/register-ts.mjs` is a tiny resolver hook that lets the
same extensionless imports used by Next.js run under Node. The suites verify that:

- every cross-reference offset in a generated PDF points at the object it names,
- declared stream lengths match the embedded bytes exactly,
- page geometry, metadata and page counts are written correctly,
- tildes, sentence indices and automatic mistake spacing tokenize as specified,
- width estimation follows font metrics rather than a flat per-character constant.
