import { Schema } from "effect"

import { type Address, addressOf, DocumentPath } from "./address.ts"
import { byCorpus, tagText, type Derived } from "./derive.ts"
import { Face, type FaceHead } from "./document.ts"
import { isPutAway, isRegular, LocatedRegular } from "./node.ts"
import { byPath } from "./paths.ts"
import { type Pointing, pointingAt, type Source } from "./pointing.ts"
import type { Reading } from "./validate.ts"

import { WAYS } from "./imports.ts"
export const Way = Schema.Literals(WAYS)
export type Way = typeof Way.Type

export const Reference = Schema.Struct({
  source: Schema.Union([LocatedRegular, Schema.Struct({ path: DocumentPath, title: Schema.String })]),
  ways: Schema.Array(Way),
})
export type Reference = typeof Reference.Type

const NOTHING_REFERS: ReadonlyArray<Reference> = []

export const referencesOf = (
  at: Pick<Reading, "claims" | "derived" | "pointing">,
  address: Address,
): ReadonlyArray<Reference> => {
  if (address.kind === "node") return nodeRefs(at, address.id)
  return documentRefs(at, address)
}

const nodeRefs = (
  at: Pick<Reading, "claims" | "derived" | "pointing">,
  id: string,
): ReadonlyArray<Reference> => {
  const { derived, pointing } = at
  if (!derived.byId.has(id)) return NOTHING_REFERS
  const found = new Map<object, Reference>()

  const file = (source: Source): void => {
    if (isPutAway(derived.claims, source.face.path)) return
    if (source.at !== undefined) {
      if (source.at.node.id === id || !isRegular(source.at)) return
    }
    const key: object = source.at ?? source.face
    const held = found.get(key)
    if (held === undefined) {
      found.set(key, { source: source.at ?? headOf(source.face), ways: source.ways })
      return
    }
    const merged = WAYS.filter((one) => held.ways.includes(one) || source.ways.includes(one))
    if (merged.length !== held.ways.length) found.set(key, { source: held.source, ways: merged })
  }
  for (const named of [id, ...(derived.mirrorsOf.get(id) ?? [])]) {
    const node = addressOf(at.claims, null, named)
    if (node === null) continue
    for (const source of pointingAt(pointing, node)) file(source)
    for (const source of pointing.get(tagText({ sigil: "@", tag: named })) ?? []) file(source)
  }
  return [...found.values()]
    .sort(byReference)
}

const documentRefs = (
  at: Pick<Reading, "claims" | "derived" | "pointing">,
  address: Exclude<Address, { readonly kind: "node" }>,
): ReadonlyArray<Reference> => {
  const sources = pointingAt(at.pointing, address)
  if (sources.length === 0) return NOTHING_REFERS
  const found: Array<Reference> = []
  for (const source of sources) {
    if (source.face.path === address.path || isPutAway(at.derived.claims, source.face.path)) continue
    if (source.at !== undefined && !isRegular(source.at)) continue
    found.push({ source: source.at ?? headOf(source.face), ways: source.ways })
  }
  return found.length === 0 ? NOTHING_REFERS : found
}

const byReference = (one: Reference, other: Reference): number => {
  const side = byPath(pathOf(one.source), pathOf(other.source))
  if (side !== 0) return side
  const oneRecord = "file" in one.source
  const otherRecord = "file" in other.source
  if (oneRecord !== otherRecord) return oneRecord ? 1 : -1
  if (!oneRecord) return 0
  return byCorpus(one.source as LocatedRegular, other.source as LocatedRegular)
}

const pathOf = (source: LocatedRegular | FaceHead): string =>
  "path" in source ? source.path : source.file

const headOf = (face: Face): FaceHead => ({ path: face.path, title: face.title })