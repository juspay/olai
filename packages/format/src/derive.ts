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

import { isMirror, type Located } from "./node.ts"

/** What a node's checkbox shows. Derived for a parent, stored for a leaf. */
export type Status = "done" | "doing" | "open"

/** The three indexes every consumer needs, built together from one list so
 *  they cannot be built from different ones — or, as they once were, with
 *  different tie-breaking. */
export interface Derived {
  /** id → the record that claims it. FIRST claim wins, which is the same rule
   *  the validator's duplicate-id error uses: the second claim is the mistake,
   *  so the first is what every other reference means. */
  readonly byId: ReadonlyMap<string, Located>
  /** parent id → its children, in sibling order. */
  readonly children: ReadonlyMap<string, ReadonlyArray<Located>>
  /** id → derived status. */
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

  return { byId, children, status: statuses(nodes, byId, children) }
}

const byOrd = (a: Located, b: Located): number =>
  a.node.ord === b.node.ord ? a.line - b.line : a.node.ord < b.node.ord ? -1 : 1

/** The children that count toward a node's derived status — the same set the
 *  validator lists when it refuses a stored one. A mirror is a second view of
 *  a node, not a second obligation, so it never counts. */
export const countedChildren = (
  derived: Derived,
  id: string,
): ReadonlyArray<Located> =>
  (derived.children.get(id) ?? []).filter((child) => !isMirror(child.node))

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

    const own = (children.get(located.node.id) ?? []).filter(
      (child) => !isMirror(child.node),
    )
    if (own.length === 0) {
      return located.node.done !== undefined
        ? "done"
        : located.node.doing !== undefined
        ? "doing"
        : "open"
    }

    const seen = own.map(of)
    if (seen.every((child) => child === "done")) return "done"
    return seen.some((child) => child !== "open") ? "doing" : "open"
  }

  for (const located of nodes) of(located)
  return status
}

// ── the drawable tree ──────────────────────────────────────────────────

/**
 * One place in the tree.
 *
 * `kind` is the whole of what a renderer needs to decide: a plain record, a
 * mirror standing in for a subtree, a mirror the walk refuses to re-enter, or
 * a mirror whose target is not in the set. The four used to be four booleans
 * reconstructed at the view; naming them here is what keeps the cycle guard in
 * one place instead of one per consumer.
 */
export type Row = {
  /** The record occupying this place — the mirror itself, for a mirror. */
  readonly at: Located
  /** The record being shown here: `at` for a node, the target for a mirror. */
  readonly shows: Located | undefined
  readonly kind: "node" | "mirror" | "cycle" | "dangling"
  readonly status: Status
  /** Stable identity of this PLACE, not of the node. The same node reached
   *  through two mirrors is two rows on screen, and folding one must not fold
   *  the other. */
  readonly key: string
  readonly children: ReadonlyArray<Row>
}

/**
 * What a record actually shows: itself, or — following as many mirror hops as
 * it takes — the regular node at the end of the chain.
 *
 * A mirror of a mirror is legal (nothing in the format forbids a second
 * pointer to a pointer) and resolving only one hop would leave a row standing
 * for a record with no title and no children of its own: a legal set the
 * reader cannot draw. `undefined` means the chain ends nowhere, which is a
 * dangling reference the validator reports separately; a chain that closes on
 * itself is a mirror-cycle, which it also reports — the visited set here is
 * so this walk stops rather than being the thing that discovers it.
 */
const target = (derived: Derived, from: Located): Located | undefined => {
  const seen = new Set<string>()
  let at: Located | undefined = from
  while (at !== undefined && isMirror(at.node)) {
    if (seen.has(at.node.id)) return undefined
    seen.add(at.node.id)
    at = derived.byId.get(at.node.mirror)
  }
  return at
}

/** The rows of one outline: the roots of `file`, expanded. Mirrors are
 *  expanded in place, because a pointer the reader has to go and follow is not
 *  a second location — it is a footnote. */
export const rowsOf = (
  derived: Derived,
  nodes: ReadonlyArray<Located>,
  file: string,
): ReadonlyArray<Row> => {
  const expand = (
    at: Located,
    ancestors: ReadonlyArray<string>,
    parentKey: string,
  ): Row => {
    const key = `${parentKey}/${at.node.id}`
    const status = derived.status.get(at.node.id) ?? "open"

    const shows = target(derived, at)
    if (shows === undefined) {
      return { at, shows, kind: "dangling", status, key, children: [] }
    }
    if (ancestors.includes(shows.node.id)) {
      return { at, shows, kind: "cycle", status, key, children: [] }
    }

    const within = [...ancestors, shows.node.id]
    return {
      at,
      shows,
      kind: isMirror(at.node) ? "mirror" : "node",
      status,
      key,
      children: (derived.children.get(shows.node.id) ?? []).map((child) =>
        expand(child, within, key)
      ),
    }
  }

  return nodes
    .filter((located) => located.file === file && located.node.parent === undefined)
    .sort(byOrd)
    .map((root) => expand(root, [], ""))
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
