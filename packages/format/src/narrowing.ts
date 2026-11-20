import type { Claims } from "./kinds.ts"
import { Schema } from "effect"

import type { Derived, Row } from "./derive.ts"
import { type Filter, parseFilter, selecting, shownRecord } from "./filter.ts"
import { declarationsOf, type KindVocabulary } from "./typing.ts"
import { isTrashed, type LocatedRegular } from "./node.ts"
import { narrowableIn, PageRequest, type Shown, shownOf } from "./page.ts"
import { MatchedNode } from "./searching.ts"
import type { Reading } from "./validate.ts"

export const NarrowingRequest = Schema.Struct({
  page: PageRequest,
  text: Schema.String,
})
export type NarrowingRequest = typeof NarrowingRequest.Type

export const NarrowingAnswer = Schema.Struct({
  text: Schema.String,
  matches: Schema.Array(MatchedNode),
})
export type NarrowingAnswer = typeof NarrowingAnswer.Type

export const sameNarrowing: (a: NarrowingAnswer, b: NarrowingAnswer) => boolean =
  Schema.toEquivalence(NarrowingAnswer)

export const sameNarrowingRequest: (a: NarrowingRequest, b: NarrowingRequest) => boolean =
  Schema.toEquivalence(NarrowingRequest)

export const narrowingOf = (
  at: Reading,
  request: NarrowingRequest,
  now: string,
  kinds: KindVocabulary,
): NarrowingAnswer => ({
  text: request.text,
  matches: narrowedIn(
    at.derived,
    shownOf(at, request.page),
    parseFilter(request.text, now, declarationsOf(at.derived, kinds)),
  ),
})

export const narrowedIn = (
  derived: Derived,
  shows: Shown,
  filter: Filter,
): ReadonlyArray<MatchedNode> => {
  if (filter.kind !== "asking") return []
  const putAway = showsPutAway(derived.claims, shows) || filter.speaksOfTrash
  const out: Array<MatchedNode> = []
  for (const { at, match } of selecting(derived, filter, prunable(shows), putAway)) {
    out.push({
      id: at.node.id as MatchedNode["id"],
      ...(match.field === null ? {} : { matched: match.field }),
    })
  }
  return out
}

export const showsPutAway = (claims: Claims, shows: Shown): boolean => {
  switch (shows.kind) {
    case "trash":
      return true
    case "outline":
      return anyPutAway(claims, shows.rows)
    case "node":
      return shows.zoomed.kind === "node" && anyPutAway(claims, shows.zoomed.children)
    case "document":
    case "day":
    case "agenda":
    case "broken":
    case "nothing":
      return false
  }
}

const anyPutAway = (claims: Claims, rows: ReadonlyArray<Row>): boolean =>
  rows.some((row) => isTrashed(claims, shownRecord(row).file))

function* prunable(shows: Shown): Generator<LocatedRegular> {
  const seen = new Set<string>()
  for (const at of narrowableIn(shows)) {
    if (seen.has(at.node.id)) continue
    seen.add(at.node.id)
    yield at
  }
}
