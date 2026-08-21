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
 * What is genuinely this package's is below: an op needs two impure things and
 * a test needs both of them boring, and a test of the PLANNER needs the same
 * four moves every time — drive it, quote what it refused, find one file of the
 * plan, find one record in it.
 *
 * Not a suite: `bun test` collects only `*.test.ts`.
 */

import type { Node, OpFailure, OutlineSet, RegularNode, WriteRequest } from "@olai/format"
import { Result } from "effect"

import { type Context, plan, type Plan } from "./plan.ts"
import { readingOf } from "@olai/format/testlib"

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

// ── driving the planner ────────────────────────────────────────────────

/**
 * The four moves every planner test makes, and the DIAGNOSTICS they carry.
 *
 * Here rather than at the top of each suite because the diagnostics are what
 * make them worth sharing: "expected `add` to plan, and it refused: …" is the
 * sentence that turns a failing assertion into a fixed test without a debugger,
 * and two copies of it is one copy that gets better and one that does not. Two
 * suites drive the planner directly now (`./plan.test.ts`, one op at a time;
 * `./batch.test.ts`, a run of them), which is the second copy this exists to
 * prevent.
 *
 * The FIXTURES stay with their suites, deliberately. Each corpus is part of
 * what its file asserts — the batch tests mark two nodes `todo` so the
 * done-over-open-work gate has something to refuse — and a shared one would be
 * a thing to read elsewhere plus a temptation to add a node that quietly
 * changes another file's expectations.
 */
export const planning = (
  set: OutlineSet,
  request: WriteRequest,
): Result.Result<Plan, OpFailure> => plan(readingOf(set), steady(), request)

/**
 * A `Result` this layer produced, unwrapped — and the DIAGNOSTIC, which is the
 * whole reason the pair has a name.
 *
 * "expected `add` to plan, and it refused: …" is the sentence that turns a
 * failing assertion into a fixed test without a debugger, and a second copy of
 * it is one copy that gets better and one that does not. The planner asked for
 * these two first; the READS ask for them now as well — `read_subtree` answers
 * a `Result` since it began taking a path, which can be refused — so they are
 * over any `Result` this package produces rather than over a plan.
 *
 * `what` is the phrase the sentence is built around ("`add` to plan",
 * "`read_subtree` to answer"), so the caller names its own verb.
 */
export const succeeded = <A>(
  outcome: Result.Result<A, OpFailure>,
  what: string,
): A => {
  if (Result.isFailure(outcome)) {
    throw new Error(
      `expected ${what}, and it refused: ` +
        `${outcome.failure._tag} — ${outcome.failure.message}`,
    )
  }
  return outcome.success
}

export const failed = <A>(
  outcome: Result.Result<A, OpFailure>,
  what: string,
): OpFailure => {
  if (Result.isSuccess(outcome)) {
    throw new Error(
      `expected ${what} to be refused, and it answered: ` +
        `${JSON.stringify(outcome.success)}`,
    )
  }
  return outcome.failure
}

/** The plan, or a failure quoted well enough to fix the test without a
 *  debugger. */
export const planned = (set: OutlineSet, request: WriteRequest): Plan =>
  succeeded(planning(set, request), `\`${request.op}\` to plan`)

export const refused = (set: OutlineSet, request: WriteRequest): OpFailure =>
  failed(planning(set, request), `\`${request.op}\``)

/** One file of a plan, by name. */
export const fileOf = (result: Plan, file: string): ReadonlyArray<Node> => {
  const found = result.files.find((entry) => entry.file === file)
  if (found === undefined) {
    throw new Error(
      `the plan does not write \`${file}\`; it writes ${
        result.files.map((entry) => entry.file).join(", ") || "nothing"
      }`,
    )
  }
  return found.nodes
}

export const record = (nodes: ReadonlyArray<Node>, id: string): RegularNode => {
  const found = nodes.find((node) => node.id === id)
  if (found === undefined) throw new Error(`no record \`${id}\` in the plan`)
  return found as RegularNode
}
