export const TAG_INK = {
  light: { l: 0.42, c: 0.12 },
  dark: { l: 0.74, c: 0.15 },
} as const

export const TAG_HUE_PROPERTY = "--tag-hue"

export const tagHue = (written: string): number => {
  const folded = written.toLowerCase()
  let hash = 0x811c9dc5
  for (let at = 0; at < folded.length; at += 1) {
    hash ^= folded.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return fmix32(hash) % 360
}

export const tagStyle = (written: string): string =>
  `${TAG_HUE_PROPERTY}: ${tagHue(written)}`

const fmix32 = (input: number): number => {
  let h = input >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

const oklchToLinearSrgb = (
  l: number,
  c: number,
  h: number,
): [number, number, number] => {
  const turn = (h * Math.PI) / 180
  const a = c * Math.cos(turn)
  const b = c * Math.sin(turn)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const l3 = l_ ** 3
  const m3 = m_ ** 3
  const s3 = s_ ** 3
  return [
    +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
}

const linearSrgbToOklab = (
  r: number,
  g: number,
  b: number,
): [number, number, number] => {
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ]
}

const oklabOfLch = (l: number, c: number, h: number): [number, number, number] => {
  const turn = (h * Math.PI) / 180
  return [l, c * Math.cos(turn), c * Math.sin(turn)]
}

const deltaEOK = (
  one: [number, number, number],
  other: [number, number, number],
): number =>
  Math.hypot(one[0] - other[0], one[1] - other[1], one[2] - other[2])

const clipSrgb = (rgb: [number, number, number]): [number, number, number] =>
  rgb.map((channel) => Math.min(1, Math.max(0, channel))) as [
    number,
    number,
    number,
  ]

const inSrgb = (rgb: [number, number, number]): boolean =>
  rgb.every((channel) => channel >= 0 && channel <= 1)

export type SrgbFromOklch = (
  l: number,
  c: number,
  h: number,
) => [number, number, number]

export const oklchClippedToSrgb: SrgbFromOklch = (l, c, h) =>
  clipSrgb(oklchToLinearSrgb(l, c, h))

const JND = 0.02

export const oklchChromaReducedToSrgb = (
  l: number,
  c: number,
  h: number,
): [number, number, number] => {
  if (l >= 1) return [1, 1, 1]
  if (l <= 0) return [0, 0, 0]
  const straight = oklchToLinearSrgb(l, c, h)
  if (inSrgb(straight)) return straight
  const clipped = clipSrgb(straight)
  if (deltaEOK(linearSrgbToOklab(...clipped), oklabOfLch(l, c, h)) < JND) {
    return clipped
  }
  let low = 0
  let high = c
  let painted = clipped
  while (high - low > 0.0001) {
    const middle = (low + high) / 2
    const candidate = oklchToLinearSrgb(l, middle, h)
    if (
      !inSrgb(candidate) &&
      deltaEOK(linearSrgbToOklab(...clipSrgb(candidate)), oklabOfLch(l, middle, h)) > JND
    ) {
      high = middle
    } else {
      low = middle
      painted = clipSrgb(candidate)
    }
  }
  return painted
}

const gamma = (channel: number): number =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055

export const tagInkHex = (
  scheme: "light" | "dark",
  hue: number,
  toSrgb: SrgbFromOklch,
): string => {
  const ink = TAG_INK[scheme]
  return (
    "#" +
    toSrgb(ink.l, ink.c, hue)
      .map((channel) => Math.round(gamma(channel) * 255).toString(16).padStart(2, "0"))
      .join("")
  )
}
