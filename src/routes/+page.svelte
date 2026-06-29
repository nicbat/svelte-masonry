<script lang="ts">
	import { Masonry, type MasonryLayoutInfo } from '$lib/index.js';

	type Tile = { id: number; ratio: number; hue: number; lines: number };

	// A spread of aspect ratios so the balancing is visible.
	const ratios = [0.6, 1, 1.5, 0.8, 1.2, 2, 0.5, 1, 1.7, 0.9, 1.3, 0.7];
	let count = $state(24);
	let minColumnWidth = $state(160);
	let columnGap = $state(12);
	let rowGap = $state(12);
	let useHeightEstimate = $state(false);

	// Wave 2 controls.
	type ColMode = 'fluid' | 'breakpoints' | 'fixed';
	let colMode = $state<ColMode>('fluid');
	let loading = $state(false);
	let animate = $state(true);
	let readingOrder = $state<'columns' | 'source'>('columns');

	// Plan 07: `columns` is undefined (fluid), a breakpoint map, or a fixed number.
	const columns = $derived(
		colMode === 'breakpoints' ? { 0: 1, 600: 2, 1000: 4 } : colMode === 'fixed' ? 3 : undefined
	);

	// Last layout info reported by onlayout (05) — observability readout.
	let layout = $state<MasonryLayoutInfo>({ columnCount: 0, columnWidth: 0 });

	const tiles = $derived(
		Array.from({ length: count }, (_, i): Tile => ({
			id: i,
			ratio: ratios[i % ratios.length],
			hue: (i * 37) % 360,
			lines: (i % 4) + 1 // varying caption heights, for heightEstimate demo
		}))
	);
</script>

<main>
	<header>
		<h1>@nicbat/svelte-masonry</h1>
		<p>Dependency-free balanced masonry for Svelte 5. Resize the window to see columns reflow.</p>
		<p><a href="/text">→ text-content stress test (type into growing textboxes)</a></p>

		<div class="controls">
			<label>
				Tiles: {count}
				<input type="range" min="4" max="60" bind:value={count} />
			</label>
			<label>
				minColumnWidth: {minColumnWidth}px
				<input type="range" min="80" max="400" step="10" bind:value={minColumnWidth} />
			</label>
			<label>
				columnGap: {columnGap}px
				<input type="range" min="0" max="48" bind:value={columnGap} />
			</label>
			<label>
				rowGap: {rowGap}px
				<input type="range" min="0" max="48" bind:value={rowGap} />
			</label>
			<label class="checkbox">
				<input type="checkbox" bind:checked={useHeightEstimate} />
				heightEstimate (caption-aware)
			</label>
			<label>
				columns mode
				<select bind:value={colMode}>
					<option value="fluid">fluid (minColumnWidth)</option>
					<option value="breakpoints">breakpoints {'{0:1, 600:2, 1000:4}'}</option>
					<option value="fixed">fixed (3)</option>
				</select>
			</label>
			<label class="checkbox">
				<input type="checkbox" bind:checked={loading} />
				loading (skeleton)
			</label>
			<label class="checkbox">
				<input type="checkbox" bind:checked={animate} />
				animate (FLIP)
			</label>
			<label>
				readingOrder
				<select bind:value={readingOrder}>
					<option value="columns">columns (balanced)</option>
					<option value="source">source (a11y)</option>
				</select>
			</label>
			<button type="button" onclick={() => (count = count === 0 ? 24 : 0)}>
				{count === 0 ? 'restore items' : 'empty (0 items)'}
			</button>
		</div>

		<p class="readout" aria-live="polite">
			onlayout → {layout.columnCount} columns @ {Math.round(layout.columnWidth)}px each
		</p>
	</header>

	<Masonry
		items={tiles}
		getKey={(t) => t.id}
		aspectRatio={(t) => t.ratio}
		{minColumnWidth}
		{columns}
		{columnGap}
		{rowGap}
		{loading}
		{animate}
		{readingOrder}
		heightEstimate={useHeightEstimate ? (t, cw) => cw / t.ratio + t.lines * 22 + 16 : undefined}
		onlayout={(info) => (layout = info)}
		class="demo-grid"
		data-testid="masonry-root"
	>
		{#snippet children(tile)}
			<div class="tile" style="background: hsl({tile.hue} 70% 60%)">
				<div class="thumb" style="aspect-ratio: {tile.ratio}">#{tile.id}</div>
				<div class="caption">
					{#each Array(tile.lines) as _, l (l)}
						<span>caption line {l + 1}</span>
					{/each}
				</div>
			</div>
		{/snippet}

		{#snippet empty()}
			<p class="state" data-testid="empty">No items to show.</p>
		{/snippet}

		{#snippet skeleton()}
			<div class="skeleton" data-testid="skeleton" aria-busy="true">
				{#each Array(8) as _, s (s)}
					<div class="skeleton-tile"></div>
				{/each}
			</div>
		{/snippet}
	</Masonry>
</main>

<style>
	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		font-family: system-ui, sans-serif;
	}
	header {
		margin-bottom: 1.5rem;
	}
	h1 {
		font-size: 1.4rem;
		margin: 0 0 0.25rem;
	}
	p {
		color: #555;
		margin: 0 0 1rem;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.5rem;
		margin-bottom: 0.75rem;
	}
	label {
		display: inline-flex;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.9rem;
	}
	label.checkbox {
		gap: 0.4rem;
	}
	.readout {
		font-size: 0.85rem;
		color: #333;
		font-variant-numeric: tabular-nums;
		margin: 0;
	}
	.tile {
		border-radius: 8px;
		overflow: hidden;
		color: white;
	}
	.thumb {
		display: grid;
		place-items: center;
		font-weight: 600;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}
	.caption {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px 8px;
		font-size: 0.75rem;
		background: rgba(0, 0, 0, 0.25);
	}
	.state {
		padding: 3rem 1rem;
		text-align: center;
		color: #888;
		border: 1px dashed #ccc;
		border-radius: 8px;
	}
	.skeleton {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
	}
	.skeleton-tile {
		height: 120px;
		border-radius: 8px;
		background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
		background-size: 200% 100%;
		animation: shimmer 1.2s infinite;
	}
	@keyframes shimmer {
		from {
			background-position: 200% 0;
		}
		to {
			background-position: -200% 0;
		}
	}
	button {
		font-size: 0.85rem;
		padding: 0.25rem 0.6rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		background: #fafafa;
		cursor: pointer;
	}
</style>
