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

/**
 * A real git repository around a directory, in the states the commit paths have
 * to tell apart.
 *
 * Real git rather than a fake, because what these tests are about is what git
 * DOES — a fake would only reproduce what we already believe. The identity is
 * repository-local, so a run depends on nothing in the developer's global config
 * and touches none of it, and the branch is named explicitly so a machine whose
 * `init.defaultBranch` differs reads the same as every other.
 *
 * The default is a repository whose fixtures are already its first commit, so
 * what a test does afterwards is the whole of what git has to say about it.
 * `identity: false` leaves the identity EMPTY, which is git's own "Author
 * identity unknown" — the commit failure people actually hit, on a fresh machine
 * or under a service account. The seed commit is still made in that case (with
 * an author supplied for that one call), because what is being set up is a
 * repository whose NEXT commit cannot be made.
 */
export const repoAt = (
  root: string,
  options: {
    readonly identity?: boolean
    readonly seed?: boolean
    /** The seed commit's subject. Worth naming when a test READS the log back
     *  and the fixture's own commit has to be tellable from olai's. */
    readonly message?: string
  } = {},
): void => {
  const git = (argv: ReadonlyArray<string>, env?: Record<string, string>) => {
    execFileSync("git", argv, {
      cwd: root,
      stdio: "ignore",
      ...(env === undefined ? {} : { env: { ...process.env, ...env } }),
    })
  }
  const nobody = options.identity === false
  git(["init", "--quiet", "--initial-branch", "main"])
  git(["config", "user.email", nobody ? "" : "test@olai.invalid"])
  git(["config", "user.name", nobody ? "" : "olai tests"])
  if (options.seed === false) return
  git(["add", "-A"])
  git(["commit", "--quiet", "--no-verify", "-m", options.message ?? "fixtures"], {
    GIT_AUTHOR_NAME: "olai tests",
    GIT_AUTHOR_EMAIL: "test@olai.invalid",
    GIT_COMMITTER_NAME: "olai tests",
    GIT_COMMITTER_EMAIL: "test@olai.invalid",
  })
}

/** Every commit subject in a repository, newest first. Three test files had
 *  grown their own spelling of this; one is enough, and it belongs beside the
 *  builder that makes the repository they read. */
export const subjectsIn = (root: string): ReadonlyArray<string> =>
  gitIn(root)("log", "--format=%s").trim().split("\n")

/** The `X-Olai-Writer` trailer on the newest commit, or `""` when it carries
 *  none. The KEY is a contract between the commit path and every test that
 *  reads it back, so it is spelled once: six literal copies meant a rename
 *  would compile and fail in five places at the same time. */
export const writerOf = (root: string): string =>
  gitIn(root)("log", "-1", "--format=%(trailers:key=X-Olai-Writer,valueonly)").trim()
