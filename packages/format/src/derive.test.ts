import { expect, test } from "bun:test"

import {
  countedChildren,
  derive,
  type Progress,
  progressOf,
  type Row,
  rowsOf,
  type Status,
  storedMarker,
  titleParts,
  unfinishedUnder,
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

// A node's status is the mark it stores, and one carrying no mark is not a
// task — which the index says by not holding it at all.
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

// Which field a record actually carries, which is also its status — the ops
// layer reads this to decide whether an undo has anything to take off.
test("the stored marker is the field a record actually carries, or nothing", () => {
  expect(
    regulars(
      `{"id":"a","ord":"a","title":"a","done":true}\n` +
        `{"id":"b","ord":"b","title":"b","doing":"2026-08-10"}\n` +
        `{"id":"t","ord":"c","title":"t","todo":true}\n` +
        `{"id":"c","ord":"d","title":"c"}`,
    ).map(storedMarker),
  ).toEqual(["done", "doing", "todo", undefined])

  // Written by hand because the parser refuses these lines: the marks are
  // exclusive on disk, so this only decides what a set the validator has
  // already condemned looks like — and it looks as far along as it claims.
  expect(storedMarker({ id: "x", ord: "a", title: "x", done: true, doing: true }))
    .toBe("done")
  expect(storedMarker({ id: "x", ord: "a", title: "x", doing: true, todo: true }))
    .toBe("doing")
})

// A PARENT is what it stores too, and nothing about its children changes that.
// This is the 2026-08-11 decision in one test: derivation read containment as
// decomposition, so a parent of tasks became a task nobody had called one, and
// a parent of notes could not be called one at all.
test("a parent says what it stores, whatever hangs under it", () => {
  // Children all done, parent unmarked: the parent is a BULLET. Nothing has
  // made it a task, and the done toggle will not touch it — which is the whole
  // bug this replaced, where those findings vanished with a parent nobody had
  // finished.
  const unmarked = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","done":true}`,
  )
  expect(unmarked.get("p")).toBeUndefined()

  // A parent whose children are all NOTES can be a task, which derivation had
  // no way to express: the four findings under it are not four subtasks.
  const overNotes = statusesOf(
    `{"id":"p","ord":"a","title":"p","todo":"2026-08-11"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1"}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2"}`,
  )
  expect(overNotes.get("p")).toBe("todo")

  // And a stored mark that disagrees with the arithmetic is simply the mark:
  // `done` over an unfinished child is a claim about the branch, which somebody
  // is allowed to make (the ops layer says so out loud — plan.ts's nudge).
  const disagreeing = statusesOf(
    `{"id":"p","ord":"a","title":"p","done":"2026-08-11"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","doing":true}`,
  )
  expect(disagreeing.get("p")).toBe("done")
  expect(disagreeing.get("c1")).toBe("doing")
})

// What the children DO add up to, and the whole of it: an annotation. It is
// beside the title, never in the checkbox, and nothing reads it to decide what
// is hidden or what is blocked.
test("the rollup counts the child tasks, and only the child tasks", () => {
  const progress = (contents: string, id: string): Progress | undefined =>
    progressOf(derive(nodesOf(contents)), id)

  expect(progress(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","doing":true}\n` +
      `{"id":"c3","parent":"p","ord":"c","title":"c3","todo":true}`,
    "p",
  )).toEqual({ done: 1, total: 3 })

  // A note under an item is not a task, so it neither adds to the total nor
  // holds it back — the same rule that keeps a bullet from blocking anything.
  expect(progress(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"aside","parent":"p","ord":"b","title":"how it went"}`,
    "p",
  )).toEqual({ done: 1, total: 1 })

  // Nothing under it is a task: there is no progress to show, rather than
  // progress of zero. A subtree of notes annotates nothing.
  expect(progress(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1"}`,
    "p",
  )).toBeUndefined()
  expect(progress(`{"id":"p","ord":"a","title":"p","done":true}`, "p")).toBeUndefined()

  // ITS OWN children, one level. A grandchild is counted by the row it hangs
  // under, which is the row a reader is looking at when they want the number.
  expect(progress(
    `{"id":"top","ord":"a","title":"top"}\n` +
      `{"id":"mid","parent":"top","ord":"a","title":"mid","doing":true}\n` +
      `{"id":"leaf","parent":"mid","ord":"a","title":"leaf","done":true}`,
    "top",
  )).toEqual({ done: 0, total: 1 })
})

// The same list read the other way, and the reason it is one list: the ops
// layer names these in a write-time nudge, and a second walk over the same
// edges would be a second answer to "is a bullet unfinished".
test("the unfinished ones are the child tasks that are not done", () => {
  const derived = derive(nodesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","doing":true}\n` +
      `{"id":"c3","parent":"p","ord":"c","title":"c3","todo":true}\n` +
      `{"id":"aside","parent":"p","ord":"d","title":"a note about it"}\n` +
      `{"id":"m","parent":"p","ord":"e","mirror":"c3"}`,
  ))
  // `doing` and `todo` alike — both are tasks that are not done. Never the
  // note, which is not a task, and never the mirror, which is not a second
  // obligation.
  expect(ids(unfinishedUnder(derived, "p"))).toEqual(["c2", "c3"])
  expect(unfinishedUnder(derived, "c1")).toEqual([])
})

