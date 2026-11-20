import { claims } from "@olai/format"
import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import type { Document, OutlineError, Reading } from "@olai/format"
import {
  markdownIn,
  NO_KINDS,
  outlinePaths,
  type Verdict,
} from "@olai/format"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { codecFor } from "./codec.ts"

const codec = codecFor(NO_KINDS, { current: TEST_CLAIMS })

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
  expect((reading.derived.namedBy.get("cook") ?? []).map((naming) => naming.at.node.id))
    .toEqual(["shop"])
})

test("a document that changed is a moved path with no records of its own", () => {
  const body = { ...KITCHEN, "notes/plan.md": "# the plan, rewritten\n" }
  const reading = bothWays(KITCHEN, body, { changed: ["notes/plan.md"], removed: [] })
  expect(markdownIn(reading.set).map((one) => [String(one.path), one.body]))
    .toEqual([["notes/plan.md", "# the plan, rewritten\n"]])
  expect(reading.derived.byFile.has("notes/plan.md")).toBe(false)
})

test("a file deleted and written back in one breath is what the upsert says", () => {
  const rewritten = `{"id":"cook","ord":"a","title":"cook something else","todo":true}\n` +
    `{"id":"shop","ord":"b","title":"shop","after":["cook"],"todo":true}`
  const reading = bothWays(KITCHEN, { ...KITCHEN, "kitchen.olai": rewritten }, {
    changed: ["kitchen.olai"],
    removed: ["kitchen.olai"],
  })
  expect(reading.derived.byId.get("cook")?.node).toMatchObject({ title: "cook something else" })
})


test("a departed claim is absent on the next probe and cannot survive in-flight validation", () => {
  const table = { current: TEST_CLAIMS }
  const live = codecFor(NO_KINDS, table)
  const path = "Work.olai"
  const contents = `{"id":"work","ord":"a0","title":"Work"}`
  expect(live.match(path)).toBe(true)
  const decoded = live.decode(path, contents)
  const previous = accepted(live.validate(new Map([[path, decoded]])))
  table.current = claims([...TEST_CLAIMS.byKind.values()].filter(claim => claim.holds !== "nodes"))
  expect(live.match(path)).toBe(false)
  const after = accepted(live.validate(new Map([[path, decoded]])))
  expect(outlinePaths(after.set)).toEqual([])
  expect(after.derived.byId.has("work")).toBe(false)
  expect(after.claims).toBe(table.current)
  expect(previous.claims).toBe(TEST_CLAIMS)
  expect(previous.derived.byId.has("work")).toBe(true)
  table.current = TEST_CLAIMS
  expect(live.match(path)).toBe(true)
  expect(Result.isSuccess(live.decode(path, contents))).toBe(true)
})

test("withdrawing a referenced body's kind reports the missing document and reinstating it repairs the reading", () => {
  const table = { current: TEST_CLAIMS }
  const live = codecFor(NO_KINDS, table)
  const files = new Map([
    ["Work.olai", live.decode("Work.olai", '{"id":"work","ord":"a0","title":"Work","desc":"[document](notes.md)"}')],
    ["notes.md", live.decode("notes.md", "# Notes")],
  ])
  expect(Result.isSuccess(live.validate(files))).toBe(true)
  table.current = claims([...TEST_CLAIMS.byKind.values()].filter(claim => claim.kind !== "markdown"))
  const withdrawn = accepted(live.validate(files))
  expect(withdrawn.set.broken).toEqual([])
  table.current = TEST_CLAIMS
  expect(accepted(live.validate(files)).set.broken).toEqual([])
})
