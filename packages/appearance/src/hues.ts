/**
 * A colour's HUE, as arithmetic — sRGB → OKLCH, and how far apart two hues
 * and two colours are.
 *
 * The table makes a claim about how it LOOKS (`./palettes.ts`): eight cells
 * 45° apart, every 60° sector carrying a colour in both polarities, accents
 * that never repeat a note. A claim about looking cannot be checked in HSL —
 * the wheel is not there: yellows crowd into a few degrees and cyans stretch
 * over thirty — so it is checked in OKLCH, the perceptual space this app
 * already renders its tag ink through. `./tagInk.ts` maps the other way (an
 * `oklch()` to the sRGB a browser paints); these are the same Ottosson
 * matrices read backwards, and `./palettes.test.ts` is the only caller.
 *
 * Pure: no observer, no DOM, no theme. A colour in, a number out.
 */

/** A colour, as OKLCH: lightness 0–1, chroma (0 is grey), hue in degrees. */
export interface Oklch {
  readonly l: number
  readonly c: number
  readonly h: number
}

/** One sRGB channel, linearised. */
const channel = (unit: number): number =>
  unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4

/** `#RRGGBB` → OKLCH. Throws on anything else, for the same reason
 *  `./contrast.ts` does: a value that is not a colour cannot be measured,
 *  and a silent `NaN` would read as a hue that passes every test. */
export const oklchOf = (hex: string): Oklch => {
  const match = /^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/.exec(hex)
  if (match?.[1] === undefined) throw new Error(`not a #RRGGBB colour: ${hex}`)
  const digits = match[1]
  const [r, g, b] = [0, 2, 4].map((at) =>
    channel(Number.parseInt(digits.slice(at, at + 2), 16) / 255),
  ) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const hue = (Math.atan2(bb, a) * 180) / Math.PI
  return { l: lightness, c: Math.hypot(a, bb), h: hue < 0 ? hue + 360 : hue }
}

/** Where a colour sits on the wheel, in degrees. Meaningless for a grey —
 *  a colour with no chroma has no hue, and the caller must say what it wants
 *  there rather than read a number out of the noise of its rounding. */
export const hueOf = (hex: string): number => oklchOf(hex).h

/** The shorter way round the wheel between two hues, 0–180. */
export const hueGap = (one: number, other: number): number => {
  const raw = Math.abs(one - other) % 360
  return Math.min(raw, 360 - raw)
}

/** How far apart two colours are: the distance between them in OKLab, where
 *  a just-noticeable difference is about 0.02. Lightness, chroma and hue all
 *  move it, which is the point — two accents 40° apart but at one lightness
 *  and one chroma are closer than two 20° apart that are not. */
export const colourGap = (one: string, other: string): number => {
  const a = oklchOf(one)
  const b = oklchOf(other)
  const turn = (lch: Oklch): [number, number, number] => [
    lch.l,
    lch.c * Math.cos((lch.h * Math.PI) / 180),
    lch.c * Math.sin((lch.h * Math.PI) / 180),
  ]
  const [l1, a1, b1] = turn(a)
  const [l2, a2, b2] = turn(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}
