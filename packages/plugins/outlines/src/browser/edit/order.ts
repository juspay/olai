import { shownRecord } from "@olai/format"
import type { Row } from "@olai/format"
import type { Anchor } from "@olai/surface"

import { foldIdOf, foldOf } from "../fold/rows.ts"
import type { Fold } from "../fold/rows.ts"
import type { Pending } from "./draft.ts"

export const flatten = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
): ReadonlyArray<Row> => {
  const drawn: Array<Row> = []
  const walk = (level: ReadonlyArray<Row>): void => {
    for (const row of level) {
      drawn.push(row)
      if (!collapsed.has(foldIdOf(row))) walk(row.children)
    }
  }
  walk(rows)
  return drawn
}

export const refound = (
  drawn: ReadonlyArray<Row>,
  record: string,
  at: string | null,
): string | undefined => {
  if (at !== null && drawn.some((row) => row.key === at)) return at
  return drawn.find((row) => row.at.node.id === record)?.key
}

export const neighbour = (
  drawn: ReadonlyArray<Row>,
  place: string,
  step: 1 | -1,
): Row | undefined => {
  const at = drawn.findIndex((row) => row.key === place)
  return at === -1 ? undefined : drawn[at + step]
}

export type Wire =
  | { readonly kind: "row"; readonly row: Row; readonly depth: number }
  | { readonly kind: "draft"; readonly pending: Pending; readonly depth: number }

export const wired = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
  drafts: ReadonlyArray<Pending>,
): ReadonlyArray<Wire> => {
  const keyed = new Map<string, Pending[]>()
  const slot = (under: string, draft: Pending) => {
    const at = keyed.get(under) ?? []
    at.push(draft)
    keyed.set(under, at)
  }
  for (const draft of drafts) {
    const at = draft.at
    slot(
      at.kind === "first" ? "first"
        : at.kind === "before" ? `b:${at.id}`
        : at.kind === "after" ? `a:${at.id}`
        : `u:${at.id}`,
      draft,
    )
  }
  const out: Array<Wire> = []
  const lay = (level: ReadonlyArray<Row>, depth: number): void => {
    for (const row of level) {
      const id = row.at.node.id
      for (const draft of keyed.get(`b:${id}`) ?? []) {
        out.push({ kind: "draft", pending: draft, depth })
      }
      out.push({ kind: "row", row, depth })
      for (const draft of keyed.get(`u:${id}`) ?? []) {
        out.push({ kind: "draft", pending: draft, depth: depth + 1 })
      }
      if (!collapsed.has(foldIdOf(row))) lay(row.children, depth + 1)
      for (const draft of keyed.get(`a:${id}`) ?? []) {
        out.push({ kind: "draft", pending: draft, depth })
      }
    }
  }
  for (const draft of keyed.get("first") ?? []) {
    out.push({ kind: "draft", pending: draft, depth: 0 })
  }
  lay(rows, 0)
  return out
}

export type Standing =
  | { readonly kind: "draft"; readonly slot: string }
  | { readonly kind: "row"; readonly place: string }

export const seated = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
  drafts: ReadonlyArray<Pending>,
  standing: Standing,
): { readonly walk: ReadonlyArray<Wire>; readonly at: number } => {
  const walk = wired(rows, collapsed, drafts)
  return {
    walk,
    at: walk.findIndex((step) =>
      step.kind === "draft"
        ? standing.kind === "draft" && step.pending.slot === standing.slot
        : standing.kind === "row" && step.row.key === standing.place
    ),
  }
}

export interface Reseating {
  readonly at: Anchor
  readonly open?: Fold
}

const flanking = (
  walk: ReadonlyArray<Wire>,
  at: number,
  depth: number,
): {
  readonly above: ReadonlyArray<Row>
  readonly below: ReadonlyArray<Row>
  readonly parent: Row | undefined
} => {
  const above: Array<Row> = []
  let parent: Row | undefined
  for (let i = at - 1; i >= 0; i--) {
    const step = walk[i]
    if (step === undefined || step.kind !== "row" || step.depth > depth) continue
    if (step.depth < depth) {
      parent = step.row
      break
    }
    above.push(step.row)
  }
  const below: Array<Row> = []
  for (let i = at + 1; i < walk.length; i++) {
    const step = walk[i]
    if (step === undefined || step.kind !== "row" || step.depth > depth) continue
    if (step.depth < depth) break
    below.push(step.row)
  }
  return { above, below, parent }
}

const asLastChild = (row: Row, collapsed: ReadonlySet<string>): Reseating => {
  const last = row.children[row.children.length - 1]
  return {
    at: last === undefined
      ? { kind: "under", id: shownRecord(row).node.id }
      : { kind: "after", id: last.at.node.id },
    ...(collapsed.has(foldIdOf(row)) ? { open: foldOf(row) } : {}),
  }
}

export const reanchored = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
  sketch: Pending,
  way: "in" | "out" | "up" | "down",
  others: ReadonlyArray<Pending> = [],
): Reseating | undefined => {
  const { walk, at } = seated(rows, collapsed, [...others, sketch], {
    kind: "draft",
    slot: sketch.slot,
  })
  const seat = walk[at]
  if (seat === undefined) return undefined
  const { above, below, parent } = flanking(walk, at, seat.depth)
  const after = (row: Row | undefined): Reseating | undefined =>
    row === undefined ? undefined : { at: { kind: "after", id: row.at.node.id } }
  const [nearest, over] = above

  switch (way) {
    case "in":
      return nearest === undefined ? undefined : asLastChild(nearest, collapsed)
    case "out":
      return after(parent)
    case "up":
      return nearest === undefined ? undefined : over === undefined
        ? { at: { kind: "before", id: nearest.at.node.id } }
        : after(over)
    case "down":
      return after(below[0])
  }
}
