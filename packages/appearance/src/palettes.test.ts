/** The table's own invariants. The TYPE already forces every row to name every
 *  token — that is what `Record<PaletteToken, string>` is for — so what is left
 *  here is the things a type cannot say: that no two rows answer to the same
 *  name, that the values are colours, that each default is one of them, and
 *  the SHAPE the table claims — a neutral and a spread of hues in each
 *  polarity, no two of them alike — measured in OKLCH. */
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
  type Palette,
  type Scheme,
} from "./palettes.ts"
describe("the palette table", () => {
  test("is the eleven, lights first", () => {
    expect(THEME_NAMES).toEqual([
      "chalk",
      "bloom",
      "manuscript",
      "leaf",
      "reef",
      "sky",
      "iris",
      "basalt",
      "ember",
      "abyss",
      "dusk",
    ])
    expect(PALETTES.map((palette) => palette.scheme)).toEqual([
      ...Array<Scheme>(7).fill("light"),
      ...Array<Scheme>(4).fill("dark"),
    ])
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
    // Every row, no excuses: `./contrast.test.ts` holds each to the promise.
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

/** reef's hue, rounded: the lattice the wheel is cut on starts at the lagoon. */
const LATTICE_ANCHOR = 177

describe("the table's shape", () => {
  const ofScheme = (scheme: Scheme) => PALETTES.filter((palette) => palette.scheme === scheme)
  const hued = (palette: Palette) => oklchOf(palette.colors.paper).c >= HUE_BEARING_CHROMA
  /** Every unordered pair of rows of one polarity. */
  const pairsOf = (scheme: Scheme) => {
    const rows = ofScheme(scheme)
    return rows.flatMap((one, at) => rows.slice(at + 1).map((other) => [one, other] as const))
  }

  test("each polarity has one neutral, the default", () => {
    expect(PALETTES.filter((palette) => !hued(palette)).map((palette) => palette.name)).toEqual([
      DEFAULT_THEME,
      DEFAULT_DARK_THEME,
    ])
  })

  test("the hues span the wheel: one light paper per 60°, one dark per 120°", () => {
    // Sectors centred on the lagoon's lattice, so reef and abyss sit in the
    // middle of theirs. Six hued lights in six sectors and three hued darks in
    // three is "covers the spectrum" with no sector doubled and none empty.
    const spread = (scheme: Scheme, width: number) => {
      const papers = ofScheme(scheme).filter(hued).map((palette) => hueOf(palette.colors.paper))
      return Array.from({ length: 360 / width }, (_, at) => {
        const centre = (LATTICE_ANCHOR + at * width) % 360
        return papers.filter((hue) => hueGap(hue, centre) < width / 2).length
      })
    }
    expect(spread("light", 60)).toEqual([1, 1, 1, 1, 1, 1])
    expect(spread("dark", 120)).toEqual([1, 1, 1])
  })

  test("a grammar row's paper sits where its recipe says", () => {
    // The browser's gamut and the 8-bit rounding move a paper's measured hue
    // a few degrees off the declared one; ten would be a different sector.
    for (const { name, recipe, colors } of PALETTES) {
      if (recipe === undefined) continue
      expect(`${name} ${hueGap(hueOf(colors.paper), recipe.hue) <= 10}`).toBe(`${name} true`)
    }
  })

  test("no two papers of one polarity are closer than chalk and reef", () => {
    // The floor is the closest two papers that shipped, MEASURED here rather
    // than rounded: the closest new pair clears it by less than a ten-
    // thousandth, and a rounded 0.03 would call that pair a failure.
    const floor = colourGap(paletteNamed("chalk")!.colors.paper, paletteNamed("reef")!.colors.paper)
    for (const scheme of ["light", "dark"] as const) {
      const under = pairsOf(scheme)
        .filter(([one, other]) => colourGap(one.colors.paper, other.colors.paper) < floor)
        .map(([one, other]) => `${one.name}/${other.name}`)
      expect(under).toEqual([])
    }
  })

  test("the accents of one polarity are told apart", () => {
    // Every two accents of a polarity stay two and a half JNDs apart, but for
    // one pair: chalk and reef SHARE the coral on purpose — it is the mark's
    // own colour, and the neutral is where the brand reads loudest.
    expect(colourGap(paletteNamed("chalk")!.colors.accent, paletteNamed("reef")!.colors.accent)).toBeLessThan(ACCENT_FLOOR)
    for (const scheme of ["light", "dark"] as const) {
      const close = pairsOf(scheme)
        .filter(([one, other]) => colourGap(one.colors.accent, other.colors.accent) < ACCENT_FLOOR)
        .map(([one, other]) => `${one.name}/${other.name}`)
      expect(close).toEqual(scheme === "light" ? ["chalk/reef"] : [])
    }
  })

  test("a light row's accent is foreign; a dark row lifts its own hue", () => {
    // The rule the vocabulary states: a paper by day wants a note from the
    // other side of the wheel; a ground by night may take its own hue and lift
    // it.
    for (const palette of PALETTES.filter(hued)) {
      const gap = hueGap(hueOf(palette.colors.paper), hueOf(palette.colors.accent))
      const holds = palette.scheme === "light" ? gap >= 60 : gap <= 45
      expect(`${palette.name} ${Math.round(gap)}° ${holds}`).toBe(`${palette.name} ${Math.round(gap)}° true`)
    }
  })

  test("a link is not a status", () => {
    // An accent close to done, doing or alarm reads as one of them. The three
    // hand-tuned rows that carry the coral sit nearer their alarm than this —
    // the coral is the mark's colour and was chosen before the floor — and
    // are the named exception; every other row clears it.
    const close = PALETTES.flatMap((palette) =>
      (["done", "doing", "alarm"] as const)
        .filter((status) => colourGap(palette.colors.accent, palette.colors[status]) < ACCENT_FLOOR)
        .map((status) => `${palette.name}/${status}`),
    )
    expect(close).toEqual(["chalk/alarm", "reef/alarm", "basalt/alarm"])
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
