import { expect, test } from "bun:test"

import {
  countedChildren,
  derive,
  fromChildren,
  type Row,
  rowsOf,
  type Status,
  storedMarker,
  titleParts,
  withoutDone,
} from "./derive.ts"
import { FIXTURE_FILE, nodesOf, nodesOfFiles } from "./fixtures.testlib.ts"
import { isMirror, type Located, type RegularNode } from "./node.ts"

const statusesOf = (contents: string): ReadonlyMap<string, Status> =>
  derive(nodesOf(contents)).status

const ids = (nodes: ReadonlyArray<Located>): ReadonlyArray<string> =>
  nodes.map((located) => located.node.id)

/** The regular records of a fixture, for the functions that read a node's own
 *  stored fields rather than a whole set. */
const regulars = (contents: string): ReadonlyArray<RegularNode> =>
  nodesOf(contents).flatMap((located) => isMirror(located.node) ? [] : [located.node])

/** A row's tree, flattened to `key kind` — the two facts a renderer switches
 *  on, and the two this file is about. */
const shape = (rows: ReadonlyArray<Row>): ReadonlyArray<string> =>
  rows.flatMap((row) => [`${row.key} ${row.kind}`, ...shape(row.children)])

/** The row at `index`, insisting it is one that draws a node. `shows` lives on
 *  those two kinds alone, so a test reading it has to say which it expected —
 *  and hears which stub it got instead when the walk disagrees. */
const drawn = (
  rows: ReadonlyArray<Row>,
  index: number,
): Extract<Row, { readonly kind: "node" | "mirror" }> => {
  const row = rows[index]
  if (row === undefined) throw new Error(`expected a row at ${index}, got none`)
  if (row.kind !== "node" && row.kind !== "mirror") {
    throw new Error(`expected row ${index} to draw a node, got a \`${row.kind}\` stub`)
  }
  return row
}

/** What a stub row says, as one string per row: the id a dangling chain died
 *  on, the id a cycle closed on, or the kind that turned out not to be one. */
const stubbed = (row: Row): string =>
  row.kind === "dangling"
    ? `dangling ${row.missing}`
    : row.kind === "cycle"
    ? `cycle ${row.through}`
    : `drawn ${row.kind}`

// ── the indexes ────────────────────────────────────────────────────────

// A leaf is the only node allowed to store a status, so a leaf is the only
// place the stored value is read back as-is — and a leaf carrying no mark is
// not a task, which the index says by not holding it at all.
test("a leaf reports what it stores, and an unmarked one reports nothing", () => {
  const status = statusesOf(
    `{"id":"a","ord":"a","title":"a","done":true}\n` +
      `{"id":"b","ord":"b","title":"b","doing":"2026-08-10"}\n` +
      `{"id":"c","ord":"c","title":"c"}`,
  )
  expect(status.get("a")).toBe("done")
  expect(status.get("b")).toBe("doing")
  expect(status.get("c")).toBeUndefined()
  // ABSENT, not present-and-empty: "no status" has one spelling, the way an
  // absent field does on disk.
  expect(status.has("c")).toBe(false)
})

// What a record CLAIMS about itself, as opposed to what it ends up showing: the
// validator's refusal quotes the stored marker by name ("`done` is computed
// from this node's 3 children"), so the two read the same field the same way.
test("the stored marker is the field a record actually carries, or nothing", () => {
  expect(
    regulars(
      `{"id":"a","ord":"a","title":"a","done":true}\n` +
        `{"id":"b","ord":"b","title":"b","doing":"2026-08-10"}\n` +
        `{"id":"c","ord":"c","title":"c"}`,
    ).map(storedMarker),
  ).toEqual(["done", "doing", undefined])

  // Written by hand because the parser refuses this line: the two markers are
  // exclusive on disk, so this only decides what a set the validator has
  // already condemned looks like — and it looks done.
  expect(storedMarker({ id: "x", ord: "a", title: "x", done: true, doing: true }))
    .toBe("done")
})

