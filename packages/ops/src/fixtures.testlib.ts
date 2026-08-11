/**
 * The fixtures the ops tests are written against.
 *
 * The BUILDERS are `@olai/format`'s own (`@olai/format/testlib`): outlines as
 * text, put through the real `parseOutline` and `assemble`, throwing with the
 * text quoted when a fixture does not parse. A copy here would be a second
 * diagnostic for the same mistake — which is what that copy was consolidated to
 * stop, one package down.
 *
 * What is genuinely this package's is below: an op needs two impure things, and
 * a test needs both of them boring.
 *
 * Not a suite: `bun test` collects only `*.test.ts`.
 */

import type { Context } from "./plan.ts"

export { failureOf, setOf, STAMP_SHAPE } from "@olai/format/testlib"

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
