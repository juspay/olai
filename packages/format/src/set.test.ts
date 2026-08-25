import { expect, test } from "bun:test"
import { Result } from "effect"

import { printAddress } from "./address.ts"
import { bodiedDocument, type Document } from "./document.ts"
import { bytesOf } from "./documents.ts"
import type { OutlineError } from "./errors.ts"
import { failureOf, outlineOf, recordsOf } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"
import { byPath } from "./paths.ts"
import { apart, assemble, documentAt, markdownIn, outlinePaths } from "./set.ts"

type Decoded = Result.Result<Document, ReadonlyArray<OutlineError>>

/** What the store hands over: one decoded file per path, each either decoded
 *  or failed. A `Map` rather than a record because that is the shape the codec
 *  seam passes — and its ORDER is deliberately not the answer: `documents` is
 *  documented as every served file in path order, and `assemble` puts them in
 *  it rather than trusting whoever built the map to have done so. */
const decoded = (files: Record<string, Decoded>): ReadonlyMap<string, Decoded> =>
  new Map(Object.entries(files))

const outline = (file: string, contents: string): Decoded =>
  Result.succeed(outlineOf(contents, file))

/** A `.md`: found, served, and carrying its text. */
const document = (file: string, text: string): Decoded =>
  Result.succeed(bodiedDocument(file, text))

const unreadable = (file: string, contents: string): Decoded =>
  Result.fail(failureOf(contents, file))

const ids = (nodes: ReadonlyArray<Located>): ReadonlyArray<string> =>
  nodes.map((located) => located.node.id)

/** The served paths, as the plain strings they spell. A brand is a fact about
 *  where a value came from rather than about what it says, so an expectation is
 *  written the way somebody would say it. */
const paths = (
  set: { readonly documents: ReadonlyArray<Document> },
): ReadonlyArray<string> => set.documents.map((document) => document.path)

/** The same, for any list of branded strings. */
const spelled = (values: ReadonlyArray<string>): ReadonlyArray<string> => [...values]

// ONE COLLECTION, whatever the kind: a decode hands over the document a file
// amounts to, and the assembly collects them in path order. Which kind a file
// is was decided by its NAME long before this, and the arm is that answer
// carried on the value rather than a second reading of it.
test("assemble collects every decoded file as the document it is", () => {
  const set = assemble(decoded({
    "home.olai": outline("home.olai", `{"id":"kitchen","ord":"a","title":"kitchen"}\n`),
    "notes/cabinets.md": document("notes/cabinets.md", "# Cabinets\n"),
    "work.olai": outline(
      "work.olai",
      `{"id":"budget","ord":"a","title":"budget"}\n{"id":"m","ord":"b","mirror":"kitchen"}`,
    ),
  }))

  expect(paths(set)).toEqual(["home.olai", "notes/cabinets.md", "work.olai"])
  expect(set.documents.map((one) => one.kind)).toEqual(["outline", "document", "outline"])
  expect(outlinePaths(set)).toEqual(["home.olai", "work.olai"])
  expect(spelled(markdownIn(set).map((one) => one.path))).toEqual(["notes/cabinets.md"])
  expect(markdownIn(set).map((one) => one.body)).toEqual(["# Cabinets\n"])
  // The nodes are reachable THROUGH the outline they were written in, in file
  // order and then line order — the same records the flat list used to hold,
  // one level down.
  expect(ids(recordsOf(set))).toEqual(["kitchen", "budget", "m"])
  expect(recordsOf(set).map((located) => `${located.file}:${located.line}`))
    .toEqual(["home.olai:1", "work.olai:1", "work.olai:2"])
})

