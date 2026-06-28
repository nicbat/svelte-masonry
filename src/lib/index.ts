/**
 * Public entry point for `@nicbat/svelte-masonry`.
 *
 * A generic, dependency-free balanced masonry layout for Svelte 5. Consumers import the component
 * from the package root — never the `.svelte` file directly — so the internal file layout can change
 * without breaking call sites.
 */
export { default as Masonry } from './Masonry.svelte';
