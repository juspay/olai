/**
 * The fixtures the ops tests are written against.
 *
 * The BUILDERS are borrowed, both of them, and for the same reason: a copy here
 * would be a second diagnostic — or a second `git init` — for the one thing it
 * describes. Outlines as text come from `@olai/format/testlib`, put through the
 * real `parseOutline` and `assemble`; a repository around a directory comes
 * from `@olai/git/testlib`, which is where the package that shells out to git
 * keeps the one spelling of `git init` this tree has.
 *
 * What is genuinely this package's is below: an op needs two impure things, and
 * a test needs both of them boring.
 *
 * Not a suite: `bun test` collects only `*.test.ts`.
 */

import type { Context } from "./plan.ts"

/** The pairing a snapshot carries, built from text — `@olai/format`'s, like
 *  the set builder beside it, because the pairing is that package's. */
export { failureOf, readingOf, setOf, STAMP_SHAPE } from "@olai/format/testlib"
export { gitIn, repoAt, subjectsIn, writerOf } from "@olai/git/testlib"

/** A planner context with no surprises in it: ids counted up from `n1`, and one
 *  fixed instant. Both of the impure things an op needs, made boring.
 *
 *  The instant is shaped like the one the server mints — local, with its offset
 *  — because that is what the tests are about to assert lands on disk. */
export const STAMP = "2026-08-09T10:15:00-04:00"

export const steady = (): Context => {
  let minted = 0
  return {
    mint: () => `n${++minted}`,
    now: () => STAMP,
  }
}