// A parent's status is the sum of the children that are TASKS — the one rule
// the validator refuses to let anyone store, so this is where it actually
// lives.
test("a parent is the sum of the children that are tasks", () => {
  const done = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","done":true}`,
  )
  expect(done.get("p")).toBe("done")

  // Something still under way is what makes a parent unfinished.
  const partly = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","doing":true}`,
  )
  expect(partly.get("p")).toBe("doing")

  // An UNMARKED sibling is not an unfinished one. It is a bullet, it owes
  // nothing, and it does not hold its parent back: every task under `p` is
  // done, so `p` is done. This is the line the old `open` residual got wrong —
  // it counted `c2` as a to-do nobody had started and read `p` as `doing`.
  const alongsideBullets = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2"}`,
  )
  expect(alongsideBullets.get("p")).toBe("done")

  // And a parent whose children are ALL bullets is a bullet itself: nothing
  // under it is a task, so there is nothing for it to be the sum of.
  const bullets = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1"}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2"}`,
  )
  expect(bullets.get("p")).toBeUndefined()
})

// What the children say is one answer with three shapes, and it is what both
// refusals — the validator's load error and the ops layer's refused write —
// are built from. The children to name exist only in the third, so the two
// sites cannot disagree about whether there are any.
test("what the children say is one of three answers", () => {
  const said = (contents: string, id: string) => fromChildren(derive(nodesOf(contents)), id)

  // Nothing: a node whose children are all bullets is a bullet.
  expect(said(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1"}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2"}`,
    "p",
  )).toEqual({ kind: "nothing", counted: 2 })

  // Done: every task under it is finished. The unmarked sibling is counted as
  // a child — the sentence says how many there are — and is not in the way.
  expect(said(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2"}`,
    "p",
  )).toEqual({ kind: "done", counted: 2 })

  // Unfinished: the tasks that are not done, and nothing else — not the
  // bullet, not the mirror, not the child that is already finished.
  const unfinished = said(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","doing":true}\n` +
      `{"id":"c3","parent":"p","ord":"c","title":"c3"}\n` +
      `{"id":"c4","parent":"p","ord":"d","mirror":"c1"}`,
    "p",
  )
  expect(unfinished?.kind).toBe("unfinished")
  expect(unfinished?.counted).toBe(3)
  expect(ids(unfinished?.kind === "unfinished" ? unfinished.children : [])).toEqual(["c2"])

  // A child that is a task because of ITS children counts the same way.
  const nested = said(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"mid","parent":"p","ord":"a","title":"mid"}\n` +
      `{"id":"leaf","parent":"mid","ord":"a","title":"leaf","doing":true}`,
    "p",
  )
  expect(ids(nested?.kind === "unfinished" ? nested.children : [])).toEqual(["mid"])

  // And a node with no counted children is not what either refusal is about.
  expect(said(`{"id":"p","ord":"a","title":"p","done":true}`, "p")).toBeNull()
})

// The rule has to hold through a whole branch, not one level: a grandparent's
// status is computed from statuses that were themselves computed.
test("a parent of parents composes rather than looking one level down", () => {
  const status = statusesOf(
    `{"id":"top","ord":"a","title":"top"}\n` +
      `{"id":"mid","parent":"top","ord":"a","title":"mid"}\n` +
      `{"id":"leaf1","parent":"mid","ord":"a","title":"l1","done":true}\n` +
      `{"id":"leaf2","parent":"mid","ord":"b","title":"l2","doing":true}\n` +
      `{"id":"other","parent":"top","ord":"b","title":"other"}`,
  )
  expect(status.get("mid")).toBe("doing")
  // `other` is a bullet and counts for nothing, but `mid` is a task and is
  // under way, so the top is under way too.
  expect(status.get("top")).toBe("doing")
})

// A mirror shows a node, so it shows that node's status; a checkbox that
// disagreed with the one two lines up would make mirrors unusable.
test("a mirror reports its target's status, however deep the target's own is", () => {
  const status = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
      `{"id":"m","ord":"b","mirror":"p"}`,
  )
  expect(status.get("p")).toBe("done")
  expect(status.get("m")).toBe("done")
})

// A mirror is a placement, not a second obligation. If it counted, showing a
// node in a second place could flip an unrelated parent out of "done".
test("a mirror child does not count toward the status of the node it sits under", () => {
  const contents = `{"id":"elsewhere","ord":"z","title":"somewhere else"}\n` +
    `{"id":"p","ord":"a","title":"p"}\n` +
    `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
    `{"id":"m","parent":"p","ord":"b","mirror":"elsewhere"}`
  const derived = derive(nodesOf(contents))
  expect(derived.status.get("m")).toBeUndefined()
  expect(derived.status.get("p")).toBe("done")

  // The mirror is still a child for *placement* — it renders under `p`…
  expect(ids(derived.children.get("p") ?? [])).toEqual(["c", "m"])
  // …and still not one for *status*, which is the set the validator lists.
  expect(ids(countedChildren(derived, "p"))).toEqual(["c"])
})

