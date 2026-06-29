# Masonry: landscape research & roadmap for `@nicbat/svelte-masonry`

> Companion docs (open directly in a browser, no build step):
>
> - [`features-explained.html`](./features-explained.html) — **every roadmap item below, explained with a
>   diagram or mini-demo.** Start here if §6 feels abstract.
> - [`playground.html`](./playground.html) — the live algorithm and its edge cases.

This document surveys how the best masonry implementations are built, locates **this** library on that
map, and proposes a feature roadmap. The guiding constraint is the one you already chose: **keep a
minimal, dependency-free core**, with anything heavier living behind optional props or as opt-in
add-ons — never at the expense of the central invariant.

---

## 0. The invariant we are protecting

This library's reason to exist is one design choice:

> Per-item heights are **only ever estimated** (from an aspect ratio) to decide _which column an item
> joins_. They are **never written back as fixed pixel heights.** Each child sizes itself naturally in
> normal flow.

The payoff: a wrong/absent aspect ratio, or a caption of unknown height, only makes columns _slightly
less balanced_ — it can never **clip, overlap, or misalign** a tile. Most fixed-frame masonry
libraries get exactly this wrong (they absolutely-position tiles into measured/estimated boxes, so a
bad measurement clips content). Every roadmap item below is judged against whether it preserves this.

---

## 1. The four ways to build masonry

Every masonry implementation in the wild is one of these. Understanding the taxonomy is what lets us
choose features deliberately rather than copying competitors.

| Approach                                             | How it places items                                                           | Strengths                                                                | Failure modes                                                                                              | Examples                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **A. CSS `columns`** (`column-count`/`column-width`) | Browser flows items top-to-bottom, column by column                           | Zero JS, tiny, reflows free                                              | **Reading order is vertical** (1,2,3 go _down_ col 1), can't balance by content, page-break artifacts      | Pure-CSS galleries                                          |
| **B. Absolute-positioning JS**                       | Measure every tile, compute x/y, `position:absolute`                          | Pixel-perfect packing, row-major order possible, enables FLIP/drag       | Needs measurement → layout thrash; **a wrong measure clips**; container needs explicit height              | Masonry.js, Muuri, Bricks.js, Macy.js                       |
| **C. Virtualized absolute**                          | B + only render the visible window (interval tree / windowing)                | Handles 10k–100k items at 60fps                                          | Most complex; measurement caches; scroll-anchoring bugs                                                    | Masonic, react-virtualized, Virtuoso                        |
| **D. Flex/grid columns + JS distribution** ← **us**  | JS assigns each item to a column array; CSS flex stacks each column naturally | No per-tile measurement, **never clips**, tiny, SSR-friendly             | Reading order is per-column in the DOM (a11y caveat, §5); no free FLIP; full reflow on column-count change | **this library**, react-masonry-css, some Svelte components |
| **E. Native CSS masonry** (`display: grid-lanes`)    | Browser engine packs into lanes                                               | Eventually the right answer: engine-level, cheap, source order preserved | **Not shippable yet** (behind flags, ~2026+), no virtualization, no JS hooks                               | CSS Grid Level 3                                            |

We are firmly **approach D**, and it's the right pick for a minimal-core library: it's the only JS
approach that structurally _cannot_ clip a tile, and it degrades gracefully. The roadmap should make us
the **best-in-class D**, and plan a clean **migration path to E** when it lands.

---

## 2. The native CSS future (and why it doesn't make us obsolete yet)

As of mid-2026, native masonry is converging on **`display: grid-lanes`** (CSS Grid Level 3), after
years of debate between `grid-template-rows: masonry` (Firefox/WebKit) and a standalone `display`
value (Chromium). It is **shipping behind flags only** — not production-ready, no firm cross-browser
date. It gives engine-level packing, variable tracks, spanning, and — crucially — **preserves source
order** (fixing the a11y caveat in §5).

What native masonry will **never** give you, and where a library still earns its place:

- **Content-balanced packing** — native packs greedily into the nearest lane; it does not minimize the
  ragged bottom the way a shortest-column heuristic can.
- **Virtualization** for huge lists (§4).
- **JS hooks**: events, drag/sort/filter, lazy-load coordination, layout callbacks.
- **A progressive-enhancement bridge today**, with a consistent API across the years it takes
  `grid-lanes` to reach baseline.

**Strategic recommendation:** treat native masonry as a _rendering backend_, not a competitor. A future
`strategy="native"` prop (or auto-detect via `CSS.supports('display','grid-lanes')`) could let the same
component emit native lanes where supported and fall back to our JS column distribution otherwise —
identical props, identical reading order goal.

