/**
 * Everything the format computes rather than stores.
 *
 * A title's `#tags`, the order of siblings, the subtree a mirror stands for,
 * how far along a parent's task children have got: none of it is on disk, all
 * of it is derived here, and it is derived ONCE. {@link derive} builds the
 * indexes; {@link rowsOf} turns them into the shape a reader sees. The
 * validator and the browser both call these — that is the point. A view that
 * rebuilt the tree itself would be a second interpretation of the format, free
 * to disagree with the one that decides whether the file is legal at all.
 *
 * STATUS IS NOT ONE OF THEM, and that is the whole of the 2026-08-11 decision.
 * A parent's status used to be computed from its children, which read outline
 * containment (notes under an item) as task decomposition (subtasks) and made
 * every parent-of-tasks a task by structure — the `open` default one level up,
 * with nobody having said so. A mark is a stored fact on the node that carries
 * it, leaf or parent, and the only thing children add up to here is
 * {@link progressOf}, which is an annotation and feeds nothing.
 *
 * Every walk is cycle-safe. The validator rejects a set whose parents or
 * mirrors close a loop, so these functions should never meet one — but they
 * also run against sets it has already condemned (a browser draws the outline
 * beside the errors), and a renderer that hangs is a worse way to learn about
 * a bug than a marked stub.
 */

import { Schema } from "effect"

import {
  isArchived,
  isMirror,
  type Located,
  type LocatedRegular,
  MARKS,
  type Node,
  type Status,
} from "./node.ts"

/** What a node's checkbox shows, re-exported rather than declared: it is one
 *  of `./node.ts`'s {@link MARKS}, and it lives beside that list because it is
 *  a fact about what a RECORD may carry. Here because every derivation below
 *  answers in it, and a consumer of a walk should not have to learn which
 *  module minted the word. */
export { Status } from "./node.ts"

/**
 * A set of nodes and everything computed from it.
 *
 * The nodes travel WITH their indexes rather than beside them. Two parameters
 * would let a caller pass one revision's nodes against another's indexes —
 * a live store, with two revisions in flight, makes a real possibility — and
 * the symptom would be a plausible tree rather than a failure.
 */
export interface Derived {
  readonly nodes: ReadonlyArray<Located>
  /** id → the record that claims it. FIRST claim wins, which is the same rule
   *  the validator's duplicate-id error uses: the second claim is the mistake,
   *  so the first is what every other reference means. */
  readonly byId: ReadonlyMap<string, Located>
  /** parent id → its children, in sibling order. */
  readonly children: ReadonlyMap<string, ReadonlyArray<Located>>
  /** id → the mark it stores, for the nodes that carry one — a mirror standing
   *  for whatever its target stores, since that is what it shows. PARTIAL over
   *  `nodes`, and that is the answer rather than a gap in it: a node missing
   *  from this map is a plain bullet, because nobody marked it. */
  readonly status: ReadonlyMap<string, Status>
  /** The node an edge holds up → the ids it must come after: the ORDERING
   *  graph, with `blocks` normalised into it. One graph, because two rules ask
   *  about the same edges — the validator's acyclicity check and the
   *  blockedness below — and a second normalisation of `blocks` would be a
   *  second graph free to disagree with the first.
   *
   *  IN TERMS OF NODES at both ends, mirrors resolved, so `x after b` and
   *  `a blocks m` are one edge when `m` is a mirror of `x` — and a loop that
   *  closes through a placement is a loop. An id nothing declares stays as
   *  written, because an unknown target is the validator's to name. */
  readonly after: ReadonlyMap<string, ReadonlyArray<string>>
  /** id → what is standing in its way. PARTIAL like `status`, and non-empty
   *  wherever it is present: absence is the answer for everything that can
   *  start, which is nearly every node. Keyed by the node itself, so a mirror
   *  asks this of what it SHOWS exactly as it asks for its status.
   *
   *  ORDERED, and promised so rather than left to fall out: a node's own
   *  `after` in the order it writes them, then whatever `blocks` it from
   *  elsewhere in file order. Every reader says them in that order — the label
   *  a row's mark carries, the tip beside it, the list on the node's page —
   *  and a promise is what keeps that from shuffling when an unrelated file
   *  gains an edge. */
  readonly blocked: ReadonlyMap<string, ReadonlyArray<InTheWay>>
}