// `ord` is a fractional index over base62, so plain string comparison IS the
// sort. Anything that treated it as a number would put `a10` after `a2`, and
// an insert between two siblings would land in the wrong place.
test("siblings sort by string comparison of ord, never numerically", () => {
  const derived = derive(nodesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"two","parent":"p","ord":"a2","title":"two"}\n` +
      `{"id":"ten","parent":"p","ord":"a10","title":"ten"}\n` +
      `{"id":"upper","parent":"p","ord":"Z","title":"upper"}`,
  ))
  expect(ids(derived.children.get("p") ?? [])).toEqual(["upper", "ten", "two"])
})

// Two siblings can legitimately share an `ord` after a merge. File order
// decides, rather than whatever the engine's sort happens to do, so two loads
// of the same file render in the same order.
test("equal ords break on line, not on sort stability", () => {
  const derived = derive(nodesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"later","parent":"p","ord":"m","title":"later"}\n` +
      `{"id":"earlier","parent":"p","ord":"m","title":"earlier"}`,
  ))
  expect(ids(derived.children.get("p") ?? [])).toEqual(["later", "earlier"])
})

// The validator reports a duplicate id on the SECOND record and points back at
// the first, which only reads as advice if every other reference still means
// the first one. `byId` and that error therefore have to pick the same record,
// or a set with one duplicate would report a second, invented dangling edge.
test("a duplicated id resolves to the record that claimed it first", () => {
  const within = derive(nodesOf(
    `{"id":"x","ord":"a","title":"first"}\n{"id":"x","ord":"b","title":"second"}`,
  ))
  expect(within.byId.get("x")?.line).toBe(1)

  const across = derive(nodesOfFiles({
    "a.jsonl": `{"id":"x","ord":"a","title":"first"}`,
    "b.jsonl": `{"id":"x","ord":"a","title":"second"}`,
  }))
  expect([across.byId.get("x")?.file, across.byId.get("x")?.line]).toEqual(["a.jsonl", 1])
  // One entry per id, not one per record: the map is an index, not a list.
  expect(across.byId.size).toBe(1)
})

// ── the drawable tree ──────────────────────────────────────────────────