---

## 3. How the notable libraries compare (feature shopping list)

What the field offers, so we can cherry-pick what fits a minimal core:

- **Masonry.js** (classic) — approach B. ~24 kB, last meaningful work ~2017. Absolute positioning,
  `imagesLoaded` companion. Effectively legacy; its existence is why people assume masonry needs a
  heavy lib.
- **Muuri** — approach B, "batteries included": drag-and-drop (incl. between grids), filter, sort,
  show/hide animations via Web Animations API, event hooks, batched DOM ops. The reference for _what a
  maximal masonry lib looks like_. Heavy; explicitly **not** our model, but a menu of opt-in ideas.
- **Masonic** (React) — approach C. Virtualized via a red-black interval tree, autosizing through
  ResizeObserver, `useInfiniteLoader`, renders tens of thousands of cells. The reference for
  **performance/scale**.
- **react-masonry-css** — approach D, like us: CSS columns + JS distribution, breakpoint→column-count
  map. Validates our approach as popular and sufficient for most galleries.
- **Bricks.js / Colcade / Macy.js** — lightweight approach-B/D libs; show the appetite for
  small-bundle masonry. "Masonry Grid" (~1.4 kB, 2025) markets _exactly_ on tiny size + native-feeling
  framework wrappers (React/Preact/Svelte/Solid).
- **CSS `columns`** — approach A; the zero-dep baseline we must beat on reading order and balance.

Takeaways for us:

1. There's a clear, durable market for a **tiny, framework-native, non-clipping** masonry — that's our
   lane.
2. The features people reach for libraries _for_ are: responsive column count (✅ we have), balanced
   packing (✅ we have), **lazy/async image handling**, **animation**, **virtualization**, and
   **drag/sort/filter**. The first three are core-compatible; the last is explicitly out of scope.

---

## 4. Gap analysis — what's missing today

Current surface: `items`, `getKey`, `aspectRatio`, `minColumnWidth`, `gap`, `footerEstimate`,
`children`. Honest gaps, grouped by your stated priorities.

### Performance / scale

- **No virtualization.** Every item renders. Fine to a few hundred tiles; a 5k-photo grid will hurt.
  This is the single biggest ceiling for "use it anywhere."
- **Full re-pack on every reactive change.** `columns` is a `$derived.by` over all items; adding one
  item re-runs the whole greedy pass. O(n·cols) is cheap, but it also re-creates column arrays each
  time, which can thrash keyed `{#each}` reconciliation for large n.
- **No `imagesLoaded`/measure coordination.** Because we never clip, we don't _need_ it for
  correctness — but balance is computed from intrinsic ratios, so unknown-height content stays
  approximate (acceptable, by design).

### DX / API

- **No `aspectRatio` as a plain accessor for `{w,h}`** — every caller writes `(p) => p.w/p.h`. A
  convenience overload or a documented recipe would help.
- **No render-element control.** Always a `div.masonry` / `div.masonry-column`. No `as` prop, no way to
  pass through `class`/`style`/`aria-*`/`data-*`, no `id`. Limits styling and semantics (e.g. a `<ul>`
  /`<li>` gallery, or `role="list"`).
- **No events / lifecycle.** No `onlayout` / `oncolumnchange` callback; consumers can't react to column
  count or react to relayout.
- **No empty / loading state slot.** Consumers hand-roll "no items."
- **Single breakpoint model.** Column count derives solely from `minColumnWidth`. No way to pin
  explicit counts per breakpoint (some designs want "exactly 2 on mobile, 4 on desktop").
- **`footerEstimate` is a flat constant.** Can't vary per item (a tile with 3 lines of caption vs 1).
  A `heightEstimate(item)` escape hatch would generalize `aspectRatio` + `footerEstimate` into one.
- **No exported types.** `T`, prop types, and a `MasonryProps<T>` aren't re-exported for consumers
  building wrappers.

### SSR & a11y

- **SSR renders a single column** (width starts at 0 → `columnCount` floors to 1), then the client
  re-flows after `bind:clientWidth` measures. Functional, but causes a **first-paint reflow / layout
  shift** and a 1-column flash. A `ssrColumns`/`initialColumns` hint, or a CSS `columns` fallback for
  the no-JS/first-paint frame, would fix it.
