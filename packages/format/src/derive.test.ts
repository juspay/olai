import { expect, test } from "bun:test"

import {
  blockersOf,
  countedChildren,
  derive,
  /** The reading of `byFile`, under a name the fixture builder below has not
   *  already taken — that one turns TEXT into records, this one asks a
   *  derivation what one file holds. */
  nodesOf as recordsOf,
  type Progress,
  progressOf,
  type Row,
  rowsOf,
  situate,
  standingBefore,
  type Status,
  isTagName,
  mayHoldTag,
  storedMarker,
  TAG_SIGILS,
  tagOpensAt,
  tagText,
  titleParts,
  titleTagRe,
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

// EVERY mark, and the absence of one, because the report this locks down
// (`mirror-status`, 2026-08-11) was that a mirror of a `doing` node drew a
// plain bullet where the target drew the half-filled box. Read through the
// ROWS rather than off the index, since the row is what a checkbox is drawn
// from: a hop the map made and the walk then keyed by the placement's own id
// would pass the test above and still leave the screen wrong. The unmarked
// target is the case the other three are only meaningful against — a mirror of
// a bullet has no box either, because there is no mark to show.
test("a mirror row draws its target's mark, whichever of them it is", () => {
  const rows = rowsOf(
    derive(nodesOfFiles({
      "a.olai": `{"id":"working","ord":"a","title":"working","doing":"2026-08-11"}\n` +
        `{"id":"waiting","ord":"b","title":"waiting","todo":"2026-08-11"}\n` +
        `{"id":"finished","ord":"c","title":"finished","done":"2026-08-11"}\n` +
        `{"id":"note","ord":"d","title":"a note about all three"}`,
      // In another file, which is where a mirror usually lives: the one
      // relation that crosses files must not be the one that drops the mark.
      "b.olai": `{"id":"m-working","ord":"a","mirror":"working"}\n` +
        `{"id":"m-waiting","ord":"b","mirror":"waiting"}\n` +
        `{"id":"m-finished","ord":"c","mirror":"finished"}\n` +
        `{"id":"m-note","ord":"d","mirror":"note"}`,
    })),
    "b.olai",
  )
  expect(rows.map((row) => [row.at.node.id, row.status])).toEqual([
    ["m-working", "doing"],
    ["m-waiting", "todo"],
    ["m-finished", "done"],
    ["m-note", undefined],
  ])
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
    "a.olai": `{"id":"x","ord":"a","title":"first"}`,
    "b.olai": `{"id":"x","ord":"a","title":"second"}`,
  }))
  expect([across.byId.get("x")?.file, across.byId.get("x")?.line]).toEqual(["a.olai", 1])
  // One entry per id, not one per record: the map is an index, not a list.
  expect(across.byId.size).toBe(1)
})

// The set is flat and carries every file's records; `byFile` is that same list
// read the other way. What it promises is DISK order, because the reader that
// needs it most is a WRITER — a write re-emits the whole file, and a
// reordering here would be a diff nobody asked for.
test("a file's records come back in line order, whatever order the set is in", () => {
  const nodes = nodesOfFiles({
    "a.olai": `{"id":"a1","ord":"b","title":"one"}\n` +
      `{"id":"a2","ord":"a","title":"two"}\n` +
      `{"id":"m","parent":"a1","ord":"a","mirror":"b1"}`,
    "b.olai": `{"id":"b1","ord":"a","title":"elsewhere"}`,
  })
  // Handed over backwards: the promise is about what the index MEANS, not
  // about the order the caller happened to build its list in.
  const derived = derive([...nodes].reverse())
  // A placement is a RECORD, so it is here — this index is about what the file
  // holds, and `ord` order is a different list (`siblingsOf` sorts for that).
  expect(ids(recordsOf(derived, "a.olai"))).toEqual(["a1", "a2", "m"])
  expect(ids(recordsOf(derived, "b.olai"))).toEqual(["b1"])
  // A file with nothing of its own is ABSENT rather than mapped to an empty
  // list: which files exist is the set's answer, never this map's.
  expect(derived.byFile.has("c.olai")).toBe(false)
  expect(recordsOf(derived, "c.olai")).toEqual([])
})

// ── what cannot start yet ──────────────────────────────────────────────

/** What one node is waiting on, as `id status` per blocker — the two facts a
 *  reader draws off a blocker, and the two this section is about. */