export const derive = (nodes: ReadonlyArray<Located>): Derived => {
  const byId = new Map<string, Located>()
  for (const located of nodes) {
    if (!byId.has(located.node.id)) byId.set(located.node.id, located)
  }

  const children = new Map<string, Array<Located>>()
  for (const located of nodes) {
    const parent = located.node.parent
    if (parent === undefined) continue
    const siblings = children.get(parent)
    if (siblings === undefined) children.set(parent, [located])
    else siblings.push(located)
  }
  // `ord` is a fractional index over base62, so plain string comparison IS the
  // sort; file order breaks ties rather than leaving them to the engine.
  for (const siblings of children.values()) siblings.sort(byOrd)

  const status = statuses(nodes, byId)
  const after = orderings(byId, nodes)
  return { nodes, byId, children, status, after, blocked: blockage(byId, status, after) }
}

/**
 * Sibling order, as the format defines it: `ord` is a fractional index over
 * base62, so plain string comparison IS the sort, and file order breaks ties
 * rather than leaving them to the engine.
 *
 * Exported because a WRITER needs it too — placing a node among its siblings is
 * the same question a reader asks, and a second comparator would be a second
 * definition of sibling order free to disagree with the one the validator and
 * the view use.
 */
export const byOrd = (a: Located, b: Located): number =>
  a.node.ord === b.node.ord ? a.line - b.line : a.node.ord < b.node.ord ? -1 : 1

/**
 * The records that share a parent, in sibling order — or the roots of one file
 * when `parent` is absent.
 *
 * A MIRROR is a sibling here, even though it is never a counted child: it
 * occupies a place in the row, and this question is about places. That is the
 * difference from {@link countedChildren}, which is about obligations.
 */
export const siblingsOf = (
  derived: Derived,
  file: string,
  parent: string | undefined,
): ReadonlyArray<Located> =>
  parent === undefined
    ? derived.nodes
      .filter((located) => located.file === file && located.node.parent === undefined)
      .sort(byOrd)
    : (derived.children.get(parent) ?? []).filter((located) => located.file === file)

/** The children that count as a node's own. A mirror is a second view of a
 *  node, not a second obligation, so it never counts — which is what {@link
 *  progressOf} rolls up and what a reader listing "what is under this" means. */
const counted = (
  children: ReadonlyMap<string, ReadonlyArray<Located>>,
  id: string,
): ReadonlyArray<LocatedRegular> =>
  // A type guard, so what comes back IS the regular records rather than a
  // list every caller has to assert about: dropping the mirrors is exactly
  // what makes that true, and saying so here is what deletes the casts.
  (children.get(id) ?? []).filter((child): child is LocatedRegular =>
    !isMirror(child.node)
  )

export const countedChildren = (
  derived: Derived,
  id: string,
): ReadonlyArray<LocatedRegular> => counted(derived.children, id)

/**
 * Every node's status: the mark it stores, and nothing else.
 *
 * A mirror stands for its target's, because that is what it shows — which for
 * a plain bullet is nothing. That is the ONLY hop, and it is a placement
 * question rather than a rollup: {@link follow} already answers it, cycle-safe,
 * for a set the validator has condemned as well as for one it has not.
 */
const statuses = (
  nodes: ReadonlyArray<Located>,
  byId: ReadonlyMap<string, Located>,
): ReadonlyMap<string, Status> => {
  const index = { byId }
  const status = new Map<string, Status>()
  for (const located of nodes) {
    const found = follow(index, located)
    const mark = found.kind === "found" ? storedMarker(found.shows.node) : undefined
    if (mark !== undefined) status.set(located.node.id, mark)
  }
  return status
}

/** What a record claims about itself, which IS its status — and `undefined`
 *  for one claiming nothing, the one spelling of absence this module has. Read
 *  in {@link MARKS} order, which is precedence: the three are mutually
 *  exclusive on disk, so it only decides what a set the validator has already
 *  condemned looks like. */
export const storedMarker = (node: LocatedRegular["node"]): Status | undefined =>
  MARKS.find((mark) => node[mark] !== undefined)

