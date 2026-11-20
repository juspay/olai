import { existsSync } from "node:fs"
import { expect, test } from "bun:test"

const GENERATED = new URL("./mark.generated.ts", import.meta.url).pathname

const guard = (): void => {
  if (!existsSync(GENERATED)) {
    throw new Error(
      "packages/plugins/odu/src/browser/mark.generated.ts is absent. It is GENERATED from " +
        "the pinned odu's logo.svg by packages/plugin-kit/default.nix " +
        "and copied into place by 'just install' — run 'just install'.",
    )
  }
}

const generated = async () => {
  guard()
  return await import("./mark.generated.ts")
}

test("the viewBox is four numbers the nested viewport can fit the artwork into", async () => {
  const { MARK_VIEWBOX } = await generated()
  const parts = MARK_VIEWBOX.trim().split(/\s+/)
  expect(parts).toHaveLength(4)
  for (const part of parts) expect(Number.isFinite(Number(part))).toBe(true)
})

test("the asset's accessible names never enter the page", async () => {
  const { MARK_BODY } = await generated()
  expect(MARK_BODY).not.toContain(`id="title"`)
  expect(MARK_BODY).not.toContain(`id="desc"`)
  expect(MARK_BODY).not.toContain("<title")
  expect(MARK_BODY).not.toContain("<desc")
})

test("every id it declares is tokenised, so the shipped constant is safe at rest", async () => {
  const { MARK_BODY, MARK_TOKEN } = await generated()
  const ids = [...MARK_BODY.matchAll(/\sid\s*=\s*"([^"]*)"/g)].map((found) => found[1] ?? "")
  expect(ids.length).toBeGreaterThan(0)
  for (const id of ids) expect(id.startsWith(MARK_TOKEN)).toBe(true)
})

test("every url(#…) names an id the body declares", async () => {
  const { MARK_BODY } = await generated()
  const declared = new Set(
    [...MARK_BODY.matchAll(/\sid\s*=\s*"([^"]*)"/g)].map((found) => found[1] ?? ""),
  )
  const referenced = [...MARK_BODY.matchAll(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g)].map(
    (found) => found[1] ?? "",
  )
  expect(referenced.length).toBeGreaterThan(0)
  for (const id of referenced) expect(declared.has(id)).toBe(true)
})

test("the wordmark and a linearGradient are still the logo", async () => {
  const { MARK_BODY } = await generated()
  expect(MARK_BODY).toContain(">odu</text>")
  expect([...MARK_BODY.matchAll(/<linearGradient\b/g)].length).toBeGreaterThanOrEqual(1)
})
