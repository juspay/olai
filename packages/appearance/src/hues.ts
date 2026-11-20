export interface Oklch {
  readonly l: number
  readonly c: number
  readonly h: number
}

const DEGREES_PER_RADIAN = 180 / Math.PI

const channel = (unit: number): number =>
  unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4

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
  const hue = Math.atan2(bb, a) * DEGREES_PER_RADIAN
  return { l: lightness, c: Math.hypot(a, bb), h: hue < 0 ? hue + 360 : hue }
}

export const hueOf = (hex: string): number => oklchOf(hex).h

export const hueGap = (one: number, other: number): number => {
  const raw = Math.abs(one - other) % 360
  return Math.min(raw, 360 - raw)
}

export const colourGap = (one: string, other: string): number => {
  const a = oklchOf(one)
  const b = oklchOf(other)
  const turn = (lch: Oklch): [number, number, number] => [
    lch.l,
    lch.c * Math.cos(lch.h / DEGREES_PER_RADIAN),
    lch.c * Math.sin(lch.h / DEGREES_PER_RADIAN),
  ]
  const [l1, a1, b1] = turn(a)
  const [l2, a2, b2] = turn(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}