/**
 * The children of a node that are TASKS, each with the mark that makes it one.
 *
 * The whole of what children add up to, in one place, because the two things
 * anyone asks of it are two readings of this one list: how far along they are
 * ({@link progressOf}, an annotation) and which of them are still open
 * ({@link unfinishedUnder}, what a write-time nudge names). A second walk over
 * the same edges — the ops layer had one — is one computation in two copies,
 * free to disagree about whether a bullet counts.
 *
 * Only the node's own children: a deep count would answer a question no row is
 * asking. And never a mirror, which is a second view of a node rather than a
 * second obligation.
 */
const tasksUnder = (
  derived: Derived,
  id: string,
): ReadonlyArray<{ readonly at: LocatedRegular; readonly status: Status }> =>
  counted(derived.children, id).flatMap((at) => {
    const status = derived.status.get(at.node.id)
    return status === undefined ? [] : [{ at, status }]
  })

/**
 * How far along the tasks under a node have got — an ANNOTATION.
 *
 * A parent showing `3/5` is telling the reader something the rows below it
 * already say, in one glance. It is not a status: it does not decide whether
 * the node is hidden ({@link withoutDone} reads the stored mark), it does not
 * block anything, and no write is refused because of it. That separation is
 * the point — rollup as a status is what made a parent a task nobody had
 * called one.
 *
 * `undefined` when nothing under it is a task — there is no progress to show
 * rather than progress of zero.
 */
export const Progress = Schema.Struct({
  done: Schema.Int,
  total: Schema.Int,
})
export type Progress = typeof Progress.Type

export const progressOf = (derived: Derived, id: string): Progress | undefined => {
  const tasks = tasksUnder(derived, id)
  if (tasks.length === 0) return undefined
  // Counted in place rather than filtered: this runs once per drawn row, and
  // the answer is two integers.
  let done = 0
  for (const task of tasks) {
    if (task.status === "done") done += 1
  }
  return { done, total: tasks.length }
}

/** The same list read the other way: the child tasks that are NOT done. A
 *  bullet is never among them — it is not a task, so there is nothing under it
 *  to finish — which is the rule a caller must not re-decide, and the reason
 *  this is here rather than at the one site that names them. */
export const unfinishedUnder = (
  derived: Derived,
  id: string,
): ReadonlyArray<LocatedRegular> =>
  tasksUnder(derived, id).flatMap((task) => task.status === "done" ? [] : [task.at])

// ── what cannot start yet ──────────────────────────────────────────────

/**
 * A node standing in another's way, and WHY it is — a task that is not done.
 *
 * The reason travels with the node rather than being restated by each reader,
 * because every one of them wants it: a mark column tones the glyph with it, a
 * page names the node, and a caller left to look the mark up again is a caller
 * free to look it up differently.
 *
 * `Exclude<Status, "done">` says the whole rule in the type: what is in the way
 * is unfinished WORK. A node with no status is absent from this shape entirely
 * — it is not a task, so there is nothing under it to finish — which is the
 * same sentence {@link unfinishedUnder} says about children, about the other
 * kind of edge.
 */
export interface InTheWay {
  readonly at: LocatedRegular
  readonly status: Exclude<Status, "done">
}

/**
 * The ordering graph of the set: the node an edge holds up → the ids it must
 * come after.
 *
 * `blocks` is sugar — `a blocks b` means `b after a` — and this is the only
 * place it is normalised, so the acyclicity rule and blockedness read one
 * graph rather than two that could disagree.
 *
 * TWO PASSES, and that is the order {@link Derived.blocked} promises: every
 * node's own `after` first, as it writes them, and only then the `blocks`
 * pointing back at it from elsewhere. One interleaved pass filed a reverse edge
 * from a record written earlier in the file AHEAD of the node's own targets,
 * so what a row with room for one blocker showed depended on where in the
 * directory somebody had written an unrelated `blocks`.
 *
 * IN TERMS OF NODES, at both ends: an edge naming a mirror is an edge to the
 * node standing at it, because a placement is addressable like any other
 * record and that is what naming one means. So `a blocks m` and `x after b`
 * land on one list when `m` mirrors `x`, and — this is the half that bites —
 * a deadlock that closes THROUGH a placement is one loop rather than two dead
 * ends. Canonicalising here rather than at each reader is what stops the
 * acyclicity rule and blockedness from disagreeing about whether two records
 * mean one edge: they would have to resolve identically, and one of them did
 * not. An id nothing declares is left as written — an unknown target is the
 * validator's to report, and dropping the edge here would decide that quietly.
 *
 * A mirror is never a source of its own: it carries no edges.
 */
