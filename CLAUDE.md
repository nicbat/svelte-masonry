# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@nicbat/svelte-masonry` is a single-component, dependency-free Svelte 5 library (peer dep: `svelte ^5`). It is a SvelteKit project structured as a publishable library: `src/lib/` is the package source, and `src/routes/+page.svelte` is a dev-only demo/playground that is not shipped.

## Commands

```bash
npm run dev       # live demo/playground at / (src/routes/+page.svelte)
npm run package   # svelte-kit sync && svelte-package && publint → builds dist/
npm run build     # vite build + package
npm run check     # svelte-kit sync && svelte-check (type-checking)
npm run lint      # prettier --check .
npm run format    # prettier --write .
```

There is no test runner configured. `npm run check` (svelte-check) is the type/correctness gate.

## Architecture

The entire library is two files:

- `src/lib/Masonry.svelte` — the component. Generic over `T` (`generics="T"`).
- `src/lib/index.ts` — public entry; re-exports `Masonry`. Consumers import from the package root, never the `.svelte` file. Add public API here.

### The core invariant (do not break this)

Per-item heights are **only ever estimated** from an aspect ratio to decide which column an item joins — they are **never written back as fixed pixel heights**. Each rendered child sizes itself naturally in normal flow. The consequence: a wrong or missing aspect ratio only makes columns slightly less balanced; it can never clip, overlap, or misalign a tile. This is the deliberate distinction from fixed-frame masonry libraries. Any change that constrains a tile's real rendered height violates the library's central promise.

### How packing works

1. `width` is measured via `bind:clientWidth` (ResizeObserver under the hood).
2. `columnCount` = how many `minColumnWidth` columns (+ gaps) fit `width`, floored to ≥1.
3. Items are packed left-to-right, each appended to the **currently shortest** column (greedy balance), using `estimatedHeight = columnWidth / aspectRatio + footerEstimate`. Invalid/undefined aspect ratio falls back to `1`. `footerEstimate` accounts for non-image chrome (captions) and is distribution-only — never rendered.
4. Output is `columns: T[][]`, rendered as flex columns. The only styling the component owns is flex layout + a `--masonry-gap`.

All reactivity is Svelte 5 runes (`$props`, `$state`, `$derived`, `$derived.by`).

### Known trade-offs (documented in the component header)

Balancing uses intrinsic aspect ratios, not measured DOM heights, so wildly varying caption heights won't balance perfectly. Column-count changes reflow all items with no FLIP animation. Both are intentional for a browse grid.

## Conventions

- Heavy JSDoc on props and the component is the source of truth for the public API — keep it in sync with the README props table when changing props.
- Strict TypeScript (`strict`, `checkJs`). Prettier (with `prettier-plugin-svelte`) is the only formatter/linter; run `npm run lint` before considering work done.
