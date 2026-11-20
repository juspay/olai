import { type Claims, type Node } from "@olai/format"
import type { Ops } from "@olai/ops"
import type { Shown } from "../git/git.ts"
import { Effect, Result } from "effect"

export type Copy =
  | { readonly _tag: "Absent" }
  | { readonly _tag: "Unparsed" }
  | { readonly _tag: "Nodes"; readonly nodes: ReadonlyArray<Node> }

const ABSENT: Copy = { _tag: "Absent" }
const UNPARSED: Copy = { _tag: "Unparsed" }

const NOTHING: ReadonlyMap<string, Copy> = new Map()

export interface Asking {
  readonly head: Effect.Effect<string | null>
  readonly show: (commit: string, path: string) => Effect.Effect<Shown>
}

export interface Committed {
  readonly at: (
    git: Asking,
    paths: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyMap<string, Copy>>
}

const AT_ONCE = 8

export const remembering = (ops: Pick<Ops, "parserFor">): Committed => {
  let generation: string | null = null
  let copies = new Map<string, { readonly claims: Claims | undefined; readonly copy: Copy }>()

  return {
    at: (git, paths) =>
      Effect.gen(function*() {
        if (paths.length === 0) return NOTHING
        const commit = yield* git.head
        if (commit === null) return answer(paths, () => ABSENT)
        if (commit !== generation) {
          generation = commit
          copies = new Map()
        }
        const mine = copies

        const wanted = new Set(paths)
        const formats = new Map([...wanted].map(path => [path, ops.parserFor(path)]))
        const missing = [...wanted].filter(path => {
          const cached = mine.get(path)
          return cached === undefined || cached.claims !== formats.get(path)?.claims
        })
        const read = yield* Effect.all(
          missing.map((path) =>
            Effect.map(git.show(commit, path), (shown) => [path, taken(formats.get(path) ?? null, path, shown)] as const)
          ),
          { concurrency: AT_ONCE },
        )
        if (generation === commit) {
          for (const [path, one] of read) if (one.keep) mine.set(path, { claims: formats.get(path)?.claims, copy: one.copy })
        }

        const found = new Map(read.map(([path, one]) => [path, one.copy] as const))
        return answer(paths, (path) => found.get(path) ?? mine.get(path)?.copy ?? ABSENT)
      }),
  }
}

const answer = (
  paths: ReadonlyArray<string>,
  of: (path: string) => Copy,
): ReadonlyMap<string, Copy> => {
  const map = new Map<string, Copy>()
  for (const path of paths) if (!map.has(path)) map.set(path, of(path))
  return map
}

export interface Taken {
  readonly copy: Copy
  readonly keep: boolean
}

export const taken = (parser: ReturnType<Ops["parserFor"]>, path: string, shown: Shown): Taken => {
  if (shown._tag === "Absent") return { copy: ABSENT, keep: true }
  if (shown._tag === "Unusable") return { copy: ABSENT, keep: false }
  if (parser === null) return { copy: ABSENT, keep: true }
  const parsed = parser.format.parse(path, shown.text, parser.claims)
  return {
    copy: Result.isFailure(parsed)
      ? UNPARSED
      : { _tag: "Nodes", nodes: parsed.success.nodes.map((located) => located.node) },
    keep: true,
  }
}
