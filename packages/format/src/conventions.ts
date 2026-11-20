import type { Claims } from "./kinds.ts"
import type { Derived } from "./derive.ts"
import { documentAt, type OutlineSet, outlinePaths } from "./set.ts"

export interface Convention {
  readonly claims: Claims
  readonly paths: PathSet
  readonly file: string | undefined
}

export interface PathSet {
  has(path: string): boolean
  readonly size: number
}

export interface PathsMoved {
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

export type ConventionWalk = (claims: Claims, files: Iterable<string>) => string | undefined

export const conventionServed = (
  claims: Claims,
  walk: ConventionWalk,
  set: OutlineSet,
  moved: PathsMoved,
  held?: Convention,
): Convention => {
  if (held !== undefined && held.claims === claims && !servedMoved(held.paths, set, moved)) return held
  return { claims, paths: servedBy(set), file: walk(claims, outlinePaths(set)) }
}

const servedBy = (set: OutlineSet): PathSet => ({
  has: (path) => documentAt(set, path) !== undefined,
  size: set.documents.length,
})

export const conventionRecorded = (
  walk: ConventionWalk,
  derived: Derived,
  moved: PathsMoved,
  held?: Convention,
): Convention => {
  const { byFile, claims } = derived
  if (held !== undefined && held.claims === claims && !recordedMoved(held.paths, byFile, moved)) return held
  return { claims, paths: byFile, file: walk(claims, byFile.keys()) }
}

const servedMoved = (held: PathSet, set: OutlineSet, moved: PathsMoved): boolean => {
  for (const path of moved.removed) if (held.has(path)) return true
  for (const path of moved.changed) {
    if ((documentAt(set, path) !== undefined) !== held.has(path)) return true
  }
  return set.documents.length !== held.size
}

const recordedMoved = (
  held: PathSet,
  byFile: ReadonlyMap<string, unknown>,
  moved: PathsMoved,
): boolean => {
  for (const path of moved.removed) if (held.has(path)) return true
  for (const path of moved.changed) if (byFile.has(path) !== held.has(path)) return true
  return byFile.size !== held.size
}