const waiting = (
  derived: ReturnType<typeof derive>,
  id: string,
): ReadonlyArray<string> =>
  blockersOf(derived, id).map((one) => `${one.at.node.id} ${one.status}`)

/** The same, for a set written as one file. */
const waitingIn = (contents: string, id: string): ReadonlyArray<string> =>
  waiting(derive(nodesOf(contents)), id)

// The rule, and the whole of it: `a after b` holds `a` up while `b` is a task
// that is NOT DONE — with the three marks there are, while it is doing or
// todo. The blocker travels with its reason, so a reader never re-derives why.
test("an after target blocks while it is a task that is not done", () => {
  const of = (mark: string): ReadonlyArray<string> =>
    waitingIn(
      `{"id":"a","ord":"a","title":"a","doing":true,"after":["b"]}\n` +
        `{"id":"b","ord":"b","title":"b"${mark}}`,
      "a",
    )
  expect(of(`,"doing":true`)).toEqual(["b doing"])
  expect(of(`,"todo":true`)).toEqual(["b todo"])
  // Done is what clears the way: it has happened, so nothing is waiting.
  expect(of(`,"done":"2026-08-10"`)).toEqual([])
})

// THE TRAP the rule is written against (docs/format.md): spelling it
// `status !== "done"` reads every plain bullet as an obstacle that can never
// be cleared, because nothing can ever finish a node that is not a task.
// Adding `todo` did not narrow it by one case — the unmarked node is still the
// one that must not block.
test("a target nobody marked never blocks, however unfinished it looks", () => {
  expect(
    waitingIn(
      `{"id":"a","ord":"a","title":"a","todo":true,"after":["note"]}\n` +
        `{"id":"note","ord":"b","title":"a note nobody marked"}`,
      "a",
    ),
  ).toEqual([])

  // Nor does a parent whose children are all bullets: a subtree of bullets
  // adds up to a bullet, and this is where that answer earns its keep.
  expect(
    waitingIn(
      `{"id":"a","ord":"a","title":"a","todo":true,"after":["notes"]}\n` +
        `{"id":"notes","ord":"b","title":"notes"}\n` +
        `{"id":"one","parent":"notes","ord":"a","title":"one"}`,
      "a",
    ),
  ).toEqual([])
})

// The same predicate at the other end of the arrow, which is the racket
// reference's own shape: a done node has happened and the order it happened in
// is no longer a question, and a bullet is not work, so neither is waiting on
// anything however unfinished what they point at is.
test("a node that is done or unmarked is waiting on nothing", () => {
  const set = (mark: string): string =>
    `{"id":"a","ord":"a","title":"a"${mark},"after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}`
  expect(waitingIn(set(`,"doing":true`), "a")).toEqual(["b doing"])
  expect(waitingIn(set(`,"done":"2026-08-10"`), "a")).toEqual([])
  expect(waitingIn(set(""), "a")).toEqual([])
})

// `blocks` is sugar for the same edge written from the other end, normalised
// in ONE place (`derive`) so the acyclicity rule and this read one graph.
test("blocks is the same edge, and both halves land in one answer", () => {
  const derived = derive(nodesOf(
    `{"id":"a","ord":"a","title":"a","todo":true,"after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}\n` +
      `{"id":"c","ord":"c","title":"c","doing":true,"blocks":["a"]}`,
  ))
  expect(waiting(derived, "a")).toEqual(["b doing", "c doing"])
  // The graph itself, as the validator's cycle check reads it.
  expect(derived.after.get("a")).toEqual(["b", "c"])
  expect(derived.blocked.has("b")).toBe(false)
})

// Work that was put away is over: it blocks nothing, because a node waiting on
// it would wait forever, and it is not blocked either, because the archive is
// read as history rather than as a plate. Both ends, one rule.
test("archived work neither blocks nor is blocked", () => {
  const derived = derive(nodesOfFiles({
    "house.olai": `{"id":"a","ord":"a","title":"a","todo":true,"after":["put-away"]}`,
    "Archive.olai":
      `{"id":"put-away","ord":"a","title":"put away half-finished","doing":true}\n` +
        `{"id":"old","ord":"b","title":"old","todo":true,"after":["a"]}`,
  }))
  expect(waiting(derived, "a")).toEqual([])
  expect(waiting(derived, "old")).toEqual([])
  // The status index still knows what they are; it is blocking they are out of.
  expect(derived.status.get("put-away")).toBe("doing")
})