const orderings = (
  byId: ReadonlyMap<string, Located>,
  nodes: ReadonlyArray<Located>,
): ReadonlyMap<string, ReadonlyArray<string>> => {
  const index = { byId }
  const named = (id: string): string => nodeNamed(index, id)?.node.id ?? id
  const after = new Map<string, Array<string>>()
  const edge = (from: string, to: string): void => {
    const existing = after.get(from)
    if (existing === undefined) after.set(from, [to])
    else existing.push(to)
  }

  for (const { node } of nodes) {
    if (isMirror(node)) continue
    for (const target of node.after ?? []) edge(node.id, named(target))
  }
  for (const { node } of nodes) {
    if (isMirror(node)) continue
    for (const target of node.blocks ?? []) edge(named(target), node.id)
  }
  return after
}

/**
 * What is standing in each node's way — the whole of blockedness, derived like
 * everything else here and stored nowhere.
 *
 * `a after b` means b blocks a WHILE b is a task that is not done — with the
 * three marks there are, while b is `doing` or `todo`. A target with NO status
 * never blocks: it is not a task, there is nothing under it to finish, so
 * there is nothing to wait for. The trap this rule is written against is
 * spelling it `status !== "done"`, which reads every plain bullet as an
 * obstacle that can never be cleared — and adding `todo` did not narrow that
 * trap by one case, since the unmarked node is still the one that must not
 * block (docs/format.md).
 *
 * ONE predicate, read at BOTH ENDS of the arrow, which is the racket
 * reference's own shape (`olai/query.rkt`'s `live?`): "a node this can be said
 * about" and "a node that still stands in the way" are the same question asked
 * from either side, and two spellings of it would be two chances to disagree
 * about what unfinished work is. So a done node is waiting on nothing — it has
 * happened, and the order it happened in is no longer a question — and a
 * bullet is neither blocked nor blocking, because a bullet is not work.
 *
 * ARCHIVED is that same answer arrived at from the other side, and it also
 * goes both ways. Work that was put away is not blocking anything: archiving
 * is what you do to work that is over, and a live node waiting on one would be
 * waiting forever. Nor is it blocked: the archive is read as history, and a
 * node in it is not being told it cannot start. Note where the exemption
 * stops — the validator's `after` cycle check exempts nothing, because a loop
 * is a loop whether or not part of it has been put away, and it is a claim
 * about the file rather than about what is on anyone's plate.
 */
const blockage = (
  byId: ReadonlyMap<string, Located>,
  status: ReadonlyMap<string, Status>,
  after: ReadonlyMap<string, ReadonlyArray<string>>,
): ReadonlyMap<string, ReadonlyArray<InTheWay>> => {
  const index = { byId }

  /** The node an end of an arrow names, WHILE it is still in play: it exists,
   *  it is a task that is not done, and it has not been put away. */
  const inPlay = (id: string): InTheWay | undefined => {
    const at = nodeNamed(index, id)
    if (at === undefined || isArchived(at.file)) return undefined
    const mark = status.get(at.node.id)
    return mark === undefined || mark === "done" ? undefined : { at, status: mark }
  }

  const blocked = new Map<string, ReadonlyArray<InTheWay>>()
  for (const [id, targets] of after) {
    const source = inPlay(id)
    if (source === undefined) continue

    const waiting = targets
      .map((target) => inPlay(target))
      .filter((blocker) => blocker !== undefined)
    if (waiting.length === 0) continue

    // Keyed by the NODE. Both spellings of an edge were resolved to one before
    // they became keys above, so a node has one list here however many records
    // pointed at it and however they addressed it.
    blocked.set(source.at.node.id, waiting)
  }
  return blocked
}

