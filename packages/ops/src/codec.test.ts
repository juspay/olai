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
import { claims, namersOf, type OutlineFormat } from "@olai/format"
import { keepRecordRead } from "@olai/format/testlib"
import { readOutline, type Unread } from "@olai/format/read"
import { refusalOf } from "@olai/prose/parse.ts"
import { read, type Read } from "@olai/prose/read.ts"
import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import { unheard } from "./fixtures.testlib.ts"
import type { Document, OutlineError, Reading } from "@olai/format"
import {
  isRegular,
  markdownIn,
  NO_KINDS,
  outlinePaths,
  recordRead,
  type Verdict,
} from "@olai/format"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { codecFor } from "./codec.ts"

/** The codec this suite validates through — the vocabulary of a build that
 *  composed no plugin, which is what every test in this package runs under
 *  ({@link ./codec.ts}'s `codecFor`, and `@olai/format`'s `NO_KINDS`). */
const codec = codecFor(NO_KINDS, { current: TEST_CLAIMS }, unheard)

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
  rows: [...reading.pointing.rows],
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
  expect(namersOf(reading.pointing, "cook").map((naming) => naming.at.node.id))
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


test("a departed claim is absent on the next probe and cannot survive in-flight validation", () => {
  const table = { current: TEST_CLAIMS }
  const live = codecFor(NO_KINDS, table, unheard)
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
  const live = codecFor(NO_KINDS, table, unheard)
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

// ONE TITLE CHANGED reads one text: decode is handed the file's previous
// document, and a record whose title and note are the same strings keeps the
// reading it had — the same object — while the changed one is read again.
test("an unchanged record's reading is the same object across a revision of its file", () => {
  const before = `{"id":"cook","ord":"a","title":"cook dinner #kitchen","desc":"see [the plan](plan.md)"}\n` +
    `{"id":"shop","ord":"b","title":"shop for @herbs"}`
  const after = `{"id":"cook","ord":"a","title":"cook dinner #kitchen","desc":"see [the plan](plan.md)"}\n` +
    `{"id":"shop","ord":"b","title":"shop for @herbs and bread"}`
  const was = codec.decode("kitchen.olai", before)
  const now = codec.decode("kitchen.olai", after, was)
  const fresh = codec.decode("kitchen.olai", after)
  const said = (decoded: Result.Result<Document, Verdict>, id: string) => {
    const document = Result.getOrThrow(decoded)
    if (document.holds !== "nodes") throw new Error("kitchen.olai decoded to no outline")
    const located = document.nodes.find((one) => one.node.id === id)
    if (located === undefined || !isRegular(located)) throw new Error(`no record ${id}`)
    return recordRead(located.node)
  }
  expect(said(now, "cook")).toBe(said(was, "cook"))
  expect(said(now, "shop")).not.toBe(said(was, "shop"))
  expect(said(now, "shop").title.tags.map(String)).toEqual(["@herbs"])
  // Handed nothing, a decode reads every text afresh.
  expect(said(fresh, "cook")).not.toBe(said(was, "cook"))
})

/**
 * WHAT A DECODE TELLS WHOEVER RUNS THE SERVER. No known text makes the parser
 * throw (`@olai/prose`'s bounds), so the format here stands in for it: it
 * decodes one record per line and keeps on each the reading a throwing parser
 * leaves — `refusalOf` of what it threw. The codec is what is under test:
 * every such text of a decoded file, named, to `heard.unread`, nothing for a
 * file the parser read, and a decode that took `slowAfter` or more to
 * `heard.slow`.
 */
test("the codec tells `heard` of each text the parser threw on, and of a slow decode", () => {
  const thrown = new Error("a wikilink token holds no wikilink")
  const failed = (text: string): Read => ({ ...read(text), refused: refusalOf(thrown) })
  const format: OutlineFormat = {
    parse: (file, text, table) => {
      const nodes = text.split("\n").map((title, at) => {
        const node = { id: `n${at}`, ord: `a${at}`, title }
        keepRecordRead(node, { title: title.startsWith("!") ? failed(title) : read(title), desc: null })
        return { file, line: at + 1, node }
      })
      return Result.succeed(readOutline(table, file, nodes))
    },
    serialize: () => "",
  }
  const table = claims([{ kind: "alternate", exts: [".tree"], holds: "nodes", kept: true, fetched: false, noun: "outline", article: "an", format }])
  const told: Array<readonly [string, Unread]> = []
  const slow: Array<string> = []
  const hearing = (slowAfter: number) =>
    codecFor(NO_KINDS, { current: table }, {
      unread: (path, unread) => told.push([path, unread]),
      slow: (path, ms) => slow.push(`${path} ${ms >= 0}`),
      slowAfter,
    })
  const live = hearing(Number.POSITIVE_INFINITY)
  expect(Result.isSuccess(live.decode("Work.tree", "paint the shed\n!a broken one\nweed the beds"))).toBe(true)
  expect(told).toEqual([["Work.tree", { where: "n1 title", refusal: { kind: "failed", cause: thrown } }]])
  told.length = 0
  live.decode("Calm.tree", "paint the shed")
  expect([told, slow]).toEqual([[], []])
  // Every decode takes at least no time at all.
  hearing(0).decode("Calm.tree", "paint the shed")
  expect(slow).toEqual(["Calm.tree true"])
})