// A mirror shows a node, so it shows that node's mark; a checkbox that
// disagreed with the one two lines up would make mirrors unusable.
test("a mirror reports its target's mark, through as many hops as it takes", () => {
  const status = statusesOf(
    `{"id":"p","ord":"a","title":"p","done":"2026-08-03"}\n` +
      `{"id":"hop","ord":"b","mirror":"p"}\n` +
      `{"id":"far","ord":"c","mirror":"hop"}`,
  )
  expect(status.get("p")).toBe("done")
  expect(status.get("hop")).toBe("done")
  expect(status.get("far")).toBe("done")
})

// A mirror is a placement, not a second obligation, so it is not counted in
// the rollup: showing a node in a second place must not make an unrelated
// parent read `1/2`.
test("a mirror child does not count toward the rollup of the node it sits under", () => {
  const contents = `{"id":"elsewhere","ord":"z","title":"somewhere else","todo":true}\n` +
    `{"id":"p","ord":"a","title":"p"}\n` +
    `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
    `{"id":"m","parent":"p","ord":"b","mirror":"elsewhere"}`
  const derived = derive(nodesOf(contents))
  expect(derived.status.get("m")).toBe("todo")
  expect(progressOf(derived, "p")).toEqual({ done: 1, total: 1 })

  // The mirror is still a child for *placement* — it renders under `p`…
  expect(ids(derived.children.get("p") ?? [])).toEqual(["c", "m"])
  // …and still not one for the rollup, which is the set `countedChildren` is.
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
    `{"id":"p","ord":"b","title":"p","doing":true}\n` +
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
  // And it shows the target's mark and the target's rollup: the row draws that
  // node's children, so it annotates that node's children.
  expect(mirror.status).toBe("doing")
  expect(mirror.progress).toEqual({ done: 1, total: 1 })
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
// set — and the rows are drawn anyway, because the browser shows the outline
// beside the errors. A renderer that hung is a worse way to learn about a bug
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

const HOUSEWORK = `{"id":"kitchen","ord":"a0","title":"kitchen","doing":true}\n` +
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

// A node that STORES done takes its subtree with it, bullets included. That is
// somebody's claim about the whole branch, made deliberately, so honouring it
// is what the toggle is for.
test("a stored done hides the whole subtree under it, bullets included", () => {
  const rows = rowsOf(
    derive(
      nodesOf(
        `{"id":"finished","ord":"a0","title":"finished","done":"2026-08-10"}\n` +
          `{"id":"one","parent":"finished","ord":"a0","title":"one","done":true}\n` +
          `{"id":"two","parent":"finished","ord":"a1","title":"two","doing":true}\n` +
          `{"id":"aside","parent":"finished","ord":"a2","title":"how it went"}`,
      ),
    ),
    FIXTURE_FILE,
  )
  expect(withoutDone(rows)).toEqual([])
})

// The bug this whole change is named after. `agents` was a parent nobody had
// marked, its task children all finished, and it DERIVED done — so the toggle
// dropped it and took four unmarked findings, which nobody had finished or
// even called work, off the screen with it. The view whose job is showing what
// is left hid exactly what was left.
test("a parent nobody marked is not hidden, however finished its children are", () => {
  const rows = rowsOf(
    derive(
      nodesOf(
        `{"id":"agents","ord":"a0","title":"agents"}\n` +
          `{"id":"chat","parent":"agents","ord":"a0","title":"chat","done":true}\n` +
          `{"id":"acp","parent":"agents","ord":"a1","title":"acp","done":true}\n` +
          `{"id":"finding","parent":"agents","ord":"a2","title":"nothing wakes a chat agent"}`,
      ),
    ),
    FIXTURE_FILE,
  )
  // The parent stays, the two done children go, and the finding — which is the
  // thing worth reading — is still there.
  expect(shape(withoutDone(rows))).toEqual([
    "/agents node",
    "/agents/finding node",
  ])
  // It reads as a bullet with a rollup beside it, not as a task: `2/2` is an
  // annotation, and `status` is what a checkbox would be drawn from.
  const agents = drawn(rows, 0)
  expect(agents.status).toBeUndefined()
  expect(agents.progress).toEqual({ done: 2, total: 2 })
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

// Derivation runs against sets the validator has already condemned — the
// browser draws the outline beside its errors — so a loop must produce a stub,
// not a hung renderer. This test failing looks like a timeout, which is the
// point.
test("a cyclic set derives without hanging", () => {
  // A parent loop no longer touches status at all: each node says what it
  // stores. It is still walked for the rows, which is the guard below.
  const parents = statusesOf(
    `{"id":"a","parent":"b","ord":"a","title":"a","doing":true}\n` +
      `{"id":"b","parent":"a","ord":"b","title":"b"}`,
  )
  expect(parents.get("a")).toBe("doing")
  expect(parents.get("b")).toBeUndefined()
  expect(progressOf(derive(nodesOf(
    `{"id":"a","parent":"b","ord":"a","title":"a","doing":true}\n` +
      `{"id":"b","parent":"a","ord":"b","title":"b"}`,
  )), "b")).toEqual({ done: 0, total: 1 })

  const mirrors = statusesOf(
    `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
  )
  expect(mirrors.get("m1")).toBeUndefined()
  expect(mirrors.get("m2")).toBeUndefined()

  // A mirror whose target was never declared is the other walk that could have
  // gone looking for a node that is not there.
  expect(statusesOf(`{"id":"m","ord":"a","mirror":"gone"}`).get("m")).toBeUndefined()
})
