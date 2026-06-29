# 06 · SSR flash / `initialColumns`

**Tag:** `opt-in` · **Status:** ✅ done (Wave 2, Approach A) · **Depends on:** touches `columnCount`/`width` init —
coordinate with 04 (gap used in count math) and 07 (breakpoint count). Do after 07 if both are planned.

> Shipped: `measured = width > 0`; in the `columnCount` `$derived.by`, `initialColumns` wins while
> `!measured` (unless `columns` is a fixed number, which is already deterministic). `columnWidth` now
> clamped `Math.max(0, …)` so the pre-measure frame can't produce a negative estimate. SSR-verified:
> `initialColumns={4}` → 4 columns server-side.

## Goal

Kill the first-paint flash. On the server there's no width to measure, so `width` starts at `0` →
`columnCount` floors to `1` → the grid renders as one tall column, then the client measures and reflows
into N columns (visible layout shift). Let the author declare the expected count up front.

## Current state (`src/lib/Masonry.svelte`)

```ts
let width = $state(0);
const columnCount = $derived(Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap))));
```

When `width === 0`, `columnCount === 1`. SSR HTML therefore contains a single `.masonry-column`.

## API change

```ts
initialColumns?: number;   // assumed column count until the client measures width
```

## Implementation steps (pick approach A; B is an alternative/addition)

### Approach A — `initialColumns` override (simplest, recommended)

1. Add `initialColumns?: number`.
2. Make `columnCount` fall back to it while width is unmeasured:
   ```ts
   const measured = $derived(width > 0);
   const columnCount = $derived(
   	measured
   		? Math.max(1, Math.floor((width + colGap) / (minColumnWidth + colGap)))
   		: Math.max(1, initialColumns ?? 1)
   );
   ```
3. For `columnWidth` while unmeasured, you can't know real px; leave it `0` (only the estimate uses it,
   and the estimate is harmless). The point is the **DOM structure** (N empty columns) matches what the
   client will produce, so when measurement confirms the same N, **no reflow occurs**. If the client
   computes a different N than `initialColumns`, it reflows once — same as today but usually avoided.
4. Distribute items across `initialColumns` on the server. With `columnWidth === 0`, every estimate is
   `footerEstimate` (constant), so packing degrades to round-robin across the N columns — acceptable for
   a pre-measure frame; the client re-packs correctly on measure.

### Approach B — CSS `columns` fallback frame (alternative)

Render a CSS multicol (`column-count: initialColumns`) flat list for SSR/no-JS, swap to the flex-column
layout after hydration+measure. More robust for no-JS, but more moving parts; only do this if you need
true no-JS support. Guard items with `break-inside: avoid`.

## Gotchas

- **Hydration mismatch:** the SSR DOM must match the client's first render. Using `initialColumns` for
  both the server and the pre-measure client tick keeps them identical. Verify no Svelte hydration
  warning appears.
- Don't set any tile heights to "reserve" space — invariant. The anti-flash win comes from matching
  _column count_, not from sizing tiles.
- If `initialColumns` is omitted, behavior is exactly as today (1-column SSR).

## Verification

- Build/run with SSR (`npm run dev` is CSR-ish; to truly test, use the SvelteKit preview/adapter).
  Confirm: with `initialColumns={4}`, view-source / first paint shows 4 columns and there's no visible
  jump on load. Check console for hydration mismatch warnings (should be none).

## Definition of done

See `plans/README.md`. Plus: props table documents `initialColumns`; README notes it as the SSR/no-flash
hint.