// A mirror is expanded in place, because a pointer the reader has to go and
// follow is not a second location — it is a footnote. So the row says it is a
// mirror, and its children are the TARGET's, drawn under the mirror's own key.
test("a mirror row is drawn with its target's children", () => {
  const nodes = nodesOf(
    `{"id":"p","ord":"b","title":"p"}\n` +
      `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
      `{"id":"m","ord":"a","mirror":"p"}`,
  )
  const rows = rowsOf(derive(nodes), "a.jsonl")
  const mirror = drawn(rows, 0)
  expect(mirror.kind).toBe("mirror")
  // `at` is the record occupying the place; `shows` is what is drawn there —
  // and it is known to be a regular node, so its title is a field read.
  expect(mirror.at.node.id).toBe("m")
  expect(mirror.shows.node.id).toBe("p")
  expect(mirror.shows.node.title).toBe("p")
  expect(mirror.children.map((row) => row.at.node.id)).toEqual(["c"])
  // And it shows the target's status, the same one the index computed.
  expect(mirror.status).toBe("done")
  const node = drawn(rows, 1)
  expect(node.kind).toBe("node")
  // A regular node shows itself — the very record, not a copy of it.
  expect(node.at).toBe(node.shows)
})

// A mirror of a mirror is legal — nothing in the format forbids a second
// pointer to a pointer — and following one hop would leave a row standing for
// a record with no title and no children of its own: a legal set the reader
// cannot draw. So the chain is followed to its end, and the row draws the
// children of the node it ended at.
test("a mirror of a mirror shows the node at the end of the chain, with its children", () => {
  const nodes = nodesOf(
    `{"id":"p","ord":"c","title":"the real one"}\n` +
      `{"id":"kid","parent":"p","ord":"a","title":"kid"}\n` +
      `{"id":"hop","ord":"b","mirror":"p"}\n` +
      `{"id":"far","ord":"a","mirror":"hop"}`,
  )
  const far = drawn(rowsOf(derive(nodes), "a.jsonl"), 0)
  expect(far.at.node.id).toBe("far")
  expect(far.kind).toBe("mirror")
  // Through both hops, to the node that actually carries a title…
  expect(far.shows.node.id).toBe("p")
  expect(far.shows.node.title).toBe("the real one")
  // …and it draws THAT node's children, under this place's own key. The
  // intermediate mirror has no children of its own, so a walk that stopped at
  // it would draw an empty row.
  expect(shape([far])).toEqual(["/far mirror", "/far/kid node"])
})

// A row's key is the identity of the PLACE, not of the node. The same node
// reached through two routes is two rows on screen, and folding one must not
// fold the other — which is only true if their keys differ.
test("one node reached through two places has two keys", () => {
  const nodes = nodesOf(
    `{"id":"p","ord":"b","title":"p"}\n` +
      `{"id":"c","parent":"p","ord":"a","title":"c"}\n` +
      `{"id":"m","ord":"a","mirror":"p"}`,
  )
  const rows = shape(rowsOf(derive(nodes), "a.jsonl"))
  expect(rows).toEqual(["/m mirror", "/m/c node", "/p node", "/p/c node"])
  expect(new Set(rows).size).toBe(rows.length)
})

// A mirror whose target is not in the set is a place with nothing to show. It
// is named as such rather than silently dropped — the validator has already
// refused the set, and the reader is looking at it to find out why.
test("a mirror with no target is a dangling row with no children", () => {
  const nodes = nodesOf(`{"id":"m","ord":"a","mirror":"gone"}`)
  const rows = rowsOf(derive(nodes), "a.jsonl")
  expect(rows.map(stubbed)).toEqual(["dangling gone"])
  // Nothing to draw, so the row carries no `shows` at all — a view switching
  // on `kind` never has a placeholder to test for.
  expect(rows.map((row) => "shows" in row)).toEqual([false])
  expect(rows[0]?.children).toEqual([])
})

// The id a dangling row names is the one the CHAIN died on. `b` exists here,
// so "a mirror of `b`, which no node declares" would be a lie — it is `b`'s own
// target that is missing, and only the walk knows that.
test("a dangling row names where the chain died, not the first hop", () => {
  const nodes = nodesOf(
    `{"id":"a","ord":"a","mirror":"b"}\n{"id":"b","ord":"b","mirror":"c"}`,
  )
  const rows = rowsOf(derive(nodes), "a.jsonl")
  expect(rows.map(stubbed)).toEqual(["dangling c", "dangling c"])
  expect(rows.map((row) => row.at.node.id)).toEqual(["a", "b"])
})

// The other way a chain can fail to end: it comes back to a record it has
// already followed. That is a cycle in the POINTERS, found before any tree is
// drawn, and the row names the id it closed on rather than the first hop.
test("a mirror chain that closes on itself is a cycle naming where it closed", () => {
  const itself = nodesOf(`{"id":"m","ord":"a","mirror":"m"}`)
  expect(rowsOf(derive(itself), "a.jsonl").map(stubbed)).toEqual(["cycle m"])

  // Two mirrors showing each other: from `m1` the chain runs m1 → m2 → m1, so
  // that place closed on `m1`, and the place at `m2` on `m2`.
  const pair = nodesOf(
    `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
  )
  const rows = rowsOf(derive(pair), "a.jsonl")
  expect(rows.map(stubbed)).toEqual(["cycle m1", "cycle m2"])
  expect(rows.every((row) => row.children.length === 0)).toBe(true)

  // And the id it closed on is not the id it started from: `a` points into a
  // loop it is not itself part of, so the honest answer is `b`.
  const into = nodesOf(
    `{"id":"a","ord":"a","mirror":"b"}\n` +
      `{"id":"b","ord":"b","mirror":"c"}\n` +
      `{"id":"c","ord":"c","mirror":"b"}`,
  )
  expect(rowsOf(derive(into), "a.jsonl").map(stubbed))
    .toEqual(["cycle b", "cycle b", "cycle c"])
})

