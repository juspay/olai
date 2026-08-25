import { describe, expect, test } from "bun:test"

import { AA, contrastRatio } from "./contrast.ts"
import { PALETTES } from "./palettes.ts"
import { TAG_HUE_PROPERTY, TAG_INK, tagHue, tagInkHex, tagStyle } from "./tagInk.ts"

describe("the hue a tag is handed", () => {
  test("one input, one hue — every time", () => {
    expect(tagHue("#now")).toBe(tagHue("#now"))
    expect(tagHue("@alice")).toBe(tagHue("@alice"))
    expect(tagHue("#work/olai")).toBe(tagHue("#work/olai"))
  })

  test("it is on the wheel", () => {
    for (const hue of ["#now", "#home", "@alice", "#work/olai", "#a", "#z-9"]
      .map(tagHue)) {
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
      expect(Number.isInteger(hue)).toBe(true)
    }
  })

  test("case folds: `#Now` and `#now` are one tag, one hue", () => {
    // The promise a colour can keep: the search fold and the index already
    // read casing apart as the same tag (`filter.ts`), so the ink may not
    // tell them apart.
    expect(tagHue("#Now")).toBe(tagHue("#now"))
    expect(tagHue("#NOW")).toBe(tagHue("#now"))
    expect(tagHue("@MiXeD")).toBe(tagHue("@mixed"))
  })

  test("the sigil is in the string: `#alice` and `@alice` are two tags", () => {
    // docs/format.md: two namespaces, two tags — so the hue never claims the
    // sameness the format refuses. (This is one assertion about THIS pair,
    // not a claim that no two tags share a hue: collisions are accepted at
    // real vocabulary sizes.)
    expect(tagHue("#alice")).not.toBe(tagHue("@alice"))
  })

  test("the pill carries the hue the sheet reads", () => {
    expect(tagStyle("#now")).toBe(`${TAG_HUE_PROPERTY}: ${tagHue("#now")}`
    )
    expect(tagStyle("#now")).toMatch(/^--tag-hue: [0-9]{1,3}$/)
  })

  test("the gold samples are THE hash", () => {
    // Hash change that still spreads and case-folds would leave the
    // contract standing but the vocabulary remapped — a remap no reader
    // asked for. The wheel itself is the map's stable fact, so these five
    // PIN it: a change of hash trips here, on the same day the faces' tests
    // would still find tags spread and signed.
    expect(tagHue("#now")).toBe(119)
    expect(tagHue("#home")).toBe(216)
    expect(tagHue("@bob")).toBe(46)
    expect(tagHue("@alice")).toBe(193)
    expect(tagHue("#alice")).toBe(315)
  })

  test("neighbours spread apart", () => {
    // Two tags one code point apart, which is what a real vocabulary is —
    // `#a`/`#b`, `#errand`/`#errands` — must not sit NEXT to each other on
    // the wheel, or a row carrying both reads as one mark again.
    const degrees = (one: string, other: string): number => {
      const raw = Math.abs(tagHue(one) - tagHue(other))
      return Math.min(raw, 360 - raw)
    }
    expect(degrees("#a", "#b")).toBeGreaterThan(20)
    expect(degrees("#errand", "#errands")).toBeGreaterThan(20)
    expect(degrees("#home", "#homes")).toBeGreaterThan(20)
  })

  test("a real vocabulary covers the wheel", () => {
    // Names the fixture vaults and the lab notes actually use. The claim is
    // SPREAD, not uniqueness: no slice of the wheel may be empty enough to
    // let a page full of tags collapse back into looking like one colour.
    const vocabulary = [
      "now", "home", "work", "errand", "review", "bug", "chore", "idea",
      "reading", "household", "school", "garden", "kitchen", "outdoors",
      "later", "someday", "today", "week", "month", "year", "a", "b", "c", "z",
    ]
    const hues = new Set(vocabulary.map((name) => tagHue(`#${name}`)))
    // Every 60° sector holds at least one: a palette of one sector is the
    // smearing this shipped to remove.
    for (let sector = 0; sector < 6; sector += 1) {
      const inside = [...hues].filter(
        (hue) => hue >= sector * 60 && hue < (sector + 1) * 60,
      )
      expect(inside.length).toBeGreaterThan(0)
    }
    // And the spaces BETWEEN landings stay bounded: no gap between two
    // nearest hues wider than 90°.
    const ordered = [...hues].sort((one, other) => one - other)
    let widest = 0
    for (let at = 0; at < ordered.length; at += 1) {
      const here = ordered[at] as number
      const next = (ordered[(at + 1) % ordered.length] as number) +
        (at + 1 === ordered.length ? 360 : 0)
      widest = Math.max(widest, next - here)
    }
    expect(widest).toBeLessThanOrEqual(90)
  })
})

describe("the ink is legible everywhere a title can sit", () => {
  test("the rendered colours are inside sRGB", () => {
    // The bound below is computed from these: a hex that cannot be written is
    // a ratio that means nothing.
    for (const scheme of ["light", "dark"] as const) {
      for (const hue of [0, 90, 180, 270, 359]) {
        expect(tagInkHex(scheme, hue)).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  test("the mapping the test grades is the mapping the sheet paints", () => {
    // gamut-mapped, not raw-oklch-to-clamped: a spot check against colours
    // pinned by hand from the conversion, so a drift in the arithmetic fails
    // here rather than mis-grading the bound.
    expect(tagInkHex("light", tagHue("#now"))).toMatch(/^#[0-9a-f]{6}$/)
  })

  test("every hue clears AA on every palette's paper and panel", () => {
    // The two grounds a title is drawn on: the outline sheet, and the
    // popovers (⌘K palette, the header's box, the row's `((` and `#`
    // widgets). Dark and light alike; measured, not eyeballed.
    const under: Array<string> = []
    for (const palette of PALETTES) {
      const ink = TAG_INK[palette.scheme]
      for (let hue = 0; hue < 360; hue += 1) {
        for (const ground of ["paper", "panel"] as const) {
          const ratio = contrastRatio(
            tagInkHex(palette.scheme, hue),
            palette.colors[ground],
          )
          if (ratio < AA) {
            under.push(
              `${palette.name} (${ink.l}/${ink.c}): hue ${hue} on ${ground} ` +
                `is ${ratio.toFixed(2)}:1, under AA`,
            )
          }
        }
      }
    }
    expect(under).toEqual([])
  })
})
