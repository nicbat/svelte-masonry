# Implementation plans

One self-contained plan per near-term feature, written so a **fresh session with no prior context** can
pick up any single file and execute it. Background and diagrams live in
[`../MASONRY-RESEARCH.md`](../MASONRY-RESEARCH.md) and
[`../features-explained.html`](../features-explained.html); these files are the _how_.

## The component, in one paragraph (shared context)

Everything happens in **`src/lib/Masonry.svelte`** (~110 lines), re-exported by `src/lib/index.ts`. It is
generic over `T` (`<script lang="ts" generics="T">`). It measures container `width` via
`bind:clientWidth`, derives a `columnCount` from `minColumnWidth`, derives `columnWidth`, then packs
`items` into `columnCount` arrays by always appending the next item to the **currently shortest** column
— where "shortest" is judged by an _estimated_ height (`columnWidth / aspectRatio + footerEstimate`).
The estimate is used **only** to choose a column; it is **never written back as a tile's real height**.
Each tile sizes itself in normal flow, so a wrong estimate can only mis-balance slightly — never clip.
**Protect that invariant in every change below.**

## The invariant (do not violate)

> No code may constrain, set, or write back a tile's rendered **height**. Estimates pick columns only.
> Measuring _positions_ (e.g. for FLIP) is fine because `transform` is layout-free; measuring or setting
> _heights_ is not.

## Build order (suggested)

Cheap/independent first; height-of-stack last. Items in the same group barely interact.

1. **[01]** Reading-order docs (the README/JSDoc half — trivial, highest value). Defer the optional
   single-flow mode to the end.
2. **[02]** Pass-through props + exported types — unblocks everyone styling it.
3. **[03]** `heightEstimate()` escape hatch.
4. **[04]** `columnGap` / `rowGap`.
5. **[05]** `onlayout` callback.
6. **[07]** Breakpoint `columns` mode. ⟶ touches `columnCount` derivation (coordinate with 04, 06).
7. **[06]** `initialColumns` / SSR flash. ⟶ also touches `columnCount` / `width` init.
8. **[08]** `empty` / `loading` slots.
9. **[09]** `animate` (FLIP) — last; touches the `{#each}` render + adds an effect.
10. **[01]** Optional single-flow reading-order mode (the bigger half).

> **Deferred, not in this set:** virtualization (separate `@nicbat/svelte-masonry/virtual` module),
> native `grid-lanes` backend. See research doc §6 items 12–13.

## Shared conventions

- **Svelte 5 runes only** (`$props`, `$state`, `$derived`, `$derived.by`, `$effect`). No stores.
- **Keep new props optional with sensible defaults** so existing call sites never break. The current
  public props are `items`, `getKey`, `children` (required) and `aspectRatio`, `minColumnWidth=160`,
  `gap=12`, `footerEstimate=56` (optional). Several plans add to this — keep the old names working as
  documented sugar/shorthands.
- **No new runtime dependencies.** Dev-only tooling is fine.
- **Update three things per feature when relevant:** (a) JSDoc on the component/props,
  (b) the README props table, (c) the playground/`features-explained.html` if behavior is visible.

## Definition of done (every plan)

- [ ] `npm run check` passes (svelte-check, strict TS — generics intact).
- [ ] `npm run lint` passes (Prettier).
- [ ] Existing usage compiles unchanged (no required-prop additions).
- [ ] The invariant holds: grep the diff for any place a tile height is set/bound — there should be none.
- [ ] JSDoc + README props table updated.
- [ ] Manual smoke test in `npm run dev` (the demo route `src/routes/+page.svelte`).
