/**
 * The auto-commit, as the store's post-publish hook.
 *
 * "Git is the only history" (docs/architecture.md), so a write that is not
 * committed is a write with no undo. Every op commits the files it wrote, with
 * the message convention the racket reference used — `capture:` / `done:` /
 * `doing:` / `move:` / `archive:` and the node's title — because a log a person
 * already knows how to read is worth more than a better one they do not.
 *
 * Three properties, and each is a decision rather than an accident:
 *
 *   - **Gated on the directory actually being a work tree.** A served directory
 *     is often somebody's notes under Dropbox, and `git init`-ing it behind
 *     their back is not this program's business. Not a work tree, no commit,
 *     and the op says so in its reply rather than failing.
 *   - **It cannot fail the write.** The bytes are on disk and the browser has
 *     already seen them by the time this runs; turning a git failure into a
 *     failed op would be a lie about what happened. A refusal is logged and
 *     reported as `committed: false`.
 *   - **Only the files this op wrote**, named explicitly on both `add` and
 *     `commit`. A served directory is a working tree with other work in it, and
 *     an op that swept up a half-finished edit somebody had staged would be a
 *     far worse failure than not committing at all.
 */

import { execFile } from "node:child_process"

import { Effect } from "effect"

export interface Committing {
  /** Absolute path of the directory being served — where git runs. */
  readonly root: string
  /** Absolute paths of the files this write produced. */
  readonly paths: ReadonlyArray<string>
  /** The commit subject. */
  readonly message: string
}

/** How long git gets. A commit in a notes directory is milliseconds; the
 *  budget is here so a wedged hook or a lock held by another process cannot
 *  hold the write gate open forever. */
const BUDGET = 10_000

/** Run git, and answer with whether it worked and what it said. Never fails:
 *  every outcome — a missing binary, a non-zero exit, a timeout — is an answer
 *  the caller decides what to do with. */
const git = (
  root: string,
  argv: ReadonlyArray<string>,
): Effect.Effect<{ readonly ok: boolean; readonly said: string }> =>
  Effect.callback<{ readonly ok: boolean; readonly said: string }>((resume) => {
    execFile(
      "git",
      [...argv],
      { cwd: root, timeout: BUDGET, encoding: "utf8" },
      (error, stdout, stderr) => {
        resume(
          Effect.succeed({
            ok: error === null,
            said: `${stdout}${stderr}`.trim() ||
              (error === null ? "" : error.message),
          }),
        )
      },
    )
  })

/** Is this directory inside a git work tree? A bare repository is not: there
 *  is nowhere for the files to be. */
export const isWorkTree = (root: string): Effect.Effect<boolean> =>
  Effect.map(
    git(root, ["rev-parse", "--is-inside-work-tree"]),
    ({ ok, said }) => ok && said === "true",
  )

/**
 * Commit the files a write produced.
 *
 * The caller has already established that there IS a repository — that answer
 * is a property of the root, so it is asked once rather than spawning a
 * `rev-parse` inside the store's write gate on every op.
 *
 * Answers whether it committed. `false` covers two situations — git said no,
 * or there was nothing to commit — and the caller does not need to tell them
 * apart: it reports what it knows and the reader looks at `git status`.
 */
export const commit = (
  what: Committing,
): Effect.Effect<boolean> =>
  Effect.gen(function*() {
    if (what.paths.length === 0) return false

    const staged = yield* git(what.root, ["add", "--", ...what.paths])
    if (!staged.ok) {
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: could not stage the write"),
        { said: staged.said },
      )
      return false
    }

    const committed = yield* git(what.root, [
      "commit",
      "--no-verify",
      "-m",
      what.message,
      "--",
      ...what.paths,
    ])
    if (!committed.ok) {
      // The ordinary case is "nothing to commit" — a write that produced the
      // bytes already there. Worth a line in the log, never worth failing.
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: the write was not committed"),
        { commitMessage: what.message, said: committed.said },
      )
      return false
    }
    return true
  })