// A DOCUMENT ARRIVES WITH ITS FACE, which is the whole of what PR 2 added to
// the set: a title, the addresses it points at, the tags its prose writes and
// the elements it can be addressed by — none of it a field on disk, all of it
// total, none of it something a consumer can forget to derive.
test("a markdown document carries a face", () => {
  const set = assemble(decoded({
    "notes/plan.md": document(
      "notes/plan.md",
      [
        "# The plan",
        "",
        "Talk to @alice about #kitchen, then read [the brief](../brief.md#scope).",
        "",
        "## Next steps",
      ].join("\n"),
    ),
    "brief.md": document("brief.md", "# Brief\n\n## Scope\n"),
  }))

  const plan = markdownIn(set).find((one) => one.path === "notes/plan.md")!
  expect(plan.title).toBe("The plan")
  // `#scope` is in there because a body is READ AS TEXT by the tag walk, the
  // same way a note is (`./derive.ts` makes that refusal and says why: this
  // package holds no markdown parser, and putting one under the write gate is
  // the trade it declines). A link's fragment looks exactly like a tag, and it
  // is left as it falls rather than special-cased by a scan pretending to know
  // what a link is.
  expect(spelled(plan.tags)).toEqual(["@alice", "#kitchen", "#scope"])
  expect(spelled(plan.headings)).toEqual(["the-plan", "next-steps"])
  // WRITTEN, because a canonical spelling is what an address promises and it is
  // what a reader of this test wants to see.
  expect(plan.links.map(printAddress)).toEqual(["brief.md#scope"])
  // Remembered at decode: a listing that re-encoded `body` to report this
  // would be paying the cost this field exists to stop paying.
  expect(plan.bytes).toBe(bytesOf(plan.body))
})

// An OUTLINE has one too, and its face is read off the records: what its nodes
// attach, what they cross-reference, what their prose links and tags. That is
// what makes "who points at this document" a question with one answer for both
// kinds (`./backlinks.ts`).
test("an outline carries a face read off its records", () => {
  const set = assemble(decoded({
    "home.olai": outline(
      "home.olai",
      [
        `{"id":"kitchen","ord":"a","title":"kitchen #home","doc":"notes/cabinets.md"}`,
        `{"id":"sink","ord":"b","title":"sink","see":["kitchen"],"desc":"see [the brief](brief.md)"}`,
        "",
      ].join("\n"),
    ),
    "notes/cabinets.md": document("notes/cabinets.md", "# Cabinets\n"),
    "brief.md": document("brief.md", "# Brief\n"),
  }))

  const home = set.documents.find((one) => one.path === "home.olai")!
  // The FILENAME, which is what an outline has always been called.
  expect(home.title).toBe("home")
  expect(spelled(home.tags)).toEqual(["#home"])
  expect(home.links.map(printAddress)).toEqual([
    "notes/cabinets.md",
    "#kitchen",
    "brief.md",
  ])
})

// HYPERTEXT is a face and nothing else, and the emptiness is `kinds.ts`'s
// `kept: false` showing through rather than a claim that a saved page points
// nowhere: nothing here has read it.
test("hypertext is a face and no body", () => {
  const set = assemble(decoded({
    "saved.html": Result.succeed(bodiedDocument("saved.html", null)),
  }))
  const saved = set.documents[0]!
  expect(saved.kind).toBe("hypertext")
  expect(paths(set)).toEqual(["saved.html"])
  expect(saved.title).toBe("saved")
  expect(saved.links).toEqual([])
  expect(spelled(saved.tags)).toEqual([])
  expect(markdownIn(set)).toEqual([])
})

