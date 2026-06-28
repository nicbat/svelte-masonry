<script lang="ts">
	import { Masonry } from '$lib/index.js';

	type Tile = { id: number; ratio: number; hue: number };

	// A spread of aspect ratios so the balancing is visible.
	const ratios = [0.6, 1, 1.5, 0.8, 1.2, 2, 0.5, 1, 1.7, 0.9, 1.3, 0.7];
	let count = $state(24);

	const tiles = $derived(
		Array.from({ length: count }, (_, i): Tile => ({
			id: i,
			ratio: ratios[i % ratios.length],
			hue: (i * 37) % 360
		}))
	);
</script>

<main>
	<header>
		<h1>@nicbat/svelte-masonry</h1>
		<p>Dependency-free balanced masonry for Svelte 5. Resize the window to see columns reflow.</p>
		<label>
			Tiles: {count}
			<input type="range" min="4" max="60" bind:value={count} />
		</label>
	</header>

	<Masonry items={tiles} getKey={(t) => t.id} aspectRatio={(t) => t.ratio}>
		{#snippet children(tile)}
			<div
				class="tile"
				style="aspect-ratio: {tile.ratio}; background: hsl({tile.hue} 70% 60%)"
			>
				#{tile.id}
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
	label {
		display: inline-flex;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.9rem;
	}
	.tile {
		display: grid;
		place-items: center;
		border-radius: 8px;
		color: white;
		font-weight: 600;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}
</style>
