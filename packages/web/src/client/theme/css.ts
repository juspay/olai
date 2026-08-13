/**
 * The palettes, as the CSS that puts one in force.
 *
 * Generated from `./palettes.ts` and appended to the built stylesheet by
 * `src/build.ts`, which is why nothing here is in `styles.css`: the table is
 * the source, and a sheet with fifteen hand-copied blocks in it would be
 * fifteen chances for a token to be forgotten. What `styles.css` still spells
 * is the TOKEN NAMES — Tailwind can only generate `text-muted` for a
 * `--color-muted` it has seen in `@theme` — and the default palette's values,
 * which `./css.test.ts` holds to this table.
 *
 * A block carries more than the eight the table writes: the altitudes the depth
 * grammar paints with are DERIVED from them (`./depth.ts`) and written in
 * beside them, so every palette gets the same depth by construction instead of
 * by fifteen hand-tunings.
 *
 * Every block is UNLAYERED, which is how it beats the `@layer theme` Tailwind
 * puts its own `:root` in. The default's block also lands on a bare `:root`,
 * because a page that picked nothing is in it — one block rather than two, so
 * the default cannot drift from itself.
 *
 * There is no `prefers-color-scheme` rule anywhere in it, on purpose: a theme
 * is a pick, and the OS is not a picker.
 */

import { depthOf, SHADOW_TOKENS, SURFACE_TOKENS } from "./depth.ts"
import {
  DEFAULT_THEME,
  type Palette,
  PALETTE_TOKENS,
  PALETTES,
  THEME_ATTRIBUTE,
} from "./palettes.ts"

/** The custom property a token is read through — Tailwind's namespace, so that
 *  `text-ink` and `--color-ink` are one decision and not two. */
export const customProperty = (token: string): string => `--color-${token}`

/** …and the one a SHADOW is read through, which is Tailwind's other namespace
 *  for the same reason. These are not declared in `@theme` — no utility is
 *  generated from them, because a shadow is asked for by the token it reads
 *  (`shadow-[var(--shadow-card)]`, spelled once in `../surface.ts`) — so this
 *  spelling and that one are the whole contract. */
export const shadowProperty = (token: string): string => `--shadow-${token}`

/** The selector a page in this theme matches. The default matches TWO: its own
 *  name, and the page that has picked nothing at all.
 *
 *  Exported so a test can ask which theme the bare `:root` belongs to, rather
 *  than reading it back out of the generated text with a regex. */
export const selectorFor = (palette: Palette): string => {
  const named = `:root[${THEME_ATTRIBUTE}="${palette.name}"]`
  return palette.name === DEFAULT_THEME ? `:root, ${named}` : named
}

/** One theme's block: its `color-scheme`, its colours, then the depth it gets
 *  by construction — the three altitudes and the shadows that say which is
 *  which, derived from the eight above (`./depth.ts`). Derived rather than
 *  written, so a palette added as a row arrives with depth already, and a
 *  reviewer cannot forget the nine values a hand-written block would owe. */
export const paletteBlock = (palette: Palette): string => {
  const depth = depthOf(palette)
  const declarations = [
    `  color-scheme: ${palette.scheme};`,
    ...PALETTE_TOKENS.map(
      (token) => `  ${customProperty(token)}: ${palette.colors[token]};`,
    ),
    ...SURFACE_TOKENS.map(
      (token) => `  ${customProperty(token)}: ${depth.surfaces[token]};`,
    ),
    ...SHADOW_TOKENS.map(
      (token) => `  ${shadowProperty(token)}: ${depth.shadows[token]};`,
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