/**
 * The other end of the arrow, asked of a node that is not work yet.
 *
 * `blockersOf` is what a node IS waiting on and it is empty for a bullet,
 * which is right for every drawing of blockedness — nothing is telling a
 * bullet it cannot start. `standingBefore` is what its `after` targets hold
 * up regardless, which is what a write about to MAKE it work has to ask
 * (`@olai/ops`' `set_doing` refusal). The two differ at exactly one end and
 * agree at the other, because they share one predicate.
 */
test("standingBefore asks the same question of a node that is not work yet", () => {
  const before = (
    derived: ReturnType<typeof derive>,
    id: string,
  ): ReadonlyArray<string> =>
    standingBefore(derived, id).map((one) => `${one.at.node.id} ${one.status}`)

  // The one place they part: an unmarked source. It is waiting on nothing, and
  // there is unfinished work in front of it all the same.
  const bullet = derive(nodesOf(
    `{"id":"a","ord":"a","title":"a","after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}`,
  ))
  expect(waiting(bullet, "a")).toEqual([])
  expect(before(bullet, "a")).toEqual(["b doing"])

  // And everywhere else they agree, because the TARGET side is one function:
  // a bullet, a done node and an archived one stand in nobody's way.
  const clear = derive(nodesOfFiles({
    "a.olai": `{"id":"a","ord":"a","title":"a","after":["note","fin","gone"]}\n` +
      `{"id":"note","ord":"b","title":"a note"}\n` +
      `{"id":"fin","ord":"c","title":"fin","done":"2026-08-10"}`,
    "Archive.olai": `{"id":"gone","ord":"a","title":"gone","todo":true}`,
  }))
  expect(before(clear, "a")).toEqual([])

  // The `blocks` sugar and the promised order are the graph's, so they are
  // this reading's too — it is `derived.after` it walks.
  //
  // THE ORDER HERE IS USER-VISIBLE, which is why it is asserted rather than
  // sorted away: `@olai/ops`' `set_doing` refusal names its blockers in this
  // sequence, so a regression that shuffled it would change the sentence a
  // person and an agent both read ("comes after 2 unfinished tasks: `b` …,
  // `c` …"). It is the same promise `Derived.blocked` makes for the one
  // blocker a row has space to draw — a node's own `after` as it writes them,
  // then whatever `blocks` points back at it.
  const both = derive(nodesOf(
    `{"id":"a","ord":"a","title":"a","after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}\n` +
      `{"id":"c","ord":"c","title":"c","todo":true,"blocks":["a"]}`,
  ))
  expect(before(both, "a")).toEqual(["b doing", "c todo"])

  // Nothing named, nothing waiting — the answer for nearly every node.
  expect(before(both, "b")).toEqual([])
})

// An archive one directory down is the same archive: `archive` puts a subtree
// beside the outline it left, wherever that outline lives.
test("an archive beside any outline is an archive", () => {
  expect(
    waiting(
      derive(nodesOfFiles({
        "work/plans.olai": `{"id":"a","ord":"a","title":"a","todo":true,"after":["old"]}`,
        "work/Archive.olai": `{"id":"old","ord":"a","title":"old","doing":true}`,
      })),
      "a",
    ),
  ).toEqual([])
})

// An edge may name a MIRROR — a placement is addressable like anything else —
// and what it means is the node standing there. Followed at either end, so the
// blocker a reader is handed is a node with a title to show.
test("an edge naming a mirror means the node it shows", () => {
  const derived = derive(nodesOfFiles({
    "a.olai": `{"id":"a","ord":"a","title":"a","todo":true,"after":["m"]}\n` +
      `{"id":"b","ord":"b","title":"the real one","doing":true}\n` +
      `{"id":"m","ord":"c","mirror":"b"}\n` +
      `{"id":"c","ord":"d","title":"c","doing":true,"blocks":["m2"]}\n` +
      `{"id":"m2","ord":"e","mirror":"a"}`,
  }))
  expect(waiting(derived, "a")).toEqual(["b doing", "c doing"])
  // Under the NODE's id, never the placement's: two records naming one node
  // are one node waiting on both of them.
  expect(derived.blocked.has("m2")).toBe(false)
  // And the graph they were read off is in terms of nodes at BOTH ends, which
  // is what lets the acyclicity rule see the same edges this did.
  expect(derived.after.get("a")).toEqual(["b", "c"])
  expect(derived.after.has("m2")).toBe(false)
})

