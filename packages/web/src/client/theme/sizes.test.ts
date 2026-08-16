import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  DEFAULT_SIZE,
  DEFAULT_TYPE_SIZE,
  SIZE_ATTRIBUTE,
  SIZE_STORAGE_KEY,
  SIZES,
  sizeCss,
  sizeNamed,
} from "./sizes.ts"

test("the default names a row of the table", () => {
  expect(sizeNamed(DEFAULT_SIZE)).toBe(DEFAULT_TYPE_SIZE)
  expect(DEFAULT_TYPE_SIZE.name).toBe(DEFAULT_SIZE)
})

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

// The bare `:root` is what a page that has picked NOTHING matches, so exactly
// one size may claim it — and it has to be the default, or a fresh browser
// would paint at one size while the panel said another.
test("the bare :root belongs to the default and to nothing else", () => {
  const bare = sizeCss()
    .split("\n\n")
    .filter((block) => block.startsWith(":root,"))
  expect(bare).toHaveLength(1)
  expect(bare[0]).toContain(`:root[${SIZE_ATTRIBUTE}="${DEFAULT_SIZE}"]`)
})

// The sizes are three multiples of the reader's OWN baseline, which is the
// accessibility half of putting this on `:root` at all: `rem` on the root
// element means the initial font size, so a reader who has set 20px in their
// browser gets 20 / 22.5 / 25 rather than being overridden to our pixels.
test("every size is a multiple of the reader's baseline, never a pixel count", () => {
  for (const size of SIZES) expect(size.root).toMatch(/^[\d.]+rem$/)
})

// The shell's boot script writes this attribute from this key before any module
// exists (`index.html`), so it cannot import either name — which is exactly the
// kind of contract that breaks silently. This is what makes a rename fail here
// instead of as a flash of the wrong size on every load.
test("the boot script writes this key onto this attribute", () => {
  const shell = readFileSync(join(import.meta.dir, "..", "index.html"), "utf8")
  expect(shell).toContain(`localStorage.getItem("${SIZE_STORAGE_KEY}")`)
  expect(shell).toContain(`setAttribute("${SIZE_ATTRIBUTE}"`)
})
