import type { Anchor, Edit } from "@olai/surface"
import type { OpFailure } from "@olai/format"
export { IDLE_COMMIT } from "../../contracts/editing.ts"

export interface Replied {
  readonly refused?: OpFailure
  readonly nudge?: string
}

export interface Editing extends Replied {
  readonly kind: "row"
  readonly row: string
  readonly id: string
  readonly place: string | null
  readonly field: "title" | "desc"
  readonly text: string
  readonly saved: string
  readonly caret?: number
  readonly was?: Slot
}

export interface Pending extends Replied {
  readonly kind: "new"
  readonly at: Anchor
  readonly text: string
  readonly slot: string
}

export type Draft = Editing | Pending

export const emptyPending = (at: Anchor, slot: string): Pending => ({
  kind: "new",
  at,
  text: "",
  slot,
})

export const emptyPendingOf = (draft: Draft | null): Pending | null =>
  draft !== null && draft.kind === "new" && draft.text.trim() === "" ? draft : null

export const parked = (
  list: ReadonlyArray<Pending>,
  held: Draft | null,
): ReadonlyArray<Pending> => {
  const empty = emptyPendingOf(held)
  if (empty === null || list.some((g) => g.slot === empty.slot)) return list
  return [...list, empty]
}

export const commitOf = (draft: Draft): Edit | null => {
  if (draft.kind === "new") {
    return emptyPendingOf(draft) !== null
      ? null
      : { verb: "add", at: draft.at, title: draft.text }
  }
  if (draft.text === draft.saved) return null
  return draft.field === "title"
    ? { verb: "title", id: draft.id, title: draft.text }
    :
      { verb: "desc", id: draft.id, desc: draft.text === "" ? null : draft.text }
}

export const typed = (draft: Draft, text: string): Draft => ({
  ...draft,
  text,
  refused: undefined,
  nudge: undefined,
})

export const landed = (draft: Draft, id: string, nudge?: string): Editing =>
  draft.kind === "new"
    ? {
      kind: "row",
      row: id,
      id,
      place: null,
      field: "title",
      text: draft.text,
      saved: draft.text,
      was: slotOf(draft),
      nudge,
    }
    : { ...draft, saved: draft.text, refused: undefined, was: undefined, nudge }

export const refused = (draft: Draft, failure: OpFailure): Draft => ({
  ...draft,
  refused: failure,
})

export interface Ghost {
  readonly draft: Draft
  readonly slot: string
}

export const ghostOf = (draft: Draft | null): Ghost | null => {
  if (draft === null) return null
  if (draft.kind === "new") return { draft, slot: draft.slot }
  const was = draft.was
  if (draft.place !== null || was === undefined || was.row === null) return null
  return { draft, slot: was.row }
}

export const kept = (
  current: Draft | null,
  held: Draft,
  nudge?: string,
): Draft | null => {
  if (current !== held) return current
  return nudge === undefined || held.kind !== "row" ? held : { ...held, nudge }
}

export const after = (draft: Editing): Anchor => ({ kind: "after", id: draft.row })

export const before = (draft: Editing): Anchor => ({ kind: "before", id: draft.row })

export type Beside = { readonly kind: "after" | "before" | "under"; readonly id: string }

export const besideOf = (at: Anchor): Beside | null =>
  at.kind === "after" || at.kind === "before" || at.kind === "under"
    ? { kind: at.kind, id: at.id }
    : null

export const walked = (
  at: Anchor,
  placements: ReadonlyMap<string, Anchor>,
  present: ReadonlySet<string>,
): Anchor => {
  const seen = new Set<string>()
  while ("id" in at && !present.has(at.id) && !seen.has(at.id)) {
    seen.add(at.id)
    const previous = placements.get(at.id)
    if (previous === undefined) break
    at = previous
  }
  return at
}

export const seatKept = (
  id: string,
  placements: ReadonlyMap<string, Anchor>,
): Anchor | null => {
  let at = placements.get(id)
  const seen = new Set<string>()
  while (at !== undefined && "id" in at && !seen.has(at.id)) {
    seen.add(at.id)
    const next = placements.get(at.id)
    if (next === undefined) break
    at = next
  }
  return at ?? null
}

export const sameBeside = (a: Beside | null, b: Beside | null): boolean =>
  a === null || b === null ? a === b : a.kind === b.kind && a.id === b.id

export const seatOf = (
  blank: Pending,
  placements: ReadonlyMap<string, Anchor>,
  present: ReadonlySet<string>,
): Beside | null => besideOf(walked(blank.at, placements, present))

export interface Slot {
  readonly row: string | null
  readonly field: "title" | "desc" | "new"
}

export const slotOf = (draft: Draft): Slot =>
  draft.kind === "new"
    ? { row: draft.slot, field: "new" }
    : { row: draft.row, field: draft.field }

export const sameSlot = (a: Slot, b: Slot): boolean =>
  a.row === b.row && a.field === b.field

export const stillAt = (draft: Draft, from: Slot): boolean =>
  sameSlot(slotOf(draft), from) ||
  (draft.kind === "row" && draft.was !== undefined && sameSlot(draft.was, from))

export const sameAnchor = (a: Anchor, b: Anchor): boolean =>
  a.kind !== b.kind
    ? false
    : a.kind === "first"
    ? a.file === (b as typeof a).file
    : a.id === (b as typeof a).id

export const reaimed = (
  list: ReadonlyArray<Pending>,
  from: Anchor,
  id: string,
): ReadonlyArray<Pending> => {
  if (from.kind === "after") return list
  const next: Anchor = { kind: "before", id }
  return list.map((g) => (sameAnchor(g.at, from) ? { ...g, at: next } : g))
}
