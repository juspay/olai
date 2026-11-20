import { expect, test } from "bun:test"
import { defaultSchema } from "rehype-sanitize"

import { ANCHOR_CLASS } from "./anchors.ts"
import { MESSAGE_PROTOCOL, SANITISE } from "./sanitise.ts"

const listed = (schema: typeof defaultSchema, tag: string) => schema.attributes?.[tag] ?? []

const values = (entries: ReturnType<typeof listed>, attribute: string): unknown[] | undefined => {
  const entry = entries.find((one) => (Array.isArray(one) ? one[0] : one) === attribute)
  return Array.isArray(entry) ? [...entry] : undefined
}

test("`a` may carry the anchor's class, and no other class of its own", () => {
  const before = listed(defaultSchema, "a")
  const after = listed(SANITISE, "a")

  expect(after.map((entry) => (Array.isArray(entry) ? entry[0] : entry)))
    .toEqual(before.map((entry) => (Array.isArray(entry) ? entry[0] : entry)))

  expect(values(before, "className")).toBeDefined()
  expect(values(after, "className")).toEqual([...(values(before, "className") ?? []), ANCHOR_CLASS])
})

test("no other tag's allowlist moved", () => {
  const tags = new Set([
    ...Object.keys(defaultSchema.attributes ?? {}),
    ...Object.keys(SANITISE.attributes ?? {}),
  ])
  for (const tag of tags) {
    if (tag === "a") continue
    expect([tag, listed(SANITISE, tag)]).toEqual([tag, listed(defaultSchema, tag)])
  }
})

test("`href` may name a message, and no other attribute may", () => {
  expect(SANITISE.protocols?.["href"]).toEqual([
    ...(defaultSchema.protocols?.["href"] ?? []),
    MESSAGE_PROTOCOL,
  ])
  expect(defaultSchema.protocols?.["href"]).toBeDefined()
  expect(defaultSchema.protocols?.["href"]).not.toContain(MESSAGE_PROTOCOL)

  for (const attribute of Object.keys(defaultSchema.protocols ?? {})) {
    if (attribute === "href") continue
    expect([attribute, SANITISE.protocols?.[attribute]])
      .toEqual([attribute, defaultSchema.protocols?.[attribute]])
  }
  expect(Object.keys(SANITISE.protocols ?? {}).sort())
    .toEqual(Object.keys(defaultSchema.protocols ?? {}).sort())
})

test("nothing but the attributes and one href protocol was touched", () => {
  expect(SANITISE.tagNames).toEqual(defaultSchema.tagNames)
  expect(SANITISE.clobber).toEqual(defaultSchema.clobber)
  expect(SANITISE.clobberPrefix).toBe("")
})
