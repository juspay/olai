import { expect, test } from "bun:test"

import {
  DEFAULT_FONT,
  DEFAULT_TYPEFACE,
  FONT_GROUPS,
  FONT_NAMES,
  FONT_TOKENS,
  HOSTED_FILES,
  TYPEFACES,
  typefaceNamed,
  woff2Name,
} from "./catalog.ts"

test("every typeface has a unique name, and the default is one of them", () => {
  expect(new Set(FONT_NAMES).size).toBe(FONT_NAMES.length)
  expect(typefaceNamed(DEFAULT_FONT)).toBe(DEFAULT_TYPEFACE)
  expect(DEFAULT_TYPEFACE.name).toBe(DEFAULT_FONT)
})

test("a name no row offers is undefined, not a guess", () => {
  expect(typefaceNamed("comic-sans")).toBeUndefined()
  expect(typefaceNamed("")).toBeUndefined()
})

test("every typeface answers the three tokens", () => {
  for (const face of TYPEFACES) {
    for (const token of FONT_TOKENS) {
      expect(face[token].length).toBeGreaterThan(0)
    }
  }
})

test("the groups partition the table, in table order inside each", () => {
  const grouped = FONT_GROUPS.flatMap((group) => group.faces.map((f) => f.name))
  expect([...grouped]).toEqual([...FONT_NAMES])
})

test("hosted files have unique basenames, and convert to woff2", () => {
  const files = HOSTED_FILES.map((file) => file.file)
  expect(new Set(files).size).toBe(files.length)
  for (const file of HOSTED_FILES) {
    expect(file.file).toMatch(/\.(ttf|otf)$/i)
    expect(woff2Name(file.file)).toMatch(/\.woff2$/)
    expect(file.family.length).toBeGreaterThan(0)
  }
})

test("every hosted family a typeface names is a file this app ships", () => {
  const shipped = new Set(HOSTED_FILES.map((file) => file.family))
  for (const face of TYPEFACES) {
    if (face.group !== "face" && face.name !== "olai" && face.name !== "source") {
      continue
    }
    for (const token of FONT_TOKENS) {
      const quoted = face[token].match(/^"([^"]+)"/)
      const bare = face[token].match(/^([^,]+)/)
      const family = quoted?.[1] ?? bare?.[1]
      if (family === undefined) continue
      if (
        family.startsWith("ui-") ||
        family === "system-ui" ||
        family.startsWith("-apple") ||
        family === "SFMono-Regular"
      ) {
        continue
      }
      expect(shipped.has(family)).toBe(true)
    }
  }
})
