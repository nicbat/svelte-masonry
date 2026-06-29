# 09 · `animate` — FLIP reflow animation

**Tag:** `opt-in` (built-in boolean, default `false`) · **Status:** ✅ done (Wave 3) · **Depends on:** do
last — it touches the `{#each}` render and adds an effect. Benefits from 02 (so `class`/keys are settled).

> Shipped: `animate`/`animateDuration` (250)/`animateEasing`. Each tile now wrapped in
> `.masonry-item[data-key]`; `bind:this={rootEl}` on the grid. Manual FLIP in an `$effect` depending on
> `columns`: measures `getBoundingClientRect`, plays a `transform` translate. Only _plays_ when
> `columnCount` or `items` (reference) changed — refreshes stored rects every run so resize-only frames
> don't animate but keep a fresh baseline. Reduced-motion gated. Off-path early-returns before any DOM
> query. Invariant safe: transform is compositor-only, no height ever touched.

## Goal

When the layout reflows — column count changes on resize, or items are added/removed/reordered — tiles
currently **jump** to their new positions. With `animate`, slide them smoothly using FLIP. Opt-in,
`false` by default; **zero behavior and no measurement when off.**

## Why this is invariant-safe (important)

FLIP measures **positions** (`getBoundingClientRect` → x/y) and animates with
`transform: translate(...)`. A `transform` is **compositor-only**: it does not participate in layout, so
the tile keeps its full natural box and **cannot be clipped**. This is fundamentally different from
virtualization (which must reserve/measure _heights_). FLIP touches no heights → invariant holds.

## The wrinkle: built-in `animate:flip` is insufficient

Svelte's `animate:flip` directive only animates reordering **within a single keyed `{#each}`**. Here,
tiles are split across **multiple per-column `{#each}` blocks**. When an item moves from column 1 to
column 2 (exactly what a column-count change does), it leaves one each-block and enters another, which
the directive does not track. So we need a small **manual FLIP**.

## Current state (`src/lib/Masonry.svelte`)

```svelte
<div class="masonry" ...>
	{#each columns as column, i (i)}
		<div class="masonry-column">
			{#each column as item (getKey(item))}
				{@render children(item)}
			{/each}
		</div>
	{/each}
</div>
```

Items are rendered directly via `{@render children(item)}` — there's currently **no per-tile wrapper
element to grab a DOM ref from**. FLIP needs a stable element per item to measure/transform.

## API change

```ts
animate?: boolean;          // default false
animateDuration?: number;   // ms, default 250; only read when animate
animateEasing?: string;     // optional, default 'cubic-bezier(.2,.8,.2,1)'
```

## Implementation steps

1. **Give each tile a wrapper element** so we have something to measure/transform. Only needed (or only
   ref-tracked) when `animate` is true, but a stable wrapper is simplest always:
   ```svelte
   {#each column as item (getKey(item))}
   	<div class="masonry-item" data-key={String(getKey(item))}>
   		{@render children(item)}
   	</div>
   {/each}
   ```
   Add minimal CSS so the wrapper doesn't change layout: `.masonry-item { display: contents }` is
   tempting but `display:contents` elements have **no box to transform** — so instead use a wrapper that
   is a normal block (`.masonry-item {}` with no extra styling); it participates in the column flex flow
   exactly where the tile used to. Verify gap still applies (the column's `gap` now spaces
   `.masonry-item` wrappers — same visual result).
2. **Track positions by key.** Keep a module-level (component-scoped) `Map<string, DOMRect>`:
   ```ts
   let lastRects = new Map<string, DOMRect>();
   ```
3. **Run FLIP after each layout change** in an `$effect` that depends on `columns` (so it re-runs when
   packing changes) — but only when `animate`:
   ```ts
   $effect(() => {
   	columns; // establish dependency
   	if (!animate) return;
   	const root = rootEl; // bind:this on the .masonry div
   	if (!root) return;
   	const items = root.querySelectorAll<HTMLElement>('.masonry-item');
   	for (const el of items) {
   		const key = el.dataset.key!;
   		const next = el.getBoundingClientRect();
   		const prev = lastRects.get(key);
   		if (prev) {
   			const dx = prev.left - next.left;
   			const dy = prev.top - next.top;
   			if (dx || dy) {
   				el.animate(
   					[{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0,0)' }],
   					{
   						duration: animateDuration ?? 250,
   						easing: animateEasing ?? 'cubic-bezier(.2,.8,.2,1)'
   					}
   				);
   			}
   		}
   		lastRects.set(key, next);
   	}
   	// prune keys that no longer exist
   	const live = new Set([...items].map((e) => e.dataset.key!));
   	for (const k of lastRects.keys()) if (!live.has(k)) lastRects.delete(k);
   });
   ```
   Add `let rootEl: HTMLDivElement | undefined = $state();` and `bind:this={rootEl}` on the `.masonry`
   div.
4. **Timing:** a Svelte `$effect` runs after the DOM updates, which is the correct "Last" moment for
   FLIP (we read the new rect, compare to the stored old rect, invert+play). No `tick()` needed because
   the effect already fires post-DOM-update. The "First" rect is simply the value stored from the
   previous run — this works for resize/reorder. (For the very first run there's no `prev`, so nothing
   animates — correct.)

## Gotchas

- **Off path must be truly free:** when `animate` is false, don't query the DOM, don't store rects, don't
  add observers. The early `return` handles this; confirm the wrapper element is the only always-on cost.
- **Enter/leave:** this plan animates _moves_ (FLIP) only. New items appear instantly and removed items
  vanish instantly. Add/remove transitions are a possible follow-up (Svelte `transition:` on
  `.masonry-item`), but keep them out of the core unless asked — they interact with measurement timing.
- **Reduced motion:** respect `@media (prefers-reduced-motion: reduce)` — gate the `el.animate` call on
  `!window.matchMedia('(prefers-reduced-motion: reduce)').matches`, or skip the animation duration.
  Do this; it's an accessibility expectation.
- **Performance:** `el.animate` runs on the compositor; fine for hundreds of tiles. Don't FLIP during
  continuous resize every pixel if it janks — consider only animating on integer column-count change
  (compare a stored `prevColumnCount`) rather than on every `columnWidth` delta. Recommended: animate on
  column-count change, not on every resize frame.
- **`querySelectorAll` cost:** acceptable per layout change; if it shows up in profiles, switch to
  `bind:this` refs collected per item.

## Verification

- `npm run check` + `npm run lint`.
- In the demo with `animate`, resize past a breakpoint and watch tiles slide (compare to the working
  demo in `features-explained.html#flip`, which uses this exact technique).
- Toggle OS "reduce motion" → confirm tiles jump instantly (no animation).
- With `animate={false}` confirm no `el.animate` calls and identical behavior to today.

## Definition of done

See `plans/README.md`. Plus: props table documents `animate`/`animateDuration`; reduced-motion respected;
off-path verified zero-cost beyond the wrapper element.
