import { expect, test } from "bun:test"
import { Result } from "effect"

import type { OutlineError } from "./errors.ts"
import { failureOf, nodesOf } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"
import { byPath } from "./paths.ts"
import { apart, assemble, type DecodedFile } from "./set.ts"

type Decoded = Result.Result<DecodedFile, ReadonlyArray<OutlineError>>

/** What the store hands over: one decoded file per path, each either decoded
 *  or failed. A `Map` rather than a record because that is the shape the codec
 *  seam passes — and its ORDER is deliberately not the answer: `files` is
 *  documented as "every `.olai` found, in path order", and `assemble` puts them
 *  in it rather than trusting whoever built the map to have done so. */
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
    "home.olai": outline("home.olai", `{"id":"kitchen","ord":"a","title":"kitchen"}\n`),
    "notes/cabinets.md": document("notes/cabinets.md", "# Cabinets\n"),
    "work.olai": outline(
      "work.olai",
      `{"id":"budget","ord":"a","title":"budget"}\n{"id":"m","ord":"b","mirror":"kitchen"}`,
    ),
  }))

  expect(set.files).toEqual(["home.olai", "work.olai"])
  expect(set.documents).toEqual([{ file: "notes/cabinets.md", text: "# Cabinets\n" }])
  // One list, in the order the files came in — and every record still names the
  // file it came from, which is why grouping them again would be the same fact
  // twice.
  expect(ids(set.nodes)).toEqual(["kitchen", "budget", "m"])
  expect(set.nodes.map((located) => `${located.file}:${located.line}`))
    .toEqual(["home.olai:1", "work.olai:1", "work.olai:2"])
})

// PATH ORDER is `assemble`'s promise and not its caller's, which is what makes
// it true of every caller. The one in the tree that does not walk a directory
// is the write gate: it assembles what the last probe held with the files it is
// about to write swapped in, so a path that did not exist before sits at the
// END of that map — and until #208 a created `Archive.olai` was published after
// the `house.olai` it sorts before, which `list_outlines` answers with and a
// search tie breaks on.
test("files, nodes and documents come out in path order, whatever order the map holds", () => {
  const set = assemble(decoded({
    "zeta.olai": outline("zeta.olai", `{"id":"z","ord":"a","title":"z"}`),
    "notes/zebra.md": document("notes/zebra.md", "z\n"),
    "Archive.olai": outline("Archive.olai", `{"id":"arch","ord":"a","title":"arch"}`),
    "notes/apple.md": document("notes/apple.md", "a\n"),
    "middle.olai": outline("middle.olai", `{"id":"mid","ord":"a","title":"mid"}`),
  }))
  expect(set.files).toEqual(["Archive.olai", "middle.olai", "zeta.olai"])
  // `nodes` follows it file by file, which is why the sort is done to the paths
  // before anything is built rather than to the lists afterwards.
  expect(ids(set.nodes)).toEqual(["arch", "mid", "z"])
  expect(set.documents.map((one) => one.file)).toEqual([
    "notes/apple.md",
    "notes/zebra.md",
  ])
})

// WHICH path order, and it is the one question a code-point sort answers
// differently: `.` is 0x2E and `/` is 0x2F, so a plain compare puts `wing.olai`
// ahead of the directory it names, while a walk descends into `wing` when it
// meets it (`@olai/store`'s `disk.ts`) and reads `wing/kitchen.olai` first.
// `byPath` is the walk's answer, it is what `assemble` sorts by, and slice 4 of
// `model-indices` is why there is one of it: the patcher places an arriving
// file by this order and the browser draws its sidebar in it, so a second
// spelling anywhere would be the same directory read two ways.
test("a directory sorts where descending into it would put it", () => {
  expect(["wing.olai", "wing/kitchen.olai", "wing-annexe.olai"].sort(byPath)).toEqual([
    "wing/kitchen.olai",
    "wing-annexe.olai",
    "wing.olai",
  ])
  // Deeper, and the same rule one level down.
  expect(["a/b.olai", "a/b/c.olai"].sort(byPath)).toEqual(["a/b/c.olai", "a/b.olai"])
  // Everything that is not the separator is code point order, unchanged.
  expect(["b.olai", "A.olai", "a.olai"].sort(byPath)).toEqual(["A.olai", "a.olai", "b.olai"])

  const set = assemble(decoded({
    "wing.olai": outline("wing.olai", `{"id":"wing","ord":"a","title":"wing"}`),
    "wing/kitchen.olai": outline(
      "wing/kitchen.olai",
      `{"id":"kitchen","ord":"a","title":"kitchen"}`,
    ),
  }))
  expect(set.files).toEqual(["wing/kitchen.olai", "wing.olai"])
  expect(ids(set.nodes)).toEqual(["kitchen", "wing"])
})