// The headline case for the cycle guard: a mirror of `a` placed inside `a`.
// Drawing `a` draws the mirror, which draws `a`. The validator refuses this
// set — and the rows are drawn anyway, because its own error messages quote
// derived status. A renderer that hung is a worse way to learn about a bug
// than a marked stub, so this test failing looks like a timeout.
test("a mirror inside its own subtree is a cycle stub, not a hang", () => {
  const nodes = nodesOf(
    `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"a"}`,
  )
  const rows = rowsOf(derive(nodes), "a.jsonl")
  expect(shape(rows)).toEqual(["/a node", "/a/m cycle"])
  // And it says which ancestor it closed on, which is what a view would
  // otherwise have to guess from the mirror's own id.
  expect(rows[0]?.children.map(stubbed)).toEqual(["cycle a"])

  // Any depth, not just directly under the target: the guard is the ancestors
  // of the place, not the parent of the mirror.
  const deep = nodesOf(
    `{"id":"a","ord":"a","title":"a"}\n` +
      `{"id":"b","parent":"a","ord":"a","title":"b"}\n` +
      `{"id":"m","parent":"b","ord":"b","mirror":"a"}`,
  )
  const deepRows = rowsOf(derive(deep), "a.jsonl")
  expect(shape(deepRows)).toEqual(["/a node", "/a/b node", "/a/b/m cycle"])
  expect(deepRows[0]?.children[0]?.children.map(stubbed)).toEqual(["cycle a"])
})

// Every `.jsonl` is an independent tree, so the rows of a file are its own
// roots — the set is flat and carries every file's nodes, so the filtering is
// what makes "the rows of this file" mean anything at all.
test("roots are the requested file's own top-level nodes, in ord order", () => {
  const nodes = nodesOfFiles({
    "a.jsonl": `{"id":"second","ord":"b","title":"b"}\n` +
      `{"id":"first","ord":"a","title":"a"}\n` +
      `{"id":"kid","parent":"first","ord":"a","title":"kid"}`,
    "b.jsonl": `{"id":"elsewhere","ord":"a","title":"elsewhere"}`,
  })
  // One `Derived` for every file: it carries the nodes it was built from, so
  // the rows of two files cannot be drawn from two different revisions.
  const derived = derive(nodes)
  expect(shape(rowsOf(derived, "a.jsonl")))
    .toEqual(["/first node", "/first/kid node", "/second node"])
  expect(shape(rowsOf(derived, "b.jsonl"))).toEqual(["/elsewhere node"])
  // A file with no nodes of its own draws nothing, rather than everything.
  expect(rowsOf(derived, "c.jsonl")).toEqual([])
})

// ── hiding what is done ────────────────────────────────────────────────

const HOUSEWORK = `{"id":"kitchen","ord":"a0","title":"kitchen"}\n` +
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demo","done":true}\n` +
  `{"id":"install","parent":"kitchen","ord":"a1","title":"install"}\n` +
  `{"id":"handles","parent":"install","ord":"a0","title":"handles","doing":true}`

test("hiding what is done drops the done rows and keeps the rest", () => {
  const rows = rowsOf(derive(nodesOf(HOUSEWORK)), FIXTURE_FILE)
  expect(shape(rows)).toEqual([
    "/kitchen node",
    "/kitchen/demo node",
    "/kitchen/install node",
    "/kitchen/install/handles node",
  ])
  expect(shape(withoutDone(rows))).toEqual([
    "/kitchen node",
    "/kitchen/install node",
    "/kitchen/install/handles node",
  ])
})

