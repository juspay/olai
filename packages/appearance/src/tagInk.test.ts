import { describe, expect, test } from "bun:test"

import { AA, contrastRatio } from "./contrast.ts"
import { PALETTES } from "./palettes.ts"
import { TAG_HUE_PROPERTY, TAG_INK, tagHue, tagInkHex, tagStyle } from "./tagInk.ts"

describe("the hue a tag is handed", () => {
  test("it is on the wheel", () => {
    for (const hue of ["#now", "#home", "@alice", "#work/olai", "#a", "#z-9"]
      .map(tagHue)) {
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
      expect(Number.isInteger(hue)).toBe(true)
    }
  })

  test("case folds: `#Now` and `#now` are one tag, one hue", () => {
    expect(tagHue("#Now")).toBe(tagHue("#now"))
    expect(tagHue("#NOW")).toBe(tagHue("#now"))
    expect(tagHue("@MiXeD")).toBe(tagHue("@mixed"))
  })

  test("the sigil is in the string: `#alice` and `@alice` are two tags", () => {
    expect(tagHue("#alice")).not.toBe(tagHue("@alice"))
  })

  test("the pill carries the hue the sheet reads", () => {
    expect(tagStyle("#now")).toBe(`${TAG_HUE_PROPERTY}: ${tagHue("#now")}`
    )
    expect(tagStyle("#now")).toMatch(/^--tag-hue: [0-9]{1,3}$/)
  })

  test("the gold samples are THE hash", () => {
    expect(tagHue("#now")).toBe(119)
    expect(tagHue("#home")).toBe(216)
    expect(tagHue("@bob")).toBe(46)
    expect(tagHue("@alice")).toBe(193)
    expect(tagHue("#alice")).toBe(315)
  })

  test("neighbours spread apart", () => {
    const degrees = (one: string, other: string): number => {
      const raw = Math.abs(tagHue(one) - tagHue(other))
      return Math.min(raw, 360 - raw)
    }
    expect(degrees("#a", "#b")).toBeGreaterThan(20)
    expect(degrees("#errand", "#errands")).toBeGreaterThan(20)
    expect(degrees("#home", "#homes")).toBeGreaterThan(20)
  })

  test("a real vocabulary covers the wheel", () => {
    const vocabulary = [
      "now", "home", "work", "errand", "review", "bug", "chore", "idea",
      "reading", "household", "school", "garden", "kitchen", "outdoors",
      "later", "someday", "today", "week", "month", "year", "a", "b", "c", "z",
    ]
    const hues = new Set(vocabulary.map((name) => tagHue(`#${name}`)))
    for (let sector = 0; sector < 6; sector += 1) {
      const inside = [...hues].filter(
        (hue) => hue >= sector * 60 && hue < (sector + 1) * 60,
      )
      expect(inside.length).toBeGreaterThan(0)
    }
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
    for (const scheme of ["light", "dark"] as const) {
      for (const hue of [0, 90, 180, 270, 359]) {
        expect(tagInkHex(scheme, hue)).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  test("the mapping the test grades is the mapping the sheet paints", () => {
    expect(tagInkHex("light", tagHue("#now"))).toMatch(/^#[0-9a-f]{6}$/)
  })

  test("every hue clears AA on every palette's paper and panel", () => {
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
