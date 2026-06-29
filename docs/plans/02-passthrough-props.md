# 02 · Pass-through props + exported types

**Tag:** `core` · **Status:** ✅ done (Wave 1) · **Depends on:** nothing. Do early — unblocks styling.

> Shipped: `MasonryProps<T>`/`MasonryLayoutInfo` live in `src/lib/types.ts` (sibling file, not the
> `.svelte` module block, to keep generic `T` available), re-exported from `index.ts`. `class` +
> `style` are destructured and composed explicitly; everything else spreads via `...rest` (first, so
> internals win). Verified in served HTML: `<div data-testid="…" class="masonry demo-grid …">`.

## Goal

Let consumers put `class`, `style`, `id`, `data-*`, `aria-*`, etc. on `<Masonry>` and have them land on
the real root element, instead of being forced to wrap it in an extra `<div>`. Also export the props
type so wrapper authors get TypeScript help.

## Current state (`src/lib/Masonry.svelte`)

```svelte
let { items, getKey, aspectRatio, minColumnWidth = 160, gap = 12, footerEstimate = 56, children }:
  { items: T[]; getKey: ...; /* ... */; children: Snippet<[T]> } = $props();
...
<div class="masonry" bind:clientWidth={width} style="--masonry-gap: {gap}px">
```

The inline type literal is the only definition of the props; nothing is exported.

## API change

```ts
class?: string;                 // merged with internal "masonry" class
// plus arbitrary passthrough attributes via ...rest
```

## Implementation steps

1. **Capture the rest.** Add `class: klass` and a rest gather to the destructure:
   ```ts
   let { items, getKey, /* ...existing... */, children, class: klass, ...rest } = $props();
   ```
   Type the new bits: `class?: string;` and let `rest` be `Record<string, unknown>` /
   `HTMLAttributes<HTMLDivElement>` (import from `svelte/elements` for accuracy).
2. **Spread onto the root**, keeping the component's own class and CSS var:
   ```svelte
   <div
     {...rest}
     class="masonry {klass ?? ''}"
     bind:clientWidth={width}
     style="--masonry-gap: {gap}px; {rest.style ?? ''}"
   >
   ```
   Decide precedence: internal `style` (the gap var) must survive — append user `style` after, or read
   it from `rest` and drop it from the spread to avoid duplication. Simplest: pull `style` into its own
   destructured var like `class`, then compose explicitly. Do the same for `style` as for `class`.
3. **Don't let passthrough clobber internals.** `bind:clientWidth`, the `masonry` class, and the gap var
   must always win. Order the spread first, explicit attributes second.
4. **Export the type.** Define and export `MasonryProps<T>` (move the inline literal into a named,
   exported `type`), and re-export it from `src/lib/index.ts`:
   ```ts
   export { default as Masonry } from './Masonry.svelte';
   export type { MasonryProps } from './Masonry.svelte';
   ```
   (Exporting a type from a `.svelte` file works via `<script lang="ts" module>` or a sibling `.ts`. If
   exporting from the component proves awkward, put `MasonryProps<T>` in a small `types.ts` and import it
   in the component.)

## Gotchas

- Generic `T` must stay intact — `MasonryProps<T>` is generic; keep `generics="T"`.
- Don't forward `items`/`getKey`/etc. into `...rest` onto the DOM (they're destructured out already, so
  they won't be — just confirm).
- Svelte warns on unknown `class` ordering; test that `class="masonry foo"` produces both classes.

## Verification

- `npm run check` (types). Add a quick demo in `+page.svelte`: `<Masonry class="x" id="y" data-z="1">`
  and confirm in devtools the root `<div>` has all three plus `class="masonry x"`.

## Definition of done

See `plans/README.md`. Plus: `MasonryProps<T>` is importable from the package root; README shows a
styling example using `class`.