- **Reading & focus order (the important one).** Because items are distributed _into per-column DOM
  subtrees_, the DOM/tab/screen-reader order is **column-major** (down col 1, then col 2…), not the
  row-major reading order the props imply. For a photo wall this is usually acceptable; for any content
  with meaning in its order it's a real WCAG 1.3.2 / focus-order concern. Options: document it loudly;
  offer an opt-in single-flow mode; or adopt the CSS **`reading-order`** property / native lanes when
  available. **This is the most under-communicated limitation and should be addressed in docs first,
  then API.**
- **No semantic roles.** No `role="list"`/`listitem` wiring or guidance; columns are presentational
  `div`s a screen reader may announce oddly. Worth a documented `role` recipe + pass-through.

### Robustness / behavior

- **Column-count change reflows with no animation** (documented; fine for browse grids).
- **No `dir="rtl"` consideration.** Flex row honors writing direction for column order, but the
  "shortest column" fill and reading-order story haven't been validated RTL.
- **`gap` couples columns and rows.** Can't set different column vs row gaps (CSS `row-gap`/
  `column-gap` would).

---

## 5. The reading-order question, in depth (decide this explicitly)

This deserves its own section because it's the one architectural fork that affects _what kind of
content the library is safe for_.

- **Today (approach D):** visual order is row-major (great), but **DOM order is column-major.** A
  keyboard user tabbing through, or a screen-reader user, traverses _down each column_. For images with
  `alt=""` (decorative wall) → no practical harm. For cards with headings, prices, links → the
  experienced order disagrees with the visual order = WCAG **1.3.2 Meaningful Sequence** /
  **2.4.3 Focus Order** risk.
- **The honest framing for docs:** "Use this for galleries and browse grids where item order is _nice
  to have_, not _semantic_. If sequence carries meaning, either (a) use the upcoming single-flow mode,
  or (b) wait for native `grid-lanes`, which preserves source order."
- **Future fix paths**, in increasing order of effort:
  1. **Document the constraint** prominently (cheap, do first).
  2. **`reading-order` CSS** — when shipping, a single-flow variant + `reading-order: auto` keeps DOM =
     visual order. Not yet baseline.
  3. **Native `grid-lanes` backend** — solves it for free where supported.

---

## 6. Proposed roadmap (minimal-core lens)

Each item tagged **[core]** (belongs in the tiny component), **[opt-in]** (prop/flag, off by default,
no new deps), or **[add-on]** (separate module/package, never bloats core), or **[docs]**.

### Now — cheap, high-leverage, zero risk to the invariant

1. **[docs]** Reading-order & a11y guidance (§5.1) + a "when to use this vs CSS columns vs native"
   matrix. _Highest value-per-effort item in this whole document._
2. **[core]** Pass-through `class` / `style` / `id` / `...rest` on the root, and a documented way to
   style columns. Unlocks real-world use without forking.
3. **[opt-in]** `heightEstimate?: (item, columnWidth) => number` as a general escape hatch that
   subsumes `aspectRatio` + `footerEstimate` (keep those as sugar). One concept, fully general.
4. **[opt-in]** `columnGap` / `rowGap` (keep `gap` as the shorthand).
5. **[core]** Export `MasonryProps<T>` and related types from the package root.
6. **[opt-in]** `onlayout` / `oncolumnchange` callbacks (no behavior change, just observability).

### Next — fixes the two real ceilings (SSR flash) + polish

7. **[opt-in]** `initialColumns` (SSR/first-paint hint) **and/or** a CSS-`columns` fallback for the
   pre-measurement frame, to kill the 1-column flash and layout shift. SSR-correctness win.
8. **[opt-in]** Explicit breakpoint→count mode (`columns={{0:1, 600:2, 1000:4}}`) as an alternative to
   `minColumnWidth`, for pixel-exact designs.
9. **[opt-in]** Empty-state / loading snippet props (`empty`, `loading`).
10. **[opt-in]** `animate` — **FLIP reflow animation as a built-in boolean prop, default `false`.**
    Originally mis-filed as an add-on; corrected. FLIP measures _positions_ and applies
    `transform: translate(...)`, a compositor-only effect that **never participates in layout and so can
    never clip a tile** — it is fully compatible with the never-clip invariant (unlike virtualization).
    Off-cost is zero behavior + ~1 KB dormant code. Wrinkle: Svelte's built-in `animate:flip` only
    handles reordering _within one_ keyed `{#each}`, but tiles live in separate per-column blocks, so a
    cross-column move needs a small **manual FLIP** (`Map<key, DOMRect>` + `$effect` + `el.animate`).
    See [`plans/09-flip-animation.md`](./plans/09-flip-animation.md).
