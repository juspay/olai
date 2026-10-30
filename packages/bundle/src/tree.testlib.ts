/**
 * THIS REPOSITORY, AS VALUES — the reading olai's own fences stand on, which is
 * not the reading's home any more.
 *
 * ## What moved, and why it moved first
 *
 * This file used to hold the machinery: glob expansion, manifest parsing, four
 * import grammars, a source walk, a module resolver, a graph walk and the
 * parser that reads what a module keeps at its own scope. All of it was generic
 * — none of it knew what a plugin is — and a second consumer now needs exactly
 * that: `@olai/effect-cordis/fence` is the door, and it answers the five claims
 * that used to be half of `fence.test.ts`.
 *
 * So the machinery lives THERE, and this file is the ADAPTER: the same names the
 * benches in this tree already call, over the door's one reading of the tree,
 * with this repo's two path conventions (`PACKAGES`-relative member names,
 * absolute file paths) on the outside. Two readings of one tree is the defect
 * the door's header calls out — a resolver that answers `undefined` once — so
 * there is one reading and this is its spelling.
 *
 * ## What stayed
 *
 * `serverHalves` and `composing`: loading each row's SERVER module is a fact
 * about olai's bundle, not about any workspace's graph, and it is the strongest
 * claim in this package because it does what the loader does — import by the
 * row's own name — rather than trusting a list. `transpilers` stays for the same
 * kind of reason: two benches here read what a file COMPILES TO (a type erased,
 * a JSX element printed) and the door deliberately reads SOURCE. Bun is this
 * tree's runner; the door is consumed by a package that may not have it.
 *
 * ## Where the other copies are
 *
 * `@olai/acp`'s `manifest.test.ts` reads manifests for its own first claim —
 * that acp imports no `@olai` sibling, which is the claim reaching for this
 * module would fail — and `@olai/tests`' `imports.test.ts` could import this
 * but only through a door, and a `./tree` door would put this file on the very
 * closure its claims walk. Both are structural, not sloppiness.
 */

import * as path from "node:path"

import {
  type Edge as DoorEdge,
  type Graph as DoorGraph,
  type Manifest,
  cssImportsOf,
  dependencyNames,
  doorsOf,
  edgesOf as edgesOfSource,
  grammarOf,
  isBench,
  mainOf,
  manifestAt as manifestAtDirectory,
  packageOf,
  readWorkspace,
  specifiersOf,
  withoutComments,
} from "@olai/effect-cordis/fence"

import { ROWS } from "./rows.ts"

/** Where every workspace member lives. */
export const PACKAGES = path.join(import.meta.dirname, "..", "..")

/** The repository root — the directory whose manifest carries the `workspaces`
 *  globs, and so the root the door reads. */
export const REPO = path.join(PACKAGES, "..")

/** THE ONE READING, for the length of a run. Every bench in this package asks
 *  it the same questions about a tree that does not change. */
export const TREE = readWorkspace(REPO)

/** `PACKAGES`-relative, so a top-level member is `web` and a nested tenant is
 *  `plugins/kolu` — this package's convention, kept where every caller already
 *  spells it. */
const relativeToPackages = (member: string): string => path.relative("packages", member)

/** One manifest, by a `PACKAGES`-relative directory OR an absolute one — the
 *  benches here spell both, and a `path.join` with an absolute second argument
 *  silently answers a path that does not exist. */
export const manifestAt = (dir: string): Manifest | undefined =>
  manifestAtDirectory(path.isAbsolute(dir) ? dir : path.join(PACKAGES, dir))

/** The door's own readings, re-exported where the signature is the one a bench
 *  already spells: one implementation, and no wrapper to drift from it. */
export { cssImportsOf, dependencyNames, doorsOf, grammarOf, isBench, mainOf, packageOf, specifiersOf, withoutComments }

/** What the ROOT manifest declares — `dependencies`, `devDependencies` and
 *  peers, because any one of them puts a package where the whole tree can reach
 *  it, which is what tells a hydrated specifier from an ordinary one. */
export const ROOT_DECLARED: ReadonlySet<string> = new Set(dependencyNames(manifestAtDirectory(REPO)))

/** Where every workspace member lives, `PACKAGES`-relative and sorted. */
export const MEMBERS: ReadonlyArray<string> = TREE.members.map(relativeToPackages)

/** What each member CALLS itself. */
export const MEMBER_OF_PACKAGE: ReadonlyMap<string, string> = new Map(
  [...TREE.memberOfPackage].map(([name, member]) => [name, relativeToPackages(member)]),
)

/** Which member a `PACKAGES`-relative path belongs to. The door answers this
 *  over repo-relative paths, and this is the CONVERSION rather than a second
 *  longest-prefix search: one reading, two conventions. */
export const memberOf = (file: string): string | undefined => {
  const member = TREE.memberOf(`packages/${file}`)
  return member === undefined ? undefined : relativeToPackages(member)
}