// PATH ORDER is `assemble`'s promise and not its caller's, which is what makes
// it true of every caller. The one in the tree that does not walk a directory
// is the write gate: it assembles what the last probe held with the files it is
// about to write swapped in, so a path that did not exist before sits at the
// END of that map — and until #208 a created `_olai/Trash.olai` was published after
// the `house.olai` it sorts before, which `list_outlines` answers with and a
// search tie breaks on.
test("documents come out in path order, whatever order the map holds", () => {
  const set = assemble(decoded({
    "zeta.olai": outline("zeta.olai", `{"id":"z","ord":"a","title":"z"}`),
    "notes/zebra.md": document("notes/zebra.md", "z\n"),
    "_olai/Trash.olai": outline("_olai/Trash.olai", `{"id":"arch","ord":"a","title":"arch"}`),
    "notes/apple.md": document("notes/apple.md", "a\n"),
    "middle.olai": outline("middle.olai", `{"id":"mid","ord":"a","title":"mid"}`),
  }))
  expect(paths(set)).toEqual([
    "_olai/Trash.olai",
    "middle.olai",
    "notes/apple.md",
    "notes/zebra.md",
    "zeta.olai",
  ])
  // The records follow it file by file, which is why the sort is done to the
  // paths before anything is built rather than to the lists afterwards.
  expect(ids(recordsOf(set))).toEqual(["arch", "mid", "z"])
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
  expect(outlinePaths(set)).toEqual(["wing/kitchen.olai", "wing.olai"])
  expect(ids(recordsOf(set))).toEqual(["kitchen", "wing"])
})

// The collection is not derived from the records, and this is the case that
// proves it: an empty `.olai` is a file of the set the sidebar shows and a file
// a writer may append to, not a file that is missing.
test("an outline holding no nodes is still one of the set's documents", () => {
  const set = assemble(decoded({
    "empty.olai": outline("empty.olai", ``),
    "a.olai": outline("a.olai", `{"id":"a","ord":"a","title":"a"}`),
  }))
  // In PATH order, which is `assemble`'s own doing rather than the order this
  // fixture happens to name them in.
  expect(outlinePaths(set)).toEqual(["a.olai", "empty.olai"])
  expect(ids(recordsOf(set))).toEqual(["a"])
})

// Nothing served is an empty set rather than an absent one: both fields are
// always there, so the browser renders "no outlines here" from the same shape
// it renders everything else from.
test("nothing decoded assembles to an empty set", () => {
  expect(assemble(decoded({}))).toEqual({ documents: [], broken: [] })
})

// A file that did not parse is still a file that was FOUND. It keeps its place
// in the collection as an EMPTY document of its own kind and carries its own
// errors, which is what lets the view put them where that outline would have
// been instead of blanking the page.
test("a file that did not decode keeps its place and carries its errors", () => {
  const set = assemble(decoded({
    "good.olai": outline("good.olai", `{"id":"a","ord":"a","title":"a"}`),
    "bad.olai": unreadable("bad.olai", `{"id":"b","ord":"a",title:"b"}`),
  }))

  expect(outlinePaths(set)).toEqual(["bad.olai", "good.olai"])
  expect(ids(recordsOf(set))).toEqual(["a"])
  expect(set.broken.map((file) => file.file)).toEqual(["bad.olai"])
  expect(set.broken[0]?.errors.map((error) => `${error.file}:${error.line} ${error.code}`))
    .toEqual(["bad.olai:1 not-json"])
})

// The same for a BODIED file the probe could not read: it holds its place as a
// document with no text, so the sidebar lists it and a write refuses to
// re-emit it from a body nobody read.
test("an unreadable document holds its place with an empty body", () => {
  const set = assemble(decoded({
    "notes/lost.md": Result.fail([
      { file: "notes/lost.md", line: 0, code: "unreadable-directory", message: "gone" },
    ] as ReadonlyArray<OutlineError>),
  }))
  const lost = markdownIn(set)[0]!
  expect(paths(set)).toEqual(["notes/lost.md"])
  expect(lost.body).toBe("")
  // The FILENAME, since an empty body has no first line to be called by.
  expect(lost.title).toBe("lost")
  expect(spelled(lost.headings)).toEqual([])
  expect(set.broken.map((file) => file.file)).toEqual(["notes/lost.md"])
})

// ── the inverse ────────────────────────────────────────────────────────

