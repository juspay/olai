/**
 * WCAG contrast, as arithmetic.
 *
 * A palette can claim it clears AA (`palettes.ts`, `aa`). That is a claim
 * about pairs of its own values, so it is checkable without a browser, and
 * `./contrast.test.ts` is what checks it — a colour nudged by two digits is
 * exactly the edit that quietly drops a pair under the line.
 *
 * sRGB relative luminance, as the spec defines it. Nothing here knows about a
 * theme: it is handed two colours and answers a number.
 */

import type { PaletteToken } from "./palettes.ts"

/** The pairs this client actually paints — a foreground, and the background it
 *  lands on. Not every pair the eight tokens could make: `muted` is never read
 *  on `rule`, and holding a palette to a combination no component draws would
 *  be rejecting a colour over a page that does not exist.
 *
 *  Each is a real site: body text and every accent read on the paper
 *  (`text-muted`, `text-alarm`, a link); `text-paper` on the sidebar entry in
 *  force and on the day being read (`bg-accent`, `bg-ink`); `text-ink` over
 *  the surface a row lights up with (`hover:bg-rule`). */
export const CONTRAST_PAIRS: ReadonlyArray<
  readonly [PaletteToken, PaletteToken]
> = [
  ["ink", "paper"],
  ["muted", "paper"],
  ["accent", "paper"],
  ["done", "paper"],
  ["doing", "paper"],
  ["alarm", "paper"],
  ["paper", "accent"],
  ["paper", "ink"],
  ["ink", "rule"],
]

/** The AA line for body text. */
export const AA = 4.5

/** The six hex digits of `#RRGGBB` — or of `#RRGGBBAA`, whose alpha this
 *  drops, because a translucent value's contrast depends on what is behind it
 *  and no palette that makes the AA claim uses one.
 *
 *  Throws on anything else: a value that is not a colour cannot be compared to
 *  one, and a silent `NaN` would read as a passing ratio. */
const hexDigits = (hex: string): string => {
  const match = /^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/.exec(hex)
  if (match?.[1] === undefined) throw new Error(`not a #RRGGBB colour: ${hex}`)
  return match[1]
}

/** One channel of a colour, linearised. */
const channel = (digits: string, at: number): number => {
  const unit = Number.parseInt(digits.slice(at, at + 2), 16) / 255
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

/** sRGB relative luminance: 0 for black, 1 for white. */
export const relativeLuminance = (hex: string): number => {
  const digits = hexDigits(hex)
  return (
    0.2126 * channel(digits, 0) +
    0.7152 * channel(digits, 2) +
    0.0722 * channel(digits, 4)
  )
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
