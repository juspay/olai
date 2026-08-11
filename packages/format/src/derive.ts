/**
 * Everything the format computes rather than stores.
 *
 * A parent's status, a title's `#tags`, the order of siblings, the subtree a
 * mirror stands for: none of it is on disk, all of it is derived here, and it
 * is derived ONCE. {@link derive} builds the indexes; {@link rowsOf} turns them
 * into the shape a reader sees. The validator and the browser both call these
 * — that is the point. A view that rebuilt the tree itself would be a second
 * interpretation of the format, free to disagree with the one that decides
 * whether the file is legal at all.
 *
 * Every walk is cycle-safe. The validator rejects a set whose parents or
 * mirrors close a loop, so these functions should never meet one — but they
 * also run against sets the validator has already condemned (its own error
 * messages quote derived status), and a renderer that hangs is a worse way to
 * learn about a bug than a marked stub.
 */

import {
  isArchived,
  isMirror,
  type Located,
  type LocatedRegular,
  MARKS,
} from "./node.ts"

/**
 * What a node's checkbox shows: one of the {@link MARKS}. Derived for a
 * parent, stored for a leaf, and OPTIONAL everywhere — a node with no status
 * is a bullet and not a task at all.
 *
 * Read off that list rather than spelled again, because it is the same set by
 * design and not by coincidence: a leaf shows the mark it carries, a parent
 * shows the mark its children add up to, and neither can produce a fourth
 * thing. One name for it, so nobody has to learn that two are the same.
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
  /** id → derived status, for the nodes that HAVE one. PARTIAL over `nodes`,
   *  and that is the answer rather than a gap in it: a node missing from this
   *  map is a plain bullet — nobody marked it, nothing under it is marked, so
   *  there is nothing to finish. */
  readonly status: ReadonlyMap<string, Status>
  /** id → the ids it must come after, as the records write them: the ORDERING
   *  graph, with `blocks` normalised into it. One graph, because two rules ask
   *  about the same edges — the validator's acyclicity check and the
   *  blockedness below — and a second normalisation of `blocks` would be a
   *  second graph free to disagree with the first. */
  readonly after: ReadonlyMap<string, ReadonlyArray<string>>
  /** id → what is standing in its way. PARTIAL like `status`, and non-empty
   *  wherever it is present: absence is the answer for everything that can
   *  start, which is nearly every node. Keyed by the node itself, so a mirror
   *  asks this of what it SHOWS exactly as it asks for its status. */
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

  const status = statuses(nodes, byId, children)
  const after = orderings(nodes)
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

/** The children that count toward a node's derived status. A mirror is a
 *  second view of a node, not a second obligation, so it never counts. One
 *  function, called by the status walk and by the validator's refusal message,
 *  because a set that disagreed about which children count would show one
 *  answer and explain the other. */
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

/** How many children answered, on every one of the three. Factored the way
 *  {@link Row} factors {@link Place}: one field, one place to describe it. */
interface Asked {
  readonly counted: number
}

/** One node in the way of another, and WHY it is — a task that is not done.
 *  The reason travels with the node rather than being restated by each reader:
 *  that restatement is what the union below exists to stop.
 *
 *  Two readers, and they are the two directions a node can be held up in: a
 *  CHILD that is not finished, which is what stops its parent storing a mark,
 *  and an `after` target that has not happened yet, which is what makes a node
 *  {@link Derived.blocked}. Same shape and the same test, because it is the
 *  same sentence — this one is unfinished work. */
export interface InTheWay {
  readonly at: LocatedRegular
  readonly status: Exclude<Status, "done">
}

/**
 * What a node's CHILDREN say about it — and the whole of what a refusal needs
 * in order to say why it refuses.
 *
 * Two places have to turn down a stored mark and explain it: the validator, on
 * load, and the ops layer, on a write. Both answer the same three-way
 * question, and the third answer is the only one that has children to name, so
 * a status beside a list would be two values with a rule between them — which
 * is what each of the two sites was holding in a comment. It is one union, and
 * the list exists exactly where it means something.
 *
 * `null` when the node has no counted children: then it speaks for itself, and
 * neither refusal is about it.
 */
