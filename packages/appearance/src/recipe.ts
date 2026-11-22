/**
 * THE GRAMMAR the newer palette rows are written in: a hue, a polarity, a
 * depth of tint and an accent hue in, eleven colours out.
 *
 * `./palettes.ts` keeps every row as literal hex, because that file imports
 * nothing (the website build copies it alone). This module is how seven of
 * those literals were found, and `./recipe.test.ts` — its only importer —
 * holds each row that declares a `recipe` equal to what `derive` answers for
 * it. So a grammar row cannot drift from its own design one digit at a time:
 * one hue across every ground and its text, the lightness steps every row of
 * its depth shares, an accent that reads on its paper, and the status triple
 * of its polarity.
 *
 * The numbers are measured off the four hand-tuned rows, not invented: `pale`
 * is reef's ramp, the dark ramp is abyss's, `deep` is reef's steps with about
 * twice the tint, and each polarity's status triple is reef's or abyss's.
 * Everything is OKLCH, painted as a browser paints it (`./tagInk.ts`,
 * `paintedHex`) and written as upper-case `#RRGGBB`, the table's spelling.
 *
 * Pure: no observer, no DOM, no state. Numbers in, colours out.
 */

import { contrastRatio } from "./contrast.ts"
import type { Depth, PaletteToken, Scheme } from "./palettes.ts"
import { paintedHex } from "./tagInk.ts"

/** The tokens a ramp decides — every one but the accent and the statuses. */
type GroundToken = "paper" | "desk" | "panel" | "pill" | "ink" | "muted" | "rule"

/** One ramp: an OKLCH lightness and chroma per ground token, all read at the
 *  row's one hue. */
type Ramp = Readonly<Record<GroundToken, readonly [l: number, c: number]>>

/** The ramps, per polarity and depth. A closed set: by day a row is `pale` or
 *  `deep`, by night only `deep` — a dark ground carries less chroma, and a
 *  second dark depth would be hues read as one ground twice. */
export const RAMP: Readonly<Record<Scheme, Readonly<Partial<Record<Depth, Ramp>>>>> = {
  light: {
    pale: {
      paper: [0.962, 0.016],
      desk: [0.935, 0.024],
      panel: [0.981, 0.009],
      pill: [0.905, 0.032],
      ink: [0.284, 0.039],
      muted: [0.476, 0.05],
      rule: [0.855, 0.042],
    },
    deep: {
      paper: [0.948, 0.032],
      desk: [0.92, 0.04],
      panel: [0.972, 0.018],
      pill: [0.89, 0.048],
      ink: [0.27, 0.045],
      muted: [0.455, 0.055],
      rule: [0.84, 0.058],
    },
  },
  dark: {
    deep: {
      paper: [0.221, 0.034],
      desk: [0.256, 0.037],
      panel: [0.297, 0.043],
      pill: [0.343, 0.049],
      ink: [0.913, 0.029],
      muted: [0.723, 0.049],
      rule: [0.369, 0.049],
    },
  },
}

/** done / doing / alarm: one triple per polarity, as OKLCH lightness, chroma
 *  and hue — reef's by day, abyss's by night. */
export const STATUS: Readonly<
  Record<Scheme, Readonly<Record<"done" | "doing" | "alarm", readonly [l: number, c: number, h: number]>>>
> = {
  light: { done: [0.506, 0.096, 164], doing: [0.496, 0.106, 71.5], alarm: [0.544, 0.178, 17] },
  dark: { done: [0.694, 0.121, 157.6], doing: [0.74, 0.139, 90], alarm: [0.714, 0.139, 9.3] },
}

/** The accent's chroma and lightness per polarity. By day the lightness is
 *  where the search STARTS: the accent is dimmed in `ACCENT_STEP`s until it
 *  reads at `ACCENT_ON_PAPER` on its own paper. By night it is fixed — every
 *  dark ground carries it far past that line. */
export const ACCENT: Readonly<Record<Scheme, { readonly l: number; readonly c: number }>> = {
  light: { l: 0.53, c: 0.155 },
  dark: { l: 0.805, c: 0.117 },
}

/** How far a light accent's lightness drops per try. */
const ACCENT_STEP = 0.002

/** The ratio a light accent is dimmed to on its paper: AA's 4.5 with room for
 *  the accent to sit on a desk or a lit row as well. */
export const ACCENT_ON_PAPER = 5.1

/**
 * A row's eleven colours, from its hue, polarity, depth and accent hue. Hues
 * are OKLCH degrees, taken mod 360. Throws for a depth its polarity has no
 * ramp for (`pale` by night): a row that asked for one would otherwise be
 * written from a ramp nobody measured.
 */
export const derive = (
  hue: number,
  scheme: Scheme,
  depth: Depth,
  accentHue: number,
): Record<PaletteToken, string> => {
  const ramp = RAMP[scheme][depth]
  if (ramp === undefined) throw new Error(`no ${depth} ramp for a ${scheme} row`)
  const paint = (l: number, c: number, h: number): string =>
    paintedHex(l, c, ((h % 360) + 360) % 360).toUpperCase()
  const grounds = Object.fromEntries(
    Object.entries(ramp).map(([token, [l, c]]) => [token, paint(l, c, hue)]),
  ) as Record<GroundToken, string>
  const { l: accentL, c: accentC } = ACCENT[scheme]
  let accent = paint(accentL, accentC, accentHue)
  if (scheme === "light") {
    for (let step = 1; contrastRatio(accent, grounds.paper) < ACCENT_ON_PAPER; step += 1) {
      const l = accentL - step * ACCENT_STEP
      if (l <= 0) throw new Error(`no accent at hue ${accentHue} reads on paper at hue ${hue}`)
      accent = paint(l, accentC, accentHue)
    }
  }
  const { done, doing, alarm } = STATUS[scheme]
  return {
    ...grounds,
    accent,
    done: paint(...done),
    doing: paint(...doing),
    alarm: paint(...alarm),
  }
}