/**
 * What drawing this record leads to drawing: its children, and — for a mirror
 * — the record it shows.
 *
 * The CONTAINMENT graph, in the one place it is spelled. It runs downward, and
 * the direction is the point: a pure parent loop is found either way, but a
 * mirror's edge to its target is downward by nature, so only this direction
 * finds the placement that expands forever.
 *
 * Two rules read it and they must not disagree. The validator refuses a set
 * whose placements close a loop ({@link ./validate.ts}); the ops layer refuses
 * the PLACEMENT that would close one, before the write, so an agent is told
 * which loop it is about to make rather than handed a report about a file that
 * was never written. Two spellings would be a mirror the planner allowed and
 * the validator then rejected — a write refused for a reason the tool that
 * planned it did not know about.
 */
export const drawnFrom = (
  derived: Pick<Derived, "children">,
  node: Node,
): ReadonlyArray<string> => [
  ...(derived.children.get(node.id) ?? []).map((child) => child.node.id),
  ...(isMirror(node) ? [node.mirror] : []),
]

/** What one node is waiting on: empty when nothing is in its way, which is the
 *  answer for nearly every node. The reading side of {@link Derived.blocked},
 *  so no caller has to know that absence is how the index spells "nothing". */
export const blockersOf = (
  derived: Derived,
  id: string,
): ReadonlyArray<InTheWay> => derived.blocked.get(id) ?? []

// ── the drawable tree ──────────────────────────────────────────────────

/** Fields every row has, whatever it turned out to be. */
interface Place {
  /** The record occupying this place — the mirror itself, for a mirror. */
  readonly at: Located
  /** Absent when this place draws a plain bullet — there is no mark, and no
   *  box to draw one in. */
  readonly status: Status | undefined
  /** What this place is waiting on, and empty when nothing is. Asked of the
   *  node the place SHOWS, so a mirror says what its target says — the rule
   *  its status already follows — and a place drawing no node at all is
   *  waiting on nothing. */
  readonly blocked: ReadonlyArray<InTheWay>
  /** The rollup, for a row that has tasks under it: an annotation beside the
   *  title, never a second answer to what the checkbox shows. */
  readonly progress: Progress | undefined
  /** Stable identity of this PLACE, not of the node. The same node reached
   *  through two mirrors is two rows on screen, and folding one must not fold
   *  the other. */
  readonly key: string
  readonly children: ReadonlyArray<Row>
}

/**
 * One place in the tree, and what the reader should be told about it.
 *
 * A union rather than four booleans, and it carries the ANSWER rather than the
 * question: a dangling row knows the id the mirror chain actually died on (not
 * the first hop, which may well exist), and a cycle row knows the id it closed
 * on. The walk is the only thing that knows either; a view recomputing them
 * from `at` would get the first hop and say something untrue.
 */
export type Row =
  | (Place & { readonly kind: "node" | "mirror"; readonly shows: LocatedRegular })
  | (Place & { readonly kind: "dangling"; readonly missing: string })
  | (Place & { readonly kind: "cycle"; readonly through: string })

/** The rows of one outline: the roots of `file`, expanded. Mirrors are
 *  expanded in place, because a pointer the reader has to go and follow is not
 *  a second location — it is a footnote. */
export const rowsOf = (derived: Derived, file: string): ReadonlyArray<Row> =>
  siblingsOf(derived, file, undefined).map((root) => expand(derived, root, [], ""))

/**
 * The rows UNDER one node: what a zoomed page draws below its heading.
 *
 * The same walk as {@link rowsOf} from a different starting line — which is
 * the point of it being one function. `ancestors` seeds the containment guard,
 * and it is the caller's because the caller already worked the chain out for
 * the crumbs: a page zoomed to `install` is still inside `kitchen`, so a mirror
 * of `kitchen` further down is a loop whether or not the ancestors above the
 * heading are being drawn as rows.
 */
export const rowsUnder = (
  derived: Derived,
  shows: LocatedRegular,
  ancestors: ReadonlyArray<LocatedRegular>,
): ReadonlyArray<Row> => {
  const within = [...ancestors.map((crumb) => crumb.node.id), shows.node.id]
  return (derived.children.get(shows.node.id) ?? []).map((child) =>
    expand(derived, child, within, "")
  )
}

