import { fileKind } from "@olai/format"
import { claims as makeClaims, type Claims, type BrokenFile } from "@olai/format"
import type { FileKindsState } from "../file-surface.ts"
import type { Head, Manifest } from "../wire.ts"
import type { CollectionFold, CollectionFoldOptions } from "@kolu/surface/solid"
import { type Accessor, createMemo } from "solid-js"

import { sortByPath } from "@olai/web/client/paths.ts"
import { sameMap } from "@olai/web/client/same.ts"

export type Standing = "reading" | "never" | "loaded"

export interface Directory {
  readonly claims: Accessor<Claims>
  readonly outlineRow: Accessor<string | undefined>
  readonly kindOf: (path: string) => string | null
  readonly standing: Accessor<Standing>
  readonly paths: Accessor<ReadonlyArray<string>>
  readonly members: Accessor<ReadonlySet<string>>
  readonly broken: Accessor<ReadonlyMap<string, BrokenFile>>
  readonly head: (file: Accessor<string>) => Accessor<number | undefined>
}

export interface HeadEntries {
  readonly byKey: (key: string) => Accessor<Head | undefined> | undefined
  readonly fold: CollectionFold<string, Head>
}

interface Held {
  readonly paths: ReadonlyArray<string>
  readonly broken: ReadonlyMap<string, BrokenFile>
  readonly members: Set<string>
}

type Upserts = ReadonlyArray<readonly [string, Head]>
type Removes = ReadonlyArray<string>

const pathsAfter = (held: Held, upserts: Upserts, removes: Removes): ReadonlyArray<string> => {
  let moved = false
  for (const [file] of upserts) {
    if (held.members.has(file)) continue
    held.members.add(file)
    moved = true
  }
  for (const file of removes) if (held.members.delete(file)) moved = true
  return moved ? sortByPath(held.members) : held.paths
}

/** The map handed in is the one the sidebar is drawn from, so it must never be
 *  written into. */
const unreadableAfter = (
  was: ReadonlyMap<string, BrokenFile>,
  upserts: Upserts,
  removes: Removes,
): ReadonlyMap<string, BrokenFile> => {
  let now: Map<string, BrokenFile> | null = null
  const editing = () => (now ??= new Map(was))
  const stood = (file: string) => (now ?? was).get(file)
  for (const [file, head] of upserts) {
    const before = stood(file)
    if (head.broken === null) {
      if (before !== undefined) editing().delete(file)
    } else if (before !== head.broken) editing().set(file, head.broken)
  }
  for (const file of removes) if (stood(file) !== undefined) editing().delete(file)
  return now ?? was
}

const after = (held: Held, upserts: Upserts, removes: Removes): Held => {
  const paths = pathsAfter(held, upserts, removes)
  const broken = unreadableAfter(held.broken, upserts, removes)
  return paths === held.paths && broken === held.broken ? held : { ...held, paths, broken }
}

/** Minted per seeding rather than shared: one fold's working memory must never
 *  be another's. */
const holdingNothing = (): Held => ({
  paths: NO_PATHS,
  broken: NO_BROKEN,
  members: new Set(),
})

const SERVED_FILES: CollectionFoldOptions<string, Head, Held> = {
  init: (entries) => after(holdingNothing(), entries, []),
  step: (held, { upserts, removes }) => after(held, upserts, removes),
}

const NO_PATHS: ReadonlyArray<string> = []
const NO_BROKEN: ReadonlyMap<string, BrokenFile> = new Map()

export const createDirectory = (
  entries: HeadEntries,
  manifest: Accessor<Manifest | undefined>,
  fileKinds: Accessor<FileKindsState | null | undefined>,
): Directory => {
  // MUST be registered under a reactive owner.
  const held = entries.fold(SERVED_FILES)
  const claims = createMemo(() => {
    try { return makeClaims(fileKinds()?.claims ?? []) }
    catch (error) {
      console.warn("olai: invalid file-kind claims frame; using no claims", error)
      return makeClaims([])
    }
  })
  const heldPaths = createMemo(() => held()?.paths ?? NO_PATHS)
  return {
    claims,
    outlineRow: () => fileKinds()?.outlineRow,
    kindOf: path => fileKind(claims(), path),
    standing: createMemo((): Standing => {
      const holding = held()
      if (holding !== undefined && holding.paths.length > 0) return "loaded"
      const said = manifest()
      if (said === null) return "never"
      return said !== undefined && holding !== undefined ? "loaded" : "reading"
    }),
    paths: heldPaths,
    members: createMemo(() => new Set(heldPaths())),
    broken: createMemo(() => held()?.broken ?? NO_BROKEN, NO_BROKEN, {
      equals: sameMap,
    }),
    head: (file) => () => entries.byKey(file())?.()?.rev,
  }
}
