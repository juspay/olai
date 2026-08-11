/**
 * The auto-commit, as the store's post-publish hook — and what it has to say
 * for itself.
 *
 * "Git is the only history" (docs/architecture.md), so a write that is not
 * committed is a write with no undo. Every op commits the files it wrote, with
 * the message convention the racket reference used — `capture:` / `done:` /
 * `doing:` / `move:` / `archive:` / `create:` / `see:` and the node's title (or
 * a path, when an outline is born empty) — because a log a person already knows
 * how to read is worth more than a better one they do not.
 *
 * Three properties, and each is a decision rather than an accident:
 *
 *   - **Gated on the directory actually being a work tree.** A served directory
 *     is often somebody's notes under Dropbox, and `git init`-ing it behind
 *     their back is not this program's business. Not a work tree, no commit,
 *     and the op says so in its reply rather than failing.
 *   - **It cannot fail the write.** The bytes are on disk and the browser has
 *     already seen them by the time this runs; turning a git failure into a
 *     failed op would be a lie about what happened. A refusal is reported, not
 *     raised.
 *   - **Only the files this op wrote**, named explicitly on both `add` and
 *     `commit`. A served directory is a working tree with other work in it, and
 *     an op that swept up a half-finished edit somebody had staged would be a
 *     far worse failure than not committing at all.
 *
 * **And it answers with WHY, not just with no.** That is what this module was
 * missing and what the bug was: every cause — not a work tree, no git on the
 * service's PATH, a refused stage, an unset identity — collapsed into one quiet
 * `false`, and git's own words went to the server log, where a person reading a
 * browser will never see them (HACKING.md: never silently ignore errors — most
 * errors should surface to the user at some level in the UX). So the two
 * answers here are VALUES a caller can render: {@link GitState}, what git is
 * doing for this directory at all, and {@link Commitment}, what happened to one
 * write's files. {@link why} is the one sentence either of them owes a reader.
 *
 * Classifying honestly costs two things, and both are deliberate:
 *
 *   - git runs under `LC_ALL=C`, so the one sentence read below is the one git
 *     prints. Nothing else about a commit depends on the locale.
 *   - a commit that failed is asked whether anything was even STAGED before it
 *     is called a failure, because "nothing to commit" — a write that produced
 *     the bytes already there — is an ordinary outcome and not an error. That
 *     is `diff --cached --quiet`'s exit code rather than a second message to
 *     match, and it runs only on the failure path, so the healthy write still
 *     costs exactly two subprocesses.
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

/**
 * What git is doing for the served directory, as a reader is told it.
 *
 * FLAT — a status and the words that go with it — rather than a discriminated
 * union with `said` on one arm, because this value is published: it is the
 * server's git cell, and the cell's schema (`@olai/surface`) is this shape. The
 * two declarations are kept in step by the compiler rather than by hand (the
 * server hands one to the other), which is the whole reason this layer, which
 * knows nothing about a wire, may still declare a value that travels on one.
 *
 *   - `off` — this serve was started with `--no-commit`. An owner's choice, not
 *     an error, and nothing about it is worth showing anyone.
 *   - `repo` — a work tree, and writes are being committed. The healthy default.
 *   - `none` — not a work tree (or a bare repository, where the files have
 *     nowhere to be). Informational: plenty of directories are not repositories.
 *   - `error` — git tried and could not, and `said` is its own words. This is
 *     the state that used to be indistinguishable from `none`.
 */
export interface GitState {
  readonly status: "off" | "repo" | "none" | "error"
  /** What git said, for the state that has something to quote. `null`
   *  otherwise — a healthy repository is not quoting anything. */
  readonly said: string | null
}

/** The opt-out, which is the one state git is never asked about — so it is the
 *  caller's to raise, and the only constant here that leaves this file. */
export const OFF: GitState = { status: "off", said: null }
export const errorState = (said: string): GitState => ({ status: "error", said })

const REPO: GitState = { status: "repo", said: null }
const NONE: GitState = { status: "none", said: null }

/**
 * What happened to one write's files.
 *
 *   - `committed` — it is in the history.
 *   - `nothing` — git had nothing to record: the write produced the bytes that
 *     were already there. Not a failure, and it must not be drawn as one.
 *   - `refused` — git tried and would not, with its own words.
 */
export type Commitment =
  | { readonly kind: "committed" }
  | { readonly kind: "nothing" }
  | { readonly kind: "refused"; readonly said: string }

const COMMITTED: Commitment = { kind: "committed" }
const NOTHING: Commitment = { kind: "nothing" }

/**
 * Why a write was not committed, in one sentence, or `undefined` when it was.
 *
 * ONE table for both answers above, because a reader looking at
 * `committed: false` asks one question and does not care which half of this
 * module knows the answer. It is prose on purpose: this rides the op's reply to
 * an agent and to the panel that draws it, where the structured half is the
 * `committed` boolean that is already there.
 */
