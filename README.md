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

| Prop             | Type                                   | Default | Description                                                                                                              |
| ---------------- | -------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `items`          | `T[]`                                  | —       | Items to lay out, in the order they should read (row-major).                                                            |
| `getKey`         | `(item: T) => string \| number`        | —       | Stable key per item, used for the keyed `{#each}`.                                                                      |
| `children`       | `Snippet<[T]>`                         | —       | Render snippet for one item: `{#snippet children(item)}…{/snippet}`.                                                    |
| `aspectRatio`    | `(item: T) => number \| undefined`     | `1`     | `width / height` per item. Non-positive / undefined is treated as `1` (square) for balancing only. Provide when known. |
| `minColumnWidth` | `number`                               | `160`   | Target minimum column width in px; column count = how many fit the container at this minimum.                           |
| `gap`            | `number`                               | `12`    | Gap in px between columns and between items within a column.                                                            |
| `footerEstimate` | `number`                               | `56`    | Estimated px of non-image chrome under each item (caption/chips) added to the height estimate so columns balance. Distribution-only; never rendered. |

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
