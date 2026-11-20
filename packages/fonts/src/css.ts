import { FONTS_DIR, type HostedFile, HOSTED_FILES, woff2Name } from "./hosted.ts"
import {
  DEFAULT_FONT,
  FONT_ATTRIBUTE,
  FONT_TOKENS,
  type Typeface,
  TYPEFACES,
  fontProperty,
} from "./typefaces.ts"

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

const fontFaceRule = (file: HostedFile): string =>
  [
    "@font-face {",
    `  font-family: "${file.family}";`,
    `  font-style: ${file.style};`,
    `  font-weight: ${file.weight};`,
    "  font-display: swap;",
    `  src: url("/${FONTS_DIR}/${woff2Name(file.file)}") format("woff2");`,
    "}",
  ].join("\n")

export const fontCss = (): string =>
  [
    "/* The named typefaces — GENERATED from packages/fonts/src/typefaces.ts",
    " * by its own css.ts. Do not edit: edit the table. */",
    ...HOSTED_FILES.map(fontFaceRule),
    ...TYPEFACES.map(typefaceBlock),
    "",
  ].join("\n")