/**
 * `apart` is `assemble` read backwards, and the only thing that can say so is a
 * round trip.
 *
 * Its caller — `@olai/ops`' batch fold, which swaps one file's records into the
 * map and assembles again — depends on invariants that are easy to get subtly
 * wrong from outside this module, and every one of them fails QUIETLY: a broken
 * file listed in both `documents` and `broken` comes back as an empty outline
 * rather than an unreadable one, a document read before the broken paths loses
 * its errors. So the pair is held to each other rather than to a memory of each
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
    "saved.html": Result.succeed(bodiedDocument("saved.html", null)),
    "bad.olai": unreadable("bad.olai", `{"id":"b","ord":"a",title:"b"}`),
  }))

  expect(assemble(apart(set))).toEqual(set)
  // The records come back as the SAME objects, not as copies that compare
  // equal: the validator's duplicate-id rule is an identity test, so a set
  // rebuilt out of clones would make every record look like a duplicate of
  // itself.
  expect(recordsOf(assemble(apart(set)))[0]).toBe(recordsOf(set)[0])
})

// The pair the two halves of `model-indices` slice 4 and `olai-batch-verbs`
// share, and the reason it gets a case of its own: `assemble` orders by
// `byPath` rather than by code point, so a file and the directory beside it
// sort the way a WALK meets them and not the way `<` does. `apart` returns a
// map and lets `assemble` do the ordering, which is what makes the inverse
// hold — but an `apart` that had rebuilt the collection from its own sort would
// pass every other case here and fail exactly this one, silently, by handing
// the batch fold a set in an order no load produces.
test("the inverse holds for the pair path order exists to settle", () => {
  const set = assemble(decoded({
    "wing.olai": outline("wing.olai", `{"id":"wing","ord":"a","title":"wing"}`),
    "wing/kitchen.olai": outline(
      "wing/kitchen.olai",
      `{"id":"kitchen","ord":"a","title":"kitchen"}`,
    ),
    "wing/notes.md": document("wing/notes.md", "n\n"),
  }))
  expect(outlinePaths(set)).toEqual(["wing/kitchen.olai", "wing.olai"])
  expect(assemble(apart(set))).toEqual(set)
  expect(outlinePaths(assemble(apart(set)))).toEqual(["wing/kitchen.olai", "wing.olai"])
})

// ── the point lookup, against the walk it replaced ──────────────────────

/**
 * `documentAt` IS A BINARY SEARCH over the order {@link assemble} promises
 * (`perf-published-maps`), which is a change to how the answer is ARRIVED AT
 * and to nothing else — so what is asked here is the equivalence: every path,
 * and a handful that are not paths at all, looked up both ways.
 *
 * The corpus is chosen to break it rather than to demonstrate it. `wing.olai`
 * beside `wing/kitchen.olai` is the pair the test above exists for — a search
 * comparing with `<` instead of {@link byPath} looks in the wrong half for
 * exactly one of them — and the misses are the cases where a search that fell
 * off either end would answer with a neighbour instead of with nothing.
 */
test("a file found by search is the file a walk finds", () => {
  const files: Record<string, Decoded> = {}
  for (const path of [
    "wing.olai",
    "wing/kitchen.olai",
    "wing/attic.olai",
    "_olai/Inbox.olai",
    "_olai/Trash.olai",
    "Areas.olai",
    "areas.olai",
    "a.olai",
    "a/b.olai",
    "a/b/c.olai",
    "zzz.olai",
  ]) files[path] = outline(path, `{"id":"${path.replace(/[^a-z]/gi, "")}","ord":"a","title":"t"}`)
  for (const path of ["notes.md", "wing/notes.md", "a/b/notes.md", "art/handle.png"]) {
    files[path] = document(path, "n\n")
  }
  const set = assemble(decoded(files))
  const walked = (path: string): Document | undefined =>
    set.documents.find((document) => document.path === path)

  for (
    const path of [
      ...Object.keys(files),
      // ...and the paths that are NOT there: before the first, after the last,
      // between two neighbours, a prefix of one, and one a segment longer.
      "",
      "AAAA.olai",
      "zzzz.olai",
      "wing",
      "wing/",
      "wing/kitchen",
      "wing/kitchen.olai/deeper.olai",
      "b.olai",
      "_olai/Pins.olai",
    ]
  ) expect(documentAt(set, path)).toBe(walked(path) as never)
})
