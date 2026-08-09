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

import { isMirror, type Located, type LocatedRegular } from "./node.ts"

/** What a node's checkbox shows. Derived for a parent, stored for a leaf. */
export type Status = "done" | "doing" | "open"

/**
 * A set of nodes and everything computed from it.
 *
 * The nodes travel WITH their indexes rather than beside them. Two parameters
 * would let a caller pass one revision's nodes against another's indexes —
 * which phase 3, with two revisions in flight, makes a live possibility — and
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
  /** id → derived status. Total over `nodes`. */
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

  return { nodes, byId, children, status: statuses(nodes, byId, children) }
}

const byOrd = (a: Located, b: Located): number =>
  a.node.ord === b.node.ord ? a.line - b.line : a.node.ord < b.node.ord ? -1 : 1

/** The children that count toward a node's derived status. A mirror is a
 *  second view of a node, not a second obligation, so it never counts. One
 *  function, called by the status walk and by the validator's refusal message,
 *  because a set that disagreed about which children count would show one
 *  answer and explain the other. */
const counted = (
  children: ReadonlyMap<string, ReadonlyArray<Located>>,
  id: string,
): ReadonlyArray<Located> =>
  (children.get(id) ?? []).filter((child) => !isMirror(child.node))

export const countedChildren = (
  derived: Derived,
  id: string,
): ReadonlyArray<Located> => counted(derived.children, id)

/**
 * A leaf says what it is. A parent is the sum of its children: all done →
 * done; anything under way, or some-but-not-all finished → doing; otherwise
 * open. A mirror reports its target's status, because that is what it shows.
 */
const statuses = (
  nodes: ReadonlyArray<Located>,
  byId: ReadonlyMap<string, Located>,
  children: ReadonlyMap<string, ReadonlyArray<Located>>,
): ReadonlyMap<string, Status> => {
  const status = new Map<string, Status>()
  const walking = new Set<string>()

  const of = (located: Located): Status => {
    const id = located.node.id
    const known = status.get(id)
    if (known !== undefined) return known
    // A loop the validator will report; treat the re-entry as unfinished
    // rather than recursing into it.
    if (walking.has(id)) return "open"
    walking.add(id)

    const computed = compute(located)
    walking.delete(id)
    status.set(id, computed)
    return computed
  }

  const compute = (located: Located): Status => {
    if (isMirror(located.node)) {
      const target = byId.get(located.node.mirror)
      return target === undefined ? "open" : of(target)
    }

    const own = counted(children, located.node.id)
    if (own.length === 0) return storedStatus(located.node)

    const seen = own.map(of)
    if (seen.every((child) => child === "done")) return "done"
    return seen.some((child) => child !== "open") ? "doing" : "open"
  }

  for (const located of nodes) of(located)
  return status
}

/** What a leaf claims about itself. `done` wins over `doing` — they are
 *  mutually exclusive on disk, so the order only decides what a set the
 *  validator has already condemned looks like. */
export const storedMarker = (
  node: LocatedRegular["node"],
): "done" | "doing" | null =>
  node.done !== undefined ? "done" : node.doing !== undefined ? "doing" : null

const storedStatus = (node: LocatedRegular["node"]): Status =>
  storedMarker(node) ?? "open"

// ── the drawable tree ──────────────────────────────────────────────────

/** Fields every row has, whatever it turned out to be. */
interface Place {
  /** The record occupying this place — the mirror itself, for a mirror. */
  readonly at: Located
  readonly status: Status
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
  derived.nodes
    .filter((located) => located.file === file && located.node.parent === undefined)
    .sort(byOrd)
    .map((root) => expand(derived, root, [], ""))

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
  const status = derived.status.get(at.node.id) ?? "open"
  const place = { at, status, key }

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
 * A done node takes its whole subtree with it. That is not a shortcut: a node
 * with counted children IS done exactly when all of them are, so every row
 * underneath one would be hidden on its own account anyway — and a row kept
 * under a hidden parent would have nowhere to hang.
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

export const follow = (derived: Derived, from: Located): Found => {
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
