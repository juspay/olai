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
 * Who a test's git is. Env beats config, and an empty `GIT_AUTHOR_NAME` (some
 * CI, some load-bearing shells) is empty, not unset — so a repository-local
 * `user.name` is not enough. Every spawn this file makes carries these, and
 * they are the same strings {@link repoAt} writes into the config, so a commit
 * through either door is the same person.
 */
export const GIT_IDENT = {
  GIT_AUTHOR_NAME: "olai tests",
  GIT_AUTHOR_EMAIL: "test@olai.invalid",
  GIT_COMMITTER_NAME: "olai tests",
  GIT_COMMITTER_EMAIL: "test@olai.invalid",
} as const

/** The env keys {@link GIT_IDENT} pins — so a test that wants git's own empty
 *  ident can clear exactly these and nothing else. */
export const GIT_IDENT_KEYS = Object.keys(GIT_IDENT) as ReadonlyArray<
  keyof typeof GIT_IDENT
>

/**
 * Git, in a directory of a test.
 *
 * One spelling of it, because the identity is the load-bearing part — see
 * {@link repoAt}. Ambient `GIT_AUTHOR_*` is overwritten, empty included: a
 * fixture that inherited `GIT_AUTHOR_NAME=` used to fail with `fatal: empty
 * ident name` on the next commit, even after {@link repoAt} had set
 * `user.name`.
 */
export const gitIn = (root: string) =>
(...argv: ReadonlyArray<string>): string =>
  execFileSync("git", argv, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...GIT_IDENT },
  })

/**
 * A git repository around a directory.
 *
 * The identity is pinned two ways, and both are load-bearing: repository-local
 * config, so a product `git` that inherits the process env still has a name
 * once that env is clean; and {@link GIT_IDENT} on every spawn this file
 * itself makes, so an empty `GIT_AUTHOR_NAME` in the ambient env cannot empty
 * the ident. The branch is named explicitly so a machine whose
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
      env: { ...process.env, ...GIT_IDENT, ...env },
    })
  }
  const nobody = options.identity === false
  git(["init", "--quiet", "--initial-branch", "main"])
  git(["config", "user.email", nobody ? "" : GIT_IDENT.GIT_AUTHOR_EMAIL])
  git(["config", "user.name", nobody ? "" : GIT_IDENT.GIT_AUTHOR_NAME])
  if (options.seed === false) return
  git(["add", "-A"])
  git(["commit", "--quiet", "--no-verify", "-m", options.message ?? "fixtures"])
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
