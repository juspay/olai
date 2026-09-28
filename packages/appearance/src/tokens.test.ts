/**
 * THE INTERFACE SCALE is small on purpose, and this holds it small.
 *
 * Chrome picks a type size, a corner and a shadow from `./tokens.css`'s
 * `@theme` by the JOB they do (`text-label`, `rounded-surface`,
 * `shadow-overlay`), never by how big they happen to be. A sixth size or a
 * third custom corner added "just for this one panel" is how a scale becomes
 * a list again, so the names are an equality here and growing one is a
 * deliberate edit of this file and of the README that states the rule.
 */

import { expect, test } from "bun:test"

const themeBlock = async (): Promise<string> => {
  const sheet = await Bun.file(new URL("./tokens.css", import.meta.url)).text()
  const theme = /@theme\s*\{([^}]*)\}/.exec(sheet)?.[1]
  expect(theme).toBeDefined()
  return theme!
}

/** The token names of one namespace, without their `--…--line-height`
 *  companions. */
const names = (theme: string, namespace: string): ReadonlyArray<string> =>
  [...theme.matchAll(new RegExp(`--${namespace}-([a-z]+)(--[a-z-]+)?\\s*:`, "g"))]
    .filter((hit) => hit[2] === undefined)
    .map((hit) => hit[1]!)

test("five type sizes, named for their job, smallest first", async () => {
  const theme = await themeBlock()
  expect(names(theme, "text")).toEqual(["caption", "label", "body", "title", "display"])
  const rem = (name: string): number =>
    Number(new RegExp(`--text-${name}:\\s*([0-9.]+)rem;`).exec(theme)?.[1])
  const sizes = ["caption", "label", "body", "title", "display"].map(rem)
  expect(sizes.every((size) => Number.isFinite(size))).toBe(true)
  expect([...sizes].sort((a, b) => a - b)).toEqual(sizes)
})

test("two custom corners; the third is Tailwind's own rounded-full", async () => {
  expect(names(await themeBlock(), "radius")).toEqual(["control", "surface"])
})

test("two shadows: raised off a control, overlay over the page", async () => {
  expect(names(await themeBlock(), "shadow")).toEqual(["raised", "overlay"])
})