// A row has space for ONE blocker, so which one comes first is a promise: the
// node's own `after` as it writes them, and only then whatever points back at
// it. Built in one interleaved pass, `blocks` from a record written EARLIER in
// the file landed first — so what a pill linked to depended on where in the
// directory somebody had written an unrelated edge.
test("a node's own after targets come before anything that blocks it", () => {
  const derived = derive(nodesOf(
    `{"id":"early","ord":"a","title":"early","doing":true,"blocks":["subject"]}\n` +
      `{"id":"own","ord":"b","title":"own","doing":true}\n` +
      `{"id":"subject","ord":"c","title":"subject","todo":true,"after":["own"]}`,
  ))
  expect(waiting(derived, "subject")).toEqual(["own doing", "early doing"])
})

// Blockedness is read off the same index wherever a node is drawn: a row, a
// mirror row (which says what its target says, the way its status does) and
// the node's own page.
test("a row, a mirror row and a page all say what the node is waiting on", () => {
  const derived = derive(nodesOf(
    `{"id":"first","ord":"a","title":"first","doing":true}\n` +
      `{"id":"second","ord":"b","title":"second","todo":true,"after":["first"]}\n` +
      `{"id":"m","ord":"c","mirror":"second"}`,
  ))
  const rows = rowsOf(derived, FIXTURE_FILE)
  expect(rows.map((row) => row.blocked.map((one) => one.at.node.id))).toEqual([
    [],
    ["first"],
    ["first"],
  ])
  expect(situate(derived, drawn(rows, 1).shows).blocked.map((one) => one.at.node.id))
    .toEqual(["first"])
})

// The waiting glyph is drawn from TWO facts at once — the mark it is toned
// with and the blockers it stands in for — so a mirror needs both of them from
// its target or the column falls back to a box, or to nothing at all. `blocked`
// is keyed by the node while `status` is keyed by every record, and the row is
// where those two key domains have to meet.
test("a mirror row carries both halves of the waiting glyph", () => {
  const derived = derive(nodesOfFiles({
    "a.olai": `{"id":"first","ord":"a","title":"first","doing":true}\n` +
      `{"id":"second","ord":"b","title":"second","todo":true,"after":["first"]}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"second"}`,
  }))
  const mirror = drawn(rowsOf(derived, "b.olai"), 0)
  expect(mirror.kind).toBe("mirror")
  // The mark the glyph is toned with…
  expect(mirror.status).toBe("todo")
  // …and what it says the row is waiting on, with its reason.
  expect(mirror.blocked.map((one) => `${one.at.node.id} ${one.status}`)).toEqual([
    "first doing",
  ])
})

// A row that draws no node is waiting on nothing — there is no node there to
// be held up — and asking is not an error.
test("a dangling row is waiting on nothing", () => {
  const rows = rowsOf(derive(nodesOf(`{"id":"m","ord":"a","mirror":"gone"}`)), FIXTURE_FILE)
  expect(rows[0]?.blocked).toEqual([])
})

// An `after` loop is a set the validator refuses — nothing in it can start
// first — but the derivation still runs against it, because that report is
// drawn over a tree. Each of them is waiting on the other, and nothing hangs.
test("an after loop derives without hanging", () => {
  const derived = derive(nodesOf(
    `{"id":"a","ord":"a","title":"a","doing":true,"after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true,"after":["a"]}`,
  ))
  expect(waiting(derived, "a")).toEqual(["b doing"])
  expect(waiting(derived, "b")).toEqual(["a doing"])
})

// A deadlock that closes THROUGH A PLACEMENT is a deadlock: `x` waits on a
// mirror of `y` and `y` waits on `x`. The view draws both as blocked — it
// resolves what an edge names — so the graph the validator refuses loops from
// has to resolve it too, or a set nobody can start anywhere in loads clean and
// says so on two rows for ever. `validate.test.ts` holds the other half.
test("a loop closing through a mirror is one loop in the graph", () => {
  const derived = derive(nodesOfFiles({
    "a.olai": `{"id":"x","ord":"a","title":"x","doing":true,"after":["m"]}\n` +
      `{"id":"y","ord":"b","title":"y","doing":true,"after":["x"]}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"y"}`,
  }))
  expect(waiting(derived, "x")).toEqual(["y doing"])
  expect(waiting(derived, "y")).toEqual(["x doing"])
  // Both edges in terms of nodes, so the loop is walkable rather than dying at
  // a placement that carries no edges of its own.
  expect(derived.after.get("x")).toEqual(["y"])
  expect(derived.after.get("y")).toEqual(["x"])
})

