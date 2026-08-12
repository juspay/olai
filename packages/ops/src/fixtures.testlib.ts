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
 * a test needs both of them boring — plus the one piece of setup two suites
 * here share, a repository around a directory, in the two states the
 * auto-commit has to tell apart.
 *
 * Not a suite: `bun test` collects only `*.test.ts`.
 */

import { execFileSync } from "node:child_process"

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

/**
 * A real git repository around a directory, in the two states the auto-commit
 * has to tell apart.
 *
 * Real git rather than a fake, because what these tests are about is what git
 * DOES — a fake would only reproduce what we already believe. The identity is
 * repository-local, so a run depends on nothing in the developer's global
 * config and touches none of it.
 *
 * `identity: false` leaves that identity EMPTY, which is git's own "Author
 * identity unknown": the commit failure people actually hit, on a fresh machine
 * or under a service account, reproduced without needing one. A seed commit is
 * still made (with an author supplied for that one call), because what is being
 * set up is a repository whose NEXT commit cannot be made.
 */
export const repoAt = (
  root: string,
  options: { readonly identity?: boolean; readonly seed?: boolean } = {},
): void => {
  const git = (argv: ReadonlyArray<string>, env?: Record<string, string>) => {
    execFileSync("git", argv, {
      cwd: root,
      stdio: "ignore",
      ...(env === undefined ? {} : { env: { ...process.env, ...env } }),
    })
  }
  const nobody = options.identity === false
  git(["init", "--quiet"])
  git(["config", "user.email", nobody ? "" : "test@olai.invalid"])
  git(["config", "user.name", nobody ? "" : "olai tests"])
  if (options.seed === false) return
  git(["add", "-A"])
  git(["commit", "--quiet", "--no-verify", "-m", "fixtures"], {
    GIT_AUTHOR_NAME: "olai tests",
    GIT_AUTHOR_EMAIL: "test@olai.invalid",
    GIT_COMMITTER_NAME: "olai tests",
    GIT_COMMITTER_EMAIL: "test@olai.invalid",
  })
}
