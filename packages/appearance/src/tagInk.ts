/**
 * A tag's INK: one hue per tag, saturation and lightness from the theme.
 *
 * The ruling (the human, 2026-08-24): every tag wears its own stable colour —
 * one tag reads the same wherever a title draws it (a tree row, a breadcrumb,
 * a palette row), and two different tags separate at a glance. Today every
 * pill is one quiet grey, which is the quiet outline taken one tag list too
 * far: `#now #home` on one row is one grey smear.
 *
 * The split of the answer is the theme's ruling about tokens read backward:
 * the tag decides its HUE, the palette decides its LIGHTNESS AND CHROMA. A hue
 * is a fact about the TEXT — `#now` is `#now` in reef and in aurora — while a
 * lightness is a fact about the GROUND it is read on, and the palette table
 * (`./palettes.ts`) is the only place this client decides grounds. So the hue
 * arrives on the pill as a number and the `--tag-ink-l` / `--tag-ink-c` that
 * temper it ride the palette blocks `./css.ts` generates: same tag, same hue,
 * legible both ways, and no per-tag tables per theme anywhere.
 *
 * ## The hue: which text, hashed how
 *
 * The text is the tag AS WRITTEN, FOLDED — `#Now` and `#now` are one hue,
 * because the index and the search fold already read them as one tag
 * (`@olai/format`'s `filter.ts`: a tag is indexed case-folded) and a colour
 * that told them apart would mark a sameness the product does not have. The
 * SIGIL stays in the string — `#alice` and `@alice` are different tags
 * (docs/format.md says they name two namespaces), so they hash as two: colour
 * separates members of a namespace, the sigil character itself separates the
 * namespaces. Sharing a hash space was the alternative; it would have drawn
 * two different tags in one hue, claiming a sameness nothing else claims.
 *
 * The hash is FNV-1a with an fmix32 avalanche, mod 360. FNV alone leaves
 * consecutive short strings (`#a`, `#b`, …) in consecutive high bits, which a
 * `* 360 / 2^32` map then places adjacent on the wheel; the avalanche says
 * nearby strings land apart. COLLISIONS ARE FINE at real vocabulary sizes —
 * there is no collision avoidance here, and building one would need the whole
 * set's vocabulary at view time. Spreading, not uniqueness, is the promise.
 * `./tagInk.test.ts` holds all three halves: the fold, the sigil, the spread.
 *
 * ## The contrast bound
 *
 * Every hue clears WCAG AA (4.5:1) on every palette's `paper` and `panel` —
 * the two grounds a title is ever drawn on (the outline sheet, and the
 * popovers: palette, header box, the row widgets) — light schemes and dark
 * alike, and this is MEASURED, not eyeballed: `./tagInk.test.ts` walks all
 * 360 hues against the table, computing the rendered sRGB the same way the
 * browser does for out-of-gamut `oklch()` (css-color-4's chroma reduction,
 * below). The bound is on paper/panel alone: the pick of a row
 * (`bg-rule/60`+) is a wash between the two, and where a tag is pressed it
 * goes accent (`../markdown/tags.ts`) anyway — the affordance overrides the
 * identity exactly while the pointing happens.
 */

/**
 * The lightness and chroma a tag's ink rides at, per scheme — declared onto
 * the palette blocks by `./css.ts`, read by `../styles.css`'s `.olai-tag`
 * rule, and held to AA on every paper and panel by `./tagInk.test.ts`. The
 * three have to move together, so they live in one place.
 *
 * How the numbers were found is worth keeping with them, because they are a
 * cliff and not a hill: contrast against WHITE-ish paper fails the warm hues
 * first at high L (yellow washes out into it), and against yellow-white panel
 * (`manuscript`) at low chroma in dark schemes the pink tail goes first —
 * 0.42/0.12 and 0.74/0.15 are the shoulders of those two cliffs, measurably
 * (worst pair in the table is 5.4:1, so a future palette has 0.9 of headroom
 * before anything here has to move).
 */
export const TAG_INK = {
  light: { l: 0.42, c: 0.12 },
  dark: { l: 0.74, c: 0.15 },
} as const

/** The custom property the pill hands the hue over on — the ONE spelling of
 *  it, so the stylesheet and the markup cannot spell it apart. */
export const TAG_HUE_PROPERTY = "--tag-hue"

/**
 * The hue of WRITTEN form of a tag, folded: a number in [0, 360), stable —
 * one input, one hue, on every face that draws it.
 *
 * Exported rather than folded into {@link tagStyle} because the story of a
 * tag's ink is told in degrees, and the test of the mapping is about degrees.
 */
export const tagHue = (written: string): number => {
  const folded = written.toLowerCase()
  let hash = 0x811c9dc5 // FNV-1a, 32-bit offset basis
  for (let at = 0; at < folded.length; at += 1) {
    hash ^= folded.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return fmix32(hash) % 360
}

/** The whole of what a pill asks for: the hue, as the one custom property the
 *  stylesheet's `.olai-tag` rule reads. The value is an integer — a string
 *  that can carry no quote — so this may sit in an attribute unescaped, which
 *  is the contract `../markdown/tags.ts` keeps about `data-tag` as well. */
export const tagStyle = (written: string): string =>
  `${TAG_HUE_PROPERTY}: ${tagHue(written)}`

/** fmix32 — the murmur3 avalanche finalizer, public domain. The difference
 *  between FNV's high bits and useful ones: after it, two inputs one code
 *  point apart land anywhere on the wheel with even odds. */
const fmix32 = (input: number): number => {
  let h = input >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

// ── oklch → sRGB, for the test's "what the browser paints" ──────────
//
// The sheet writes `oklch(l c h)`; the BOUND is stated in WCAG ratios, which
// are sRGB luminances. Browsers bring an out-of-gamut oklch colour into sRGB
// by css-color-4's gamut mapping — reduce C at fixed L and H, or clip when
// already within a just-noticeable difference of the wall — so that is what
// is computed here. A ratio computed WITHOUT the mapping would be grading a
// colour nobody is shown.

/** OKLCH → linear sRGB — Ottosson's matrices, both ways. */
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

/** css-color-4's just-noticeable difference, as the spec names it. */
const JND = 0.02

/**
 * The rendered colour of an `oklch(l c h)` the sheet could write, including
 * the browser's own gamut mapping (css-color-4 §13.2's LOCAL MINDE): if it is
 * out of gamut, clip when that is within a JND of exact, else walk the chroma
 * down to the wall keeping L and H. `tagInkHex` is the only caller, and the
 * only reason it exists is so the AA claim is computed over what is PAINTED
 * rather than over the declared colour.
 */
export const oklchPaintedInSrgb = (
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

/**
 * One tag's ink as it lands on screen, for `./tagInk.test.ts`'s bound — what
 * `var(--tag-l) var(--tag-c) <hue>` paints, as `#RRGGBB` for `contrast.ts`'s
 * arithmetic. Both schemes are exported through the one table above: the test
 * grades each palette against the pair ITS scheme uses.
 */
export const tagInkHex = (
  scheme: "light" | "dark",
  hue: number,
): string => {
  const ink = TAG_INK[scheme]
  return (
    "#" +
    oklchPaintedInSrgb(ink.l, ink.c, hue)
      .map((channel) => Math.round(gamma(channel) * 255).toString(16).padStart(2, "0"))
      .join("")
  )
}
