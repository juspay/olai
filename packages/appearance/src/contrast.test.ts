import { describe, expect, test } from "bun:test"

import { AA, contrastRatio, relativeLuminance } from "./contrast.ts"
import { PALETTES, type PaletteToken } from "./palettes.ts"
const PAINTED: ReadonlyArray<readonly [PaletteToken, PaletteToken]> = [
  ["ink", "paper"],
  ["muted", "paper"],
  ["accent", "paper"],
  ["done", "paper"],
  ["doing", "paper"],
  ["alarm", "paper"],
  ["ink", "desk"],
  ["muted", "desk"],
  ["ink", "panel"],
  ["muted", "panel"],
  ["ink", "pill"],
  ["muted", "pill"],
  ["paper", "accent"],
  ["paper", "ink"],
  ["ink", "rule"],
]

describe("contrast", () => {
  test("the arithmetic is the spec's", () => {
    expect(relativeLuminance("#000000")).toBe(0)
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10)
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 10)
    expect(contrastRatio("#8E3348", "#8E3348")).toBeCloseTo(1, 10)
  })

  test("an alpha is dropped rather than misread", () => {
    expect(relativeLuminance("#A1836B53")).toBe(relativeLuminance("#A1836B"))
  })

  test("a value that is not a colour is refused, not silently NaN", () => {
    expect(() => relativeLuminance("rebeccapurple")).toThrow()
  })

  test("every palette clears the reading floor, pair by pair", () => {
    const FLOOR: ReadonlyArray<
      readonly [PaletteToken, PaletteToken, number]
    > = [
      ["ink", "paper", 7],
      ["paper", "ink", 7],
      ["muted", "paper", AA],
      ["accent", "paper", AA],
      ["done", "paper", AA],
      ["doing", "paper", AA],
      ["alarm", "paper", AA],
      ["ink", "desk", AA],
      ["ink", "panel", AA],
      ["ink", "pill", AA],
      ["paper", "accent", AA],
      ["ink", "rule", AA],
    ]
    const under = PALETTES.flatMap((palette) =>
      FLOOR.flatMap(([foreground, background, floor]) => {
        const ratio = contrastRatio(
          palette.colors[foreground],
          palette.colors[background],
        )
        return ratio >= floor
          ? []
          : [
              `${palette.name}: ${foreground} on ${background} is ` +
                `${ratio.toFixed(2)}:1, under ${floor}:1`,
            ]
      }),
    )
    expect(under).toEqual([])
  })

  test("every palette keeps the AA promise, pair by pair", () => {
    const promised = PALETTES.filter((palette) => palette.aa === true)
    expect(promised.length).toBe(PALETTES.length)
    const under = promised.flatMap((palette) =>
      PAINTED.flatMap(([foreground, background]) => {
        const ratio = contrastRatio(
          palette.colors[foreground],
          palette.colors[background],
        )
        return ratio >= AA
          ? []
          : [
              `${palette.name}: ${foreground} on ${background} is ` +
                `${ratio.toFixed(2)}:1, under AA`,
            ]
      }),
    )
    expect(under).toEqual([])
  })
})