// ── read backwards ─────────────────────────────────────────────────────

// `mirrorsOf` is `follow` reversed, and following the CHAIN is what makes it
// that rather than a reverse of the `mirror` field: a mirror of a mirror of
// `x` shows `x`, so `x` is where it is filed, and the record in the middle
// collects nothing. One walk builds both directions — a second would be a
// second chance to disagree about where a chain ends, and a placement filed
// under one node while it shows another is exactly what this exists to find.
test("a mirror is filed under the node its chain ends at, not the hop before", () => {
  const derived = derive(nodesOfFiles({
    "a.olai": `{"id":"x","ord":"a","title":"the real one"}`,
    "b.olai": `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"x"}`,
  }))
  expect(derived.mirrorsOf.get("x")).toEqual(["m1", "m2"])
  expect(derived.mirrorsOf.has("m2")).toBe(false)
})

// The two ways a chain fails are the two ways it shows no node — and a node
// that shows itself is not standing in for anything. `status` leaves all three
// out; so does this, for the same reason.
test("a chain that shows no node, and a node that shows itself, are filed nowhere", () => {
  const derived = derive(nodesOf(
    `{"id":"gone","ord":"a","mirror":"nobody"}\n` +
      `{"id":"loop","ord":"b","mirror":"loop"}\n` +
      `{"id":"plain","ord":"c","title":"plain"}`,
  ))
  expect(derived.mirrorsOf.size).toBe(0)
})

// A duplicated id is one node — `byId` says so — so it is one entry here too.
test("a node's mirrors are listed once each", () => {
  const derived = derive(nodesOfFiles({
    "a.olai": `{"id":"x","ord":"a","title":"x"}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"x"}`,
    "c.olai": `{"id":"m","ord":"a","mirror":"x"}`,
  }))
  expect(derived.mirrorsOf.get("x")).toEqual(["m"])
})

// `edgesTo` is `after` reversed, and reversed by the same act that built it:
// both maps get their keys AFTER the edge has been resolved to nodes, so the
// forward reading and the reverse one cannot disagree about whether two
// records mean one edge.
test("the ordering graph reversed says who was waiting on a node", () => {
  const derived = derive(nodesOf(
    `{"id":"x","ord":"a","title":"x","doing":true,"blocks":["e"]}\n` +
      `{"id":"m","ord":"b","mirror":"x"}\n` +
      `{"id":"a","ord":"c","title":"a","todo":true,"after":["m"]}\n` +
      `{"id":"e","ord":"d","title":"e","todo":true}`,
  ))
  expect(derived.after.get("a")).toEqual(["x"])
  expect(derived.after.get("e")).toEqual(["x"])
  // Both spellings land at the NODE, in `after`'s own promised order — the
  // node's own `after` first, then what points back at it — and the placement
  // collects nothing.
  expect(derived.edgesTo.get("x")).toEqual(["a", "e"])
  expect(derived.edgesTo.has("m")).toBe(false)
  expect(derived.edgesTo.has("a")).toBe(false)
})

// One relation written twice is one relation. The forward map keeps what the
// record wrote (a reader says the targets as they were named); the reverse one
// answers "which nodes have to be looked at again", and that is a set.
test("a target names each node waiting on it once", () => {
  const derived = derive(nodesOf(
    `{"id":"x","ord":"a","title":"x","doing":true}\n` +
      `{"id":"a","ord":"b","title":"a","todo":true,"after":["x","x"]}`,
  ))
  expect(derived.after.get("a")).toEqual(["x", "x"])
  expect(derived.edgesTo.get("x")).toEqual(["a"])
})

