import { expect, test } from "bun:test"

import { deadLinkFace } from "./dead-links.ts"

const LINK = { path: "gone away.md", written: "../gone%20away.md#scope", words: "x" }

test("a link to a path nothing serves is dead, and says what it resolved to", () => {
  const face = deadLinkFace(LINK, new Set())
  expect(face.dead).toBe(true)
  expect(face.label).toContain("link resolves to nothing served: gone away.md")
})

test("the accessible name keeps the link's own words in front of the warning", () => {
  expect(deadLinkFace(LINK, new Set()).label).toStartWith("x — ")
  expect(deadLinkFace({ ...LINK, words: "" }, new Set()).label)
    .toStartWith("link resolves to nothing served")
})

test("a served path, and an unknown membership, leave a link alone", () => {
  expect(deadLinkFace(LINK, new Set(["gone away.md"]))).toEqual({ dead: false, label: undefined })
  expect(deadLinkFace(LINK, undefined)).toEqual({ dead: false, label: undefined })
})

test("withdrawal and reconnection cannot reuse a stale warning", () => {
  const served = new Set<string>()
  expect(deadLinkFace(LINK, served).dead).toBe(true)
  served.add(LINK.path)
  expect(deadLinkFace(LINK, served).dead).toBe(false)
  served.delete(LINK.path)
  expect(deadLinkFace(LINK, served).dead).toBe(true)
})
