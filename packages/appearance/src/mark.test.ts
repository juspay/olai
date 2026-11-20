import { describe, expect, test } from "bun:test"

import { markSvg } from "./mark.ts"
import { paletteNamed, PALETTES } from "./palettes.ts"
import { DEFAULT_PALETTE } from "./palettes.ts"
const INSTALL = DEFAULT_PALETTE

describe("the palm-leaf mark", () => {
  test("every palette paints paper, ink and done into it", () => {
    for (const palette of PALETTES) {
      const svg = markSvg(palette)
      expect(svg).toContain(`fill="${palette.colors.paper}"`)
      expect(svg).toContain(`stroke="${palette.colors.ink}"`)
      expect(svg).toContain(`fill="${palette.colors.done}"`)
    }
  })

  test("two palettes do not draw the same mark", () => {
    const reef = paletteNamed("reef")
    const basalt = paletteNamed("basalt")
    expect(reef).toBeDefined()
    expect(basalt).toBeDefined()
    if (reef === undefined || basalt === undefined) return
    expect(markSvg(reef)).not.toBe(markSvg(basalt))
  })

  test("the waiting dot is the same drawing with one thing added", () => {
    for (const palette of PALETTES) {
      const plain = markSvg(palette)
      const marked = markSvg(palette, true)
      expect(marked).not.toBe(plain)
      expect(marked).toContain(plain.slice(0, plain.indexOf("</svg>")))
      expect(marked).toContain(`fill="${palette.colors.doing}"`)
    }
  })

  test("the shipped icon is the mark in the light default", async () => {
    const shipped = await Bun.file(
      new URL("../../plugins/web-app/src/public/icon.svg", import.meta.url),
    ).text()
    expect(shipped).toBe(markSvg(INSTALL))
  })
})
