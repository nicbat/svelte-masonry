# 05 · `onlayout` / `oncolumnchange` callback

**Tag:** `opt-in` · **Status:** ✅ done (Wave 1, `onlayout` only; `oncolumnchange` skipped) · **Depends on:** nothing. Trivial once `columnCount`/
`columnWidth` exist (they do).

## Goal

Notify the consumer whenever the layout recalculates (column count or width changed), so they can react
— analytics, a "showing N columns" label, triggering image preloads, etc. **No behavior change**, pure
observability.

## Current state (`src/lib/Masonry.svelte`)

`columnCount` and `columnWidth` are existing `$derived` values. Nothing is emitted.

## API change

```ts
onlayout?: (info: { columnCount: number; columnWidth: number }) => void;
```

(Optionally also `oncolumnchange?: (count: number) => void` that fires only when the integer count
changes — but `onlayout` covers it; prefer shipping just `onlayout` unless a caller needs the narrower
one.)

## Implementation steps

1. Add the optional prop + type.
2. Fire it in an `$effect` so it runs after render/measurement, not during derivation:
   ```ts
   $effect(() => {
   	// read both so the effect re-runs when either changes
   	const info = { columnCount, columnWidth };
   	onlayout?.(info);
   });
   ```
3. Decide on `columnWidth` churn: `columnWidth` changes on every pixel of resize, so `onlayout` fires
   often. That's acceptable for an "onlayout" callback (mirrors a ResizeObserver). If you also add
   `oncolumnchange`, gate it on integer change:
   ```ts
   let prevCount = $state(-1);
   $effect(() => {
   	if (columnCount !== prevCount) {
   		prevCount = columnCount;
   		oncolumnchange?.(columnCount);
   	}
   });
   ```

## Gotchas

- **Don't call the callback inside a `$derived`** — derivations must be side-effect-free. Use `$effect`.
- The first fire happens after initial measurement (when `width` becomes non-zero). Document that
  `columnWidth` may be `0` / count `1` on the very first SSR/pre-measure tick if it ever fires then;
  in practice the effect runs client-side post-measure.
- Keep it untyped-safe: callback is optional; never assume it's set.

## Verification

- `npm run check`. In the demo, pass `onlayout={(i) => console.log(i)}`, resize the window, watch counts
  update in the console.

## Definition of done

See `plans/README.md`. Plus: props table documents `onlayout` (and `oncolumnchange` if shipped) and
notes it's observability-only.
