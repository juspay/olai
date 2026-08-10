import { expect, test } from "bun:test"
import { Result } from "effect"

import type { OutlineError } from "./errors.ts"
import { failureOf, nodesOf } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"
import { assemble, type DecodedFile } from "./set.ts"

type Decoded = Result.Result<DecodedFile, ReadonlyArray<OutlineError>>

/** What the store hands over: one decoded file per path, in the order it found
 *  them, each either decoded or failed. A `Map` rather than a record, because
 *  the reader's order is part of the answer — `files` is documented as "every
 *  `.jsonl` found, in path order" — and it is the caller's iteration order that
 *  carries it. */
const decoded = (files: Record<string, Decoded>): ReadonlyMap<string, Decoded> =>
  new Map(Object.entries(files))

const outline = (file: string, contents: string): Decoded =>
  Result.succeed({ file, nodes: nodesOf(contents, file) })

/** A `.md`: found, served, and carrying its text. */
const document = (file: string, text: string): Decoded =>
  Result.succeed({ file, text })

const unreadable = (file: string, contents: string): Decoded =>
  Result.fail(failureOf(contents, file))

const ids = (nodes: ReadonlyArray<Located>): ReadonlyArray<string> =>
  nodes.map((located) => located.node.id)

// The set is FLAT: outlines contribute their nodes to one list, documents
// their path and their text, and which a file is was decided by its name long
// before this. Assembling it here rather than in whatever read the directory is
// what keeps "what belongs to a set" a statement about the format.
test("assemble sorts decoded files into outlines, their nodes, and documents", () => {
  const set = assemble(decoded({
    "home.jsonl": outline("home.jsonl", `{"id":"kitchen","ord":"a","title":"kitchen"}\n`),
    "notes/cabinets.md": document("notes/cabinets.md", "# Cabinets\n"),
    "work.jsonl": outline(
      "work.jsonl",
      `{"id":"budget","ord":"a","title":"budget"}\n{"id":"m","ord":"b","mirror":"kitchen"}`,
    ),
  }))

  expect(set.files).toEqual(["home.jsonl", "work.jsonl"])
  expect(set.documents).toEqual([{ file: "notes/cabinets.md", text: "# Cabinets\n" }])
  // One list, in the order the files came in — and every record still names the
  // file it came from, which is why grouping them again would be the same fact
  // twice.
  expect(ids(set.nodes)).toEqual(["kitchen", "budget", "m"])
  expect(set.nodes.map((located) => `${located.file}:${located.line}`))
    .toEqual(["home.jsonl:1", "work.jsonl:1", "work.jsonl:2"])
})

// `files` is not derived from `nodes`, and this is the case that proves it: an
// empty `.jsonl` is a file of the set the sidebar shows and a file a writer may
// append to, not a file that is missing.
test("an outline holding no nodes is still one of the set's files", () => {
  const set = assemble(decoded({
    "empty.jsonl": outline("empty.jsonl", ``),
    "a.jsonl": outline("a.jsonl", `{"id":"a","ord":"a","title":"a"}`),
  }))
  expect(set.files).toEqual(["empty.jsonl", "a.jsonl"])
  expect(ids(set.nodes)).toEqual(["a"])
})

// Nothing served is an empty set rather than an absent one: the four fields
// are always there, so the browser renders "no outlines here" from the same
// shape it renders everything else from.
test("nothing decoded assembles to an empty set", () => {
  expect(assemble(decoded({}))).toEqual({
    files: [],
    nodes: [],
    documents: [],
    broken: [],
  })
})

// A file that did not parse is still a file that was FOUND. It keeps its place
// in the sidebar and carries its own errors, which is what lets the view put
// them where that outline would have been instead of blanking the page.
test("a file that did not decode keeps its place and carries its errors", () => {
  const set = assemble(decoded({
    "good.jsonl": outline("good.jsonl", `{"id":"a","ord":"a","title":"a"}`),
    "bad.jsonl": unreadable("bad.jsonl", `{"id":"b","ord":"a",title:"b"}`),
  }))

  expect(set.files).toEqual(["good.jsonl", "bad.jsonl"])
  expect(ids(set.nodes)).toEqual(["a"])
  expect(set.broken.map((file) => file.file)).toEqual(["bad.jsonl"])
  expect(set.broken[0]?.errors.map((error) => `${error.file}:${error.line} ${error.code}`))
    .toEqual(["bad.jsonl:1 not-json"])
})
