/**
 * Everything the format computes rather than stores.
 *
 * A parent's status, a title's `#tags`, the order of siblings, the subtree a
 * mirror stands for: none of it is on disk, all of it is derived here, and it
 * is derived in one place so the validator that refuses to let it be stored
 * and the view that renders it can never disagree about what it would have
 * been.
 *
 * Every walk is cycle-safe. The validator rejects a set whose parents or
 * mirrors close a loop, so these functions should never meet one — but they
 * also run against sets the validator has already condemned (its own error
 * messages quote derived status), and a renderer that hangs is a worse failure
 * than one that shows a marked stub.
 */

import type { Located } from "./node.ts"

/** What a node's checkbox shows. Derived for a parent, stored for a leaf. */
export type Status = "done" | "doing" | "open"

/** Parent id → its children, in sibling order. `ord` is a fractional index
 *  over base62, so plain string comparison IS the sort; file order breaks ties
 *  rather than leaving them to the engine's stability guarantees. */
export const childIndex = (
  all: ReadonlyArray<Located>,
): ReadonlyMap<string, ReadonlyArray<Located>> => {
  const children = new Map<string, Array<Located>>()
  for (const located of all) {
    const parent = located.node.parent
    if (parent === undefined) continue
    const siblings = children.get(parent)
    if (siblings === undefined) children.set(parent, [located])
    else siblings.push(located)
  }
  for (const siblings of children.values()) siblings.sort(byOrd)
  return children
}

/** The top of one outline, in sibling order. */
export const rootsOf = (nodes: ReadonlyArray<Located>): ReadonlyArray<Located> =>
  nodes.filter((located) => located.node.parent === undefined).sort(byOrd)

const byOrd = (a: Located, b: Located): number =>
  a.node.ord === b.node.ord ? a.line - b.line : a.node.ord < b.node.ord ? -1 : 1

/** A mirror is a second view of its target, so it counts as a placement, not
 *  as an obligation: it never contributes to the status of the parent it sits
 *  under. */
const isCounted = (located: Located): boolean => located.node.mirror === undefined

/** id → status, for every node in the set.
 *
 *  A leaf says what it is. A parent is the sum of its children: all done →
 *  done; anything under way, or some-but-not-all finished → doing; otherwise
 *  open. A mirror reports its target's status, because that is what it shows. */
export const statusIndex = (
  all: ReadonlyArray<Located>,
  children: ReadonlyMap<string, ReadonlyArray<Located>>,
): ReadonlyMap<string, Status> => {
  const byId = new Map(all.map((located) => [located.node.id, located]))
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
    if (located.node.mirror !== undefined) {
      const target = byId.get(located.node.mirror)
      return target === undefined ? "open" : of(target)
    }

    const own = (children.get(located.node.id) ?? []).filter(isCounted)
    if (own.length === 0) return stored(located)

    const statuses = own.map(of)
    if (statuses.every((child) => child === "done")) return "done"
    return statuses.some((child) => child !== "open") ? "doing" : "open"
  }

  for (const located of all) of(located)
  return status
}

/** What a leaf claims about itself. */
const stored = ({ node }: Located): Status =>
  node.done !== undefined ? "done" : node.doing !== undefined ? "doing" : "open"

/** The children that count toward a node's derived status — the same set the
 *  validator lists when it refuses a stored one. */
export const countedChildren = (
  children: ReadonlyMap<string, ReadonlyArray<Located>>,
  id: string,
): ReadonlyArray<Located> => (children.get(id) ?? []).filter(isCounted)

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

/** Every tag in a title, in order, without duplicates. */
export const tagsOf = (title: string): ReadonlyArray<string> => [
  ...new Set(
    titleParts(title).flatMap((part) => (part.kind === "tag" ? [part.tag] : [])),
  ),
]