/** Every source under one directory, as ABSOLUTE paths — the convention this
 *  package's benches already read files with. Read off the door's corpus rather
 *  than walked again: `settings.test.ts` asks one directory, `mechanics.test.ts`
 *  asks `PACKAGES`, and both are prefixes of the same reading. */
export const sourcesUnder = (dir: string): ReadonlyArray<string> =>
  TREE.sources
    .filter((source) => {
      // A PATH BOUNDARY, not a string prefix: `plugins/pi` is a prefix of
      // `plugins/pins`, and a filter that said so would hand one tenant the
      // other's sources — which is the whole class of bug a fence is for.
      const at = path.join(REPO, source.file)
      return at === dir || at.startsWith(`${dir}${path.sep}`)
    })
    .map((source) => path.join(REPO, source.file))


export interface Named {
  /** `PACKAGES`-relative, so a failure reads as a path somebody can open. */
  readonly file: string
  readonly grammar: "css" | "tsx" | "ts"
  /** Every specifier this file reaches for at all, by that grammar. */
  readonly specs: ReadonlyArray<string>
}

/** WHAT A FILE NAMES, the runtime's way — the walk's instrument, which elides a
 *  type-only import (it is erased) and keeps a dynamic one it will not follow. */
export const edgesOf = (file: string, text: string): ReadonlyArray<DoorEdge> => edgesOfSource(file, text, true)

/** One transpiler per grammar, for the two benches that read COMPILED code. The
 *  `ts` loader refuses JSX, which is why there are two. */
export const transpilers = {
  ts: new Bun.Transpiler({ loader: "ts" }),
  tsx: new Bun.Transpiler({ loader: "tsx" }),
} as const

/** What one walk found, in this package's path convention: which file reached
 *  for which specifier, every module VISITED, and every edge it could not
 *  follow. */
export interface TreeGraph {
  readonly reached: ReadonlyArray<{ readonly file: string; readonly spec: string; readonly dynamic: boolean }>
  readonly files: ReadonlyArray<string>
  readonly unresolved: ReadonlyArray<string>
}

/** The graph one module opens, with this package's path convention on it. */
export const graphFrom = (entry: string): TreeGraph => {
  const graph: DoorGraph = TREE.graphOf(path.relative(REPO, entry))
  const seen = (file: string): string => path.relative(PACKAGES, path.join(REPO, file))
  return {
    reached: graph.reached.map((edge) => ({ ...edge, file: seen(edge.file) })),
    files: graph.visited.map(seen),
    unresolved: graph.unresolved,
  }
}

/** The pairs alone, which is what most callers here want. */
export const walkFrom = (entry: string): ReadonlyArray<{ file: string; spec: string }> => graphFrom(entry).reached

/**
 * EVERY PLUGIN'S SERVER MODULE, LOADED — what a test reads now that no door in
 * this package statically imports a plugin.
 *
 * A test does what the runtime does, which is also the stronger claim: it
 * IMPORTS BY THE ROW'S OWN NAME. A row whose module does not export what this
 * package believes it does fails here, in the same grammar the loader would
 * fail in, rather than at a `satisfies` on a list nobody maintains.
 */
export const serverHalves = async (): Promise<ReadonlyArray<ServerHalf>> =>
  Promise.all(ROWS.map((row) => import(row.name) as Promise<ServerHalf>))

/**
 * As much of a server half as the benches in this package read.
 *
 * `surface` and `faces` are OPTIONAL, and the absent arm is a whole kind of
 * plugin rather than an unfinished one: an ENGINE composes no sibling surface —
 * what it contributes to a tab already travels on the chat cell, which is
 * core's, and a second surface under `surface/claude/` saying the same thing
 * would be one fact on the wire twice.
 */
export interface ServerHalf {
  readonly name: string
  readonly surface?: { readonly spec: unknown }
  readonly faces?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly kinds?: ReadonlyArray<{ readonly kind: string }>
}

/**
 * ...and the halves that compose a SIBLING — as the shape the composition doors
 * take.
 *
 * TWO ABSENCES AND ONLY ONE OF THEM IS A STATE. A half with NEITHER a surface
 * nor faces is an engine, and drops out. A half with a surface and no faces is
 * half an edit — a sibling on the wire that every face is denied in full — and
 * throwing here is what stops it being silently skipped by a filter.
 */
export const composing = (
  halves: ReadonlyArray<ServerHalf>,
): ReadonlyArray<ServerHalf & { readonly surface: { readonly spec: unknown }; readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>> }> =>
  halves.flatMap((half) => {
    if (half.surface === undefined) return []
    if (half.faces === undefined) {
      throw new Error(`${half.name}: a half with a surface and no \`faces\` composes a sibling nobody may see`)
    }
    return [{ ...half, surface: half.surface, faces: half.faces }]
  })
