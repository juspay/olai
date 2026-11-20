import { createMatchedRows } from "../pruning.ts"

import type { Filter, Refusal } from "@olai/format"
import { needlesOf } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

import type { Drawn } from "../page.ts"
import type { Matches } from "./matches.ts"
import { type Counts, NOTHING_COUNTED } from "./count.ts"
import { matchesIn, narrowed, placesIn } from "./drawn.ts"

export const NOTHING_MATCHED: Matches = new Map()

export interface Narrowing {
  readonly text: Accessor<string>
  readonly active: Accessor<boolean>
  readonly refusals: Accessor<ReadonlyArray<Refusal>>
  readonly selected: Accessor<Matches | null>
  readonly needles: Accessor<ReadonlyArray<string>>
  readonly drawn: Accessor<Drawn>
  readonly answering: Accessor<string | null>
  readonly counts: Accessor<Counts>
}

export const createNarrowing = (source: {
  readonly query: Accessor<Filter>
  readonly text: Accessor<string>
  readonly all: Accessor<Drawn>
  readonly afterDone: Accessor<Drawn>
  readonly matched: Accessor<Matches | undefined>
  readonly answering: Accessor<string | null>
}): Narrowing => {
  const active = createMemo(() => source.query().kind !== "nothing")
  const asking = createMemo(() => source.query().kind === "asking")

  const selected = createMemo<Matches | null>(() => {
    if (!active()) return null
    if (!asking()) return NOTHING_MATCHED
    return source.matched() ?? null
  })

  const treeRows = createMemo(() => { const shown = source.afterDone(); return shown.kind === "tree" ? shown.rows : [] })
  const matches = createMatchedRows(treeRows, selected)
  const drawn = createMemo(() => {
    const found = selected()
    const shown = source.afterDone()
    return shown.kind === "tree" ? { ...shown, rows: matches() } : found === null ? shown : narrowed(shown, found)
  })

  const held = createMemo(() => (active() ? placesIn(source.all()) : 0))

  return {
    text: source.text,
    active,
    selected,
    needles: createMemo(() => needlesOf(source.query())),
    refusals: createMemo(() => {
      const asked = source.query()
      return asked.kind === "refused" ? asked.refusals : []
    }),
    drawn,
    answering: createMemo(() => {
      const typed = source.text().trim()
      if (!asking()) return typed
      return source.answering() === typed ? typed : null
    }),
    counts: createMemo(() => {
      if (!active()) return NOTHING_COUNTED
      const found = selected() ?? NOTHING_MATCHED
      const shown = matchesIn(drawn(), found)
      return {
        shown,
        held: held(),
        hiddenAsDone: source.all() === source.afterDone()
          ? 0
          : matchesIn(source.all(), found) - shown,
      }
    }, NOTHING_COUNTED, {
      equals: (was, is) =>
        was.shown === is.shown && was.held === is.held &&
        was.hiddenAsDone === is.hiddenAsDone,
    }),
  }
}
