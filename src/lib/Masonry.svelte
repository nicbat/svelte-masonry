<script lang="ts" generics="T">
	import type { MasonryProps } from './types.js';

	/**
	 * A generic, dependency-free balanced masonry layout for Svelte 5.
	 *
	 * Items are distributed left-to-right into the shortest column (order-preserving / row-major
	 * reading order), with column count derived responsively from the container width. The crucial
	 * design choice — and what keeps it robust — is that **per-item heights are only ever estimated
	 * from an aspect ratio to decide which column an item joins; they are never written back as fixed
	 * pixel heights.** Each rendered child sizes itself naturally in normal flow, so a wrong or absent
	 * aspect ratio (or a footer/caption of unknown height) only makes the columns slightly less
	 * balanced — it can never clip, overlap, or mis-align a tile. This is the failure mode that
	 * fixed-frame masonry libraries get wrong.
	 *
	 * The component owns no styling beyond flex columns and a gap, and imports nothing but `svelte`,
	 * so it can be lifted into a standalone publishable package unchanged.
	 *
	 * ### Accessibility & reading order
	 * Because items are distributed into per-column DOM containers, the **DOM, Tab, and screen-reader
	 * order is column-major** (down column 1, then column 2…) even though the *visual* order is
	 * row-major. For decorative galleries this is fine; if the items' order carries meaning, the
	 * mismatch can trip WCAG 1.3.2 (Meaningful Sequence) and 2.4.3 (Focus Order). For order-significant
	 * content pass `readingOrder="source"` to render a single source-ordered CSS multi-column flow where
	 * DOM order == reading order (at the cost of JS balancing — see {@link MasonryProps.readingOrder}).
	 *
	 * See {@link MasonryProps} for the full prop reference (all of `aspectRatio`, `heightEstimate`,
	 * `gap`/`columnGap`/`rowGap`, `onlayout`, `class`/pass-through attributes, etc.).
	 *
	 * Concerns / future improvements: balancing uses intrinsic aspect ratios rather than measured DOM
	 * heights, so captions of wildly varying height won't balance perfectly — acceptable here, and a
	 * future variant could opt into a post-render measure pass. Reflows are instant by default; pass
	 * `animate` to slide tiles with FLIP (opt-in, reduced-motion aware).
	 */
	let {
		items,
		getKey,
		aspectRatio,
		heightEstimate,
		minColumnWidth = 160,
		columns: columnsProp,
		initialColumns,
		gap = 12,
		columnGap,
		rowGap,
		footerEstimate = 56,
		onlayout,
		empty,
		loading = false,
		skeleton,
		readingOrder = 'columns',
		animate = false,
		animateDuration = 250,
		animateEasing = 'cubic-bezier(.2, .8, .2, 1)',
		children,
		class: klass,
		style: userStyle,
		...rest
	}: MasonryProps<T> = $props();

	/** Measured content width (px). `bind:clientWidth` uses a ResizeObserver under the hood. */
	let width = $state(0);
	/** The root grid element, bound for FLIP position measurement (only used when `animate`). */
	let rootEl = $state<HTMLDivElement>();
	/** Whether the container has been measured yet (false on the server / first tick). */
	const measured = $derived(width > 0);

	/** Effective horizontal/vertical gaps; each falls back to the `gap` shorthand. */
	const colGap = $derived(columnGap ?? gap);
	const rowGap_ = $derived(rowGap ?? gap);

	/**
	 * How many columns to render. Precedence: an explicit fixed `columns` number (width-independent, so
	 * SSR-safe) → the `initialColumns` hint while still unmeasured → a `columns` breakpoint map → the
	 * default fluid `minColumnWidth` model. All paths floor to ≥ 1.
	 */
	const columnCount = $derived.by(() => {
		if (typeof columnsProp === 'number') return Math.max(1, Math.floor(columnsProp));
		// Before the client measures, prefer the author's hint to avoid the SSR/first-paint flash.
		if (!measured && initialColumns != null) return Math.max(1, Math.floor(initialColumns));
		if (columnsProp && typeof columnsProp === 'object') {
			const bps = Object.keys(columnsProp)
				.map(Number)
				.filter((n) => Number.isFinite(n))
				.sort((a, b) => a - b);
			if (bps.length === 0) return 1;
			let count = columnsProp[bps[0]] ?? 1;
			for (const bp of bps) if (width >= bp) count = columnsProp[bp];
			return Math.max(1, Math.floor(count));
		}
		return Math.max(1, Math.floor((width + colGap) / (minColumnWidth + colGap)));
	});

	/**
	 * Actual rendered column width, used to scale the aspect-ratio height estimate into px. Clamped to
	 * ≥ 0 so the pre-measurement frame (width 0 with N assumed columns) yields a harmless `0`, never a
	 * negative estimate.
	 */
	const columnWidth = $derived(
		Math.max(0, columnCount > 0 ? (width - colGap * (columnCount - 1)) / columnCount : 0)
	);

	/**
	 * Pack items into `columnCount` columns, each item joining the currently-shortest column. Heights
	 * are estimates (image height ≈ columnWidth / aspectRatio, plus a flat footer — or a fully custom
	 * `heightEstimate`) used solely to pick a column; see the component note on why estimate error is
	 * harmless.
	 */
	const columns = $derived.by<T[][]>(() => {
		const cols: T[][] = Array.from({ length: columnCount }, () => []);
		const heights = new Array<number>(columnCount).fill(0);
		for (const item of items) {
			let estimatedHeight: number;
			if (heightEstimate) {
				const h = heightEstimate(item, columnWidth);
				// A bad user function must degrade gracefully, never NaN the layout.
				estimatedHeight = Number.isFinite(h) && h > 0 ? h : 0;
			} else {
				const ar = aspectRatio?.(item);
				const validAr = ar && ar > 0 ? ar : 1;
				estimatedHeight = columnWidth / validAr + footerEstimate;
			}
			let shortest = 0;
			for (let i = 1; i < columnCount; i++) {
				if (heights[i] < heights[shortest]) shortest = i;
			}
			cols[shortest].push(item);
			heights[shortest] += estimatedHeight;
		}
		return cols;
	});

	// Observability only: notify on every layout recalculation. Must be an $effect (not a derivation)
	// so it runs after measurement and stays side-effect-free where derivations are concerned.
	$effect(() => {
		onlayout?.({ columnCount, columnWidth });
	});

	/** Last measured position per key, the "First" half of FLIP. Empty unless `animate`. */
	let lastRects = new Map<string, DOMRect>();
	let prevColumnCount = -1;
	let prevItems: T[] | undefined;
	/** Becomes true once the first measured layout is recorded, so the initial settle never animates. */
	let primed = false;
	let prevAnimate = false;

	// While `animate` is off we don't track positions (off-path stays free), so the stored baseline
	// goes stale. When it flips back on, re-prime so the next layout is re-established silently instead
	// of catching up with one surprise animation. Declared before the FLIP effect so it runs first.
	$effect(() => {
		if (animate && !prevAnimate) {
			primed = false;
			lastRects.clear();
		}
		prevAnimate = animate;
	});

	/**
	 * Manual FLIP. Built-in `animate:flip` can't help here because a tile moving between columns leaves
	 * one keyed `{#each}` and enters another. After every repack we read each tile's new position
	 * ("Last"), invert against its stored old position ("First"), and play a layout-free `transform` —
	 * which can never resize or clip the tile, so the never-clip invariant holds. We only *play* on a
	 * real reflow (column-count change or items changed), not on every resize pixel, but we always
	 * refresh the stored rects so the next reflow inverts from a fresh baseline.
	 */
	$effect(() => {
		columns; // establish dependency: re-run on every repack
		if (!animate) return;
		const root = rootEl;
		if (!root) return;

		const countChanged = columnCount !== prevColumnCount;
		const itemsChanged = items !== prevItems;
		const shouldPlay = countChanged || itemsChanged;
		prevColumnCount = columnCount;
		prevItems = items;

		const reduce =
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

		const tiles = root.querySelectorAll<HTMLElement>('.masonry-item');
		const live = new Set<string>();
		for (const el of tiles) {
			const key = el.dataset.key;
			if (key == null) continue;
			live.add(key);
			const next = el.getBoundingClientRect();
			const prev = lastRects.get(key);
			if (shouldPlay && primed && !reduce && prev) {
				const dx = prev.left - next.left;
				const dy = prev.top - next.top;
				if (dx || dy) {
					el.animate(
						[{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
						{ duration: animateDuration, easing: animateEasing }
					);
				}
			}
			lastRects.set(key, next);
		}
		// Drop keys that no longer exist so the map can't grow unbounded.
		for (const k of lastRects.keys()) if (!live.has(k)) lastRects.delete(k);
		// After the first measured layout is stored, later reflows are real reflows worth animating.
		if (measured) primed = true;
	});
</script>

{#if loading && skeleton}
	{@render skeleton()}
{:else if items.length === 0 && empty}
	{@render empty()}
{:else if readingOrder === 'source'}
	<!-- Source-ordered CSS multi-column flow: DOM order == reading order. The browser balances; the
	     JS aspect-ratio packing does not apply here. `break-inside: avoid` keeps tiles whole. -->
	<div
		{...rest}
		bind:this={rootEl}
		class="masonry masonry-source {klass ?? ''}"
		bind:clientWidth={width}
		style="--masonry-col-gap: {colGap}px; --masonry-row-gap: {rowGap_}px; --masonry-columns: {columnCount}; {userStyle ??
			''}"
	>
		{#each items as item (getKey(item))}
			<div class="masonry-item" data-key={String(getKey(item))}>
				{@render children(item)}
			</div>
		{/each}
	</div>
{:else}
	<div
		{...rest}
		bind:this={rootEl}
		class="masonry {klass ?? ''}"
		bind:clientWidth={width}
		style="--masonry-col-gap: {colGap}px; --masonry-row-gap: {rowGap_}px; {userStyle ?? ''}"
	>
		{#each columns as column, i (i)}
			<div class="masonry-column">
				{#each column as item (getKey(item))}
					<div class="masonry-item" data-key={String(getKey(item))}>
						{@render children(item)}
					</div>
				{/each}
			</div>
		{/each}
	</div>
{/if}

<style>
	.masonry {
		display: flex;
		align-items: flex-start;
		gap: var(--masonry-col-gap);
		width: 100%;
	}
	.masonry-column {
		display: flex;
		flex: 1 1 0;
		flex-direction: column;
		gap: var(--masonry-row-gap);
		min-width: 0;
	}
	/* Per-item wrapper: a plain block so it has a box to FLIP-transform, no layout effect of its own. */
	.masonry-item {
		min-width: 0;
	}
	/* readingOrder="source": one source-ordered flow in a CSS multi-column container. Overrides the
	   flex display above (same specificity, declared later). */
	.masonry-source {
		display: block;
		column-count: var(--masonry-columns);
		column-gap: var(--masonry-col-gap);
	}
	.masonry-source .masonry-item {
		break-inside: avoid;
		margin-bottom: var(--masonry-row-gap);
	}
</style>
