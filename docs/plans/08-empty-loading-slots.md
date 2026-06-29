# 08 · `empty` / `loading` snippet slots

**Tag:** `opt-in` · **Status:** ✅ done (Wave 2) · **Depends on:** nothing.

> Shipped: boolean `loading` + `skeleton` snippet (chose `skeleton` over overloading `loading`, per the
> gotcha) + `empty` snippet. Precedence `loading > empty > grid` via `{#if loading && skeleton}{:else
if items.length === 0 && empty}{:else}<grid/>{/if}`. SSR-verified all three branches.

## Goal

Built-in places to render an empty state ("no items yet") and optionally a loading skeleton, so callers
stop hand-rolling `{#if items.length === 0}` wrappers around the component.

## Current state (`src/lib/Masonry.svelte`)

`children: Snippet<[T]>` is the only snippet. When `items` is empty, the component renders an empty
`.masonry` with empty columns (nothing visible).

## API change

```ts
empty?: Snippet;     // rendered when items.length === 0 (and not loading)
loading?: boolean;   // optional: when true, render the `loadingSlot` instead of the grid
loadingSlot?: Snippet; // optional skeleton; name TBD — see gotcha
```

Minimum viable: just `empty`. Add `loading`/skeleton only if wanted — see gotcha on naming.

## Implementation steps

1. Add `empty?: Snippet` (and optionally the loading pair) to props + type.
2. Branch the markup:
   ```svelte
   {#if loading && loadingSlot}
   	{@render loadingSlot()}
   {:else if items.length === 0 && empty}
   	{@render empty()}
   {:else}
   	<div class="masonry" ...>
   		{#each columns as column, i (i)}
   			...
   		{/each}
   	</div>
   {/if}
   ```
3. Keep the root `.masonry` div (and its `bind:clientWidth`) only in the grid branch. Note: when the
   grid is not rendered, `width` won't measure — fine, because we re-enter the grid branch with items
   and measurement resumes. Confirm no stale `width` causes a one-frame mis-layout (it won't: the
   `bind:clientWidth` re-fires on mount of the grid div).

## Gotchas

- **Snippet naming:** `loading` as a boolean + a separate skeleton snippet is clearer than overloading.
  Svelte reserves no names here, but avoid calling a snippet `loading` and a boolean `loading` together.
  Suggested: boolean `loading`, snippet `skeleton`. Pick one and document it.
- Don't render `empty` while `loading` — loading takes precedence.
- `empty`/`skeleton` are optional; if absent, fall back to today's behavior (empty grid).

## Verification

- `npm run check`. In the demo: pass `items={[]}` with an `empty` snippet → see the message; toggle
  `loading` → see the skeleton.

## Definition of done

See `plans/README.md`. Plus: props table documents the slot(s) and precedence (loading > empty > grid).
