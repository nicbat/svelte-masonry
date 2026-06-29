# 01 · Reading & focus order

**Tag:** `docs` + `opt-in` · **Status:** ✅ done (Half A Wave 1, Half B Wave 4) · **Depends on:** nothing for the
docs half; did the single-flow mode after 02–09.

> Shipped Half A: "Accessibility & reading order" paragraph in the component JSDoc + a README section.
> Shipped Half B: `readingOrder: 'columns' | 'source'` (default `'columns'`). Chose **B1 (CSS multicol)**
> over B2 (CSS `reading-flow`/`reading-order` property) because B2's browser support was still rolling
> out in 2026 and a dependency-free lib needs predictable behavior everywhere. `'source'` renders a flat
> source-ordered `{#each items}` in a `.masonry-source` container (`column-count: var(--masonry-columns)`,
> `break-inside: avoid` on items, `margin-bottom` for row gap); DOM order == reading order; browser
> balances (JS packing not applied). FLIP still works (wrapper is still `.masonry-item[data-key]`).

## Goal

Make the library's biggest limitation **honest and visible**, then optionally offer an escape hatch.
Because items are distributed into per-column DOM containers, the DOM / Tab / screen-reader order is
**column-major** (down col 1, then col 2…) even though the visual order is row-major. For decorative
galleries this is fine; for content whose order carries meaning it risks WCAG 1.3.2 (Meaningful
Sequence) and 2.4.3 (Focus Order). See research doc §5 and the diagram in `features-explained.html` #1.

This plan has two halves; do them separately.

## Half A — documentation (cheap, do first)

No code logic changes. Communicate the constraint everywhere a user looks:

1. **Component JSDoc** (`src/lib/Masonry.svelte`, the top doc comment): add a short "Accessibility &
   reading order" paragraph stating that DOM order is column-major and when that matters.
2. **README**: add an "Accessibility" section with the "use for galleries / order-not-semantic" guidance
   and a one-line "when to use this vs CSS `columns` vs native masonry" note.
3. Cross-link to `docs/features-explained.html#reading-order` for the visual.

**Done when:** a reader can't miss the caveat; no behavior changed.

## Half B — opt-in single-flow mode (later)

Offer a mode where DOM order == visual order, accepting weaker balancing.

### API

```ts
readingOrder?: 'columns' | 'source';   // default 'columns' (today's behavior)
```

- `'columns'` — current behavior (best balance, column-major DOM).
- `'source'` — render items in a **single source-ordered flow** so DOM == reading order.

### Implementation options (pick one; B2 preferred)

- **B1 — CSS `columns` fallback:** when `readingOrder === 'source'`, render one flat list inside a
  `column-count` / `column-width` CSS multicol container instead of flex columns. DOM stays source order;
  the browser flows items. Trade-off: multicol can split an item across columns — guard with
  `break-inside: avoid` on each item wrapper. No JS balancing in this mode.
- **B2 — `reading-order` CSS (progressive enhancement):** keep the flex-column DOM but, where the
  browser supports the CSS `reading-order` property, set it so assistive tech follows visual order.
  Feature-detect; fall back to B1 or to documented `'columns'`. (Property still rolling out as of 2026 —
  verify support before relying on it.)

### Gotchas

- Don't silently change the default; `'columns'` stays default to preserve current behavior.
- In `'source'` mode the shortest-column packing does **not** apply — say so in JSDoc.

## Verification

- Docs half: visual review of README + rendered JSDoc.
- Mode half: `npm run dev`, tab through tiles in each mode; confirm `'source'` tab order matches visual
  order. Add both modes to the playground's control set.

## Definition of done

See `README.md`. Plus: README has an Accessibility section; if Half B shipped, `readingOrder` is
documented in the props table with its balancing caveat.
