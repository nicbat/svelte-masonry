# 04 · Separate `columnGap` / `rowGap`

**Tag:** `opt-in` · **Status:** ✅ done (Wave 1) · **Depends on:** nothing. Coordinate with 06/07 (both read
the column gap in the `columnCount` math).

> Shipped: `colGap`/`rowGap_` derived (`columnGap ?? gap`, `rowGap ?? gap`); column-fitting math uses
> `colGap`; CSS vars split into `--masonry-col-gap` / `--masonry-row-gap`. **06/07 must build on
> `colGap`, not `gap`, in the count math.**

## Goal

Allow different horizontal (between columns) and vertical (between stacked tiles) spacing, while keeping
`gap` as a shorthand for "both."

## Current state (`src/lib/Masonry.svelte`)

A single `gap = 12` prop is used in **three** places:

1. `columnCount` derivation: `Math.floor((width + gap) / (minColumnWidth + gap))`
2. `columnWidth` derivation: `(width - gap * (columnCount - 1)) / columnCount`
3. The CSS var: `style="--masonry-gap: {gap}px"`, consumed by both `.masonry { gap }` (between columns)
   and `.masonry-column { gap }` (between rows).

## API change

```ts
gap?: number;        // shorthand, default 12 (unchanged)
columnGap?: number;  // defaults to gap
rowGap?: number;     // defaults to gap
```

## Implementation steps

1. Add the two props; derive effective values:
   ```ts
   const colGap = $derived(columnGap ?? gap);
   const rowGap_ = $derived(rowGap ?? gap);
   ```
2. **Use `colGap` (not `gap`) in the column-fitting math** — `columnCount` and `columnWidth` both
   concern horizontal spacing:
   ```ts
   const columnCount = $derived(
   	Math.max(1, Math.floor((width + colGap) / (minColumnWidth + colGap)))
   );
   const columnWidth = $derived(
   	columnCount > 0 ? (width - colGap * (columnCount - 1)) / columnCount : 0
   );
   ```
3. Split the CSS vars and apply each to the right axis:
   ```svelte
   <div class="masonry" ... style="--masonry-col-gap: {colGap}px; --masonry-row-gap: {rowGap_}px">
   ```
   ```css
   .masonry {
   	gap: var(--masonry-col-gap);
   } /* between columns */
   .masonry-column {
   	gap: var(--masonry-row-gap);
   } /* between rows */
   ```

## Gotchas

- Keep `gap` as the only documented "set both" knob; `columnGap`/`rowGap` override per axis.
- If plan 02 (passthrough `style`) already shipped, make sure these vars compose with any user `style`.
- Don't rename the existing `--masonry-gap` without updating any docs/snippets that reference it
  (currently only the component itself does).

## Verification

- `npm run check`. In the demo, set `columnGap={24} rowGap={6}` and confirm visually (see the mock in
  `features-explained.html#gaps`).

## Definition of done

See `plans/README.md`. Plus: props table lists `gap`/`columnGap`/`rowGap` with the shorthand
relationship.
