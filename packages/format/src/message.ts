import type { Claims } from "./kinds.ts"
import { biggestOf, type NodeChange, type Sort } from "./changes.ts"
import type { Other } from "./committing.ts"
import { stemOf } from "./kinds.ts"

export const MESSAGE_PREFIX = "olai"

const VERB: Readonly<Record<Sort, string>> = {
  created: "capture",
  trashed: "trash",
  gone: "gone",
  done: "done",
  undone: "undone",
  cancelled: "cancelled",
  uncancelled: "uncancelled",
  doing: "doing",
  "not-doing": "not-doing",
  moved: "move",
  scheduled: "date",
  unscheduled: "date",
  noted: "note",
  renamed: "rename",
  linked: "see",
  edited: "edit",
}

const BODY_LINES = 20

export const composed = (
  claims: Claims,
  changes: ReadonlyArray<NodeChange>,
  others: ReadonlyArray<Other> = [],
): string => {
  const biggest = biggestOf(changes)
  if (biggest === null && others.length === 0) return `${MESSAGE_PREFIX}: nothing`

  const lines = changes
    .slice(0, BODY_LINES)
    .map((change) => `${VERB[change.sort]}: ${change.title}`)
  const rest = changes.length - lines.length
  if (rest > 0) lines.push(`… and ${rest} more`)

  if (others.length > 0) {
    if (lines.length > 0) lines.push("")
    for (const other of others.slice(0, BODY_LINES)) {
      lines.push(
        other.from === null
          ? `${other.how}: ${other.path}`
          : `${other.how}: ${other.from} → ${other.path}`,
      )
    }
    const left = others.length - Math.min(others.length, BODY_LINES)
    if (left > 0) lines.push(`… and ${left} more`)
  }

  return `${subjectOf(claims, changes, others, biggest)}\n\n${lines.join("\n")}\n`
}

const subjectOf = (
  claims: Claims,
  changes: ReadonlyArray<NodeChange>,
  others: ReadonlyArray<Other>,
  biggest: NodeChange | null,
): string => {
  const files = `${others.length} ${others.length === 1 ? "file" : "files"}`
  if (biggest === null) {
    const first = others[0]?.path ?? ""
    const more = others.length > 1 ? ` and ${others.length - 1} more` : ""
    return `${MESSAGE_PREFIX}: ${files} — ${first}${more}`
  }
  const outlines = new Set(changes.map((change) => change.file))
  const count = `${changes.length} ${changes.length === 1 ? "edit" : "edits"}`
  const where = outlines.size === 1 ? ` to ${stemOf(claims, biggest.file)}` : ""
  const also = others.length === 0 ? "" : ` · ${others.length} other ${
    others.length === 1 ? "file" : "files"
  }`
  return `${MESSAGE_PREFIX}: ${count}${where} — ${biggest.title} ${biggest.sort}${also}`
}
