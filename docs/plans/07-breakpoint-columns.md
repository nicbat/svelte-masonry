# 07 · Explicit breakpoint `columns` mode

**Tag:** `opt-in` · **Status:** ✅ done (Wave 2) · **Depends on:** replaces/branches the `columnCount`
derivation — coordinate with 04 (gap in math) and 06 (initialColumns fallback).

> Shipped: prop is `columns` (destructured as `columnsProp` to avoid colliding with the internal
> `columns` derived array). `number` → fixed count (SSR-safe); object → breakpoint map (largest bp ≤
> width wins); else fluid `minColumnWidth`. Empty/invalid map → 1. SSR-verified: `columns={3}` → 3
> columns server-side.

## Goal

Offer an alternative to the fluid `minColumnWidth` model: let designers pin **exact** column counts at
width breakpoints. `minColumnWidth` stays the default.

## Current state (`src/lib/Masonry.svelte`)

```ts
const columnCount = $derived(Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap))));
```

Count is always derived from `minColumnWidth`.

## API change

```ts
columns?: number | Record<number, number>;
// number            → fixed count, ignore width
// { 0:1, 600:2, 1000:4 } → min-width breakpoint → count map
// when set, overrides minColumnWidth
```

## Implementation steps

1. Add `columns?: number | Record<number, number>`.
2. Branch the `columnCount` derivation:
   ```ts
   const columnCount = $derived.by(() => {
   	if (typeof columns === 'number') return Math.max(1, Math.floor(columns));
   	if (columns && typeof columns === 'object') {
   		// pick the count for the largest breakpoint <= current width
   		const bps = Object.keys(columns)
   			.map(Number)
   			.sort((a, b) => a - b);
   		let count = columns[bps[0]] ?? 1;
   		for (const bp of bps) if (width >= bp) count = columns[bp];
   		return Math.max(1, count);
   	}
   	// default: fluid minColumnWidth model (unchanged)
   	const g = colGap; // or gap, depending on plan 04
   	return Math.max(1, Math.floor((width + g) / (minColumnWidth + g)));
   });
   ```
3. `columnWidth` derivation is unchanged — it already computes from `columnCount` and width.

## Gotchas

- **Pre-measure / SSR:** when `width === 0` and a breakpoint map is used, the `>= bp` loop yields the
  smallest breakpoint's count (e.g. `1` for key `0`). If plan 06 shipped, let `initialColumns` win while
  unmeasured; otherwise document that the smallest breakpoint is the SSR count.
- Validate the map gracefully: empty object → fall back to `1`; non-numeric keys ignored by `Number`.
- Keep `minColumnWidth` working when `columns` is absent — don't make it required or break the default.
- Decide precedence and **document it**: `columns` (when set) overrides `minColumnWidth`.

## Verification

- `npm run check`. In the demo, pass `columns={{0:1, 600:2, 1000:4}}`, resize across 600/1000 px, confirm
  the count snaps exactly at those widths. Also test `columns={3}` (always 3).

## Definition of done

See `plans/README.md`. Plus: props table documents `columns` and its precedence over `minColumnWidth`.
