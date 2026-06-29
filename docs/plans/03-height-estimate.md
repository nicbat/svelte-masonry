# 03 · `heightEstimate()` escape hatch

**Tag:** `opt-in` · **Status:** ✅ done (Wave 1) · **Depends on:** nothing.

> Shipped: `heightEstimate?(item, columnWidth)` branch in the packing loop; non-finite/≤0 returns
> clamp to `0`. Falls back to `aspectRatio`/`footerEstimate` when absent.

## Goal

Generalize the per-item height _estimate_ (used only to pick a column) into one optional function, so
callers can model captions/chips of varying height precisely. Keep `aspectRatio` + `footerEstimate` as
the easy path. Still estimate-only — never written back as a real height.

## Current state (`src/lib/Masonry.svelte`)

Inside the `columns = $derived.by<T[][]>(...)`:

```ts
const ar = aspectRatio?.(item);
const validAr = ar && ar > 0 ? ar : 1;
const estimatedHeight = columnWidth / validAr + footerEstimate;
```

## API change

```ts
heightEstimate?: (item: T, columnWidth: number) => number;
```

When provided, it **fully replaces** the `aspectRatio`/`footerEstimate` computation. When absent,
behavior is exactly as today.

## Implementation steps

1. Add `heightEstimate?: (item: T, columnWidth: number) => number;` to props + type.
2. In the packing loop, branch:
   ```ts
   const estimatedHeight = heightEstimate
   	? Math.max(0, heightEstimate(item, columnWidth))
   	: columnWidth / (aspectRatio?.(item) && aspectRatio(item)! > 0 ? aspectRatio(item)! : 1) +
   		footerEstimate;
   ```
   (Clean this up to avoid calling `aspectRatio(item)` three times — compute `validAr` first as today,
   only in the `else` branch.)
3. Guard against `NaN`/negative/`Infinity` returns from a user function: clamp to `>= 0` and treat
   non-finite as `0` so a bad function degrades to "joins shortest column by current heights," never
   throws or NaNs the layout.

## Gotchas

- `heightEstimate` runs once per item per re-pack; keep callers aware it should be cheap/pure.
- Document clearly: the returned number is a **relative balancing weight in px-ish units**, not the
  tile's real height. Returning `0` for everything == round-robin-ish; that's allowed.
- Do not remove or deprecate `aspectRatio`/`footerEstimate`; they remain the documented default path.

## Verification

- `npm run check`. In the playground (or demo), pass a `heightEstimate` that adds `lines * 20` and
  confirm columns balance differently than aspect-ratio-only, with **no clipping**.

## Definition of done

See `plans/README.md`. Plus: props table documents `heightEstimate` and states it supersedes
`aspectRatio`+`footerEstimate` when present, estimate-only.