// `namedBy` is the format's own `targetsOf` read backwards, and it is RAW —
// what the records SAY, before a chain is followed or `blocks` is normalised
// into `after`. That is the point of it being a third index rather than a
// reading of the two above: the ops layer refuses to retire a placement
// something still names, and the canonical maps have filed every one of those
// edges at the node the placement shows, where a refusal about the PLACEMENT
// could never find them.
test("a record is filed under the id it wrote, not the node that id means", () => {
  const derived = derive(nodesOf(
    `{"id":"x","ord":"a","title":"x"}\n` +
      `{"id":"m","ord":"b","mirror":"x"}\n` +
      `{"id":"a","ord":"c","title":"a","after":["m"],"see":["m"]}\n` +
      `{"id":"b","ord":"d","title":"b","blocks":["m"]}`,
  ))
  // One entry per RECORD, with the fields in declaration order: a node naming
  // the same id twice is one dependent with two reasons, not two dependents.
  expect((derived.namedBy.get("m") ?? []).map((one) => `${one.at.node.id} ${one.fields}`))
    .toEqual(["a after,see", "b blocks"])
  // `see` is in here and in nothing else — no derivation reads it, and a
  // reverse index that left it out would let a write land that should not.
  expect(derived.edgesTo.has("m")).toBe(false)
  // The placement's own claim on the node it shows is an entry like any other.
  expect((derived.namedBy.get("x") ?? []).map((one) => `${one.at.node.id} ${one.fields}`))
    .toEqual(["m mirror"])
})

// One field naming an id twice is still one field: a reader listing it twice
// would be reporting the shape of the file rather than what it means.
test("a field naming the same id twice is named once", () => {
  const derived = derive(nodesOf(
    `{"id":"x","ord":"a","title":"x"}\n` +
      `{"id":"a","ord":"b","title":"a","after":["x","x"],"see":["x"]}`,
  ))
  expect((derived.namedBy.get("x") ?? []).map((one) => one.fields)).toEqual([
    ["after", "see"],
  ])
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
  const rows = rowsOf(derive(nodes), "a.olai")
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
  const far = drawn(rowsOf(derive(nodes), "a.olai"), 0)
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
  const rows = shape(rowsOf(derive(nodes), "a.olai"))
  expect(rows).toEqual(["/m mirror", "/m/c node", "/p node", "/p/c node"])
  expect(new Set(rows).size).toBe(rows.length)
})

// A mirror whose target is not in the set is a place with nothing to show. It
// is named as such rather than silently dropped — the validator has already
// refused the set, and the reader is looking at it to find out why.
test("a mirror with no target is a dangling row with no children", () => {
  const nodes = nodesOf(`{"id":"m","ord":"a","mirror":"gone"}`)
  const rows = rowsOf(derive(nodes), "a.olai")
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
  const rows = rowsOf(derive(nodes), "a.olai")
  expect(rows.map(stubbed)).toEqual(["dangling c", "dangling c"])
  expect(rows.map((row) => row.at.node.id)).toEqual(["a", "b"])
})

