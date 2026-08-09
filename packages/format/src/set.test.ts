import { expect, test } from "bun:test"

import { nodesOf } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"
import { assemble, type DecodedFile } from "./set.ts"

/** What a reader hands over: one decoded file per path, in the order it found
 *  them. A `Map` rather than a record, because the reader's order is part of
 *  the answer — `files` is documented as "every `.jsonl` found, in path order"
 *  — and it is the caller's iteration order that carries it. */
const decoded = (files: Record<string, DecodedFile>): ReadonlyMap<string, DecodedFile> =>
  new Map(Object.entries(files))

const outline = (file: string, contents: string): DecodedFile => ({
  kind: "outline",
  outline: { file, nodes: nodesOf(contents, file) },
})

const document: DecodedFile = { kind: "document" }

const ids = (nodes: ReadonlyArray<Located>): ReadonlyArray<string> =>
  nodes.map((located) => located.node.id)

// The set is FLAT: outlines contribute their nodes to one list, documents
// contribute only their path, and which a file is was decided by its name long
// before this. Assembling it here rather than in whatever read the directory is
// what keeps "what belongs to a set" a statement about the format.
test("assemble sorts decoded files into outlines, their nodes, and documents", () => {
  const set = assemble(decoded({
    "home.jsonl": outline("home.jsonl", `{"id":"kitchen","ord":"a","title":"kitchen"}\n`),
    "notes/cabinets.md": document,
    "work.jsonl": outline(
      "work.jsonl",
      `{"id":"budget","ord":"a","title":"budget"}\n{"id":"m","ord":"b","mirror":"kitchen"}`,
    ),
  }))

  expect(set.files).toEqual(["home.jsonl", "work.jsonl"])
  expect(set.documents).toEqual(["notes/cabinets.md"])
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

// Nothing served is an empty set rather than an absent one: the three fields
// are always there, so the browser renders "no outlines here" from the same
// shape it renders everything else from.
test("nothing decoded assembles to an empty set", () => {
  expect(assemble(decoded({}))).toEqual({ files: [], nodes: [], documents: [] })
})
