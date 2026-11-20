import {
  type BrokenFile,
  type Document,
  documentAt,
  type OutlineSet,
  type Reading,
} from "@olai/format"
import type { Snapshot } from "@olai/store"

type Moved = Pick<Snapshot<unknown>, "changed" | "removed">

export interface Change<T> {
  readonly entries: Map<string, T>
  readonly upserts: ReadonlyArray<readonly [string, T]>
  readonly removes: ReadonlyArray<string>
}

export interface Sliced<T> extends Change<T> {
  readonly born: ReadonlySet<string>
}


/** The revision handed in is CONSUMED: a caller must not go on reading the old
 *  one. An entry the wire is told about and an entry the map holds are written
 *  in the SAME statement. */
export const changeOf = <S extends Document, T>(
  set: OutlineSet,
  holds: (document: Document) => document is S,
  build: (source: S) => T,
  decoded: ReadonlyArray<Document>,
  moved: Moved,
  previous: Change<T> | undefined,
  complete: boolean,
): Sliced<T> => {
  const held = previous?.entries
  const touched = decoded.filter(holds)
  const removes = moved.removed.filter((path) => held?.has(path) === true)
  const born = new Set(
    touched.flatMap((document) => (held?.has(document.path) === true ? [] : [document.path])),
  )

  const entries = held !== undefined && complete && born.size === 0 && removes.length === 0
    ? held
    : rebuilt(set, holds, build, new Set(touched.map((document) => document.path)), held)
  if (entries === held) {
    for (const document of touched) entries.set(document.path, build(document))
  }
  const minted = complete || held === undefined ? NO_MINTED : mintedOf(held, entries, moved.removed)
  return {
    entries,
    upserts: touched.flatMap((document) => {
      const entry = entries.get(document.path)
      return entry === undefined ? [] : [[document.path, entry] as const]
    }),
    removes: minted.length === 0 ? removes : [...removes, ...minted],
    born,
  }
}

const NO_MINTED: ReadonlyArray<string> = []

const mintedOf = <T>(
  held: ReadonlyMap<string, T>,
  entries: ReadonlyMap<string, T>,
  removed: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const named = new Set(removed)
  return [...held.keys()].filter((key) => !entries.has(key) && !named.has(key))
}

const rebuilt = <S extends Document, T>(
  set: OutlineSet,
  holds: (document: Document) => document is S,
  build: (source: S) => T,
  touched: ReadonlySet<string>,
  held: ReadonlyMap<string, T> | undefined,
): Map<string, T> => {
  const entries = new Map<string, T>()
  for (const document of set.documents) {
    if (!holds(document)) continue
    const published = touched.has(document.path) ? undefined : held?.get(document.path)
    entries.set(document.path, published ?? build(document))
  }
  return entries
}

export interface Projection<T> {
  readonly files: ReadonlySet<string>
  readonly change: Change<T>
}

export const frame = (snapshot: Snapshot<Reading>, previous?: ReadonlySet<string>) => {
  const decoded = snapshot.changed.flatMap(path => {
    const document = documentAt(snapshot.value.set, path)
    return document ? [document] : []
  })
  const born = decoded.filter(document => !previous?.has(document.path))
  const gone = snapshot.removed.filter(path => previous?.has(path) && !documentAt(snapshot.value.set, path))
  const complete = previous === undefined || previous.size + born.length - gone.length === snapshot.value.set.documents.length
  const files = previous && complete && born.length === 0 && gone.length === 0 ? previous
    : new Set(snapshot.value.set.documents.map(document => document.path))
  return { decoded, complete, files, broken: new Map(snapshot.value.set.broken.map(file => [file.file, file])) }
}
