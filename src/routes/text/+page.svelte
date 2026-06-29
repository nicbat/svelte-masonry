<script lang="ts">
	import { Masonry } from '$lib/index.js';

	type Note = { id: number; hue: number; text: string };

	let count = $state(12);
	let minColumnWidth = $state(220);
	let gap = $state(14);
	let animate = $state(true);

	// Deeply-reactive state so `bind:value` on each textarea writes straight into the item.
	let notes = $state<Note[]>([]);

	// (Re)build the notes array when the count changes, preserving any text already typed. The length
	// guard makes this a no-op once in sync, so writing `notes` here can't loop the effect.
	$effect(() => {
		if (notes.length === count) return;
		const next: Note[] = [];
		for (let i = 0; i < count; i++) {
			next.push(notes[i] ?? { id: i, hue: (i * 47) % 360, text: '' });
		}
		notes = next;
	});

	/**
	 * Auto-grow a textarea to fit its content — this is the *content* sizing itself, never the grid.
	 * Takes the current text as the action parameter so `update` re-fits on programmatic changes
	 * (e.g. "fill all"), not just on the `input` event.
	 */
	function autogrow(node: HTMLTextAreaElement, _value: string) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		};
		resize();
		node.addEventListener('input', resize);
		// Re-fit if the column width changes under it (ResizeObserver on the element).
		const ro = new ResizeObserver(resize);
		ro.observe(node);
		return {
			// On a programmatic value change the action `update` can fire before `bind:value` has written
			// the new text to the DOM, so measure on the next frame once the content is in place.
			update: () => requestAnimationFrame(resize),
			destroy() {
				node.removeEventListener('input', resize);
				ro.disconnect();
			}
		};
	}

	const lorem =
		'The quick brown fox jumps over the lazy dog. Type as much as you like and watch the tile grow.';
	function fillAll() {
		notes = notes.map((n) => ({ ...n, text: lorem.slice(0, 20 + ((n.id * 17) % 80)) }));
	}
	function clearAll() {
		notes = notes.map((n) => ({ ...n, text: '' }));
	}

	// Per-item balancing weights. Empty by default (so packing is round-robin and stays put as you
	// type); "re-estimate" measures each tile's *real* rendered height and feeds it back, so the next
	// pack balances against true content — a manual, on-demand rebalance.
	let estimates = $state<Record<number, number>>({});
	function reestimate() {
		const next: Record<number, number> = {};
		document
			.querySelectorAll<HTMLElement>('[data-testid="text-grid"] .masonry-item[data-key]')
			.forEach((el) => {
				const k = el.dataset.key;
				if (k != null) next[Number(k)] = el.getBoundingClientRect().height;
			});
		estimates = next;
	}
</script>

<main>
	<header>
		<a href="/">← back to the box playground</a>
		<h1>Text-content stress test</h1>
		<p>
			Each tile holds an auto-growing textarea. Type into them: the tile grows to fit with
			<strong>no clipping</strong> — heights are never written back. Columns do <strong>not</strong>
			re-balance as you type, because packing uses size <em>estimates</em>, not measured heights.
			Hit
			<strong>re-estimate</strong> to feed each tile's real measured height into
			<code>heightEstimate</code> and re-pack — the columns rebalance on demand (and FLIP into place
			if
			<code>animate</code> is on). That's the deliberate trade-off, in your control.
		</p>

		<div class="controls">
			<label>
				Tiles: {count}
				<input type="range" min="2" max="30" bind:value={count} />
			</label>
			<label>
				minColumnWidth: {minColumnWidth}px
				<input type="range" min="140" max="400" step="10" bind:value={minColumnWidth} />
			</label>
			<label>
				gap: {gap}px
				<input type="range" min="0" max="40" bind:value={gap} />
			</label>
			<label class="checkbox">
				<input type="checkbox" bind:checked={animate} />
				animate (FLIP)
			</label>
			<button type="button" onclick={fillAll}>fill all</button>
			<button type="button" onclick={clearAll}>clear all</button>
			<button type="button" class="primary" onclick={reestimate}>re-estimate (rebalance)</button>
		</div>
	</header>

	<Masonry
		items={notes}
		getKey={(n) => n.id}
		{minColumnWidth}
		{gap}
		{animate}
		heightEstimate={(n) => estimates[n.id] ?? 120}
		data-testid="text-grid"
	>
		{#snippet children(note)}
			<div class="card" style="--hue: {note.hue}">
				<div class="card-head">#{note.id}</div>
				<textarea
					use:autogrow={note.text}
					bind:value={note.text}
					rows="2"
					placeholder="Type here…"
					data-key={note.id}
				></textarea>
				<div class="card-foot">{note.text.length} chars</div>
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
	a {
		font-size: 0.85rem;
		color: #2563eb;
	}
	h1 {
		font-size: 1.4rem;
		margin: 0.5rem 0 0.25rem;
	}
	header p {
		color: #555;
		max-width: 70ch;
		margin: 0 0 1rem;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.5rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	label {
		display: inline-flex;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.9rem;
	}
	button {
		font-size: 0.85rem;
		padding: 0.25rem 0.6rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		background: #fafafa;
		cursor: pointer;
	}
	button.primary {
		border-color: #2563eb;
		background: #2563eb;
		color: white;
		font-weight: 600;
	}
	.card {
		display: flex;
		flex-direction: column;
		border: 1px solid hsl(var(--hue) 50% 80%);
		border-radius: 10px;
		background: hsl(var(--hue) 70% 97%);
		overflow: hidden;
	}
	.card-head {
		padding: 6px 10px;
		font-weight: 600;
		font-size: 0.8rem;
		color: hsl(var(--hue) 60% 30%);
		background: hsl(var(--hue) 70% 90%);
	}
	textarea {
		border: 0;
		outline: none;
		resize: none;
		overflow: hidden;
		width: 100%;
		box-sizing: border-box;
		padding: 10px;
		font: inherit;
		font-size: 0.9rem;
		line-height: 1.4;
		background: transparent;
		color: #222;
	}
	.card-foot {
		padding: 4px 10px;
		font-size: 0.7rem;
		color: #999;
		border-top: 1px solid hsl(var(--hue) 40% 90%);
	}
</style>