export const why = (outcome: GitState | Commitment): string | undefined => {
  if ("status" in outcome) {
    switch (outcome.status) {
      case "off":
        return "this directory is served with --no-commit, so writes are not committed"
      case "none":
        return "the served directory is not a git work tree, so there is nothing to commit to"
      case "error":
        return `git could not be asked about this directory: ${outcome.said ?? ""}`.trim()
      case "repo":
        return undefined
    }
  }
  switch (outcome.kind) {
    case "committed":
      return undefined
    case "nothing":
      return "git had nothing to commit — the write produced the bytes that were already there"
    case "refused":
      return `git refused the commit: ${outcome.said}`
  }
}

/** How long git gets. A commit in a notes directory is milliseconds; the
 *  budget is here so a wedged hook or a lock held by another process cannot
 *  hold the write gate open forever. */
const BUDGET = 10_000

/** One run of git: whether it worked, what it said, and the exit code when
 *  there was one (`null` when the process could not be started at all, which is
 *  the missing-binary case). */
interface Ran {
  readonly ok: boolean
  readonly said: string
  readonly code: number | null
}

/** Run git, and answer with whether it worked and what it said. Never fails:
 *  every outcome — a missing binary, a non-zero exit, a timeout — is an answer
 *  the caller decides what to do with. */
const git = (
  root: string,
  argv: ReadonlyArray<string>,
): Effect.Effect<Ran> =>
  Effect.callback<Ran>((resume) => {
    execFile(
      "git",
      [...argv],
      {
        cwd: root,
        timeout: BUDGET,
        encoding: "utf8",
        // `LC_ALL=C` so git's own sentences are the ones {@link NOT_A_REPO}
        // reads. `GIT_TERMINAL_PROMPT=0` so a repository that wants a
        // credential fails instead of sitting on a prompt nobody can answer —
        // this runs inside the store's write gate.
        env: { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" },
      },
      (error, stdout, stderr) => {
        const code = (error as { readonly code?: unknown } | null)?.code
        resume(
          Effect.succeed({
            ok: error === null,
            said: `${stdout}${stderr}`.trim() ||
              (error === null ? "" : error.message),
            code: error === null ? 0 : typeof code === "number" ? code : null,
          }),
        )
      },
    )
  })

/** git's own answer for "there is no repository here", pinned to English by the
 *  `LC_ALL=C` above. Matched rather than inferred from the exit code because
 *  128 is also what a repository git REFUSES to use answers with — dubious
 *  ownership is the one people actually hit — and calling that "not a git
 *  repo" is exactly the collapse this module exists to stop. Anything
 *  unrecognised is reported as an error, which is the safe direction. */
const NOT_A_REPO = /not a git repository/i

/**
 * What git makes of this directory: a work tree, no work tree, or trouble.
 *
 * A bare repository answers `false` and is `none`: there is nowhere for the
 * files to be. This replaced an `isWorkTree` returning a boolean, which had to
 * answer `false` for a git that could not be run at all — the same word for
 * "your notes are not a repository" and "this service has no git on its PATH".
 */
export const probe = (root: string): Effect.Effect<GitState> =>
  Effect.map(git(root, ["rev-parse", "--is-inside-work-tree"]), (ran) => {
    if (ran.ok) return ran.said === "true" ? REPO : NONE
    return NOT_A_REPO.test(ran.said) ? NONE : errorState(ran.said)
  })

/**
 * Commit the files a write produced.
 *
 * The caller has already established that there IS a repository — that answer
 * is a property of the root, so it is asked once rather than spawning a
 * `rev-parse` inside the store's write gate on every op.
 *
 * Answers with WHICH of the three things happened, because they are three
 * different pieces of news: a commit, a write that had nothing to record, and a
 * git that refused. The last used to be the second, and a person watching an
 * agent write to a repository could not tell which they were looking at.
 */
export const commit = (
  what: Committing,
): Effect.Effect<Commitment> =>
  Effect.gen(function*() {
    if (what.paths.length === 0) return NOTHING

    const staged = yield* git(what.root, ["add", "--", ...what.paths])
    if (!staged.ok) {
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: could not stage the write"),
        { said: staged.said },
      )
      return { kind: "refused", said: staged.said }
    }

    const committed = yield* git(what.root, [
      "commit",
      "--no-verify",
      "-m",
      what.message,
      "--",
      ...what.paths,
    ])
    if (committed.ok) return COMMITTED

    // Was there anything to commit? The index is still staged after a failed
    // commit, so git's own exit code answers it: `--quiet` exits 0 when the
    // staged tree matches HEAD, 1 when it does not. Nothing staged is the
    // ordinary "the write produced the bytes already there"; anything else is
    // a refusal, and the identity nobody set is the one people hit.
    const pending = yield* git(what.root, [
      "diff",
      "--cached",
      "--quiet",
      "--",
      ...what.paths,
    ])
    if (pending.ok) {
      yield* Effect.annotateLogs(
        Effect.logDebug("olai git: nothing to commit"),
        { commitMessage: what.message, said: committed.said },
      )
      return NOTHING
    }

    yield* Effect.annotateLogs(
      Effect.logWarning("olai git: the write was not committed"),
      { commitMessage: what.message, said: committed.said },
    )
    return { kind: "refused", said: committed.said }
  })
