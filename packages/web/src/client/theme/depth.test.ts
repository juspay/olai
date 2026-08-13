import { describe, expect, test } from "bun:test"

import { AA, contrastRatio } from "./contrast.ts"
import {
  climbs,
  depthOf,
  RUNG_TOKENS,
  RUNGS,
  SHADOW_TOKENS,
  stepOf,
  SURFACE_TOKENS,
  VISIBLE,
} from "./depth.ts"
import { mixed } from "./hex.ts"
import { PALETTES } from "./palettes.ts"

/**
 * THE HARD CONSTRAINT, as arithmetic.
 *
 * The depth grammar has to hold on fifteen palettes and both schemes, and the
 * way it fails is silent: a card that ended up the same shade as the canvas
 * still renders, still passes every e2e, and looks exactly like the flat app
 * this replaced. Nobody reviewing a hex can see it. So every claim the grammar
 * makes is asked of every row here — and the answers are COLLECTED rather than
 * asserted one at a time, so a ramp nudged in `./depth.ts` reports every
 * palette it broke instead of only the first.
 */
const complaints = (
  about: (palette: (typeof PALETTES)[number]) => string | undefined,
): string[] =>
  PALETTES.flatMap((palette) => {
    const said = about(palette)
    return said === undefined ? [] : [`${palette.name}: ${said}`]
  })

/** Every shadow that says a surface is ABOVE — which is every one of them but
 *  the well. Derived rather than listed, so a sixth shadow is covered by the two
 *  claims below on the day it is added rather than on the day somebody notices
 *  the list was never updated. */
const FLOATING = SHADOW_TOKENS.filter((token) => token !== "well")

describe("the altitude ramp", () => {
  test("every palette climbs away from its own ground", () => {
    // The direction, and it is the whole of the light/dark asymmetry: depth is
    // made by DARKENING what is behind on a light ground and by LIGHTENING what
    // is in front on a dark one, so in both the ramp rises in luminance from
    // canvas to well to raised. A palette that inverted would be drawing a card
    // cut INTO the desk.
    expect(
      complaints((palette) =>
        climbs(depthOf(palette)) ? undefined : "the ramp does not climb"
      ),
    ).toEqual([])
  })

  test("every palette's climb lands where the ramp aimed it", () => {
    // Half of the vanish claim, and the half that is CIRCULAR on its own: it
    // proves the bisection reached `RUNGS.top`, and would go on passing if
    // somebody quieted that knob to 1.05. The other half is the next test.
    expect(
      complaints((palette) => {
        const step = stepOf(depthOf(palette), "raised")
        return step >= RUNGS.top - 0.01
          ? undefined
          : `a raised surface is ${step.toFixed(3)}:1 off the canvas, under ` +
            `the ramp's ${RUNGS.top}`
      }),
    ).toEqual([])
  })

  test("no palette's cards vanish into its canvas", () => {
    // The failure this file exists for, asked against a floor that does NOT
    // come from the ramp: `VISIBLE` is the mock's own measurement, so lowering
    // `RUNGS.top` fails here rather than passing quietly. Two numbers, because
    // "the derivation worked" and "the result can be seen" are two claims and
    // only the second one is about a reader.
    expect(
      complaints((palette) => {
        const step = stepOf(depthOf(palette), "raised")
        return step >= VISIBLE
          ? undefined
          : `a raised surface is ${step.toFixed(3)}:1 off the canvas, under ` +
            `the ${VISIBLE} a person was shown and approved`
      }),
    ).toEqual([])
  })

  test("a well sits between the ground and a floating surface", () => {
    // Furniture is recessed, so it is nearer the ground than content is — on
    // BOTH sides of the asymmetry, which is what makes one `WELL` spelling
    // serve the month in the canvas and a code fence inside the sheet.
    expect(
      complaints((palette) => {
        const depth = depthOf(palette)
        const well = stepOf(depth, "well")
        const raised = stepOf(depth, "raised")
        return well > 1 && well < raised
          ? undefined
          : `a well is ${well.toFixed(3)}:1 off the canvas and a card is ` +
            `${raised.toFixed(3)}:1`
      }),
    ).toEqual([])
  })

  test("the ramp is the same height in every palette", () => {
    // Not merely "deep enough" but EQUALLY deep: fifteen palettes with the same
    // grammar and fifteen different amounts of it would be fifteen designs. The
    // spread is float noise plus one hex step of rounding, not a decision.
    const steps = PALETTES.map((palette) => stepOf(depthOf(palette), "raised"))
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(0.05)
  })

  test("no palette's seam is a colour that means something else", () => {
    // The point of deriving a seam at all. `rule` is a value each palette wrote
    // for its own borders, and three of them wrote something that is not a line
    // colour: `robot`'s rule IS its alarm, `matcha`'s is its muted ink. Drawing
    // the app's kept lines in that value made every nesting guide and heading
    // rule on those rows read as an error or as text. So a seam may be none of
    // the palette's own signal colours, and it has to be a real step off the
    // surface it is drawn on — content, which is `raised` on either side of the
    // asymmetry.
    expect(
      complaints((palette) => {
        const depth = depthOf(palette)
        const seam = depth.surfaces.seam
        const borrowed = (["accent", "done", "doing", "alarm", "rule"] as const)
          .filter((token) => palette.colors[token].toUpperCase() === seam)
        if (borrowed.length > 0) return `its seam IS its ${borrowed.join("/")}`
        const off = contrastRatio(seam, depth.surfaces.raised)
        return off >= 1.3
          ? undefined
          : `its seam is ${off.toFixed(2)}:1 off a card, too close to be a line`
      }),
    ).toEqual([])
  })

  test("the picked state is the accent, over that palette's own card", () => {
    // Mixed against the RAISED surface rather than spelled as an opacity at each
    // site: an `accent/16` composites over whatever happens to be behind it, so
    // the same utility would be a different tint on a card, on the canvas and in
    // a well. This is the one that has to be the same tint everywhere.
    expect(
      complaints((palette) => {
        const depth = depthOf(palette)
        const towards = mixed(depth.surfaces.raised, palette.colors.accent, 1)
        return depth.surfaces.picked !== depth.surfaces.raised &&
            depth.surfaces.picked !== towards
          ? undefined
          : "the picked surface is not a tint of the accent"
      }),
    ).toEqual([])
  })
})

