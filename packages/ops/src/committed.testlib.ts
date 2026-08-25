/**
 * THE COMMITTED SIDE AS IT WAS, kept in the tree so the cache can be checked
 * against it — and a counting wrapper, so what the cache actually SAVES is a
 * number this repository can re-run rather than a claim in a commit message.
 *
 * {@link forgetful} is not a fake and not a simplification: it is the loop
 * `./pending.ts` used to run inline, one `git show HEAD:<file>` subprocess and
 * one full parse per dirty outline per revision, with nothing remembered
 * between revisions. That is the whole "before" of `perf-git-per-write`, and it
 * is the reference arm of the differential (`./pending.equivalence.test.ts`)
 * and the "before" of the bench (`./pending.bench.ts`) — the same rule this
 * tree already applies to the published-revision maps and the scoped query: a
 * pair of figures nobody can reproduce is a pair of figures nobody should
 * believe, and an equivalence whose other side is deleted is an equivalence to
 * nothing.
 *
 * It asks about `HEAD` BY NAME, deliberately, because that is what the old code
 * asked. Which is also the difference the cache is built on — see
 * `./committed.ts` on why a question about `HEAD` is one nobody may remember
 * the answer to.
 *
 * Not a suite: `bun test` collects only `*.test.ts`.
 */

import { Effect } from "effect"

import { type Asking, type Committed, copyOf } from "./committed.ts"

/** What the old inline loop bounded its concurrency at, and what the new one
 *  does — the arms have to spend their subprocesses the same way or the timing
 *  compares two schedulers rather than two designs. */
const AT_ONCE = 8

/**
 * The old computation: every dirty outline, every revision, no memory.
 *
 * The one thing it does NOT reproduce is the shape of the ask — `git show`
 * takes a commit here, and the old code spelled `HEAD` into the command. Naming
 * `HEAD` is exactly equivalent for a single reading (it is the same commit the
 * cached arm resolves), and it is what keeps this arm honest as the "before":
 * it never asks which commit it is on, because the old code never had to.
 */
export const forgetful = (): Committed => ({
  at: (git, paths) =>
    Effect.gen(function*() {
      if (paths.length === 0) return new Map()
      const read = yield* Effect.all(
        paths.map((path) =>
          Effect.map(git.show("HEAD", path), (text) => [path, copyOf(path, text)] as const)
        ),
        { concurrency: AT_ONCE },
      )
      return new Map(read)
    }),
})

/** A {@link Committed} with a counter around the repository it asks. */
export interface Counted {
  readonly committed: Committed
  /** Subprocesses the committed side has run since this wrapper was made — the
   *  `rev-parse` for the commit and every `show` under it. THE number
   *  `perf-git-per-write` is about: it has to be O(what changed this revision)
   *  and not O(what is waiting). */
  readonly spawns: () => number
  /** Just the file reads, which is the half that used to grow with the dirty
   *  list. */
  readonly shows: () => number
  readonly reset: () => void
}

/**
 * Count what one arm spends, by counting the REPOSITORY it is handed rather
 * than by instrumenting either implementation.
 *
 * That is what makes the two arms comparable: neither of them knows it is being
 * counted, and both spend their subprocesses through the same two verbs. It is
 * also why the count is honest about the cache's own overhead — the `rev-parse`
 * that makes remembering safe is a subprocess like any other and is counted
 * like one.
 */
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
