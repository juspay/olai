import type { Claims } from "./kinds.ts"
import { Schema } from "effect"

import { addressAt, addressWritten } from "./address.ts"
import { type Derived, nodeNamed, rootsOf } from "./derive.ts"
import { pinsIn } from "./node.ts"

const Pinned = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  shows: Schema.optionalKey(Schema.Struct({
    id: Schema.String,
    name: Schema.String,
  })),
})
export type Pinned = typeof Pinned.Type

export const Shelf = Schema.Array(Pinned)
export type Shelf = typeof Shelf.Type

export const NO_PINS: Shelf = []

export const sameShelf: (a: Shelf, b: Shelf) => boolean = Schema.toEquivalence(Shelf)

export const pinTargetIn = (claims: Claims, title: string): string | undefined => {
  const address = addressAt(claims, addressWritten(title))
  return address?.kind === "node" || address?.kind === "row" ? address.id : undefined
}

export const shelfOf = (derived: Derived): Shelf =>
  shelfIn(derived, pinsIn(derived.claims, derived.byFile.keys()))

export const shelfIn = (derived: Derived, file: string | undefined): Shelf => {
  if (file === undefined) return NO_PINS
  return rootsOf(derived, file).flatMap((located) => {
    const node = located.node
    const row = { id: node.id, title: node.title }
    const target = pinTargetIn(derived.claims, node.title)
    if (target === undefined) return [row]
    const shows = nodeNamed(derived, target)
    return [shows === undefined ? row : { ...row, shows: { id: target, name: shows.node.title } }]
  })
}
