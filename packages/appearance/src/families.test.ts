/** The rule that puts each dark palette under its light sibling: the four
 *  pairs the table makes today, and the promise a new row could break — that
 *  no light is the day of two darks, which in the picker would be two
 *  swatches drawn in one place. */
import { describe, expect, test } from "bun:test"

import { lightSiblings } from "./families.ts"
import { PALETTES } from "./palettes.ts"

describe("each dark palette's light sibling", () => {
  test("is the one of its own hue, and the neutral's is the neutral", () => {
    expect(Object.fromEntries(lightSiblings(PALETTES))).toEqual({
      basalt: "chalk",
      ember: "manuscript",
      abyss: "reef",
      dusk: "iris",
    })
  })

  test("no light palette is the sibling of two darks", () => {
    const lights = [...lightSiblings(PALETTES).values()]
    expect(new Set(lights).size).toBe(lights.length)
    expect(lights.length).toBe(PALETTES.filter((palette) => palette.scheme === "dark").length)
  })

  test("a dark with no light of its kind has no sibling", () => {
    // A neutral dark in a table with no neutral light is left out rather
    // than paired with whatever hue happens to be first.
    const rows = PALETTES.filter((palette) => palette.name !== "chalk")
    expect(lightSiblings(rows).has("basalt")).toBe(false)
  })
})
