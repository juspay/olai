import type { Ops } from "@olai/ops"
import { Effect } from "effect"

import { type Asking, type Committed, taken } from "./committed.ts"

const AT_ONCE = 8

export const forgetful = (ops: Pick<Ops, "parserFor">): Committed => ({
  at: (git, paths) =>
    Effect.gen(function*() {
      if (paths.length === 0) return new Map()
      const read = yield* Effect.all(
        paths.map((path) =>
          Effect.map(git.show("HEAD", path), (shown) => [path, taken(ops.parserFor(path), path, shown).copy] as const)
        ),
        { concurrency: AT_ONCE },
      )
      return new Map(read)
    }),
})

export interface Counted {
  readonly committed: Committed
  readonly spawns: () => number
  readonly shows: () => number
  readonly reset: () => void
}

export const counting = (inner: Committed): Counted => {
  let heads = 0
  let shows = 0
  const committed: Committed = {
    at: (git, paths) =>
      inner.at({
        head: Effect.andThen(Effect.sync(() => heads++), git.head),
        show: (commit, path) =>
          Effect.andThen(Effect.sync(() => shows++), git.show(commit, path)),
      } satisfies Asking, paths),
  }
  return {
    committed,
    spawns: () => heads + shows,
    shows: () => shows,
    reset: () => {
      heads = 0
      shows = 0
    },
  }
}