const expand = (
  derived: Derived,
  at: Located,
  ancestors: ReadonlyArray<string>,
  parentKey: string,
): Row => {
  const key = `${parentKey}/${at.node.id}`
  const found = follow(derived, at)
  // The fields every branch shares, including the rollup a stub has none of —
  // the drawn branch below overrides it, and no branch has to remember to say
  // it has nothing. What a place is WAITING ON is asked of the node it shows,
  // which a stub has none of either.
  const place = {
    at,
    status: derived.status.get(at.node.id),
    blocked: found.kind === "found" ? blockersOf(derived, found.shows.node.id) : [],
    progress: undefined,
    key,
  }

  if (found.kind !== "found") {
    return { ...place, children: [], ...found }
  }
  if (ancestors.includes(found.shows.node.id)) {
    return { ...place, children: [], kind: "cycle", through: found.shows.node.id }
  }

  const within = [...ancestors, found.shows.node.id]
  return {
    ...place,
    // The rollup of what this place SHOWS: a mirror's row draws its target's
    // children, so it draws its target's progress too.
    progress: progressOf(derived, found.shows.node.id),
    kind: isMirror(at.node) ? "mirror" : "node",
    shows: found.shows,
    children: (derived.children.get(found.shows.node.id) ?? []).map((child) =>
      expand(derived, child, within, key)
    ),
  }
}

/**
 * The same rows with everything done left out — the done-visibility switch,
 * which is a property of a reading and not of the file. Nothing is touched on
 * disk and nothing is marked: a hidden row is a row not drawn.
 *
 * Done-hidden means exactly this: a row whose node STORES `done` is not drawn,
 * and its subtree goes with it. The sweep is justified rather than inferred
 * now — a done mark on a parent is somebody's claim about the whole branch,
 * made deliberately, so hiding what hangs under it is honouring the claim.
 * That was the defect this replaced: a parent that merely *derived* done, by
 * arithmetic nobody had asked for, took unmarked findings down with it, and
 * the view whose whole purpose is showing what is left hid exactly what was
 * left. Nothing derives done any more, so nothing is hidden that nobody
 * finished.
 */
export const withoutDone = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> =>
  rows.flatMap((row) =>
    row.status === "done" ? [] : [{ ...row, children: withoutDone(row.children) }]
  )

/**
 * The canonical parent chain of a node, root first, the node itself excluded.
 *
 * CANONICAL, so it is a property of the node and not of the click that got you
 * there: a node reached through a mirror three files away has the same
 * ancestry as one reached by scrolling to it. `parent` is same-file by the
 * format, so every crumb lives in the node's own outline.
 *
 * Cycle-safe, like every walk here. A parent loop is a set the validator
 * rejects, but the crumbs are drawn from sets its own error messages describe.
 */
export const ancestorsOf = (
  derived: Derived,
  id: string,
): ReadonlyArray<LocatedRegular> => {
  const chain: Array<LocatedRegular> = []
  const seen = new Set<string>([id])
  let next = derived.byId.get(id)?.node.parent

  while (next !== undefined && !seen.has(next)) {
    seen.add(next)
    const located = derived.byId.get(next)
    // A parent that is missing, or is a mirror, is a set the validator has
    // already condemned. Stop at the last crumb that is really there rather
    // than inventing one or walking through a placement.
    if (located === undefined || isMirror(located.node)) break
    chain.push(located as LocatedRegular)
    next = located.node.parent
  }

  return chain.reverse()
}

/**
 * A node, and the derived facts that say what it IS.
 *
 * One concept with two readers so far, and they would otherwise be two
 * identical structures: a zoomed page puts these above its heading, a day
 * lists nodes from all over the set and each of them needs the same three, and
 * search-with-ancestors will want them too. A title torn out of its outline
 * says nothing — `order the new cabinets` is a different task under `kitchen
 * remodel` than under `the office move` — so "the node plus its context" is a
 * thing, and it is this one.
 */
