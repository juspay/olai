/**
 * A colour, as the three numbers a `#RRGGBB` stands for — and the two things
 * this directory does with them: MIX two, and read one's luminance.
 *
 * Its own file because two callers already want it and they want different
 * halves. `./contrast.ts` linearises the channels to answer a WCAG ratio;
 * `./depth.ts` mixes a palette's paper toward its ink to derive the altitude
 * ramp. Both are arithmetic on a hex and neither is about the other, so the
 * parsing lives once, here, and a value that is not a colour is refused in one
 * place rather than in two.
 *
 * sRGB, and no colour space beyond it. `color-mix(in oklab, …)` would be the
 * nicer blend, but every value this produces is written into the generated
 * stylesheet as a LITERAL — which is the whole point of deriving them in
 * TypeScript: what fifteen palettes get for depth is a fact a unit test can
 * hold them to (`./depth.test.ts`), not a computation a browser may or may not
 * support.
 */

/** A colour's three channels, 0–255. */
export interface Channels {
  readonly red: number
  readonly green: number
  readonly blue: number
}

/**
 * The three channels of `#RRGGBB` — or of `#RRGGBBAA`, whose alpha this DROPS,
 * because what a translucent value looks like depends on what is behind it and
 * neither caller has anything behind it to ask about. (`chocolate`'s rule is
 * the one such value in the table, and it is theirs.)
 *
 * Throws on anything else. A value that is not a colour cannot be mixed with
 * one or compared to one, and a silent `NaN` would read as a passing ratio.
 */
export const channelsOf = (hex: string): Channels => {
  const match = /^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/.exec(hex)
  if (match?.[1] === undefined) throw new Error(`not a #RRGGBB colour: ${hex}`)
  const digits = match[1]
  const at = (index: number): number =>
    Number.parseInt(digits.slice(index, index + 2), 16)
  return { red: at(0), green: at(2), blue: at(4) }
}

/** …and back, as the six upper-case digits the palette table is written in.
 *
 *  The leading zero is a comparison and not `padStart(2, "0")`, and that is
 *  deliberate rather than fussy: `packages/tests` injects a fault into exactly
 *  that call to prove the client's error boundary catches a thrown render, and
 *  this function is reached from the theme boot — which runs OUTSIDE that
 *  boundary, so borrowing the same call would turn its scenario from "the card
 *  is drawn" into "the bundle died". Two lines of arithmetic is a cheaper answer
 *  than a test that has to know about this file. */
export const hexOf = (channels: Channels): string => {
  const digit = (value: number): string => {
    const byte = Math.round(Math.min(255, Math.max(0, value)))
    return `${byte < 16 ? "0" : ""}${byte.toString(16).toUpperCase()}`
  }
  return `#${digit(channels.red)}${digit(channels.green)}${digit(channels.blue)}`
}

/** `from`, moved `ratio` of the way to `toward`: 0 is `from` itself, 1 is
 *  `toward`. Channel-wise in sRGB, which is what a browser's own
 *  `color-mix(in srgb, …)` does. */
export const mixed = (from: string, toward: string, ratio: number): string => {
  const a = channelsOf(from)
  const b = channelsOf(toward)
  const step = (one: number, other: number): number => one + (other - one) * ratio
  return hexOf({
    red: step(a.red, b.red),
    green: step(a.green, b.green),
    blue: step(a.blue, b.blue),
  })
}

/** A colour as the `rgb(… / …)` a shadow is written with. Kept here beside the
 *  parsing, because it is the same fact about a hex read out a third way — and
 *  the shadows in `./depth.ts` are the only place this app writes a translucent
 *  colour by hand. */
export const translucent = (hex: string, alpha: number): string => {
  const { red, green, blue } = channelsOf(hex)
  return `rgb(${red} ${green} ${blue} / ${alpha})`
}
