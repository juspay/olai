import { describe, expect, test } from "bun:test"

import { markSvg } from "./mark.ts"
import { paletteNamed, PALETTES } from "./palettes.ts"

/** The palette the files in `public/` are drawn in — a brand mark, not a
 *  pick. The tab is painted from whichever row is in force; the installer
 *  keeps a file. */
const INSTALL = paletteNamed("leaf")
if (INSTALL === undefined) {
  throw new Error("unreachable: no row named leaf")
}

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
    const pitch = paletteNamed("pitch")
    expect(reef).toBeDefined()
    expect(pitch).toBeDefined()
    if (reef === undefined || pitch === undefined) return
    expect(markSvg(reef)).not.toBe(markSvg(pitch))
  })

  test("the shipped icon is the mark in the leaf palette", async () => {
    // The install files are a SNAPSHOT of this drawing in one row. A geometry
    // edit here that forgot the file, or a leaf retune that forgot the icon,
    // is a tab and a home screen that no longer agree about what the mark is.
    const shipped = await Bun.file(
      new URL("../public/icon.svg", import.meta.url),
    ).text()
    expect(shipped).toBe(markSvg(INSTALL))
  })
})
