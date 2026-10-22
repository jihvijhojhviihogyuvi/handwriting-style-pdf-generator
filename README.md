# Chirograph

A previewable handwriting-style PDF generator built with Next.js and Canvas.

## Features

- Generate realistic handwritten pages from editable text
- Multiple handwriting styles and pen ink colors
- Adjustable writing size, nib thinness, spacing, drift, height variation, and margin wander
- Paper textures, ruled pages, and forensic guide overlays
- Letter-variant specimen inspection
- Zoomable preview with PDF export and print support

## Preview

Run the development server and open the local preview:

```bash
pnpm dev
```

Then visit `http://localhost:3000`.

## Build

```bash
pnpm build
pnpm start
```

## Project Structure

- `app/` — Next.js App Router entry points and global styles
- `components/handwriting-studio.tsx` — interactive studio UI
- `lib/allograph-engine.ts` — handwriting glyph and stroke synthesis
- `lib/page-compositor.ts` — page layout and Canvas composition
- `lib/mistake-generator.ts` — correction and handwriting artifact generation

## Usage

1. Enter or edit text in the workbench.
2. Choose a handwriting profile, ink color, and paper style.
3. Tune the controls for size, nib thinness, spacing, and natural variation.
4. Review the generated page in the preview.
5. Export or print the result when it is ready.
