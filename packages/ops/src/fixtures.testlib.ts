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

import { execFileSync } from "node:child_process"

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

/**
 * Git, in a directory of this package's tests.
 *
 * One spelling of it, because the identity is the load-bearing part: a CI
 * runner has no `~/.gitconfig`, so a copy that forgot `user.email` would pass
 * on every laptop and fail only there. Three test files had grown one each, and
 * they had already drifted over the branch name.
 */
export const gitIn = (root: string) =>
(...argv: ReadonlyArray<string>): string =>
  execFileSync("git", argv, { cwd: root, encoding: "utf8" })

/** A repository around a directory that already has its fixtures in it, with
 *  those fixtures as the first commit — so what a test does afterwards is the
 *  whole of what git has to say about it. */
export const repoAt = (root: string): void => {
  const git = gitIn(root)
  git("init", "--quiet", "--initial-branch", "main")
  git("config", "user.email", "test@olai.invalid")
  git("config", "user.name", "olai tests")
  git("add", "-A")
  git("commit", "--quiet", "-m", "fixtures")
}
