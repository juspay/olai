import { type Custom, customOf } from "@olai/format"
import type { DocumentHit, NodeHit } from "@olai/format"

import { customEntries } from "olai-plugin-outlines/property-values"

export interface NodeProp {
  readonly key: string
  readonly value: string
  readonly matched: boolean
}

export const nodeProps = (hit: NodeHit): ReadonlyArray<NodeProp> =>
  rowProps(customOf(hit), hit.matchedProps)

export const documentProps = (hit: DocumentHit): ReadonlyArray<NodeProp> =>
  rowProps(hit.props ?? {}, hit.matchedProps)

const rowProps = (
  custom: Custom,
  named: ReadonlyArray<string> | undefined,
): ReadonlyArray<NodeProp> => {
  const matched = named ?? []
  const entries = customEntries(custom).map((entry) => ({
    key: entry.key,
    value: entry.value,
    matched: matched.includes(entry.key),
  }))
  return [
    ...matched.flatMap((key) => {
      const entry = entries.find((one) => one.key === key)
      return entry === undefined ? [] : [entry]
    }),
    ...entries.filter((entry) => !entry.matched),
  ]
}
