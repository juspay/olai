import { sayingEnd } from "olai-plugin-chat/wire"
import type { Saying } from "@kolu/acp/wire"
import type { CollectionFold, CollectionFoldOptions } from "@kolu/surface/solid"
import { type Accessor, createMemo } from "solid-js"

export interface Tail {
  readonly of: string
  readonly at: number
  readonly text: string
}

export interface Growing {
  readonly pieces: Map<string, Saying>
  readonly tail: Tail | null
}

const joined = (pieces: Map<string, Saying>): Tail | null => {
  const all = [...pieces.values()]
  const of = all.at(-1)?.of
  if (of === undefined) return null
  const run = all.filter((piece) => piece.of === of).sort((one, other) => one.at - other.at)
  let tail: Tail = { of, at: run[0]?.at ?? 0, text: "" }
  for (const piece of run) {
    if (piece.at !== sayingEnd(tail)) break
    tail = { ...tail, text: `${tail.text}${piece.text}` }
  }
  return tail
}

export const TRANSCRIPT_TAIL: CollectionFoldOptions<string, Saying, Growing> = {
  init: (entries) => {
    const pieces = new Map(entries)
    return { pieces, tail: joined(pieces) }
  },
  step: (held, { upserts, removes }) => {
    let tail = held.tail
    let moved = false
    let rebuild = false
    for (const key of removes) {
      if (!held.pieces.delete(key)) continue
      moved = true
      rebuild = true
    }
    for (const [key, piece] of upserts) {
      held.pieces.set(key, piece)
      moved = true
      if (rebuild) continue
      if (tail !== null && tail.of === piece.of && sayingEnd(tail) === piece.at) {
        tail = { ...tail, text: `${tail.text}${piece.text}` }
        continue
      }
      rebuild = true
    }
    if (!moved) return held
    return { pieces: held.pieces, tail: rebuild ? joined(held.pieces) : tail }
  },
}

export const createTail = (
  fold: CollectionFold<string, Saying>,
): {
  readonly tail: Accessor<Tail | null>
  readonly of: Accessor<string | null>
} => {
  const held = fold(TRANSCRIPT_TAIL)
  const tail = createMemo(() => held()?.tail ?? null)
  return { tail, of: createMemo(() => tail()?.of ?? null) }
}

export const grownText = (
  row: { readonly text: string },
  tail: Tail,
): string => {
  const held = row.text.length
  if (sayingEnd(tail) <= held) return row.text
  if (tail.at > held) return row.text
  return `${row.text}${tail.text.slice(held - tail.at)}`
}
