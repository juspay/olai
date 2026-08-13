/**
 * The typefaces, as the CSS that puts one in force.
 *
 * Generated from `./fonts.ts` and appended to the built stylesheet by
 * `src/build.ts`, which is why nothing here is in `styles.css`: the table is
 * the source, and a sheet with twenty hand-copied `@font-face` blocks in it
 * would be twenty chances for a file to be forgotten. What `styles.css` still
 * spells is the TOKEN NAMES and the default row's stacks — Tailwind can only
 * generate `font-sans` for a `--font-sans` it has seen in `@theme`.
 *
 * Every block is UNLAYERED, which is how it beats the `@layer theme` Tailwind
 * puts its own `:root` in. The default's block also lands on a bare `:root`,
 * because a page that picked nothing is in it — one block rather than two, so
 * the default cannot drift from itself.
 *
 * A hosted file is declared even when no pick uses it yet this load: the
 * browser only fetches a family a computed style names, so the unused faces
 * cost a few lines of CSS and no bytes on the wire.
 */

import {
  DEFAULT_FONT,
  FONT_ATTRIBUTE,
  FONT_TOKENS,
  type HostedFile,
  HOSTED_FILES,
  type Typeface,
  TYPEFACES,
  woff2Name,
  fontProperty,
} from "./fonts.ts"

/** The selector a page in this typeface matches. The default matches TWO: its
 *  own name, and the page that has picked nothing at all.
 *
 *  Exported so a test can ask which face the bare `:root` belongs to. */
export const selectorFor = (face: Typeface): string => {
  const named = `:root[${FONT_ATTRIBUTE}="${face.name}"]`
  return face.name === DEFAULT_FONT ? `:root, ${named}` : named
}

export const typefaceBlock = (face: Typeface): string => {
  const declarations = FONT_TOKENS.map(
    (token) => `  ${fontProperty(token)}: ${face[token]};`,
  )
  return `${selectorFor(face)} {\n${declarations.join("\n")}\n}`
}

export const fontFaceRule = (file: HostedFile): string =>
  [
    "@font-face {",
    `  font-family: "${file.family}";`,
    `  font-style: ${file.style};`,
    `  font-weight: ${file.weight};`,
    "  font-display: swap;",
    `  src: url("/fonts/${woff2Name(file.file)}") format("woff2");`,
    "}",
  ].join("\n")

/** Every `@font-face`, then every pick's block, in table order. */
export const fontCss = (): string =>
  [
    "/* The named typefaces — GENERATED from",
    " * packages/web/src/client/theme/fonts.ts by that directory's fontCss.ts.",
    " * Do not edit: edit the table. */",
    ...HOSTED_FILES.map(fontFaceRule),
    ...TYPEFACES.map(typefaceBlock),
    "",
  ].join("\n")
