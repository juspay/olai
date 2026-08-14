import { describe, expect, test } from "bun:test"

import { fontCss, fontFaceRule, selectorFor, typefaceBlock } from "./css.ts"
import {
  DEFAULT_FONT,
  FONT_ATTRIBUTE,
  FONT_TOKENS,
  HOSTED_FILES,
  TYPEFACES,
  fontProperty,
} from "./catalog.ts"

const css = fontCss()

describe("the generated typeface blocks", () => {
  test("every face can be asked for by name", () => {
    for (const face of TYPEFACES) {
      expect(css).toContain(`:root[${FONT_ATTRIBUTE}="${face.name}"]`)
    }
  })

  test("every face declares every token, with the table's value", () => {
    for (const face of TYPEFACES) {
      const block = typefaceBlock(face)
      for (const token of FONT_TOKENS) {
        expect(block).toContain(`${fontProperty(token)}: ${face[token]};`)
      }
    }
  })

  test("one face is what a page that picked nothing reads in", () => {
    const bare = TYPEFACES.filter((face) =>
      selectorFor(face).split(",").some((part) => part.trim() === ":root"),
    ).map((face) => face.name)
    expect(bare).toEqual([DEFAULT_FONT])
  })

  test("every hosted file has an @font-face naming its family and woff2", () => {
    for (const file of HOSTED_FILES) {
      expect(css).toContain(fontFaceRule(file))
    }
  })
})
