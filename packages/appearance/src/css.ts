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

export const customProperty = (token: string): string => `--color-${token}`

export const tokenValue = (token: PaletteToken): string =>
  `var(${customProperty(token)})`

export const selectorFor = (palette: Palette): string => {
  const named = `:root[${THEME_ATTRIBUTE}="${palette.name}"]`
  return palette.name === DEFAULT_THEME ? `:root, ${named}` : named
}

export const UNPICKED_SELECTOR = `:root:not([${THEME_ATTRIBUTE}])`

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

export const paletteBlock = (palette: Palette): string =>
  `${selectorFor(palette)} {\n${declarationsOf(palette, "  ")}\n}`

export const unpickedDarkBlock = (): string =>
  `@media (prefers-color-scheme: dark) {\n  ${UNPICKED_SELECTOR} {\n${declarationsOf(DEFAULT_DARK_PALETTE, "    ")}\n  }\n}`

export const paletteCss = (): string =>
  [
    "/* The named palettes — GENERATED from",
    " * packages/appearance/src/palettes.ts by that directory's css.ts.",
    " * Do not edit: edit the table. */",
    ...PALETTES.map(paletteBlock),
    unpickedDarkBlock(),
    "",
  ].join("\n")