export type FromChildren =
  /** None of them is a task, so neither is the node. */
  | (Asked & { readonly kind: "nothing" })
  /** Every task among them is finished. */
  | (Asked & { readonly kind: "done" })
  /** Some are not, and they are what to mark instead. Non-empty. */
  | (Asked & {
    readonly kind: "unfinished"
    readonly children: ReadonlyArray<InTheWay>
  })

export const fromChildren = (derived: Derived, id: string): FromChildren | null => {
  const own = counted(derived.children, id)
  if (own.length === 0) return null

  // The walk's OWN answer, read back rather than worked out a second time:
  // a node with counted children derives exactly these three cases.
  const says = derived.status.get(id)
  if (says === undefined) return { kind: "nothing", counted: own.length }
  if (says === "done") return { kind: "done", counted: own.length }

  return {
    kind: "unfinished",
    counted: own.length,
    // A child is in the way if it is a TASK that is not done — never merely
    // `!== "done"`, which reads a plain bullet as an obstacle that can never
    // be cleared.
    children: own.flatMap((at) => {
      const status = derived.status.get(at.node.id)
      return status === undefined || status === "done" ? [] : [{ at, status }]
    }),
  }
}

/**
 * A leaf says what it is, and says nothing at all when it carries no mark.
 *
 * A parent counts only the children that are TASKS — the ones with a status of
 * their own — and reports how far along they have got as a whole:
 *
 * - every one of them done → **done**;
 * - every one of them `todo` → **todo**, because nothing under it has started
 *   and a parent that claimed otherwise would be inventing progress;
 * - anything else → **doing**: something has started, or some are finished
 *   while others are not, and both of those are a thing under way.
 *
 * A parent whose counted children include no task is no more a task than they
 * are, so it has no status either: an unmarked child is not an unfinished
 * obligation, it is a bullet, and a subtree of bullets adds up to a bullet.
 *
 * A mirror reports its target's status, because that is what it shows — which
 * for a plain bullet is nothing.
 */
const statuses = (
  nodes: ReadonlyArray<Located>,
  byId: ReadonlyMap<string, Located>,
  children: ReadonlyMap<string, ReadonlyArray<Located>>,
): ReadonlyMap<string, Status> => {
  // The map handed back IS the one the walk fills, and "no status" is a
  // settled ANSWER rather than a missing one — so `settled` records that the
  // question was asked and `status` holds only the nodes with an answer. One
  // spelling of absence, the same one every caller reads off `status.get`,
  // and no second table to copy out of at the end.
  const status = new Map<string, Status>()
  const settled = new Set<string>()
  const walking = new Set<string>()

  const of = (located: Located): Status | undefined => {
    const id = located.node.id
    if (settled.has(id)) return status.get(id)
    // A loop the validator will report; treat the re-entry as carrying nothing
    // rather than recursing into it.
    if (walking.has(id)) return undefined
    walking.add(id)

    const computed = compute(located)
    walking.delete(id)
    settled.add(id)
    if (computed !== undefined) status.set(id, computed)
    return computed
  }

  const compute = (located: Located): Status | undefined => {
    if (isMirror(located.node)) {
      const target = byId.get(located.node.mirror)
      return target === undefined ? undefined : of(target)
    }

    const own = counted(children, located.node.id)
    if (own.length === 0) return storedMarker(located.node)

    // One array, not one per unmarked child: most nodes carry no mark, so
    // this runs over every parent-child edge in the set on every derive.
    const tasks = own.map(of).filter((mark) => mark !== undefined)
    if (tasks.length === 0) return undefined
    // The two unanimous answers first, and `doing` for everything else —
    // including the mixed case, where some are finished and some have not
    // started, which is exactly what a thing under way looks like.
    if (tasks.every((task) => task === "done")) return "done"
    if (tasks.every((task) => task === "todo")) return "todo"
    return "doing"
  }

  for (const located of nodes) of(located)
  return status
}

