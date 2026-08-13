import { describe, expect, test } from "bun:test"

import { AA, contrastRatio, relativeLuminance } from "./contrast.ts"
import { PALETTES, type PaletteToken } from "./palettes.ts"

/** The pairs this client actually paints — a foreground, and the background it
 *  lands on. Not every pair the eight tokens could make: `muted` is never read
 *  on `rule`, and holding a palette to a combination no component draws would
 *  be rejecting a colour over a page that does not exist.
 *
 *  Each is a real site: body text and every accent read on the paper
 *  (`text-muted`, `text-alarm`, a link); `text-paper` on the day being read and
 *  on the app's primary buttons (`bg-accent`), and on the mobile scrim's own
 *  ground (`bg-ink`). It is a claim about the components, so it lives here
 *  rather than with the arithmetic.
 *
 *  `ink` on `rule` USED TO BE HERE and is deliberately gone: `hover:bg-rule` was
 *  the surface a row lit up with, and since the depth pass a row lights up by
 *  RISING — `bg-raised`, plus a shadow (`../surface.ts`). Nothing paints an
 *  opaque `rule` any more; what is left of that token is hairlines and tints.
 *  The three grounds that replaced it are held to the same AA line by
 *  `./depth.test.ts`, against the surfaces the ramp actually derives. */
const PAINTED: ReadonlyArray<readonly [PaletteToken, PaletteToken]> = [
  ["ink", "paper"],
  ["muted", "paper"],
  ["accent", "paper"],
  ["done", "paper"],
  ["doing", "paper"],
  ["alarm", "paper"],
  ["paper", "accent"],
  ["paper", "ink"],
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
    // `chocolate`'s rule is translucent, which is theirs and stays theirs. A
    // ratio against a colour that is partly what is behind it is not a fact,
    // so the alpha is ignored — and no palette that makes the AA claim has one.
    expect(relativeLuminance("#A1836B53")).toBe(relativeLuminance("#A1836B"))
  })

  test("a value that is not a colour is refused, not silently NaN", () => {
    expect(() => relativeLuminance("rebeccapurple")).toThrow()
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
