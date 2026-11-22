/** The grammar holds the rows it wrote. `./palettes.ts` keeps every colour as
 *  a literal, so the claim that a row IS its recipe — one hue across its
 *  grounds, the steps of its depth, an accent that reads, its polarity's
 *  status triple — is only true while this file says so. */
import { describe, expect, test } from "bun:test"

import { contrastRatio } from "./contrast.ts"
import { PALETTES } from "./palettes.ts"
import { ACCENT_ON_PAPER, derive, RAMP } from "./recipe.ts"

const written = PALETTES.filter((palette) => palette.recipe !== undefined)

describe("the grammar", () => {
  test("wrote every row but the four hand-tuned ones", () => {
    // The four that shipped first stay digit for digit and are not derived;
    // every row after them is.
    expect(PALETTES.filter((palette) => palette.recipe === undefined).map((palette) => palette.name)).toEqual([
      "chalk",
      "reef",
      "basalt",
      "abyss",
    ])
    expect(written.map((palette) => palette.name)).toEqual([
      "bloom",
      "manuscript",
      "leaf",
      "sky",
      "iris",
      "ember",
      "dusk",
    ])
  })

  test("each row it wrote is exactly what it derives from that row's recipe", () => {
    for (const { name, scheme, recipe, colors } of written) {
      if (recipe === undefined) continue
      expect({ name, colors: { ...colors } }).toEqual({
        name,
        colors: derive(recipe.hue, scheme, recipe.depth, recipe.accentHue),
      })
    }
  })

  test("a depth is one of the closed set its polarity offers", () => {
    expect(Object.keys(RAMP.light)).toEqual(["pale", "deep"])
    expect(Object.keys(RAMP.dark)).toEqual(["deep"])
    const outside = written
      .filter(({ scheme, recipe }) => recipe === undefined || !(recipe.depth in RAMP[scheme]))
      .map((palette) => palette.name)
    expect(outside).toEqual([])
    // …and asking for one that is not there is refused, not guessed.
    expect(() => derive(300, "dark", "pale", 332)).toThrow("no pale ramp for a dark row")
  })

  test("every accent it wrote reads on its own paper", () => {
    // By day the grammar searches for this; by night the lightness is FIXED,
    // so this is the only thing holding a dark accent to the line.
    const under = written
      .filter(({ colors }) => contrastRatio(colors.accent, colors.paper) < ACCENT_ON_PAPER)
      .map((palette) => palette.name)
    expect(under).toEqual([])
  })

  test("a hue is read mod 360", () => {
    expect(derive(-58, "light", "deep", 467)).toEqual(derive(302, "light", "deep", 107))
  })
})