/** What a leaf claims about itself, which for a leaf IS its status — and
 *  `undefined` for a leaf claiming nothing, the one spelling of absence this
 *  module has. Read in {@link MARKS} order, which is precedence: the three are
 *  mutually exclusive on disk, so it only decides what a set the validator has
 *  already condemned looks like. */
export const storedMarker = (node: LocatedRegular["node"]): Status | undefined =>
  MARKS.find((mark) => node[mark] !== undefined)

// ── what cannot start yet ──────────────────────────────────────────────

/** The ordering graph of the set: id → the ids that record must come after.
 *
 *  `blocks` is sugar — `a blocks b` means `b after a` — and this is the only
 *  place it is normalised, so the acyclicity rule and blockedness read one
 *  graph rather than two that could disagree. Ids as the records write them,
 *  because the validator names the record it found the edge on.
 *
 *  A mirror carries no edges — it is a placement, not a node — so it is never
 *  a source here, though another record's `blocks` may name one as a target. */
const orderings = (
  nodes: ReadonlyArray<Located>,
): ReadonlyMap<string, ReadonlyArray<string>> => {
  const after = new Map<string, Array<string>>()
  const edge = (from: string, to: string): void => {
    const existing = after.get(from)
    if (existing === undefined) after.set(from, [to])
    else existing.push(to)
  }

  for (const { node } of nodes) {
    if (isMirror(node)) continue
    for (const target of node.after ?? []) edge(node.id, target)
    for (const target of node.blocks ?? []) edge(target, node.id)
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
  /** The node an end of an arrow actually names, WHILE it is still in play:
   *  it exists, it is a task that is not done, and it has not been put away.
   *  A mirror is followed to the node it shows, because an edge that names a
   *  placement means the node standing there. */
  const inPlay = (id: string): InTheWay | undefined => {
    const named = byId.get(id)
    if (named === undefined) return undefined
    const found = follow({ byId }, named)
    if (found.kind !== "found" || isArchived(found.shows.file)) return undefined
    const mark = status.get(found.shows.node.id)
    return mark === undefined || mark === "done"
      ? undefined
      : { at: found.shows, status: mark }
  }

  const blocked = new Map<string, ReadonlyArray<InTheWay>>()
  for (const [id, targets] of after) {
    const source = inPlay(id)
    if (source === undefined) continue

    const waiting = targets.flatMap((target) => {
      const blocker = inPlay(target)
      return blocker === undefined ? [] : [blocker]
    })
    if (waiting.length === 0) continue

    // Keyed by the node, not by the id the edge was written with: two records
    // can name one node — `x after b` and `a blocks m`, where `m` is a mirror
    // of `x` — and that is one node waiting on both of them.
    const key = source.at.node.id
    blocked.set(key, [...(blocked.get(key) ?? []), ...waiting])
  }
  return blocked
}

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
  const place = {
    at,
    status: derived.status.get(at.node.id),
    blocked: found.kind === "found" ? blockersOf(derived, found.shows.node.id) : [],
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
 * A done node takes its whole subtree with it, INCLUDING the plain bullets
 * under it. Every task below a done node is done — that is what made the node
 * done — and a bullet that is not a task is a note on finished work rather
 * than something outstanding; a row kept under a hidden parent would have
 * nowhere to hang anyway.
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
  /** Absent when the node carries no mark and derives none. */
  readonly status: Status | undefined
  /** What it is waiting on, and empty when nothing is. */
  readonly blocked: ReadonlyArray<InTheWay>
  /** The canonical parent chain, root first, `shows` excluded. */
  readonly trail: ReadonlyArray<LocatedRegular>
}

export const situate = (derived: Derived, shows: LocatedRegular): Situated => ({
  shows,
  status: derived.status.get(shows.node.id),
  blocked: blockersOf(derived, shows.node.id),
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

/** Takes the ID INDEX rather than the whole of {@link Derived}: it is all the
 *  walk reads, and saying so is what lets the blockedness derivation above
 *  follow a mirror while the indexes it belongs to are still being built. */
export const follow = (derived: Pick<Derived, "byId">, from: Located): Found => {
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