// The other way a chain can fail to end: it comes back to a record it has
// already followed. That is a cycle in the POINTERS, found before any tree is
// drawn, and the row names the id it closed on rather than the first hop.
test("a mirror chain that closes on itself is a cycle naming where it closed", () => {
  const itself = nodesOf(`{"id":"m","ord":"a","mirror":"m"}`)
  expect(rowsOf(derive(itself), "a.olai").map(stubbed)).toEqual(["cycle m"])

  // Two mirrors showing each other: from `m1` the chain runs m1 → m2 → m1, so
  // that place closed on `m1`, and the place at `m2` on `m2`.
  const pair = nodesOf(
    `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
  )
  const rows = rowsOf(derive(pair), "a.olai")
  expect(rows.map(stubbed)).toEqual(["cycle m1", "cycle m2"])
  expect(rows.every((row) => row.children.length === 0)).toBe(true)

  // And the id it closed on is not the id it started from: `a` points into a
  // loop it is not itself part of, so the honest answer is `b`.
  const into = nodesOf(
    `{"id":"a","ord":"a","mirror":"b"}\n` +
      `{"id":"b","ord":"b","mirror":"c"}\n` +
      `{"id":"c","ord":"c","mirror":"b"}`,
  )
  expect(rowsOf(derive(into), "a.olai").map(stubbed))
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
  const rows = rowsOf(derive(nodes), "a.olai")
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
  const deepRows = rowsOf(derive(deep), "a.olai")
  expect(shape(deepRows)).toEqual(["/a node", "/a/b node", "/a/b/m cycle"])
  expect(deepRows[0]?.children[0]?.children.map(stubbed)).toEqual(["cycle a"])
})

// Every `.olai` is an independent tree, so the rows of a file are its own
// roots — the set is flat and carries every file's nodes, so the filtering is
// what makes "the rows of this file" mean anything at all.
test("roots are the requested file's own top-level nodes, in ord order", () => {
  const nodes = nodesOfFiles({
    "a.olai": `{"id":"second","ord":"b","title":"b"}\n` +
      `{"id":"first","ord":"a","title":"a"}\n` +
      `{"id":"kid","parent":"first","ord":"a","title":"kid"}`,
    "b.olai": `{"id":"elsewhere","ord":"a","title":"elsewhere"}`,
  })
  // One `Derived` for every file: it carries the nodes it was built from, so
  // the rows of two files cannot be drawn from two different revisions.
  const derived = derive(nodes)
  expect(shape(rowsOf(derived, "a.olai")))
    .toEqual(["/first node", "/first/kid node", "/second node"])
  expect(shape(rowsOf(derived, "b.olai"))).toEqual(["/elsewhere node"])
  // A file with no nodes of its own draws nothing, rather than everything.
  expect(rowsOf(derived, "c.olai")).toEqual([])
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

// Done-hiding reads the row's status, and a mirror's status is its target's —
// so a mirror of a done node goes, and the subtree it was drawing goes with it,
// which is the same sweep the target's own row gets. The rest of the mirroring
// file stays: hiding is per row, and a placement being dropped says nothing
// about the one written after it.
test("done-hidden drops a mirror of a done node with the subtree it draws", () => {
  const rows = rowsOf(
    derive(nodesOfFiles({
      "a.olai": `{"id":"finished","ord":"a","title":"finished","done":"2026-08-11"}\n` +
        `{"id":"how","parent":"finished","ord":"a","title":"how it went"}\n` +
        `{"id":"open","ord":"b","title":"open","doing":true}`,
      "b.olai": `{"id":"m-finished","ord":"a","mirror":"finished"}\n` +
        `{"id":"m-open","ord":"b","mirror":"open"}`,
    })),
    "b.olai",
  )
  // Drawn, the mirror carries the target's subtree — the bullet under a done
  // node is exactly what the sweep is about.
  expect(shape(rows)).toEqual([
    "/m-finished mirror",
    "/m-finished/how node",
    "/m-open mirror",
  ])
  expect(shape(withoutDone(rows))).toEqual(["/m-open mirror"])
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

/** The tags of a title AS WRITTEN, in reading order — what a filter runs on,
 *  assembled from the parts because the format stores no tag list. The sigil
 *  comes with them: `#alice` and `@alice` are two tags, so a list that dropped
 *  it would be a list that cannot tell them apart. */
const tags = (title: string): ReadonlyArray<string> =>
  titleParts(title).flatMap((part) => (part.kind === "tag" ? [tagText(part)] : []))

// Tags live inline in the title verbatim — the format stores no tag list — so
// the split is what the view renders, and it has to keep the text intact.
test("a title splits into text and tags, and rejoins to itself", () => {
  const parts = titleParts("call #alice about #work/olai now")
  expect(parts).toEqual([
    { kind: "text", text: "call " },
    { kind: "tag", sigil: "#", tag: "alice" },
    { kind: "text", text: " about " },
    // A `/` is part of the tag, so `#work/olai` is one tag and not two.
    { kind: "tag", sigil: "#", tag: "work/olai" },
    { kind: "text", text: " now" },
  ])
  expect(
    parts.map((part) => (part.kind === "tag" ? tagText(part) : part.text)).join(""),
  ).toBe("call #alice about #work/olai now")
})

// The second sigil, and it rejoins to itself for the same reason: what a part
// list is FOR is drawing the title back, so the character that started a tag
// travels with it rather than being assumed to be a `#`.
test("an @tag is a tag, and the sigil comes back out with it", () => {
  const parts = titleParts("ask @alice about #work")
  expect(parts).toEqual([
    { kind: "text", text: "ask " },
    { kind: "tag", sigil: "@", tag: "alice" },
    { kind: "text", text: " about " },
    { kind: "tag", sigil: "#", tag: "work" },
  ])
  expect(
    parts.map((part) => (part.kind === "tag" ? tagText(part) : part.text)).join(""),
  ).toBe("ask @alice about #work")
})

// The two are different tags, not two spellings of one — which is the point of
// having both, and what the editor's two triggers complete over separately.
test("the sigils are two namespaces", () => {
  expect(tags("@alice and #alice")).toEqual(["@alice", "#alice"])
})

// `@` mid-word is an email address or a handle quoted inside a word, and both
// are things people put in titles. `#` keeps the alphabet it has always had.
test("an @ inside a word is text, and a # inside one is still a tag", () => {
  expect(tags("mail srid@srid.ca about it")).toEqual([])
  expect(tags("(@alice) and [@bob]")).toEqual(["@alice", "@bob"])
  expect(tags("@carol first")).toEqual(["@carol"])
  // Unchanged from the day the format shipped: narrowing `#` would restyle
  // titles in sets that are already written.
  expect(tags("issue#42")).toEqual(["#42"])
})

// A bare sigil is punctuation people write ("issue #, see below"); treating it
// as an empty tag would style the rest of the line as one.
test("a bare sigil is text", () => {
  expect(titleParts("issue # 42")).toEqual([{ kind: "text", text: "issue # 42" }])
  expect(tags("issue # 42")).toEqual([])
  expect(tags("reply @ noon")).toEqual([])
})

// The tags come out in reading order, over the same alphabet ids use plus `/`,
// so a filter reading them off the parts sees the title as written.
test("tags come out in reading order, over the tag alphabet", () => {
  expect(tags("#b then #a then #b again")).toEqual(["#b", "#a", "#b"])
  expect(tags("#Tag-1 #tag_2")).toEqual(["#Tag-1", "#tag_2"])
})

// The web client styles tags with the same alphabet; it must not re-declare it.
// A fresh regex each call so /g state cannot leak across walks.
test("titleTagRe is the alphabet titleParts uses, fresh each call", () => {
  const one = titleTagRe()
  const other = titleTagRe()
  expect(one).not.toBe(other)
  expect(one.source).toBe(other.source)
  expect([..."#work/olai mid @a-b".matchAll(one)].map((m) => m[0])).toEqual([
    "#work/olai",
    "@a-b",
  ])
})

// The list the editor's triggers are built from, so a third sigil is one edit
// in the format rather than one in the format and one in a widget.
test("TAG_SIGILS is what titleTagRe matches", () => {
  expect([...TAG_SIGILS]).toEqual(["#", "@"])
  for (const sigil of TAG_SIGILS) {
    expect(tags(`a ${sigil}thing`)).toEqual([`${sigil}thing`])
  }
})

// The three questions a client COMPLETING a tag asks, held to the regex they
// are about — which is the whole reason they are exported rather than written
// again in a widget. If one of them drifts from the alphabet, this fails here
// rather than as a popup that offers to rewrite the middle of a word.
test("the tag predicates agree with the alphabet they are about", () => {
  for (const name of ["home", "work/olai", "Tag-1", "tag_2", ""]) {
    expect(isTagName(name)).toBe(true)
    if (name !== "") expect(tags(`a #${name}`)).toEqual([`#${name}`])
  }
  for (const name of ["a b", "a.b", "a!", "a#b"]) expect(isTagName(name)).toBe(false)
})

test("a sigil opens a tag at a word start and nowhere else", () => {
  // The same positions `titleTagRe`'s `@` lookbehind accepts, asked directly.
  expect(tagOpensAt("@a", 0)).toBe(true)
  for (const before of [" ", "(", "[", "{"]) {
    expect(tagOpensAt(`x${before}@a`, 2)).toBe(true)
    expect(tags(`x${before}@a`)).toEqual(["@a"])
  }
  expect(tagOpensAt("srid@srid", 4)).toBe(false)
  expect(tags("srid@srid")).toEqual([])
})

// The cheap negative every walk takes first. Written three times before it was
// exported, and two of those had already drifted.
test("a title with no sigil in it cannot hold a tag", () => {
  expect(mayHoldTag("order the new cabinets")).toBe(false)
  expect(mayHoldTag("issue # 42")).toBe(true)
  expect(mayHoldTag("srid@srid.ca")).toBe(true)
  // The guard is allowed to be generous — it only ever saves a walk.
  for (const title of ["a #home", "a @alice"]) {
    expect(mayHoldTag(title)).toBe(true)
    expect(tags(title).length).toBe(1)
  }
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
