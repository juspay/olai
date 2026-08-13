/**
 * WCAG contrast, as arithmetic.
 *
 * A palette can claim it clears AA (`palettes.ts`, `aa`). That is a claim
 * about pairs of its own values, so it is checkable without a browser, and
 * `./contrast.test.ts` is what checks it — a colour nudged by two digits is
 * exactly the edit that quietly drops a pair under the line.
 *
 * sRGB relative luminance, as the spec defines it. Nothing here knows about a
 * theme, or about this app: it is handed two colours and answers a number.
 * WHICH pairs olai paints is a claim about components and lives with the test
 * that makes it.
 *
 * It is read for a second thing now, and it is the same arithmetic: `./depth.ts`
 * derives the altitude ramp by climbing until a surface is a stated ratio away
 * from the ground it sits on. A step in luminance is what "raised" MEANS on a
 * screen, in either direction, which is why one number serves both a legibility
 * floor and a depth cue.
 */

import { channelsOf } from "./hex.ts"

/** The AA line for body text. */
export const AA = 4.5

/** One channel of a colour, linearised. */
const linear = (value: number): number => {
  const unit = value / 255
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

/** sRGB relative luminance: 0 for black, 1 for white. The parsing is
 *  `./hex.ts`'s — including its refusal of anything that is not a colour, and
 *  its dropping of an alpha, which a ratio could not account for anyway. */
export const relativeLuminance = (hex: string): number => {
  const { red, green, blue } = channelsOf(hex)
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
}

/** How far apart two colours are, as the ratio WCAG states its lines in: 1
 *  (identical) to 21 (black on white). Symmetric, so naming the arguments
 *  foreground and background is documentation rather than arithmetic. */
export const contrastRatio = (
  foreground: string,
  background: string,
): number => {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
