/**
 * The file table, and the one thing it and `./typefaces.ts` owe each other:
 * a family a pick QUOTES has to be a family this app ships a file for. The
 * two tables are apart (`hosted.ts` says why) and that promise is the seam
 * between them, so it is checked here rather than remembered.
 */

import { expect, test } from "bun:test"

import { HOSTED_FILES, woff2Name } from "./hosted.ts"
import { FONT_TOKENS, TYPEFACES } from "./typefaces.ts"

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