// `files` is not derived from `nodes`, and this is the case that proves it: an
// empty `.olai` is a file of the set the sidebar shows and a file a writer may
// append to, not a file that is missing.
test("an outline holding no nodes is still one of the set's files", () => {
  const set = assemble(decoded({
    "empty.olai": outline("empty.olai", ``),
    "a.olai": outline("a.olai", `{"id":"a","ord":"a","title":"a"}`),
  }))
  // In PATH order, which is `assemble`'s own doing rather than the order this
  // fixture happens to name them in.
  expect(set.files).toEqual(["a.olai", "empty.olai"])
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
    "good.olai": outline("good.olai", `{"id":"a","ord":"a","title":"a"}`),
    "bad.olai": unreadable("bad.olai", `{"id":"b","ord":"a",title:"b"}`),
  }))

  expect(set.files).toEqual(["bad.olai", "good.olai"])
  expect(ids(set.nodes)).toEqual(["a"])
  expect(set.broken.map((file) => file.file)).toEqual(["bad.olai"])
  expect(set.broken[0]?.errors.map((error) => `${error.file}:${error.line} ${error.code}`))
    .toEqual(["bad.olai:1 not-json"])
})

// ── the inverse ────────────────────────────────────────────────────────

/**
 * `apart` is `assemble` read backwards, and the only thing that can say so is a
 * round trip.
 *
 * Its caller — `@olai/ops`' batch fold, which swaps one file's records into the
 * map and assembles again — depends on invariants that are easy to get subtly
 * wrong from outside this module, and every one of them fails QUIETLY: a broken
 * file listed in both `files` and `broken` comes back as an empty outline
 * rather than an unreadable one, a document read before the broken paths loses
 * its errors, a regrouping that trusted `set.files` order puts a node in the
 * wrong file. So the pair is held to each other rather than to a memory of each
 * other, over a set that carries one of each kind.
 */
test("a set taken apart and assembled again is the set it was", () => {
  const set = assemble(decoded({
    "home.olai": outline(
      "home.olai",
      [
        `{"id":"kitchen","ord":"a","title":"kitchen"}`,
        `{"id":"sink","parent":"kitchen","ord":"a","title":"sink"}`,
        "",
      ].join("\n"),
    ),
    "empty.olai": outline("empty.olai", ""),
    "notes/cabinets.md": document("notes/cabinets.md", "# Cabinets\n"),
    "saved.html": Result.succeed({ file: "saved.html", text: null }),
    "bad.olai": unreadable("bad.olai", `{"id":"b","ord":"a",title:"b"}`),
  }))

  expect(assemble(apart(set))).toEqual(set)
  // The records come back as the SAME objects, not as copies that compare
  // equal: the validator's duplicate-id rule is an identity test, so a set
  // rebuilt out of clones would make every record look like a duplicate of
  // itself.
  expect(assemble(apart(set)).nodes[0]).toBe(set.nodes[0])
})

// The pair the two halves of `model-indices` slice 4 and `olai-batch-verbs`
// share, and the reason it gets a case of its own: `assemble` orders by
// `byPath` rather than by code point, so a file and the directory beside it
// sort the way a WALK meets them and not the way `<` does. `apart` returns a
// map and lets `assemble` do the ordering, which is what makes the inverse
// hold — but a `apart` that had rebuilt `files` from its own sort would pass
// every other case here and fail exactly this one, silently, by handing the
// batch fold a set in an order no load produces.
test("the inverse holds for the pair path order exists to settle", () => {
  const set = assemble(decoded({
    "wing.olai": outline("wing.olai", `{"id":"wing","ord":"a","title":"wing"}`),
    "wing/kitchen.olai": outline(
      "wing/kitchen.olai",
      `{"id":"kitchen","ord":"a","title":"kitchen"}`,
    ),
    "wing/notes.md": document("wing/notes.md", "n\n"),
  }))
  expect(set.files).toEqual(["wing/kitchen.olai", "wing.olai"])
  expect(assemble(apart(set))).toEqual(set)
  expect(assemble(apart(set)).files).toEqual(["wing/kitchen.olai", "wing.olai"])
})
