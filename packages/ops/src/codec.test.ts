/**
 * The seam, in the one way it can be got wrong.
 *
 * `@olai/format`'s patcher is held to `derive` by a property test of its own,
 * so what is left to prove here is the TRANSLATION: the store says what it last
 * published and which paths have moved, and this codec turns that into a delta
 * about files. A delta that named the wrong file, or read a changed file's
 * records out of the wrong place, would produce a perfectly self-consistent
 * view of a directory nobody has — and every rule below it would then be
 * checked against that.
 *
 * So each test validates the same set twice, once building on the last verdict
 * and once from nothing, and asserts the two are the same reading.
 */

import type { Document, OutlineError, Reading } from "@olai/format"
import {
  markdownIn,
  outlinePaths,
  type Verdict,
} from "@olai/format"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { codec } from "./codec.ts"

type Files = Record<string, string>

const decoded = (
  files: Files,
): Map<string, Result.Result<Document, Verdict>> =>
  new Map(
    Object.entries(files).map(([path, contents]) => [
      path,
      codec.byName?.(path) ?? codec.decode(path, contents),
    ]),
  )

/** A verdict that must be one, so a test that mis-writes a fixture hears which
 *  rule refused it rather than a type error three lines later. */
const accepted = (
  outcome: Result.Result<Reading, Verdict>,
): Reading => {
  if (Result.isFailure(outcome)) {
    throw new Error(
      `the fixture does not validate:\n${
        outcome.failure.findings
          .map((error) => `  ${error.file}:${error.line} ${error.message}`)
          .join("\n")
      }`,
    )
  }
  return outcome.success
}

/** The two readings compared the way the patcher's own suite compares two
 *  views: every index, entries and all. `Map`s and `Set`s are spread, because
 *  `toEqual` reads a `Set` as membership and these promise more than that. */
const readable = (reading: Reading): unknown => ({
  set: reading.set,
  nodes: reading.derived.nodes,
  byId: [...reading.derived.byId],
  byFile: [...reading.derived.byFile],
  namedBy: [...reading.derived.namedBy],
  children: [...reading.derived.children],
  status: [...reading.derived.status],
  after: [...reading.derived.after],
  blocked: [...reading.derived.blocked],
  mirrorsOf: [...reading.derived.mirrorsOf].map(([id, of]) => [id, [...of]]),
  edgesTo: [...reading.derived.edgesTo].map(([id, to]) => [id, [...to]]),
})

/**
 * Validate `after` twice — once building on `before`'s verdict with `changed`
 * and `removed` named, once from nothing at all — and insist the two agree.
 *
 * The second map is the FIRST one with the moved paths swapped in, which is
 * what a probe hands over: a file whose stamp did not move keeps the very value
 * it was cached with ({@link ../../store/src/probe.ts}). Re-decoding the whole
 * directory here instead would build a set of equal-but-different records, and
 * the fixture would be measuring a thing the store never does.
 */
const bothWays = (
  before: Files,
  after: Files,
  moved: { readonly changed: ReadonlyArray<string>; readonly removed: ReadonlyArray<string> },
): Reading => {
  const held = decoded(before)
  const first = accepted(codec.validate(held))

  const files = new Map(held)
  for (const path of moved.removed) files.delete(path)
  for (const path of moved.changed) {
    files.set(path, codec.byName?.(path) ?? codec.decode(path, after[path] as string))
  }
  // The fixture's own claim, checked: the two lists really are the difference
  // between the two directories.
  expect([...files.keys()].sort()).toEqual(Object.keys(after).sort())

  const built = accepted(
    codec.validate(files, { value: first, changed: moved.changed, removed: moved.removed }),
  )
  expect(readable(built)).toEqual(readable(accepted(codec.validate(files))) as never)
  return built
}

const KITCHEN: Files = {
  "kitchen.olai": `{"id":"cook","ord":"a","title":"cook dinner","todo":true}\n` +
    `{"id":"shop","ord":"b","title":"shop","after":["cook"],"todo":true}`,
  "notes/plan.olai": `{"id":"plan","ord":"a","title":"the plan","see":["cook"]}\n` +
    `{"id":"here","ord":"b","parent":"plan","mirror":"cook"}`,
  "notes/plan.md": "# the plan\n",
}

test("an edited outline is patched onto the last verdict", () => {
  const done = `{"id":"cook","ord":"a","title":"cook dinner","done":true}\n` +
    `{"id":"shop","ord":"b","title":"shop","after":["cook"],"todo":true}`
  const reading = bothWays(KITCHEN, { ...KITCHEN, "kitchen.olai": done }, {
    changed: ["kitchen.olai"],
    removed: [],
  })
  // The placement in the other file says what its target says, and what was
  // waiting is waiting no longer — the two facts a patch has to carry across
  // files, asserted here as well as compared, so a test that agreed with a
  // rebuild about NOTHING would still have to agree about these.
  expect(reading.derived.status.get("here")).toBe("done")
  expect(reading.derived.blocked.has("shop")).toBe(false)
})

test("an outline that arrives is patched in, in path order", () => {
  const arriving = { ...KITCHEN, "beside.olai": `{"id":"new","ord":"a","title":"new"}` }
  const reading = bothWays(KITCHEN, arriving, { changed: ["beside.olai"], removed: [] })
  expect(outlinePaths(reading.set))
    .toEqual(["beside.olai", "kitchen.olai", "notes/plan.olai"])
  expect(reading.derived.nodes.map((at) => at.node.id))
    .toEqual(["new", "cook", "shop", "plan", "here"])
})

test("an outline that goes away takes its records out of the indexes", () => {
  const { "notes/plan.olai": _gone, ...left } = KITCHEN
  const reading = bothWays(KITCHEN, left, { changed: [], removed: ["notes/plan.olai"] })
  expect(reading.derived.mirrorsOf.has("cook")).toBe(false)
  // What still names it is what is left naming it: the `see` and the placement
  // went with the file, and the edge in the file that stayed did not.
  expect((reading.derived.namedBy.get("cook") ?? []).map((naming) => naming.at.node.id))
    .toEqual(["shop"])
})

test("a document that changed is a moved path with no records of its own", () => {
  // The store names every file it re-decoded, and a `.md` is one of them. It
  // holds no records, so the delta says so — and a codec that had read a
  // body's text as an outline's nodes would say something else entirely.
  const body = { ...KITCHEN, "notes/plan.md": "# the plan, rewritten\n" }
  const reading = bothWays(KITCHEN, body, { changed: ["notes/plan.md"], removed: [] })
  expect(markdownIn(reading.set).map((one) => [String(one.path), one.body]))
    .toEqual([["notes/plan.md", "# the plan, rewritten\n"]])
  expect(reading.derived.byFile.has("notes/plan.md")).toBe(false)
})

test("a file deleted and written back in one breath is what the upsert says", () => {
  // Both lists name it — deleted out of band, put back by the commit that is
  // being judged — and the removal is answered by the upsert rather than the
  // other way around.
  const rewritten = `{"id":"cook","ord":"a","title":"cook something else","todo":true}\n` +
    `{"id":"shop","ord":"b","title":"shop","after":["cook"],"todo":true}`
  const reading = bothWays(KITCHEN, { ...KITCHEN, "kitchen.olai": rewritten }, {
    changed: ["kitchen.olai"],
    removed: ["kitchen.olai"],
  })
  expect(reading.derived.byId.get("cook")?.node).toMatchObject({ title: "cook something else" })
})
