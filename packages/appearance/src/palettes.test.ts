/** The table's own invariants. The TYPE already forces every row to name every
 *  token — that is what `Record<PaletteToken, string>` is for — so what is left
 *  here is the things a type cannot say: that no two rows answer to the same
 *  name, that the values are colours, that each default is one of them, and
 *  the SHAPE the table claims — two polarities, each a neutral and the lagoon,
 *  measured in OKLCH. */
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

  test("the two defaults are one of each polarity, and the OS chooses between them", () => {
    expect(DEFAULT_PALETTE.name).toBe(DEFAULT_THEME)
    expect(DEFAULT_DARK_PALETTE.name).toBe(DEFAULT_DARK_THEME)
    expect(DEFAULT_PALETTE.scheme).toBe("light")
    expect(DEFAULT_DARK_PALETTE.scheme).toBe("dark")
    expect(defaultPaletteFor("light")).toBe(DEFAULT_PALETTE)
    expect(defaultPaletteFor("dark")).toBe(DEFAULT_DARK_PALETTE)
  })

  test("every row promises AA", () => {
    // Four rows, no excuses: `./contrast.test.ts` holds each to the promise.
    expect(PALETTES.every((palette) => palette.aa === true)).toBe(true)
  })

  test("a name no row offers resolves to nothing, rather than to something", () => {
    // What a value stored by an older olai looks like after a rename — the
    // client forgets it, and can only do that if this answers honestly. The
    // fourteen rows that left the wheel are that case now.
    expect(paletteNamed("no-such-theme")).toBeUndefined()
    expect(paletteNamed("pitch")).toBeUndefined()
    expect(paletteNamed("aurora")).toBeUndefined()
  })

  test("the attribute and the storage key are the ones the shell spells", () => {
    // Pinned because the shell's inline boot script (head.html) spells both
    // as literals — it runs before any module — and `css.test.ts` reads THIS
    // side of the contract when it checks that one.
    expect(THEME_ATTRIBUTE).toBe("data-theme")
    expect(THEME_STORAGE_KEY).toBe("olai.theme")
  })

  test("the values reach the table verbatim (spot check)", () => {
    // A canary over the table itself: each default's paper (also the
    // shell's two chrome colours and the manifest's one).
    expect(paletteNamed("chalk")?.colors.paper).toBe("#FBFBF9")
    expect(paletteNamed("basalt")?.colors.paper).toBe("#161718")
    expect(paletteNamed("reef")?.colors.accent).toBe("#B43C45")
    expect(paletteNamed("abyss")?.colors.paper).toBe("#06201A")
  })
})

/** A paper with enough chroma to read as a colour at all. The neutrals sit
 *  under it on purpose: chalk and basalt are the day read in no particular
 *  hue. */
const HUE_BEARING_CHROMA = 0.01

/** Two and a half just-noticeable differences: a JND is about 0.02. */
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
    // reef's night is the abyss: a family is one hue read twice, so the two
    // papers sit within 10° of each other on the wheel.
    const gap = hueGap(hueOf(paletteNamed("reef")!.colors.paper), hueOf(paletteNamed("abyss")!.colors.paper))
    expect(gap).toBeLessThanOrEqual(10)
  })

  test("the two accents of one polarity are told apart", () => {
    // The two darks carry different notes — coral on basalt, cyan on abyss —
    // and must stay two and a half JNDs apart. The two lights SHARE the coral
    // on purpose: it is the mark's own colour, and the neutral is where the
    // brand reads loudest.
    expect(colourGap(paletteNamed("basalt")!.colors.accent, paletteNamed("abyss")!.colors.accent)).toBeGreaterThanOrEqual(ACCENT_FLOOR)
    expect(colourGap(paletteNamed("chalk")!.colors.accent, paletteNamed("reef")!.colors.accent)).toBeLessThan(ACCENT_FLOOR)
  })

  test("a light row's accent is foreign; the abyss lifts its own hue", () => {
    // The rule the vocabulary states: "a complement, or the bright analogous
    // of a dark ground". The lagoon by day wants a note from the other side
    // of the wheel; the deep may take its own hue and lift it.
    const reef = paletteNamed("reef")!
    const abyss = paletteNamed("abyss")!
    expect(hueGap(hueOf(reef.colors.paper), hueOf(reef.colors.accent))).toBeGreaterThanOrEqual(60)
    expect(hueGap(hueOf(abyss.colors.paper), hueOf(abyss.colors.accent))).toBeLessThanOrEqual(45)
  })

  test("the surfaces step in one direction", () => {
    // In a light palette the desk is under the paper and the panel over it;
    // in a dark one every step is a lift. A dark palette whose desk fell
    // darker than its paper would draw the furniture as a hole in the page.
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
