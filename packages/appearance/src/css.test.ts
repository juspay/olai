import { describe, expect, test } from "bun:test"

import { customProperty, paletteBlock, paletteCss, selectorFor, UNPICKED_SELECTOR, unpickedDarkBlock } from "./css.ts"
import {
  DEFAULT_DARK_PALETTE,
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  PALETTE_TOKENS,
  PALETTES,
  THEME_ATTRIBUTE,
} from "./palettes.ts"
import { TAG_INK } from "./tagInk.ts"
const css = paletteCss()

describe("the generated palette blocks", () => {
  test("every theme can be asked for by name", () => {
    for (const palette of PALETTES) {
      expect(css).toContain(`:root[${THEME_ATTRIBUTE}="${palette.name}"]`)
    }
  })

  test("every theme declares every token, with the table's value", () => {
    for (const palette of PALETTES) {
      const block = paletteBlock(palette)
      for (const token of PALETTE_TOKENS) {
        expect(block).toContain(
          `${customProperty(token)}: ${palette.colors[token]};`,
        )
      }
    }
  })

  test("every theme says which color-scheme it is", () => {
    for (const palette of PALETTES) {
      expect(paletteBlock(palette)).toContain(`color-scheme: ${palette.scheme};`)
    }
  })

  test("every theme's block carries the tag ink of its scheme", () => {
    for (const palette of PALETTES) {
      const ink = TAG_INK[palette.scheme]
      const block = paletteBlock(palette)
      expect(block).toContain(`--tag-ink-l: ${ink.l};`)
      expect(block).toContain(`--tag-ink-c: ${ink.c};`)
    }
  })

  test("one theme is what a page that picked nothing reads in by day", () => {
    const bare = PALETTES.filter((palette) =>
      selectorFor(palette).split(",").some((part) => part.trim() === ":root"),
    ).map((palette) => palette.name)
    expect(bare).toEqual([DEFAULT_THEME])
  })

  test("the OS answers for the unpicked page, and for nothing else", () => {
    const block = unpickedDarkBlock()
    expect(block).toMatch(/^@media \(prefers-color-scheme: dark\) \{/)
    expect(block).toContain(UNPICKED_SELECTOR)
    expect(UNPICKED_SELECTOR).toBe(`:root:not([${THEME_ATTRIBUTE}])`)
    for (const token of PALETTE_TOKENS) {
      expect(block).toContain(`${customProperty(token)}: ${DEFAULT_DARK_PALETTE.colors[token]};`)
    }
    expect(block).toContain("color-scheme: dark;")
    expect(css.split("prefers-color-scheme").length - 1).toBe(1)
    expect(css).toContain(block)
  })
})

describe("the stylesheet's @theme", () => {
  test("declares the default palette, token for token", async () => {
    const sheet = await Bun.file(new URL("./tokens.css", import.meta.url)).text()
    const theme = /@theme\s*\{([^}]*)\}/.exec(sheet)?.[1]
    expect(theme).toBeDefined()
    for (const token of PALETTE_TOKENS) {
      expect(theme).toContain(
        `${customProperty(token)}: ${DEFAULT_PALETTE.colors[token]};`,
      )
    }
  })
})
