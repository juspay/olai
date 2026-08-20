/**
 * The palettes, as the CSS that puts one in force.
 *
 * Generated from `./palettes.ts` and appended to the built stylesheet by
 * `src/build.ts`, which is why nothing here is in `styles.css`: the table is
 * the source, and a sheet with a hand-copied block per theme in it would be
 * one chance per theme for a token to be forgotten. What `styles.css` still spells
 * is the TOKEN NAMES — Tailwind can only generate `text-muted` for a
 * `--color-muted` it has seen in `@theme` — and the default palette's values,
 * which `./css.test.ts` holds to this table.
 *
 * Every block is UNLAYERED, which is how it beats the `@layer theme` Tailwind
 * puts its own `:root` in. The default's block also lands on a bare `:root`,
 * because a page that picked nothing is in it — one block rather than two, so
 * the default cannot drift from itself.
 *
 * There is no `prefers-color-scheme` rule anywhere in it, on purpose: a theme
 * is a pick, and the OS is not a picker.
 */

import {
  DEFAULT_THEME,
  type Palette,
  type PaletteToken,
  PALETTE_TOKENS,
  PALETTES,
  THEME_ATTRIBUTE,
} from "./palettes.ts"

/** The custom property a token is read through — Tailwind's namespace, so that
 *  `text-ink` and `--color-ink` are one decision and not two. */
export const customProperty = (token: string): string => `--color-${token}`

/** The same token as a VALUE, for the one thing a utility class cannot be: a
 *  colour computed at render time and written into a style attribute — a
 *  gradient down the agenda's spine, the ring around now (`../agenda/spine.ts`).
 *  Beside the property rather than at that site, because it is the same
 *  namespace decision one step on, and a second `var(--color-…)` spelled
 *  elsewhere is what would survive a rename of it. */
export const tokenValue = (token: PaletteToken): string =>
  `var(${customProperty(token)})`

/** The selector a page in this theme matches. The default matches TWO: its own
 *  name, and the page that has picked nothing at all.
 *
 *  Exported so a test can ask which theme the bare `:root` belongs to, rather
 *  than reading it back out of the generated text with a regex. */
export const selectorFor = (palette: Palette): string => {
  const named = `:root[${THEME_ATTRIBUTE}="${palette.name}"]`
  return palette.name === DEFAULT_THEME ? `:root, ${named}` : named
}

/** One theme's block: its `color-scheme`, then its colours. */
export const paletteBlock = (palette: Palette): string => {
  const declarations = [
    `  color-scheme: ${palette.scheme};`,
    ...PALETTE_TOKENS.map(
      (token) => `  ${customProperty(token)}: ${palette.colors[token]};`,
    ),
  ]
  return `${selectorFor(palette)} {\n${declarations.join("\n")}\n}`
}

/** Every block, in table order.
 *
 *  Order is NOT load-bearing, and it is worth saying so: a page in `pitch`
 *  matches the default's block only through the bare `:root` (0,1,0) and its
 *  own through `:root[data-theme="pitch"]` (0,2,0), so the named block wins on
 *  specificity wherever either is written. */
export const paletteCss = (): string =>
  [
    "/* The named palettes — GENERATED from",
    " * packages/web/src/client/theme/palettes.ts by that directory's css.ts.",
    " * Do not edit: edit the table. */",
    ...PALETTES.map(paletteBlock),
    "",
  ].join("\n")
