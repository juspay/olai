import { describe, expect, test } from "bun:test"

import { fontCss, fontFaceRule, selectorFor, typefaceBlock } from "./fontCss.ts"
import {
  DEFAULT_FONT,
  DEFAULT_TYPEFACE,
  FONT_ATTRIBUTE,
  FONT_STORAGE_KEY,
  FONT_TOKENS,
  HOSTED_FILES,
  TYPEFACES,
  fontProperty,
} from "./fonts.ts"

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

describe("the shell's boot script", () => {
  const shell = (): Promise<string> =>
    Bun.file(new URL("../index.html", import.meta.url)).text()

  test("reads the key this table writes, and writes the attribute it keys on", async () => {
    const html = await shell()
    expect(html).toContain(`localStorage.getItem("${FONT_STORAGE_KEY}")`)
    expect(html).toContain(`setAttribute("${FONT_ATTRIBUTE}"`)
  })
})

describe("the stylesheet's @theme", () => {
  test("declares the default typeface, token for token", async () => {
    const sheet = await Bun.file(new URL("../styles.css", import.meta.url)).text()
    const theme = /@theme\s*\{([^}]*)\}/.exec(sheet)?.[1]
    expect(theme).toBeDefined()
    for (const token of FONT_TOKENS) {
      expect(theme).toContain(
        `${fontProperty(token)}: ${DEFAULT_TYPEFACE[token]};`,
      )
    }
  })
})
