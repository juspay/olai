import { describe, expect, test } from "bun:test"

import { AA, contrastRatio, relativeLuminance } from "./contrast.ts"
import { PALETTES, type PaletteToken } from "./palettes.ts"

/** The pairs this client actually paints — a foreground, and the background it
 *  lands on. Not every pair the eleven tokens could make: `muted` is never read
 *  on `rule`, and holding a palette to a combination no component draws would
 *  be rejecting a colour over a page that does not exist.
 *
 *  Each is a real site: body text and every accent read on the paper
 *  (`text-muted`, `text-alarm`, a link); chrome labels on the desk; a date
 *  badge on its pill; `text-paper` on the day being read (`bg-ink`); `text-ink`
 *  over the surface a row lights up with (`hover:bg-rule`). It is a claim
 *  about the components, so it lives here rather than with the arithmetic. */
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
    // The two ends of the scale, which is the whole of what can be checked
    // without restating the formula: black on white is 21:1, and a colour
    // against itself is 1:1.
    expect(relativeLuminance("#000000")).toBe(0)
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10)
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 10)
    expect(contrastRatio("#8E3348", "#8E3348")).toBeCloseTo(1, 10)
  })

  test("an alpha is dropped rather than misread", () => {
    // A ratio against a colour that is partly what is behind it is not a
    // fact, so the alpha is ignored — and no palette that makes the AA claim
    // has one.
    expect(relativeLuminance("#A1836B53")).toBe(relativeLuminance("#A1836B"))
  })

  test("a value that is not a colour is refused, not silently NaN", () => {
    expect(() => relativeLuminance("rebeccapurple")).toThrow()
  })

  test("every palette clears the reading floor, pair by pair", () => {
    // Ink on the page (and paper on the frame) at least 7:1, because this is
    // an outliner a person lives in. The rest of the pairs this client paints
    // on the paper, and ink on the raised surfaces, at least AA. `chalk`
    // additionally promises the full PAINTED set, including muted on a pill.
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

  test("a palette that promises AA keeps it, pair by pair", () => {
    const promised = PALETTES.filter((palette) => palette.aa === true)
    expect(promised.length).toBeGreaterThan(0)
    // Collected rather than asserted one at a time, so a colour edited two
    // digits reports every pair it dropped instead of only the first.
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
