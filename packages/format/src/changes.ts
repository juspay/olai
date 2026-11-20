import type { Claims } from "./kinds.ts"
import { Schema } from "effect"

import type { Custom } from "./custom.ts"
import { isTrashed, isMirror, MirrorNode, type Node, RegularNode } from "./node.ts"

const STAMPS: ReadonlySet<string> = new Set(["created", "changed"])

const RECORD_FIELDS: ReadonlyArray<string> = [
  ...Object.keys(RegularNode.fields),
  ...Object.keys(MirrorNode.fields),
].filter((field, at, all) =>
  field !== "id" && !STAMPS.has(field) && all.indexOf(field) === at
)

export const Field = Schema.String
export type Field = typeof Field.Type

export const Sort = Schema.Literals([
  "created",
  "trashed",
  "gone",
  "done",
  "undone",
  "cancelled",
  "uncancelled",
  "doing",
  "not-doing",
  "moved",
  "scheduled",
  "unscheduled",
  "noted",
  "renamed",
  "linked",
  "edited",
])
export type Sort = typeof Sort.Type



export const NodeChange = Schema.Struct({
  file: Schema.String,
  id: Schema.String,
  title: Schema.String,
  fields: Schema.Array(Field),
  sort: Sort,
})
export type NodeChange = typeof NodeChange.Type

export type Records = ReadonlyMap<string, ReadonlyArray<Node>>

interface Placed {
  readonly file: string
  readonly node: Node
}

export const changesOf = (
  claims: Claims,
  before: Records,
  after: Records,
): ReadonlyArray<NodeChange> => {
  const was = placed(before)
  const now = placed(after)

  const changes: Array<NodeChange> = []

  for (const [file, nodes] of after) {
    for (const node of nodes) {
      const previous = was.get(node.id)
      if (previous === undefined) {
        changes.push({
          file,
          id: node.id,
          title: nameOf(node),
          fields: [],
          sort: "created",
        })
        continue
      }
      const fields = differing(previous, { file, node })
      if (fields.length === 0) continue
      changes.push({
        file,
        id: node.id,
        title: nameOf(node),
        fields,
        sort: sortOf(claims, fields, { file, node }),
      })
    }
  }

  for (const [file, nodes] of before) {
    for (const node of nodes) {
      if (now.has(node.id)) continue
      changes.push({
        file,
        id: node.id,
        title: nameOf(node),
        fields: [],
        sort: "gone",
      })
    }
  }

  return changes
}

export const biggestOf = (
  changes: ReadonlyArray<NodeChange>,
): NodeChange | null => {
  let best: NodeChange | null = null
  for (const change of changes) {
    if (best === null || rank(change.sort) < rank(best.sort)) best = change
  }
  return best
}

const rank = (sort: Sort): number => Sort.literals.indexOf(sort)

const placed = (records: Records): ReadonlyMap<string, Placed> => {
  const by = new Map<string, Placed>()
  for (const [file, nodes] of records) {
    for (const node of nodes) by.set(node.id, { file, node })
  }
  return by
}

const nameOf = (node: Node): string => (isMirror(node) ? node.id : node.title)

const differing = (before: Placed, after: Placed): ReadonlyArray<Field> => {
  const fields: Array<Field> = []
  if (before.file !== after.file) fields.push("file")
  for (const field of RECORD_FIELDS) {
    if (!same(valueOf(before.node, field), valueOf(after.node, field))) {
      fields.push(field)
    }
  }
  return fields
}

type Value = string | boolean | ReadonlyArray<string> | Custom | undefined

const valueOf = (node: Node, field: (typeof RECORD_FIELDS)[number]): Value =>
  (node as Readonly<Record<string, Value>>)[field]

const same = (a: Value, b: Value): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, at) => entry === b[at])
  }
  if (isMap(a) && isMap(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length &&
      keys.every((key) => same(a[key], b[key]))
  }
  return a === b
}

const isMap = (value: Value): value is Custom =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const set = (node: Node, field: "done" | "cancelled" | "doing" | "date"): boolean =>
  valueOf(node, field) !== undefined

const sortOf = (claims: Claims, fields: ReadonlyArray<Field>, after: Placed): Sort => {
  const changed = new Set(fields)
  if (changed.has("file")) {
    return isTrashed(claims, after.file) ? "trashed" : "moved"
  }
  if (changed.has("done")) return set(after.node, "done") ? "done" : "undone"
  if (changed.has("cancelled")) {
    return set(after.node, "cancelled") ? "cancelled" : "uncancelled"
  }
  if (changed.has("doing")) return set(after.node, "doing") ? "doing" : "not-doing"
  if (changed.has("parent") || changed.has("ord")) return "moved"
  if (changed.has("date")) return set(after.node, "date") ? "scheduled" : "unscheduled"
  if (changed.has("desc")) return "noted"
  if (changed.has("title")) return "renamed"
  if (
    changed.has("see") || changed.has("after") || changed.has("blocks") ||
    changed.has("mirror")
  ) {
    return "linked"
  }
  return "edited"
}
