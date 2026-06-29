import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Layout info emitted by {@link MasonryProps.onlayout} whenever the layout recalculates. */
export interface MasonryLayoutInfo {
	/** Number of columns currently rendered. */
	columnCount: number;
	/** Rendered width of a single column in px (may be `0` before the first measurement). */
	columnWidth: number;
}

/**
 * Props for the `Masonry` component, generic over the item type `T`.
 *
 * In addition to the props below, any standard attribute valid on a `<div>` — `id`, `style`,
 * `data-*`, `aria-*`, event handlers like `onclick`, etc. — is passed through to the root element,
 * so you can style or annotate the grid without an extra wrapper.
 */
export interface MasonryProps<T> extends Omit<
	HTMLAttributes<HTMLDivElement>,
	'children' | 'class'
> {
	/** The items to lay out, in the order they should read (row-major). */
	items: T[];
	/** Stable key per item (used for the keyed `{#each}`). */
	getKey: (item: T) => string | number;
	/**
	 * Optional `width / height` per item; non-positive/undefined ⇒ treated as `1` (square) for
	 * balancing only. Provide it whenever known for tighter columns. Ignored when
	 * {@link MasonryProps.heightEstimate} is set.
	 */
	aspectRatio?: (item: T) => number | undefined;
	/**
	 * Optional escape hatch that **fully replaces** the `aspectRatio` + `footerEstimate` height
	 * computation used to pick a column. Receives the item and the current `columnWidth` (px) and
	 * returns a relative balancing weight in px-ish units — **not** the tile's real height (the tile
	 * always sizes itself in normal flow). Keep it cheap and pure; it runs once per item per re-pack.
	 * Non-finite/negative returns are clamped to `0` (degrades to "join the shortest column"), never
	 * throwing or breaking layout. When omitted, `aspectRatio`/`footerEstimate` are used as before.
	 */
	heightEstimate?: (item: T, columnWidth: number) => number;
	/**
	 * Target minimum column width in px; column count = how many fit the container at this minimum.
	 * Defaults to `160`. Ignored when {@link MasonryProps.columns} is set.
	 */
	minColumnWidth?: number;
	/**
	 * Pin the column count explicitly instead of deriving it from {@link MasonryProps.minColumnWidth}.
	 * Either a fixed `number` (always that many columns, width-independent) or a min-width breakpoint →
	 * count map, e.g. `{ 0: 1, 600: 2, 1000: 4 }` (the count for the largest breakpoint ≤ the current
	 * width wins). When set, **overrides `minColumnWidth`**.
	 */
	columns?: number | Record<number, number>;
	/**
	 * Column count to assume before the client measures the container width — set this to your expected
	 * count to avoid the first-paint flash where SSR renders a single tall column and then reflows.
	 * Only affects the pre-measurement frame; once width is known the real count takes over. Has no
	 * effect when {@link MasonryProps.columns} is a fixed number (already deterministic).
	 */
	initialColumns?: number;
	/** Shorthand for both `columnGap` and `rowGap` in px. Defaults to `12`. */
	gap?: number;
	/** Horizontal gap between columns in px. Overrides {@link MasonryProps.gap} on the column axis. */
	columnGap?: number;
	/** Vertical gap between stacked tiles in px. Overrides {@link MasonryProps.gap} on the row axis. */
	rowGap?: number;
	/**
	 * Estimated px of non-image chrome under each item (caption/chips) added to the height estimate so
	 * columns balance accounting for fixed footers. Distribution-only; never rendered. Defaults to
	 * `56`. Ignored when {@link MasonryProps.heightEstimate} is set.
	 */
	footerEstimate?: number;
	/**
	 * Observability-only callback fired (in an effect, after measurement) whenever the column count or
	 * width changes — e.g. for analytics, a "showing N columns" label, or triggering preloads. Does
	 * not affect layout. Fires often during resize, mirroring a `ResizeObserver`.
	 */
	onlayout?: (info: MasonryLayoutInfo) => void;
	/** Class string merged with the component's own `masonry` class on the root element. */
	class?: string;
	/**
	 * Rendered instead of the grid when there are no items (`items.length === 0`) and not loading.
	 * Optional; when absent an empty grid renders as before.
	 */
	empty?: Snippet;
	/** When `true`, render {@link MasonryProps.skeleton} instead of the grid. Takes precedence over `empty`. */
	loading?: boolean;
	/** Loading placeholder rendered while {@link MasonryProps.loading} is `true`. Optional. */
	skeleton?: Snippet;
	/**
	 * How the item DOM is ordered, which determines Tab / screen-reader sequence.
	 * - `'columns'` (default) — the balanced flex-column layout. Best column balance (uses the
	 *   aspect-ratio/`heightEstimate` packing), but the DOM is **column-major**, so it can mismatch the
	 *   visual row order. Fine for decorative galleries.
	 * - `'source'` — render one source-ordered flow in a CSS multi-column container, so DOM order ==
	 *   reading order (good for order-significant content / WCAG 1.3.2 & 2.4.3). Trade-off: balancing is
	 *   left to the browser (the JS `aspectRatio`/`heightEstimate` packing does **not** apply), and items
	 *   are kept from splitting across columns via `break-inside: avoid`.
	 */
	readingOrder?: 'columns' | 'source';
	/**
	 * When `true`, smoothly slide tiles to their new positions (FLIP) on reflow — column-count changes
	 * and item add/remove/reorder. Default `false`; when off there is zero measurement or DOM querying.
	 * Animation is invariant-safe: it only measures *positions* and animates with a compositor-only
	 * `transform`, so a tile is never resized or clipped. Respects `prefers-reduced-motion`.
	 */
	animate?: boolean;
	/** FLIP animation duration in ms. Only read when {@link MasonryProps.animate}. Defaults to `250`. */
	animateDuration?: number;
	/** FLIP animation easing. Only read when {@link MasonryProps.animate}. Defaults to a soft ease-out. */
	animateEasing?: string;
	/** Render snippet for one item: `{#snippet children(item)}…{/snippet}`. */
	children: Snippet<[T]>;
}
