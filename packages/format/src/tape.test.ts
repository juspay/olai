import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { Result } from "effect"

import { decodedOf, outlineOf, readingOf, setOf } from "./fixtures.testlib.ts"
import { assemble, nodesIn } from "./set.ts"
import { stillHolds, taping } from "./tape.ts"
import { reading, type Reading } from "./validate.ts"

const ONE = "a.olai"
const OTHER = "b.olai"

const files = (
  { title = "as written", day = null as string | null, extra = false } = {},
): Record<string, string> => ({
  [ONE]: [
    JSON.stringify({ id: "r", ord: "a0", title: "root" }),
    JSON.stringify({
      id: "one",
      parent: "r",
      ord: "a1",
      title,
      ...(day === null ? {} : { date: day }),
    }),
  ].join("\n"),
  [OTHER]: JSON.stringify({ id: "s", ord: "a0", title: "elsewhere" }),
  ...(extra ? { "c.olai": JSON.stringify({ id: "nobody", ord: "a0", title: "arrived" }) } : {}),
})

const at = (options?: Parameters<typeof files>[0]): Reading => readingOf(setOf(files(options)))

test("a keyed read that found something is held against the value moving", () => {
  const was = at({ day: "2026-03-04" })
  const taped = taping(was)
  expect(taped.reading.derived.byId.get("one")).toBe(was.derived.byId.get("one"))
  expect(stillHolds(taped.tape, was, at({ day: "2026-03-04" }))).toBe(false)
})

test("a read of a key nothing answered is held against a record arriving", () => {
  const was = at()
  const taped = taping(was)
  expect(taped.reading.derived.byId.get("nobody")).toBeUndefined()
  expect(stillHolds(taped.tape, was, at({ extra: true }))).toBe(false)
})

test("...and so is a `has`, which is taped like a `get`", () => {
  const was = at()
  const taped = taping(was)
  expect(taped.reading.derived.byId.has("nobody")).toBe(false)
  expect(stillHolds(taped.tape, was, at({ extra: true }))).toBe(false)
})

test("a WALK is held against the whole index", () => {
  const was = at({ day: "2026-03-04" })
  const taped = taping(was)
  expect([...taped.reading.derived.byDay.keys()]).toEqual(["2026-03-04"])
  expect(stillHolds(taped.tape, was, at({ day: "2026-03-05" }))).toBe(false)
  expect(stillHolds(taped.tape, was, at())).toBe(false)
})

test("a tape that read nothing at all always holds", () => {
  const was = at({ day: "2026-03-04" })
  const taped = taping(was)
  expect(stillHolds(taped.tape, was, at({ title: "something else" }))).toBe(true)
})

test("the same reading holds whatever was read of it", () => {
  const was = at({ day: "2026-03-04" })
  const taped = taping(was)
  taped.reading.derived.byId.get("one")
  void [...taped.reading.derived.byDay]
  void taped.reading.derived.nodes
  void taped.reading.set.documents
  void taped.reading.set.broken
  expect(stillHolds(taped.tape, was, was)).toBe(true)
})

test("the taping view answers exactly what the reading answers", () => {
  const was = at({ day: "2026-03-04" })
  const view = taping(was).reading
  expect(view.derived.byId.get("one")).toBe(was.derived.byId.get("one"))
  expect(view.derived.byId.has("one")).toBe(true)
  expect(view.derived.byId.size).toBe(was.derived.byId.size)
  expect([...view.derived.byDay]).toEqual([...was.derived.byDay])
  expect([...view.derived.byFile.keys()]).toEqual([...was.derived.byFile.keys()])
  expect([...view.derived.children.values()]).toEqual([...was.derived.children.values()])
  expect([...view.derived.byId.entries()]).toEqual([...was.derived.byId.entries()])
  expect(view.derived.nodes).toBe(was.derived.nodes)
  expect(view.set.documents).toBe(was.set.documents)
  expect(view.set.broken).toBe(was.set.broken)
  const seen: Array<string> = []
  view.derived.byId.forEach((_value, key) => seen.push(key))
  expect(seen).toEqual([...was.derived.byId.keys()])
})

test("the taping view stands in for EVERY field of the derivation", () => {
  const was = at({ day: "2026-03-04" })
  const view = taping(was).reading.derived
  const named = Object.keys(was.derived)
  expect(named.length).toBeGreaterThan(10)
  for (const field of named) {
    const stood = (view as unknown as Record<string, unknown>)[field]
    const real = (was.derived as unknown as Record<string, unknown>)[field]
    expect([field, stood === undefined]).toEqual([field, false])
    if (real instanceof Map) {
      expect([field, [...(stood as ReadonlyMap<string, unknown>)]])
        .toEqual([field, [...real]])
    } else expect([field, stood]).toEqual([field, real])
  }
})

test("the served files are compared by the FACE, not by the object", () => {
  const was = at()
  const taped = taping(was)
  void taped.reading.set.documents
  expect(stillHolds(taped.tape, was, at())).toBe(true)
  expect(stillHolds(taped.tape, was, at({ extra: true }))).toBe(false)
})

test("a PATCHED revision carries what it did not touch, and the tape spends it", () => {
  const dated = {
    [ONE]: files()[ONE] as string,
    [OTHER]: JSON.stringify({ id: "s", ord: "a0", title: "elsewhere", date: "2026-03-04" }),
  }
  const decoded = decodedOf(dated)
  const was = readingOf(assemble(TEST_CLAIMS, decoded))
  decoded.set(
    ONE,
    Result.succeed(outlineOf(files({ title: "typed into" })[ONE] as string, ONE)),
  )
  const set = assemble(TEST_CLAIMS, decoded)
  const now = reading(TEST_CLAIMS, set, {
    read: was,
    delta: { upserts: [[ONE, { nodes: nodesIn(decoded.get(ONE)) }]], removes: [] },
  })
  expect(now.derived.byId.get("s")).toBe(was.derived.byId.get("s"))

  const untouched = taping(was)
  untouched.reading.derived.byId.get("s")
  untouched.reading.derived.children.get("s")
  expect(stillHolds(untouched.tape, was, now)).toBe(true)

  const touched = taping(was)
  touched.reading.derived.byId.get("one")
  expect(stillHolds(touched.tape, was, now)).toBe(false)

  const calendar = taping(was)
  void [...calendar.reading.derived.byDay.keys()]
  expect(now.derived.byDay).toBe(was.derived.byDay)
  expect(stillHolds(calendar.tape, was, now)).toBe(true)
})
