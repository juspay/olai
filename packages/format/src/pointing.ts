import { type Address, printAddress } from "./address.ts"
import { type Document, type Face, faceOf, sameFace, isOutline } from "./document.ts"
import { type Editable, overlay } from "./overlay.ts"
import { byPath } from "./paths.ts"
import { type Located } from "./node.ts"
import { contributionsOf, type Way } from "./imports.ts"
import { byCorpus } from "./derive.ts"
import { type Claims } from "./kinds.ts"

export interface Source {
  readonly at: Located | undefined
  readonly face: Face
  readonly ways: ReadonlyArray<Way>
}

export type Pointing = ReadonlyMap<string, ReadonlyArray<Source>>

const NOTHING_POINTS: ReadonlyArray<Source> = []

export const pointingAt = (pointing: Pointing, address: Address): ReadonlyArray<Source> =>
  pointing.get(printAddress(address)) ?? NOTHING_POINTS

const pointInto = (
  into: Map<string, Array<Source>>,
  claims: Claims,
  document: Document,
): void => {
  const face = faceOf(document)
  const records = document.holds === "nodes" ? document.nodes : undefined
  for (const contribution of contributionsOf(claims, face, records)) {
    const source: Source = { at: contribution.at, face, ways: [contribution.way] }
    fileAt(into, contribution.key, source)
    const address = contribution.address
    if (address !== undefined && address.kind !== "node" && address.kind !== "document") {
      fileAt(into, printAddress({ kind: "document", path: address.path }), source)
    }
  }
}


export const pointingOf = (claims: Claims, documents: ReadonlyArray<Document>): Pointing => {
  const into = new Map<string, Array<Source>>()
  for (const document of documents) pointInto(into, claims, document)
  return into
}

export const repointed = (
  before: Pointing,
  claims: Claims,
  was: ReadonlyArray<Document>,
  now: ReadonlyArray<Document>,
): Pointing => {
  const { touched, departing, arriving } = moved(was, claims, now)
  const keys = new Set(arriving.keys())
  for (const key of departing.keys()) keys.add(key)
  if (keys.size === 0) return before
  const map: Editable<string, ReadonlyArray<Source>> = overlay(before, "by key")
  for (const key of keys) {
    const own = [
      ...(before.get(key) ?? []).filter((source) => !touched.has(source.face.path)),
      ...(arriving.get(key) ?? []),
    ].sort(bySource)
    if (own.length === 0) map.delete(key)
    else map.set(key, own)
  }
  return map.sealed()
}

const fileAt = (into: Map<string, Array<Source>>, key: string, entry: Source): void => {
  const held = into.get(key)
  if (held === undefined) {
    into.set(key, [entry])
    return
  }
  const last = held[held.length - 1] as Source
  if (last.at === entry.at && last.face === entry.face) {
    if (!last.ways.includes(entry.ways[0] as Way)) {
      held[held.length - 1] = { at: last.at, face: last.face, ways: [...last.ways, entry.ways[0] as Way] }
    }
    return
  }
  held.push(entry)
}

const bySource = (one: Source, other: Source): number => {
  const side = byPath(one.face.path, other.face.path)
  if (side !== 0) return side
  if (one.at === undefined && other.at === undefined) return 0
  if (one.at === undefined) return -1
  if (other.at === undefined) return 1
  return byCorpus(one.at, other.at)
}

const moved = (
  was: ReadonlyArray<Document>,
  claims: Claims,
  now: ReadonlyArray<Document>,
): {
  readonly touched: ReadonlySet<string>
  readonly departing: ReadonlyMap<string, ReadonlyArray<Source>>
  readonly arriving: ReadonlyMap<string, ReadonlyArray<Source>>
} => {
  const touched = new Set<string>()
  const departing = new Map<string, Array<Source>>()
  const arriving = new Map<string, Array<Source>>()
  let here = 0
  let there = 0
  const left = (document: Document): void => {
    touched.add(document.path)
    pointInto(departing, claims, document)
  }
  const joined = (document: Document): void => {
    touched.add(document.path)
    pointInto(arriving, claims, document)
  }
  while (here < was.length && there < now.length) {
    const one = was[here] as Document
    const other = now[there] as Document
    const side = byPath(one.path, other.path)
    if (side < 0) {
      left(one)
      here++
    } else if (side > 0) {
      joined(other)
      there++
    } else if (one === other) {
      here++
      there++
    } else {
      const faces = sameFace(one, other)
      const records = isOutline(one) && isOutline(other)
        ? one.nodes !== other.nodes
        : false
      if (!faces || records) {
        left(one)
        joined(other)
      }
      here++
      there++
    }
  }
  for (; here < was.length; here++) left(was[here] as Document)
  for (; there < now.length; there++) joined(now[there] as Document)
  return { touched, departing, arriving }
}