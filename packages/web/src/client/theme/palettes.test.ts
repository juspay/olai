import { describe, expect, test } from "bun:test"

import {
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  paletteNamed,
  PALETTES,
  THEME_ATTRIBUTE,
  THEME_NAMES,
  THEME_STORAGE_KEY,
} from "./palettes.ts"

/** The table's own invariants. The TYPE already forces every row to name every
 *  token — that is what `Record<PaletteToken, string>` is for — so what is left
 *  here is the things a type cannot say: that no two rows answer to the same
 *  name, that the values are colours, and that the default is one of them. */
describe("the palette table", () => {
  test("ships the fifteen the racket implementation did", () => {
    expect(PALETTES.length).toBe(15)
  })

  test("no two themes share a name", () => {
    // Two rows with one name is one block overwriting the other in the sheet,
    // and two chips in the picker that do the same thing.
    expect(new Set(THEME_NAMES).size).toBe(THEME_NAMES.length)
  })

  test("a name is something an attribute, a key and a selector can all hold", () => {
    for (const name of THEME_NAMES) expect(name).toMatch(/^[a-z][a-z0-9-]*$/)
  })

  test("every value is a colour", () => {
    for (const palette of PALETTES) {
      for (const [token, value] of Object.entries(palette.colors)) {
        expect(`${palette.name}.${token}=${value}`).toMatch(
          /=#[0-9A-F]{6}(?:[0-9A-F]{2})?$/,
        )
      }
    }
  })

  test("the default is one of the themes, and it is the one that promises AA", () => {
    expect(DEFAULT_PALETTE.name).toBe(DEFAULT_THEME)
    expect(DEFAULT_PALETTE.aa).toBe(true)
  })

  test("a name no row offers resolves to nothing, rather than to something", () => {
    // What a value stored by an older olai looks like after a rename — the
    // client forgets it, and can only do that if this answers honestly.
    expect(paletteNamed("no-such-theme")).toBeUndefined()
    expect(paletteNamed(DEFAULT_THEME)).toBe(DEFAULT_PALETTE)
  })

  test("the attribute and the storage key are the ones the shell spells", () => {
    // Pinned because the shell's inline boot script (index.html) spells both
    // as literals — it runs before any module — and `css.test.ts` reads THIS
    // side of the contract when it checks that one.
    expect(THEME_ATTRIBUTE).toBe("data-theme")
    expect(THEME_STORAGE_KEY).toBe("olai.theme")
  })

  test("the ported values reach the table verbatim (spot check)", () => {
    // A canary over the port itself, in the same spirit as the racket suite's:
    // the first palette's paper and the last one's alarm, read off
    // master-racket's olai/web/theme.rkt.
    expect(paletteNamed("leaf")?.colors.paper).toBe("#E4ECCA")
    expect(paletteNamed("robot")?.colors.alarm).toBe("#E8393F")
  })
})
