/**
 * The pilcrow's promise, in both directions: a mark where there is something
 * behind it, and no mark where there is not.
 */

import { expect, test } from "bun:test"
import type { RegularNode } from "@olai/format"

import { hasBody } from "./body.ts"

const node = (fields: Partial<RegularNode>): RegularNode =>
  ({ id: "a", ord: "a0", title: "a", ...fields }) as RegularNode

test("a note is a body", () => {
  expect(hasBody(node({ desc: "walnut or birch" }))).toBe(true)
})

test("a `see` is a body — a row draws its references nowhere else", () => {
  expect(hasBody(node({ see: ["herbs"] }))).toBe(true)
})

test("a bare title is not", () => {
  expect(hasBody(node({}))).toBe(false)
  expect(hasBody(node({ desc: "" }))).toBe(false)
  expect(hasBody(node({ see: [] }))).toBe(false)
})

test("PROPERTIES are not a body — the run is drawn on the row, open or not", () => {
  expect(hasBody(node({ custom: { stage: "review" } }))).toBe(false)
})

test("...nor is anything else the row already draws for itself", () => {
  // A date is the badge, a mark is the glyph, a `doc` is its own line under
  // the title whether the row is open or not.
  expect(hasBody(node({ date: "2026-08-10", todo: true, doc: "notes/x.md" }))).toBe(false)
})