describe("the shadows", () => {
  test("a well is inset, and nothing else is", () => {
    // The grammar's one shape rule: a recess is told by an inner shadow and a
    // float by a cast one, so a token that mixed them would be a surface at two
    // altitudes at once. A dark palette's cards DO carry an inset — the lit top
    // edge, which is the only depth cue that survives a black ground — so the
    // claim is about the drop half.
    expect(
      complaints((palette) => {
        const shadows = depthOf(palette).shadows
        if (!shadows.well.startsWith("inset ")) return "its well is not inset"
        const floating = FLOATING.filter((token) => shadows[token].startsWith("inset "))
        return floating.length === 0
          ? undefined
          : `${floating.join(", ")} lead with an inset shadow`
      }),
    ).toEqual([])
  })

  test("a dark palette lifts with light, not with a darker shadow", () => {
    // The construction the whole hard constraint turns on. On `pitch` the canvas
    // IS `#000000`: a black shadow against it is not a subtle shadow, it is
    // nothing at all, and the one-pixel lit top edge is what says the surface
    // has come toward you.
    expect(
      complaints((palette) => {
        if (palette.scheme !== "dark") return undefined
        const shadows = depthOf(palette).shadows
        const unlit = FLOATING.filter(
          (token) => !shadows[token].includes("inset 0 1px 0 rgb(255 255 255"),
        )
        return unlit.length === 0
          ? undefined
          : `${unlit.join(", ")} have no lit top edge`
      }),
    ).toEqual([])
  })

  test("a light palette's shadow is its own ink", () => {
    // ...so a green palette casts a green-black shadow. Depth that belongs to
    // the theme rather than sitting on top of it — and the reason the values are
    // derived per palette instead of one rgba nobody can tint.
    expect(
      complaints((palette) => {
        if (palette.scheme !== "light") return undefined
        const shadows = depthOf(palette).shadows
        return SHADOW_TOKENS.every((token) =>
            shadows[token].includes("rgb(") && !shadows[token].includes("rgb(0 0 0")
          )
          ? undefined
          : "a light palette casts a neutral shadow"
      }),
    ).toEqual([])
  })
})

describe("the AA promise, on the new surfaces", () => {
  test("a palette that promises AA keeps it on every altitude", () => {
    // `contrast.test.ts` makes this claim for the eight tokens' own pairs. The
    // grammar added three grounds that body text now lands on — a tree row on
    // the canvas, a label in a well, prose on a card — so the promise has to
    // reach them or it stopped being a promise about the app the day the ramp
    // arrived.
    const promised = PALETTES.filter((palette) => palette.aa === true)
    expect(promised.length).toBeGreaterThan(0)
    const under = promised.flatMap((palette) => {
      const depth = depthOf(palette)
      return RUNG_TOKENS.flatMap((surface) =>
        (["ink", "muted"] as const).flatMap((foreground) => {
          const ratio = contrastRatio(
            palette.colors[foreground],
            depth.surfaces[surface],
          )
          return ratio >= AA
            ? []
            : [
              `${palette.name}: ${foreground} on ${surface} is ` +
              `${ratio.toFixed(2)}:1, under AA`,
            ]
        })
      )
    })
    expect(under).toEqual([])
  })
})

describe("the vocabulary", () => {
  test("every palette answers every token", () => {
    // A `Record` the compiler already checks — asserted anyway, because the
    // values are DERIVED and a derivation can answer `undefined` where a table
    // cannot: one missing branch in `depth.ts` and a palette would ship a
    // surface painted with nothing at all.
    for (const palette of PALETTES) {
      const depth = depthOf(palette)
      for (const token of SURFACE_TOKENS) {
        expect(depth.surfaces[token]).toMatch(/^#[0-9A-F]{6}$/)
      }
      for (const token of SHADOW_TOKENS) {
        expect(depth.shadows[token]).toContain("px")
      }
    }
  })
})