export interface Situated {
  /** The regular node at the end of the chain, whatever record was addressed
   *  to reach it. */
  readonly shows: LocatedRegular
  /** Absent when the node carries no mark. */
  readonly status: Status | undefined
  /** What it is waiting on, and empty when nothing is. */
  readonly blocked: ReadonlyArray<InTheWay>
  /** The rollup of its task children, for the same reason a row carries one. */
  readonly progress: Progress | undefined
  /** The canonical parent chain, root first, `shows` excluded. */
  readonly trail: ReadonlyArray<LocatedRegular>
}

export const situate = (derived: Derived, shows: LocatedRegular): Situated => ({
  shows,
  status: derived.status.get(shows.node.id),
  blocked: blockersOf(derived, shows.node.id),
  progress: progressOf(derived, shows.node.id),
  trail: ancestorsOf(derived, shows.node.id),
})

/**
 * What a record actually shows: itself, or — following as many mirror hops as
 * it takes — the regular node at the end of the chain.
 *
 * A mirror of a mirror is legal (nothing in the format forbids a second
 * pointer to a pointer) and resolving only one hop would leave a row standing
 * for a record with no title and no children of its own: a legal set the
 * reader cannot draw. The two failures are told apart and each names the id it
 * failed at, because "a mirror of `b`, which no node declares" is a lie when
 * `b` exists and it is `b`'s own target that is missing.
 */
type Found =
  | { readonly kind: "found"; readonly shows: LocatedRegular }
  | { readonly kind: "dangling"; readonly missing: string }
  | { readonly kind: "cycle"; readonly through: string }

export const follow = (
  // Only the id index, so the status pass and the blockedness pass can call it
  // while the rest of the derivation is still being built — and so a caller
  // with a whole `Derived` passes it unchanged.
  derived: Pick<Derived, "byId">,
  from: Located,
): Found => {
  // The common case, said first because this runs for every node of the set,
  // for every edge endpoint and for every `see` target on every derive: a
  // record that is not a mirror shows itself, and there is no chain to
  // remember.
  if (!isMirror(from.node)) return { kind: "found", shows: from as LocatedRegular }

  const seen = new Set<string>()
  let at: Located = from
  while (isMirror(at.node)) {
    if (seen.has(at.node.id)) return { kind: "cycle", through: at.node.id }
    seen.add(at.node.id)
    const next = derived.byId.get(at.node.mirror)
    if (next === undefined) return { kind: "dangling", missing: at.node.mirror }
    at = next
  }
  return { kind: "found", shows: at as LocatedRegular }
}

/**
 * The node an ID NAMES: the regular record at the end of whatever mirror chain
 * it addresses, and `undefined` when nothing declares it or the chain does not
 * end at a node.
 *
 * An edge target is an id like any other and a mirror is addressable like any
 * other record, so "what does this id mean" is one question with one answer —
 * the node standing at that placement. Every reader of a target field asks it:
 * blockedness, to find what is in the way, and the view, to put a `see`
 * target's title on a link. Two spellings of it would be two answers about the
 * same id, and the one that got it wrong would be a link with no text.
 *
 * The distinction from {@link follow} is which question is being asked: follow
 * tells a ROW apart from the two ways its chain can fail, because a row has to
 * draw the failure. A reference has nothing to draw and nowhere to say it, so
 * both failures answer the same thing here.
 */
export const nodeNamed = (
  derived: Pick<Derived, "byId">,
  id: string,
): LocatedRegular | undefined => {
  const named = derived.byId.get(id)
  if (named === undefined) return undefined
  const found = follow(derived, named)
  return found.kind === "found" ? found.shows : undefined
}

// ── titles ─────────────────────────────────────────────────────────────

/**
 * The two characters that start a tag.
 *
 * `#` is what this format has always had; `@` joined it with the editor's tag
 * autocomplete (`input-widgets`), because Workflowy trains both hands and a
 * trigger that inserted the OTHER character would be an affordance writing text
 * the set does not recognise as a tag. They are two NAMESPACES rather than two
 * spellings of one: `#alice` and `@alice` are different tags, which is the
 * whole reason a person reaches for one rather than the other (`@` for who,
 * `#` for what).
 */
export const TAG_SIGILS = ["#", "@"] as const
export type TagSigil = (typeof TAG_SIGILS)[number]

