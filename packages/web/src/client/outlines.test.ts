/**
 * The reconnect rule, which is the one thing in `./outlines.ts` a unit test can
 * hold.
 *
 * The fold around it needs a reactive runtime this suite does not have — `bun
 * test` resolves SolidJS's server build, where a memo is computed once and never
 * invalidated — so what the composition does with a frame is a `just bench` leg
 * (`./outlines.bench.ts`, which runs under `--conditions browser` and drives the
 * framework's real hook). What is left, and what is actually this module's own
 * decision, is WHICH of the two objects a full-set frame is rebuilt out of: the
 * one the wire just decoded, or the one the store is already holding for that
 * key. The framework's half — that an unchanged entry keeps the object it had —
 * is pinned upstream.
 *
 * IDENTITY IS THE ASSERTION and not a stand-in for one. Every per-record cache
 * in the app is keyed on the record, `@olai/format`'s per-record search fold
 * above all, so "the same content" is not the property that matters here and
 * `toBe` is deliberate throughout.
 */

import { faceOf } from "@olai/format"
import { outlineOf } from "@olai/format/testlib"
import type { OutlineEntry } from "@olai/surface"
import { expect, test } from "bun:test"

import { seedOf } from "./outlines.ts"

/** One file's entry, built the way the server builds one — the format's own
 *  parse and its own face — so the fixture is a wire value rather than a shape
 *  that merely satisfies the type. Called twice for one file, it answers twice
 *  with equal content and different objects, which is exactly what a reconnect
 *  hands a tab. */
const entryOf = (file: string, id: string, rev = 1): OutlineEntry => {
  const outline = outlineOf(`{"id":"${id}","ord":"a","title":"one"}`, file)
  return { rev, nodes: outline.nodes, broken: null, face: faceOf(outline) }
}

test("the seed takes the entry the store holds, not the one the frame carried", () => {
  const stored = entryOf("a.olai", "one")
  // What a reconnect delivers: the same content, freshly decoded — a different
  // object saying the same thing, which is precisely what makes it dangerous.
  const decoded = entryOf("a.olai", "one")
  expect(decoded).not.toBe(stored)
  const seed = seedOf([["a.olai", decoded]], () => stored)
  expect(seed.upserts.map(([file]) => file)).toEqual(["a.olai"])
  expect(seed.upserts[0]?.[1]).toBe(stored)
})

test("the seed falls back to the frame's own entry where the store answers nothing", () => {
  // The framework applies a snapshot to the store before it seeds any fold, so
  // this is a state the wire cannot produce — and it is answered rather than
  // asserted about, because a total function is cheaper than a claim about
  // somebody else's ordering.
  const decoded = entryOf("b.olai", "two")
  const seed = seedOf([["b.olai", decoded]], () => undefined)
  expect(seed.upserts[0]?.[1]).toBe(decoded)
})

test("the seed names every key the frame did, in the order the frame did", () => {
  // A full-set frame IS the directory, so the seed carries all of it — and the
  // order is the frame's, because where a file's records land in the flat list
  // is the format's own rule and this hands the frame on rather than sorting it.
  const frame = [
    ["b.olai", entryOf("b.olai", "two")],
    ["a.olai", entryOf("a.olai", "one")],
  ] as const
  const seed = seedOf(frame, () => undefined)
  expect(seed.upserts.map(([file]) => file)).toEqual(["b.olai", "a.olai"])
  // And nothing is removed: a snapshot is patched onto the empty view, so there
  // is nothing standing for a remove to name.
  expect(seed.removes).toEqual([])
})
