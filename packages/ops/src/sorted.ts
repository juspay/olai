import {
  biggestOf,
  changesOf,
  type Derived,
  documentAt,
  markdownAt,
  type Node,
  nodesOf,
  type OutlineSet,
  outlineNames,
  type Sort,
} from "@olai/format"

import type { Plan } from "./plan.ts"

export const sortOfWrite = (
  before: OutlineSet,
  derived: Derived,
  plan: Plan,
): Sort | undefined => {
  const { files, documents = [], removed = [], id: about } = plan
  const gone = removed[0]
  if (gone !== undefined) {
    return documentAt(before, gone) !== undefined ? "gone" : undefined
  }
  const doc = documents[0]
  if (doc !== undefined) {
    const prior = markdownAt(before, doc.file)
    if (prior === undefined) return "created"
    return prior.body === doc.text ? undefined : "edited"
  }
  const was = new Map<string, ReadonlyArray<Node>>(
    files.map((planned) => [
      planned.file,
      nodesOf(derived, planned.file).map((located) => located.node),
    ]),
  )
  const now = new Map(files.map((planned) => [planned.file, planned.nodes]))
  const changes = changesOf(derived.claims, was, now)
  const change = changes.find((entry) => entry.id === about) ?? biggestOf(changes)
  if (change !== null && change !== undefined) return change.sort
  const known = outlineNames(before)
  return files.some((planned) => !known.has(planned.file)) ? "created" : undefined
}
