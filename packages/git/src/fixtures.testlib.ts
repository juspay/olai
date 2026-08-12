/**
 * A real repository, in the states a commit path has to tell apart.
 *
 * Real git rather than a fake, because what these tests are about is what git
 * DOES — a fake would only reproduce what we already believe.
 *
 * On the `./testlib` subpath rather than the main entry: it is not product. It
 * is published because the packages ABOVE test against repositories too, and
 * the alternative was each of them growing its own `git init` — which is how
 * three of them had already drifted over the branch name, and how one that
 * forgot `user.email` passed on every laptop and failed only on a CI runner
 * with no `~/.gitconfig`.
 *
 * Not a suite: `bun test` collects only `*.test.ts`.
 */

import { execFileSync } from "node:child_process"

/**
 * Git, in a directory of a test.
 *
 * One spelling of it, because the identity is the load-bearing part — see
 * {@link repoAt}.
 */
export const gitIn = (root: string) =>
(...argv: ReadonlyArray<string>): string =>
  execFileSync("git", argv, { cwd: root, encoding: "utf8" })

/**
 * A git repository around a directory.
 *
 * The identity is repository-local, so a run depends on nothing in the
 * developer's global config and touches none of it, and the branch is named
 * explicitly so a machine whose `init.defaultBranch` differs reads the same as
 * every other.
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
 *  would compile and fail in five places at the same time.
 *
 *  It names olai's own trailer even though the package under it does not know
 *  that key — {@link repoAt} builds repositories for the packages ABOVE, and
 *  what they sign their commits with is what they read back. */
export const writerOf = (root: string): string =>
  gitIn(root)("log", "-1", "--format=%(trailers:key=X-Olai-Writer,valueonly)").trim()