// A done PARENT takes its subtree with it: every task below it is done — that
// is what made it done — and the bullets among them are notes on finished work
// rather than anything outstanding. A row kept under a hidden parent would
// have nowhere to hang in any case.
test("a done parent hides its whole subtree, bullets included", () => {
  const rows = rowsOf(
    derive(
      nodesOf(
        `{"id":"finished","ord":"a0","title":"finished"}\n` +
          `{"id":"one","parent":"finished","ord":"a0","title":"one","done":true}\n` +
          `{"id":"two","parent":"finished","ord":"a1","title":"two","done":true}\n` +
          `{"id":"aside","parent":"finished","ord":"a2","title":"how it went"}`,
      ),
    ),
    FIXTURE_FILE,
  )
  expect(withoutDone(rows)).toEqual([])
})

// Hidden, never touched: the rows handed in are the same rows afterwards, so
// the switch cannot be mistaken for an edit.
test("hiding leaves the rows it was given alone", () => {
  const rows = rowsOf(derive(nodesOf(HOUSEWORK)), FIXTURE_FILE)
  const before = shape(rows)
  withoutDone(rows)
  expect(shape(rows)).toEqual(before)
})

// ── titles ─────────────────────────────────────────────────────────────

/** The tags of a title, in reading order — what a filter runs on, assembled
 *  from the parts because the format stores no tag list. */
const tags = (title: string): ReadonlyArray<string> =>
  titleParts(title).flatMap((part) => (part.kind === "tag" ? [part.tag] : []))

// Tags live inline in the title verbatim — the format stores no tag list — so
// the split is what the view renders, and it has to keep the text intact.
test("a title splits into text and tags, and rejoins to itself", () => {
  const parts = titleParts("call #alice about #work/olai now")
  expect(parts).toEqual([
    { kind: "text", text: "call " },
    { kind: "tag", tag: "alice" },
    { kind: "text", text: " about " },
    // A `/` is part of the tag, so `#work/olai` is one tag and not two.
    { kind: "tag", tag: "work/olai" },
    { kind: "text", text: " now" },
  ])
  expect(
    parts.map((part) => (part.kind === "tag" ? `#${part.tag}` : part.text)).join(""),
  ).toBe("call #alice about #work/olai now")
})

// A bare `#` is punctuation people write ("issue #, see below"); treating it as
// an empty tag would style the rest of the line as one.
test("a bare hash is text", () => {
  expect(titleParts("issue # 42")).toEqual([{ kind: "text", text: "issue # 42" }])
  expect(tags("issue # 42")).toEqual([])
})

// The tags come out in reading order, over the same alphabet ids use plus `/`,
// so a filter reading them off the parts sees the title as written.
test("tags come out in reading order, over the tag alphabet", () => {
  expect(tags("#b then #a then #b again")).toEqual(["b", "a", "b"])
  expect(tags("#Tag-1 #tag_2")).toEqual(["Tag-1", "tag_2"])
})

// ── loops ──────────────────────────────────────────────────────────────

// Derivation runs against sets the validator has already condemned — its own
// error messages quote derived status — so a loop must produce a stub, not a
// hung renderer. This test failing looks like a timeout, which is the point.
test("a cyclic set derives without hanging", () => {
  const parents = statusesOf(
    `{"id":"a","parent":"b","ord":"a","title":"a"}\n` +
      `{"id":"b","parent":"a","ord":"b","title":"b"}`,
  )
  expect(parents.get("a")).toBeUndefined()
  expect(parents.get("b")).toBeUndefined()

  const mirrors = statusesOf(
    `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
  )
  expect(mirrors.get("m1")).toBeUndefined()
  expect(mirrors.get("m2")).toBeUndefined()

  // A mirror whose target was never declared is the other walk that could have
  // gone looking for a node that is not there.
  expect(statusesOf(`{"id":"m","ord":"a","mirror":"gone"}`).get("m")).toBeUndefined()
})