11. **[opt-in]** RTL validation + `dir`-aware column order; add to the playground's test matrix.

### Later — deliberately deferred / kept _out_ of core

12. **[add-on]** **Virtualization** as a separate entry (e.g. `@nicbat/svelte-masonry/virtual`) or a
    documented integration with a windowing lib. The one feature that genuinely needs measured heights
    and absolute positioning, which _conflicts_ with the never-clip invariant — so it must be a distinct,
    opt-in surface, not retrofitted into the core. **Biggest "use it anywhere" unlock; highest
    complexity. Explicitly deferred to a later milestone.**
13. **[add-on]** Native `grid-lanes` backend (`strategy="native" | "columns" | "auto"`) once browser
    support is real — same props, engine-level packing, free reading order.
14. **Explicitly NOT planned:** drag-and-drop, sort, filter (that's Muuri's territory; bundling it
    would betray the minimal-core promise). Document this as a non-goal so contributors don't drift.

> **Implementation plans:** the committed near-term set (items 1–10, i.e. features 1–8 of
> `features-explained.html` plus FLIP) each have a standalone, cleared-context-ready plan in
> [`plans/`](./plans/). Virtualization is deferred.

---

## 7. Concrete API sketch (for discussion, not committed)

```ts
type MasonryProps<T> = {
	items: T[];
	getKey: (item: T) => string | number;
	children: Snippet<[T]>;

	// sizing for balance (estimate-only, never written back)
	aspectRatio?: (item: T) => number | undefined; // sugar
	footerEstimate?: number; // sugar
	heightEstimate?: (item: T, columnWidth: number) => number; // general escape hatch

	// layout
	minColumnWidth?: number; // default 160
	columns?: number | Record<number, number>; // explicit / breakpoint mode (overrides minColumnWidth)
	gap?: number; // shorthand
	columnGap?: number;
	rowGap?: number;

	// rendering / DX
	class?: string;
	style?: string;
	initialColumns?: number; // SSR / first-paint hint
	empty?: Snippet; // when items.length === 0
	onlayout?: (info: { columnCount: number; columnWidth: number }) => void;

	// motion (opt-in, default off)
	animate?: boolean; // FLIP reflow animation; default false
	animateDuration?: number; // ms, read only when animate; default ~250
};
```

Everything above the "rendering / DX" line is layout math; everything below is ergonomics. None of it
requires measuring a tile's _height_, so none of it threatens the invariant — including `animate`,
which only measures positions and animates with layout-free `transform`s.

---

## 8. Sources

- [Masonry: Things You Won't Need A Library For Anymore — Smashing Magazine](https://www.smashingmagazine.com/2025/12/masonry-things-you-wont-need-library-anymore/)
- [Masonry In CSS: Should Grid Evolve Or Stand Aside For A New Module? — Smashing Magazine](https://www.smashingmagazine.com/2025/05/masonry-css-should-grid-evolve-stand-aside-new-module/)
- [Masonry layout — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Masonry_layout)
- [CSS Masonry Layout: Native Grid Support — SitePoint](https://www.sitepoint.com/css-masonry-layout-native-grid/)
- [Introducing grid-lanes: The New Masonry Layout Mode in CSS](https://www.izendestudioweb.com/articles/2025/12/31/introducing-grid-lanes-the-new-masonry-layout-mode-in-css/)
- [Making a Masonry Layout That Works Today — CSS-Tricks](https://css-tricks.com/making-a-masonry-layout-that-works-today/)
- [Masonic — High-performance virtualized masonry for React (GitHub)](https://github.com/jaredLunde/masonic)
- [Virtuoso Masonry](https://virtuoso.dev/masonry/)
- [Muuri — Infinite responsive, sortable, filterable, draggable layouts (GitHub)](https://github.com/haltu/muuri)
- [Masonry Grid: A 1.4 kB Library That Actually Works — DEV](https://dev.to/dangreen/masonry-grid-a-14-kb-library-that-actually-works-341n)
- [csswg-drafts #5675 — Masonry reading-order accessibility issue](https://github.com/w3c/csswg-drafts/issues/5675)
- [Grid layout and accessibility — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Accessibility)
- [C27: Making the DOM order match the visual order — W3C WCAG techniques](https://www.w3.org/TR/WCAG20-TECHS/C27.html)
- [Solving the CSS layout and source order disconnect — Chrome for Developers](https://developer.chrome.com/blog/reading-order)
