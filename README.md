# @nicbat/svelte-masonry

A generic, **dependency-free** balanced masonry layout for **Svelte 5**.

Items are distributed left-to-right into the shortest column (order-preserving / row-major reading
order), with the column count derived responsively from the container width.

The crucial design choice — and what keeps it robust — is that **per-item heights are only ever
_estimated_ from an aspect ratio to decide which column an item joins; they are never written back as
fixed pixel heights.** Each rendered child sizes itself naturally in normal flow, so a wrong or
absent aspect ratio (or a footer/caption of unknown height) only makes the columns slightly less
balanced — it can never clip, overlap, or mis-align a tile. That is the failure mode that
fixed-frame masonry libraries get wrong.

The component owns no styling beyond flex columns and a gap, and imports nothing but `svelte`.

## Install

```bash
# from npm (once published)
npm install @nicbat/svelte-masonry

# or straight from GitHub
npm install github:nicbat/svelte-masonry
```

`svelte` (`^5`) is a peer dependency — your app provides it.

## Usage

```svelte
<script lang="ts">
	import { Masonry } from '@nicbat/svelte-masonry';

	type Photo = { id: string; src: string; w: number; h: number };
	let photos: Photo[] = [/* … */];
</script>

<Masonry
	items={photos}
	getKey={(p) => p.id}
	aspectRatio={(p) => p.w / p.h}
	minColumnWidth={200}
	gap={16}
>
	{#snippet children(photo)}
		<img src={photo.src} alt="" style="width: 100%; display: block; border-radius: 8px" />
	{/snippet}
</Masonry>
```

## Props

| Prop              | Type                                           | Default     | Description                                                                                                                                                                                                                                                         |
| ----------------- | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`           | `T[]`                                          | —           | Items to lay out, in the order they should read (row-major).                                                                                                                                                                                                        |
| `getKey`          | `(item: T) => string \| number`                | —           | Stable key per item, used for the keyed `{#each}`.                                                                                                                                                                                                                  |
| `children`        | `Snippet<[T]>`                                 | —           | Render snippet for one item: `{#snippet children(item)}…{/snippet}`.                                                                                                                                                                                                |
| `aspectRatio`     | `(item: T) => number \| undefined`             | `1`         | `width / height` per item. Non-positive / undefined is treated as `1` (square) for balancing only. Provide when known.                                                                                                                                              |
| `minColumnWidth`  | `number`                                       | `160`       | Target minimum column width in px; column count = how many fit the container at this minimum. Ignored when `columns` is set.                                                                                                                                        |
| `columns`         | `number \| Record<number, number>`             | —           | Pin the column count instead of deriving it from `minColumnWidth`. A fixed `number` (width-independent), or a min-width breakpoint→count map, e.g. `{ 0: 1, 600: 2, 1000: 4 }`. **Overrides `minColumnWidth`.**                                                     |
| `initialColumns`  | `number`                                       | —           | Column count to assume before the client measures width — set to your expected count to avoid the SSR first-paint flash. No effect once measured, or when `columns` is a fixed number.                                                                              |
| `heightEstimate`  | `(item: T, columnWidth: number) => number`     | —           | Escape hatch that **fully replaces** `aspectRatio` + `footerEstimate` for column choice. Returns a relative balancing weight in px-ish units — **not** the tile's real height (tiles always size themselves). Cheap/pure; non-finite/negative returns clamp to `0`. |
| `gap`             | `number`                                       | `12`        | Shorthand for both `columnGap` and `rowGap` in px.                                                                                                                                                                                                                  |
| `columnGap`       | `number`                                       | `gap`       | Horizontal gap between columns in px. Overrides `gap` on the column axis.                                                                                                                                                                                           |
| `rowGap`          | `number`                                       | `gap`       | Vertical gap between stacked tiles in px. Overrides `gap` on the row axis.                                                                                                                                                                                          |
| `footerEstimate`  | `number`                                       | `56`        | Estimated px of non-image chrome under each item (caption/chips) added to the height estimate so columns balance. Distribution-only; never rendered. Ignored when `heightEstimate` is set.                                                                          |
| `onlayout`        | `(info: { columnCount; columnWidth }) => void` | —           | Observability-only callback fired when the column count or width changes (analytics, "showing N columns" labels, preloads). Does not affect layout.                                                                                                                 |
| `class`           | `string`                                       | —           | Merged with the component's own `masonry` class on the root element.                                                                                                                                                                                                |
| `empty`           | `Snippet`                                      | —           | Rendered instead of the grid when `items` is empty and not loading.                                                                                                                                                                                                 |
| `loading`         | `boolean`                                      | `false`     | When `true`, render `skeleton` instead of the grid. Takes precedence over `empty`.                                                                                                                                                                                  |
| `skeleton`        | `Snippet`                                      | —           | Loading placeholder rendered while `loading` is `true`.                                                                                                                                                                                                             |
| `animate`         | `boolean`                                      | `false`     | Slide tiles to new positions with FLIP on reflow (column-count change, add/remove/reorder). Invariant-safe (animates a compositor-only `transform`, never resizes/clips). Respects `prefers-reduced-motion`. Off = zero measurement.                                |
| `animateDuration` | `number`                                       | `250`       | FLIP duration in ms. Only read when `animate`.                                                                                                                                                                                                                      |
| `animateEasing`   | `string`                                       | ease-out    | FLIP easing. Only read when `animate`.                                                                                                                                                                                                                              |
| `readingOrder`    | `'columns' \| 'source'`                        | `'columns'` | `'columns'` = balanced flex layout (column-major DOM). `'source'` = source-ordered CSS multi-column flow so DOM order == reading order (a11y), trading away JS balancing. See Accessibility below.                                                                  |

Any other standard `<div>` attribute (`id`, `style`, `data-*`, `aria-*`, `onclick`, …) is passed
through to the root element, so you can style or annotate the grid without an extra wrapper. The
exported `MasonryProps<T>` type is available for wrapper authors:

```ts
import { Masonry, type MasonryProps } from '@nicbat/svelte-masonry';
```

## Accessibility & reading order

Items are distributed into **per-column DOM containers**, so the DOM, Tab, and screen-reader order is
**column-major** (down column 1, then column 2…) even though the _visual_ order is row-major. For
decorative or browse/gallery grids this is fine. **If the items' order carries meaning** (steps,
ranked results, a reading sequence), this mismatch can trip WCAG 1.3.2 (Meaningful Sequence) and 2.4.3
(Focus Order).

For that case, pass **`readingOrder="source"`**:

```svelte
<Masonry items={steps} getKey={(s) => s.id} readingOrder="source">
	{#snippet children(step)}…{/snippet}
</Masonry>
```

This renders a single source-ordered flow in a CSS multi-column container, so the DOM, Tab, and
screen-reader order match the visual reading order. The trade-off: the browser handles balancing, so
the JS `aspectRatio` / `heightEstimate` packing does **not** apply in this mode (items are kept whole
with `break-inside: avoid`). The invariant still holds — tile heights are never constrained.

Rule of thumb: default `'columns'` when order is _presentational_; `readingOrder="source"` when order
is _semantic_.

## Why "balanced"?

Columns are filled by always appending the next item to the **currently shortest** column (estimating
its height from the aspect ratio), rather than naïvely round-robining. This keeps column bottoms close
to even without ever constraining a tile's real height.

## Development

```bash
npm install
npm run dev       # live demo / playground at /
npm run package   # build dist/ with svelte-package + publint
npm run check     # svelte-check
```

## License

MIT
