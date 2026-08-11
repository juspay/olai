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

import {
  isMirror,
  type Located,
  type LocatedRegular,
  MARKS,
} from "./node.ts"

/**
 * What a node's checkbox shows: one of the {@link MARKS}. STORED, on the node
 * that carries it, whether or not it has children — and OPTIONAL everywhere,
 * because a node with no status is a bullet and not a task at all.
 *
 * Read off that list rather than spelled again, because a status IS a mark:
 * there is nothing else it could be now that nothing computes one. One name
 * for it, so nobody has to learn that two are the same.
 *
 * What there is deliberately no member for is UNMARKED. `open` used to be one,
 * and it was what a node got for carrying nothing, which made every node a
 * task and left one value answering two questions — "a task nobody has
 * started" and "not a task at all". Absence answers the second; `todo` is how
 * a node says the first, and someone has to put it there.
 */
export type Status = (typeof MARKS)[number]

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

  return { nodes, byId, children, status: statuses(nodes, byId) }
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
export interface Progress {
  readonly done: number
  readonly total: number
}

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

// ── the drawable tree ──────────────────────────────────────────────────

/** Fields every row has, whatever it turned out to be. */
interface Place {
  /** The record occupying this place — the mirror itself, for a mirror. */
  readonly at: Located
  /** Absent when this place draws a plain bullet — there is no mark, and no
   *  box to draw one in. */
  readonly status: Status | undefined
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
  // The fields every branch shares, including the rollup a stub has none of —
  // the drawn branch below overrides it, and no branch has to remember to say
  // it has nothing.
  const place = {
    at,
    status: derived.status.get(at.node.id),
    progress: undefined,
    key,
  }

  const found = follow(derived, at)
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
  /** The rollup of its task children, for the same reason a row carries one. */
  readonly progress: Progress | undefined
  /** The canonical parent chain, root first, `shows` excluded. */
  readonly trail: ReadonlyArray<LocatedRegular>
}

export const situate = (derived: Derived, shows: LocatedRegular): Situated => ({
  shows,
  status: derived.status.get(shows.node.id),
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
  // Only the id index, so the status pass can call it while the rest of the
  // derivation is still being built — and so a caller with a whole `Derived`
  // passes it unchanged.
  derived: Pick<Derived, "byId">,
  from: Located,
): Found => {
  // The common case, said first because this runs for every node of the set on
  // every derive: a record that is not a mirror shows itself, and there is no
  // chain to remember.
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

// ── titles ─────────────────────────────────────────────────────────────

/** A title, split into what to print and what to style. Tags live inline in
 *  the title verbatim — the format stores no tag list — so the split happens
 *  at view time, every time. */
export type TitlePart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "tag"; readonly tag: string }

/** `#` followed by letters, digits, `_`, `-` or `/` — the last so `#work/olai`
 *  is one tag. A bare `#` is text. */
const TAG = /#[A-Za-z0-9_/-]+/g

export const titleParts = (title: string): ReadonlyArray<TitlePart> => {
  const parts: Array<TitlePart> = []
  let at = 0
  for (const match of title.matchAll(TAG)) {
    const start = match.index
    if (start > at) parts.push({ kind: "text", text: title.slice(at, start) })
    parts.push({ kind: "tag", tag: match[0].slice(1) })
    at = start + match[0].length
  }
  if (at < title.length) parts.push({ kind: "text", text: title.slice(at) })
  return parts
}
