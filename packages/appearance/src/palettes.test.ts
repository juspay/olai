/** The table's own invariants. The TYPE already forces every row to name every
 *  token — that is what `Record<PaletteToken, string>` is for — so what is left
 *  here is the things a type cannot say: that no two rows answer to the same
 *  name, that the values are colours, that the default is one of them, and the
 *  SPREAD the table claims — the wheel it says it is, measured in OKLCH. */
import { describe, expect, test } from "bun:test"

import { colourGap, hueGap, hueOf, oklchOf } from "./hues.ts"
import {
  DEFAULT_PALETTE,
  type Palette,
  DEFAULT_THEME,
  paletteNamed,
  PALETTES,
  THEME_ATTRIBUTE,
  THEME_NAMES,
  THEME_STORAGE_KEY,
} from "./palettes.ts"
describe("the palette table", () => {
  test("is the eighteen, the wheel in order, the neutrals last", () => {
    expect(THEME_NAMES).toEqual([
      "bloom",
      "apricot",
      "manuscript",
      "leaf",
      "reef",
      "sky",
      "iris",
      "orchid",
      "chalk",
      "madder",
      "ember",
      "brandy",
      "spruce",
      "abyss",
      "midnight",
      "aurora",
      "dusk",
      "pitch",
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

  // "The default is one of the themes" is what `DEFAULT_PALETTE`'s throw says,
  // at import — its own comment above it says so — and `paletteNamed` finds a
  // row by its `name`, so the value's `.name` IS `DEFAULT_THEME` by
  // construction. Which theme a page that picked nothing lands in is asked
  // where it is observable, of the selectors: `./css.test.ts`.
  test("chalk is the one that promises AA", () => {
    expect(paletteNamed("chalk")?.aa).toBe(true)
    expect(
      PALETTES.filter((palette) => palette.aa === true).map((palette) => palette.name),
    ).toEqual(["chalk"])
  })

  test("a name no row offers resolves to nothing, rather than to something", () => {
    // What a value stored by an older olai looks like after a rename — the
    // client forgets it, and can only do that if this answers honestly. The
    // WorkFlowy ports that left this table are that case.
    expect(paletteNamed("no-such-theme")).toBeUndefined()
    expect(paletteNamed("matcha")).toBeUndefined()
  })

  test("the attribute and the storage key are the ones the shell spells", () => {
    // Pinned because the shell's inline boot script (index.html) spells both
    // as literals — it runs before any module — and `css.test.ts` reads THIS
    // side of the contract when it checks that one.
    expect(THEME_ATTRIBUTE).toBe("data-theme")
    expect(THEME_STORAGE_KEY).toBe("olai.theme")
  })

  test("the values reach the table verbatim (spot check)", () => {
    // A canary over the table itself: the default's paper (also the
    // manifest's chrome), the AA palette's desk, and two rows added with the
    // eight families.
    expect(paletteNamed("reef")?.colors.paper).toBe("#D6F0EA")
    expect(paletteNamed("chalk")?.colors.desk).toBe("#F2F2EC")
    expect(paletteNamed("apricot")?.colors.paper).toBe("#FFDECE")
    expect(paletteNamed("abyss")?.colors.paper).toBe("#021A15")
  })
})

/** The rows that MAKE a hue claim: a paper with enough chroma to read as a
 *  colour at all. The two neutral picks sit outside it on purpose — chalk is
 *  the quietest reading and pitch spends nothing on #000000, and neither is a
 *  cell of the wheel. */
const HUE_BEARING_CHROMA = 0.02

/** Two and a half just-noticeable differences: a JND is about 0.02. */
const ACCENT_FLOOR = 0.05

/** Each scheme's rows that carry a hue — the wheel that scheme is. */
const WHEEL: Record<"light" | "dark", ReadonlyArray<Palette>> = {
  light: PALETTES.filter(
    (palette) =>
      palette.scheme === "light" &&
      oklchOf(palette.colors.paper).c >= HUE_BEARING_CHROMA,
  ),
  dark: PALETTES.filter(
    (palette) =>
      palette.scheme === "dark" &&
      oklchOf(palette.colors.paper).c >= HUE_BEARING_CHROMA,
  ),
}

describe("the table's spread", () => {
  test("the neutral picks are the only rows without a hue", () => {
    const neutral = PALETTES.filter(
      (palette) => oklchOf(palette.colors.paper).c < HUE_BEARING_CHROMA,
    ).map((palette) => palette.name)
    expect(neutral).toEqual(["chalk", "pitch"])
  })

  test("every 60° sector of the wheel carries a light row and a dark one", () => {
    // The whole of what "sky's night is midnight" is FOR: a colour a person
    // likes is there in either polarity. Six sectors, six hues a scheme.
    for (const scheme of ["light", "dark"] as const) {
      const sectors = WHEEL[scheme].map((palette) =>
        Math.floor(hueOf(palette.colors.paper) / 60),
      )
      expect([...new Set(sectors)].sort((one, other) => one - other)).toEqual([
        0, 1, 2, 3, 4, 5,
      ])
    }
  })

  test("no two papers of one scheme sit within 30° of each other", () => {
    // Ten rows inside one band of the wheel is the pile this table stopped
    // being: three of the ten light papers used to sit inside 32°.
    const close: Array<string> = []
    for (const scheme of ["light", "dark"] as const) {
      const rows = WHEEL[scheme]
      for (let at = 0; at < rows.length; at += 1)
        for (let other = at + 1; other < rows.length; other += 1) {
          const gap = hueGap(
            hueOf(rows[at]!.colors.paper),
            hueOf(rows[other]!.colors.paper),
          )
          if (gap < 30) {
            close.push(
              `${scheme}: ${rows[at]!.name}/${rows[other]!.name} is ${gap.toFixed(1)}°`,
            )
          }
        }
    }
    expect(close).toEqual([])
  })

  test("every light paper has its dark twin in the same cell", () => {
    // reef's night is the abyss and sky's is midnight: a family is one hue
    // read twice, so each light row's nearest dark row is within 10°.
    const darks = WHEEL.dark
    const lonely = WHEEL.light.flatMap((light) => {
      const nearest = Math.min(
        ...darks.map((dark) =>
          hueGap(hueOf(light.colors.paper), hueOf(dark.colors.paper)),
        ),
      )
      return nearest <= 10
        ? []
        : [`${light.name}: its nearest dark row is ${nearest.toFixed(1)}° away`]
    })
    expect(lonely).toEqual([])
  })

  test("no two accents of one scheme are closer than two and a half JNDs", () => {
    // The accents were the collapse: six of the ten rows wore a teal or a
    // blue a few degrees apart, and two pairs were the same colour to the eye
    // (manuscript/bloom measured 0.037). Held by distance rather than by hue,
    // because two accents 40° apart at one lightness and one chroma are
    // closer than two 20° apart that are not.
    const close: Array<string> = []
    for (const scheme of ["light", "dark"] as const) {
      const rows = PALETTES.filter((palette) => palette.scheme === scheme)
      for (let at = 0; at < rows.length; at += 1)
        for (let other = at + 1; other < rows.length; other += 1) {
          const gap = colourGap(
            rows[at]!.colors.accent,
            rows[other]!.colors.accent,
          )
          if (gap < ACCENT_FLOOR) {
            close.push(
              `${scheme}: ${rows[at]!.name}/${rows[other]!.name} is ${gap.toFixed(3)}`,
            )
          }
        }
    }
    expect(close).toEqual([])
  })

  test("a light row's accent is foreign, a dark row's is the same thing lit", () => {
    // The rule the vocabulary states: "a complement, or the bright analogous
    // of a dark ground". A light page wants a note from the other side of the
    // wheel; a dark one may take its own hue and lift it.
    const wrong: Array<string> = []
    for (const palette of PALETTES) {
      if (oklchOf(palette.colors.paper).c < HUE_BEARING_CHROMA) continue
      const gap = hueGap(
        hueOf(palette.colors.paper),
        hueOf(palette.colors.accent),
      )
      const fine = palette.scheme === "light" ? gap >= 60 : gap <= 45 || gap >= 60
      if (!fine) {
        wrong.push(
          `${palette.name}: its accent is ${gap.toFixed(0)}° from its paper`,
        )
      }
    }
    expect(wrong).toEqual([])
  })
})
