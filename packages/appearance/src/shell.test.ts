import { expect, test } from "bun:test"
import { runInNewContext } from "node:vm"

import { FONT_ATTRIBUTE, FONT_STORAGE_KEY } from "@olai/fonts"

import {
  DEFAULT_DARK_THEME,
  DEFAULT_THEME,
  SYSTEM_SCHEME,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from "./palettes.ts"
import { bootScript, CANVAS_SELECTOR } from "./shell.ts"
import { SIZE_ATTRIBUTE, SIZE_STORAGE_KEY } from "./sizes.ts"

const firstPaint = (
  stored: Readonly<Record<string, string>>,
): { attributes: Record<string, string>; canvas: string } => {
  const attributes = new Map<string, string>()
  const canvas = { content: SYSTEM_SCHEME }
  runInNewContext(bootScript(), {
    localStorage: { getItem: (key: string) => stored[key] ?? null },
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => attributes.set(name, value),
      },
      querySelector: (selector: string) => (selector === CANVAS_SELECTOR ? canvas : null),
    },
  })
  return { attributes: Object.fromEntries(attributes), canvas: canvas.content }
}

test("every stored choice is on the page, and the canvas is in the pick's scheme", () => {
  const painted = firstPaint({
    [THEME_STORAGE_KEY]: DEFAULT_DARK_THEME,
    [FONT_STORAGE_KEY]: "system",
    [SIZE_STORAGE_KEY]: "larger",
  })
  expect(painted.attributes).toEqual({
    [THEME_ATTRIBUTE]: DEFAULT_DARK_THEME,
    [FONT_ATTRIBUTE]: "system",
    [SIZE_ATTRIBUTE]: "larger",
  })
  expect(painted.canvas).toBe("dark")
  expect(firstPaint({ [THEME_STORAGE_KEY]: DEFAULT_THEME }).canvas).toBe("light")
})

test("a theme no row offers leaves the browser following the system", () => {
  const painted = firstPaint({ [THEME_STORAGE_KEY]: "burnt-umber" })
  expect(painted.canvas).toBe(SYSTEM_SCHEME)
})

test("a browser that has picked nothing is left as the shell authored it", () => {
  const painted = firstPaint({})
  expect(painted.attributes).toEqual({})
  expect(painted.canvas).toBe(SYSTEM_SCHEME)
})

test("storage a browser refuses to read leaves the first paint usable", () => {
  const writes: Array<unknown> = []
  expect(() =>
    runInNewContext(bootScript(), {
      localStorage: {
        getItem: () => {
          throw new Error("storage denied")
        },
      },
      document: {
        documentElement: { setAttribute: (...args: Array<unknown>) => writes.push(args) },
        querySelector: () => null,
      },
    }),
  ).not.toThrow()
  expect(writes).toEqual([])
})
