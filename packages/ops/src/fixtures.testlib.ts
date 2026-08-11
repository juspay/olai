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

export { failureOf, setOf } from "@olai/format/testlib"

/** A planner context with no surprises in it: ids counted up from `n1`, and one
 *  fixed day. Both of the impure things an op needs, made boring. */
export const steady = (): Context => {
  let minted = 0
  return {
    mint: () => `n${++minted}`,
    today: () => "2026-08-09",
  }
}
