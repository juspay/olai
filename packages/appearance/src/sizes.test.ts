import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  DEFAULT_SIZE,
  SIZE_ATTRIBUTE,
  SIZE_STORAGE_KEY,
  SIZES,
  sizeCss,
  sizeNamed,
} from "./sizes.ts"

test("a name no row offers is nobody's size", () => {
  expect(sizeNamed("huge")).toBeUndefined()
  expect(sizeNamed(null)).toBeUndefined()
})

test("every size gets a block, keyed on its own name", () => {
  const css = sizeCss()
  for (const size of SIZES) {
    expect(css).toContain(`:root[${SIZE_ATTRIBUTE}="${size.name}"]`)
    expect(css).toContain(`font-size: ${size.root};`)
  }
})

test("the bare :root belongs to the default and to nothing else", () => {
  const bare = sizeCss()
    .split("\n\n")
    .filter((block) => block.startsWith(":root,"))
  expect(bare).toHaveLength(1)
  expect(bare[0]).toContain(`:root[${SIZE_ATTRIBUTE}="${DEFAULT_SIZE}"]`)
})

test("every size is a multiple of the reader's baseline, never a pixel count", () => {
  for (const size of SIZES) expect(size.root).toMatch(/^[\d.]+rem$/)
})

test("the boot script writes this key onto this attribute", () => {
  const shell = readFileSync(join(import.meta.dir, "..", "..", "plugins", "theme", "src", "head.html"), "utf8")
  expect(shell).toContain(`localStorage.getItem("${SIZE_STORAGE_KEY}")`)
  expect(shell).toContain(`setAttribute("${SIZE_ATTRIBUTE}"`)
})
