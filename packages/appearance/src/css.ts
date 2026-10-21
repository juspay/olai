/**
 * The palettes, as the CSS that puts one in force.
 *
 * Generated from `./palettes.ts` and appended to the built stylesheet by the
 * theme row's build contribution, which is why nothing here is in
 * `tokens.css`: the table is the source, and a sheet with a hand-copied block
 * per theme in it would be one chance per theme for a token to be forgotten.
 * What `tokens.css` still spells is the TOKEN NAMES — Tailwind can only
 * generate `text-muted` for a `--color-muted` it has seen in `@theme` — and the
 * light default's values, which `./css.test.ts` holds to this table.
 *
 * Every block is UNLAYERED, which is how it beats the `@layer theme` Tailwind
 * puts its own `:root` in. The light default's block also lands on a bare
 * `:root`, because a page that picked nothing is in it by day — one block
 * rather than two, so the default cannot drift from itself.
 *
 * ONE `prefers-color-scheme` rule, and it is scoped to the page that picked
 * nothing: `:root:not([data-theme])` under the dark media query takes the dark
 * default's values. A stored pick writes the attribute, so the OS never
 * overrules a person — it only answers for the page nobody has answered for.
 */

import {
  DEFAULT_DARK_PALETTE,
  DEFAULT_THEME,
  type Palette,
  type PaletteToken,
  PALETTE_TOKENS,
  PALETTES,
  THEME_ATTRIBUTE,
} from "./palettes.ts"
import { TAG_INK } from "./tagInk.ts"

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

/** The selector a page in this theme matches. The light default matches TWO:
 *  its own name, and the page that has picked nothing at all.
 *
 *  Exported so a test can ask which theme the bare `:root` belongs to, rather
 *  than reading it back out of the generated text with a regex. */
export const selectorFor = (palette: Palette): string => {
  const named = `:root[${THEME_ATTRIBUTE}="${palette.name}"]`
  return palette.name === DEFAULT_THEME ? `:root, ${named}` : named
}

/** The selector the dark default ALSO answers to: the page that picked
 *  nothing, while the OS says dark. Scoped to the media rule below. */
export const UNPICKED_SELECTOR = `:root:not([${THEME_ATTRIBUTE}])`

/** One theme's declarations: its `color-scheme`, then its colours — and the
 *  two numbers a tag's hue is rendered through ({@link ./tagInk.ts}). Those
 *  ride the same block rather than the base sheet, because the scheme is the
 *  palette's own fact and a `--tag-ink-l` answered anywhere else would be a
 *  second place able to disagree with it. Not `--color-` namespaced: they are
 *  not colours, and `./css.test.ts`'s token sweep counts the eleven. */
const declarationsOf = (palette: Palette, indent: string): string => {
  const ink = TAG_INK[palette.scheme]
  return [
    `${indent}color-scheme: ${palette.scheme};`,
    ...PALETTE_TOKENS.map(
      (token) => `${indent}${customProperty(token)}: ${palette.colors[token]};`,
    ),
    `${indent}--tag-ink-l: ${ink.l};`,
    `${indent}--tag-ink-c: ${ink.c};`,
  ].join("\n")
}

/** One theme's block, under the selector(s) it answers to. */
export const paletteBlock = (palette: Palette): string =>
  `${selectorFor(palette)} {\n${declarationsOf(palette, "  ")}\n}`

/** The dark default's second claim: the unpicked page, under a dark OS. */
export const unpickedDarkBlock = (): string =>
  `@media (prefers-color-scheme: dark) {\n  ${UNPICKED_SELECTOR} {\n${declarationsOf(DEFAULT_DARK_PALETTE, "    ")}\n  }\n}`

/** Every block, in table order, then the OS's say over the unpicked page.
 *
 *  Order is NOT load-bearing, and it is worth saying so: a page in `abyss`
 *  matches the default's block only through the bare `:root` (0,1,0) and its
 *  own through `:root[data-theme="abyss"]` (0,2,0), so the named block wins on
 *  specificity wherever either is written. The media block's
 *  `:root:not([data-theme])` is (0,2,0) too, which is how it beats the bare
 *  `:root` by day-default and loses to every named block. */
export const paletteCss = (): string =>
  [
    "/* The named palettes — GENERATED from",
    " * packages/appearance/src/palettes.ts by that directory's css.ts.",
    " * Do not edit: edit the table. */",
    ...PALETTES.map(paletteBlock),
    unpickedDarkBlock(),
    "",
  ].join("\n")
