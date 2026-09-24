import { describe, expect, test } from "bun:test"

import { fontCss, selectorFor, typefaceBlock } from "./css.ts"
import { HOSTED_FILES } from "./hosted.ts"
import {
  DEFAULT_FONT,
  FONT_ATTRIBUTE,
  FONT_TOKENS,
  TYPEFACES,
  fontProperty,
} from "./typefaces.ts"

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
    // Read out of the generated text and spelled HERE, rather than asked of
    // `fontFaceRule` — which is what this used to do, and which made it a
    // comparison of that function with itself: every declaration could be
    // deleted from the rule and both sides moved together. The `src:` line is
    // the one that matters, and it was the one nothing held: drop it and the
    // page falls back to whatever the family name happens to match on the
    // machine, silently, with this test still green.
    const rules = css
      .split("@font-face {")
      .slice(1)
      .map((part) => part.slice(0, part.indexOf("}")))
    expect(rules).toHaveLength(HOSTED_FILES.length)
    for (const [index, file] of HOSTED_FILES.entries()) {
      const rule = rules[index] ?? ""
      expect(rule).toContain(`font-family: "${file.family}";`)
      expect(rule).toMatch(/src: url\("\/[^"]+\.woff2"\) format\("woff2"\);/)
    }
  })
})
