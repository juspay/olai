import { describe, expect, test } from "bun:test"

import { colourGap, hueGap, hueOf, oklchOf } from "./hues.ts"
import {
  DEFAULT_DARK_PALETTE,
  DEFAULT_DARK_THEME,
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  defaultPaletteFor,
  paletteNamed,
  PALETTES,
  THEME_ATTRIBUTE,
  THEME_NAMES,
  THEME_STORAGE_KEY,
} from "./palettes.ts"
describe("the palette table", () => {
  test("is the four, lights first", () => {
    expect(THEME_NAMES).toEqual(["chalk", "reef", "basalt", "abyss"])
    expect(PALETTES.map((palette) => palette.scheme)).toEqual(["light", "light", "dark", "dark"])
  })

  test("no two themes share a name", () => {
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

  test("the two defaults are one of each polarity, and the OS chooses between them", () => {
    expect(DEFAULT_PALETTE.name).toBe(DEFAULT_THEME)
    expect(DEFAULT_DARK_PALETTE.name).toBe(DEFAULT_DARK_THEME)
    expect(DEFAULT_PALETTE.scheme).toBe("light")
    expect(DEFAULT_DARK_PALETTE.scheme).toBe("dark")
    expect(defaultPaletteFor("light")).toBe(DEFAULT_PALETTE)
    expect(defaultPaletteFor("dark")).toBe(DEFAULT_DARK_PALETTE)
  })

  test("every row promises AA", () => {
    expect(PALETTES.every((palette) => palette.aa === true)).toBe(true)
  })

  test("a name no row offers resolves to nothing, rather than to something", () => {
    expect(paletteNamed("no-such-theme")).toBeUndefined()
    expect(paletteNamed("pitch")).toBeUndefined()
    expect(paletteNamed("aurora")).toBeUndefined()
  })

  test("the attribute and the storage key are the ones the shell spells", () => {
    expect(THEME_ATTRIBUTE).toBe("data-theme")
    expect(THEME_STORAGE_KEY).toBe("olai.theme")
  })

  test("the values reach the table verbatim (spot check)", () => {
    expect(paletteNamed("chalk")?.colors.paper).toBe("#FBFBF9")
    expect(paletteNamed("basalt")?.colors.paper).toBe("#161718")
    expect(paletteNamed("reef")?.colors.accent).toBe("#B43C45")
    expect(paletteNamed("abyss")?.colors.paper).toBe("#06201A")
  })
})

const HUE_BEARING_CHROMA = 0.01

const ACCENT_FLOOR = 0.05

describe("the table's shape", () => {
  test("each polarity is a neutral and the lagoon", () => {
    const neutral = PALETTES.filter(
      (palette) => oklchOf(palette.colors.paper).c < HUE_BEARING_CHROMA,
    ).map((palette) => palette.name)
    expect(neutral).toEqual(["chalk", "basalt"])
    const hued = PALETTES.filter(
      (palette) => oklchOf(palette.colors.paper).c >= HUE_BEARING_CHROMA,
    ).map((palette) => palette.name)
    expect(hued).toEqual(["reef", "abyss"])
  })

  test("the lagoon is one hue read twice", () => {
    const gap = hueGap(hueOf(paletteNamed("reef")!.colors.paper), hueOf(paletteNamed("abyss")!.colors.paper))
    expect(gap).toBeLessThanOrEqual(10)
  })

  test("the two accents of one polarity are told apart", () => {
    expect(colourGap(paletteNamed("basalt")!.colors.accent, paletteNamed("abyss")!.colors.accent)).toBeGreaterThanOrEqual(ACCENT_FLOOR)
    expect(colourGap(paletteNamed("chalk")!.colors.accent, paletteNamed("reef")!.colors.accent)).toBeLessThan(ACCENT_FLOOR)
  })

  test("a light row's accent is foreign; the abyss lifts its own hue", () => {
    const reef = paletteNamed("reef")!
    const abyss = paletteNamed("abyss")!
    expect(hueGap(hueOf(reef.colors.paper), hueOf(reef.colors.accent))).toBeGreaterThanOrEqual(60)
    expect(hueGap(hueOf(abyss.colors.paper), hueOf(abyss.colors.accent))).toBeLessThanOrEqual(45)
  })

  test("the surfaces step in one direction", () => {
    for (const palette of PALETTES) {
      const l = (token: "paper" | "desk" | "panel" | "pill") => oklchOf(palette.colors[token]).l
      if (palette.scheme === "light") {
        expect(l("desk")).toBeLessThan(l("paper"))
        expect(l("panel")).toBeGreaterThanOrEqual(l("paper"))
        expect(l("pill")).toBeLessThan(l("desk"))
      } else {
        expect(l("desk")).toBeGreaterThan(l("paper"))
        expect(l("panel")).toBeGreaterThan(l("desk"))
        expect(l("pill")).toBeGreaterThan(l("panel"))
      }
    }
  })
})
