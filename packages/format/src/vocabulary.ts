import { Schema } from "effect"

import {
  type Derived,
  TAG_SIGILS,
  type TagSigil,
  tagPart,
} from "./derive.ts"
import { isPutAway, type LocatedRegular } from "./node.ts"

export const TagsRequest = Schema.Struct({
  sigil: Schema.Literals(TAG_SIGILS),
  query: Schema.String,
  limit: Schema.Number,
})
export type TagsRequest = typeof TagsRequest.Type

export const TagCompletion = Schema.Struct({
  name: Schema.String,
  count: Schema.Number,
})
export type TagCompletion = typeof TagCompletion.Type

export const TagsAnswer = Schema.Struct({
  tags: Schema.Array(TagCompletion),
})
export type TagsAnswer = typeof TagsAnswer.Type

export interface TagUse {
  readonly sigil: TagSigil
  readonly name: string
  readonly folded: string
  readonly count: number
}

const counted = new WeakMap<Derived, ReadonlyArray<TagUse>>()

export const vocabularyOf = (derived: Derived): ReadonlyArray<TagUse> => {
  const seen = counted.get(derived)
  if (seen !== undefined) return seen
  const tags = counting(derived)
  counted.set(derived, tags)
  return tags
}

const counting = (derived: Derived): ReadonlyArray<TagUse> => {
  const away = putAway(derived)
  const tags: Array<TagUse> = []
  for (const [written, records] of derived.taggedBy) {
    const live = away.size === 0 ? records.length : alive(records, away)
    if (live === 0) continue
    const { sigil, tag } = tagPart(written)
    tags.push({ sigil, name: tag, folded: tag.toLowerCase(), count: live })
  }
  return tags.sort((one, other) =>
    other.count - one.count || one.name.localeCompare(other.name)
  )
}

const putAway = (derived: Derived): ReadonlySet<string> => {
  const away = new Set<string>()
  for (const file of derived.byFile.keys()) {
    if (isPutAway(derived.claims, file)) away.add(file)
  }
  return away
}

const alive = (
  records: ReadonlyArray<LocatedRegular>,
  away: ReadonlySet<string>,
): number => {
  let live = 0
  for (const at of records) if (!away.has(at.file)) live++
  return live
}

export const completingTags = (
  derived: Derived,
  request: TagsRequest,
): ReadonlyArray<TagCompletion> => offering(vocabularyOf(derived), request)

const offering = (
  vocabulary: ReadonlyArray<TagUse>,
  request: TagsRequest,
): ReadonlyArray<TagCompletion> => {
  const wanted = request.query.toLowerCase()
  const starts: Array<TagCompletion> = []
  const buried: Array<TagCompletion> = []
  for (const tag of vocabulary) {
    if (tag.sigil !== request.sigil) continue
    const into = tag.folded.startsWith(wanted)
      ? starts
      : tag.folded.includes(wanted)
      ? buried
      : null
    if (into === null || into.length >= request.limit) continue
    into.push({ name: tag.name, count: tag.count })
    if (starts.length >= request.limit) break
  }
  return [...starts, ...buried].slice(0, request.limit)
}