/** A title, split into what to print and what to style. Tags live inline in
 *  the title verbatim — the format stores no tag list — so the split happens
 *  at view time, every time. */
export type TitlePart =
  | { readonly kind: "text"; readonly text: string }
  | {
    readonly kind: "tag"
    /** Which character started it — carried rather than assumed, so a part
     *  list rejoins to the title it came from. */
    readonly sigil: TagSigil
    /** The name, without the sigil. */
    readonly tag: string
  }

/** The written form of a tag part — the characters the title actually holds.
 *  One spelling, because every consumer that draws a tag or indexes one needs
 *  it and three of them re-assembling it is three chances to drop the `@`. */
export const tagText = (part: { readonly sigil: TagSigil; readonly tag: string }): string =>
  `${part.sigil}${part.tag}`

/**
 * Whether text could hold a tag AT ALL — a plain `indexOf` per sigil, and the
 * guard every walk of {@link titleParts} takes first.
 *
 * That call runs a global regex and allocates a part per segment, and most
 * titles hold no tag at all; the search index, the client's two renderings of a
 * pill and its tag completion all want the same cheap negative. It was written
 * three times before this existed, and the first two had already drifted (one
 * asked about `#` only).
 */
export const mayHoldTag = (text: string): boolean =>
  text.includes("#") || text.includes("@")

/**
 * A fresh `/g` regex for an inline tag in a title.
 *
 * A sigil followed by letters, digits, `_`, `-` or `/` — the last so
 * `#work/olai` is one tag. A bare sigil is text. Returned new each call so `/g`
 * state is never shared across walks (the client styles tags by walking HAST
 * text nodes with the same alphabet, and must not re-declare it).
 *
 * THE TWO SIGILS ARE NOT MATCHED THE SAME WAY, and the asymmetry is about what
 * people write rather than about tidiness: `@` sits inside ordinary words all
 * the time (`srid@srid.ca`, a handle quoted mid-sentence) and `#` essentially
 * does not, so `@` is claimed only where a word STARTS — the beginning of the
 * title, or after a space or an opening bracket. `#` keeps the alphabet it has
 * had since the format's first day, unchanged, because narrowing it would
 * restyle titles in sets that are already written.
 */
export const titleTagRe = (): RegExp => /#[A-Za-z0-9_/-]+|(?<![^\s([{])@[A-Za-z0-9_/-]+/g

/**
 * Whether `text` is a tag NAME and nothing else — the alphabet above, asked as
 * a question.
 *
 * It exists because a client COMPLETING a tag has to know where one stops
 * while it is still half-typed, and this file already says the alphabet must
 * not be re-declared elsewhere. An empty name passes: `#` on its own is a tag
 * being started, which is exactly when a completion is wanted, and it is
 * {@link titleTagRe}'s business that a bare sigil is not yet a tag.
 */
export const isTagName = (text: string): boolean => /^[A-Za-z0-9_/-]*$/.test(text)

/**
 * Whether a sigil sitting at `at` STARTS a tag rather than sitting inside a
 * word — the beginning of the text, or after a space or an opening bracket.
 *
 * The rule {@link titleTagRe} applies to `@`, asked of ANY position, because a
 * completion wants it for both sigils: offering to rewrite the middle of
 * `issue#42` is offering to rewrite a word somebody is in the middle of
 * typing. What the format RECOGNISES as a tag is the regex's own, wider
 * question for `#`; this is only about where one may be started.
 */
export const tagOpensAt = (text: string, at: number): boolean =>
  at === 0 || /[\s([{]/.test(text[at - 1] as string)

export const titleParts = (title: string): ReadonlyArray<TitlePart> => {
  const parts: Array<TitlePart> = []
  let at = 0
  for (const match of title.matchAll(titleTagRe())) {
    const start = match.index
    if (start > at) parts.push({ kind: "text", text: title.slice(at, start) })
    parts.push({
      kind: "tag",
      sigil: match[0][0] as TagSigil,
      tag: match[0].slice(1),
    })
    at = start + match[0].length
  }
  if (at < title.length) parts.push({ kind: "text", text: title.slice(at) })
  return parts
}
