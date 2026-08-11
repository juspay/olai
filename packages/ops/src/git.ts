/**
 * Git, as plumbing. Nothing here decides anything.
 *
 * {@link open} is the socket: it answers with a {@link Repo} or with `null` for
 * a directory that is not a work tree, and everything else is a method on it.
 * Three questions and one verb, each a subprocess and each total — whether the
 * repository can take a commit right now, which of the served files are dirty,
 * what HEAD had in one of them, and commit exactly these paths with exactly
 * this message. What those answers MEAN is {@link ./pending.ts}'s.
 *
 * WHERE the directory sits — the git directory, and what the served root is
 * called from the repository root — is asked once, when the handle is opened,
 * and then belongs to the handle. It is git's own business: git speaks
 * repo-relative paths and everything above this file speaks served-root-relative
 * ones, and a consumer that had to carry that around would be a consumer this
 * volatility had leaked into.
 *
 * Two properties are decisions rather than accidents, and both are older than
 * this file's current shape:
 *
 *   - **it cannot fail a write.** A commit runs after the bytes are already on
 *     disk and already on screen, so turning git's refusal into a failed op
 *     would be a lie about what happened. Every outcome — a missing binary, a
 *     non-zero exit, a timeout — comes back as an answer.
 *   - **only the files named**, on both `add` and `commit`. A served directory
 *     is a working tree with other work in it, and a commit that swept up a
 *     half-finished edit somebody had staged would be a far worse failure than
 *     not committing at all.
 *
 * What is NEW here is {@link state}: until a commit was something a person
 * asked for, nothing checked whether the repository was mid-merge, mid-rebase
 * or on a detached HEAD — so an agent marking a node done in the middle of a
 * conflict could swallow the resolution. That hole is what decided manual over
 * automatic, and this is where it is closed.
 *
 * A handle is opened once per round rather than kept, because a directory can
 * become a repository while the server is running — and once per round is what
 * makes a directory with twelve dirty outlines cost one `rev-parse` rather
 * than thirteen.
 */

import type { Reason, RepoState } from "@olai/format"
import { Effect } from "effect"
import { execFile } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"

/** How long git gets. A commit in a notes directory is milliseconds; the
 *  budget is here so a wedged hook or a lock held by another process cannot
 *  hold a caller open forever. */
const BUDGET = 10_000

interface Said {
  readonly ok: boolean
  /** stdout and stderr together, trimmed — what a log line quotes. */
  readonly said: string
  /** stdout, verbatim. Trailing newlines are data when the answer is a list. */
  readonly out: string
}

/** Run git, and answer with whether it worked and what it said. Never fails:
 *  every outcome is an answer the caller decides what to do with. */
const git = (root: string, argv: ReadonlyArray<string>): Effect.Effect<Said> =>
  Effect.callback<Said>((resume) => {
    execFile(
      "git",
      [...argv],
      { cwd: root, timeout: BUDGET, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resume(
          Effect.succeed({
            ok: error === null,
            said: `${stdout}${stderr}`.trim() || (error === null ? "" : error.message),
            out: stdout,
          }),
        )
      },
    )
  })

/**
 * Where the served directory sits in a repository — two answers out of one
 * subprocess, because both are wanted together and each would otherwise be a
 * spawn of its own.
 */
interface Placement {
  readonly gitDir: string
  /** `""` when the served directory IS the repository root, `"docs/"` when it
   *  is a directory inside one. Git's own `--show-prefix` spelling: always
   *  `/`-separated, always with a trailing slash when it is not empty. */
  readonly prefix: string
}

const place = (root: string): Effect.Effect<Placement | null> =>
  Effect.map(
    git(root, [
      "rev-parse",
      "--is-inside-work-tree",
      "--absolute-git-dir",
      "--show-prefix",
    ]),
    ({ ok, out }) => {
      if (!ok) return null
      // Three lines, in the order they were asked for. `--show-prefix` prints
      // an EMPTY line at the repository root, which is why the raw stdout is
      // split rather than the trimmed message.
      const lines = out.split("\n")
      if (lines[0]?.trim() !== "true") return null
      const gitDir = lines[1]?.trim()
      if (gitDir === undefined || gitDir === "") return null
      return { gitDir, prefix: lines[2]?.trim() ?? "" }
    },
  )

/** The files git writes while an operation is half-finished, and what each of
 *  them means. A rebase leaves a detached HEAD behind, so this list is checked
 *  BEFORE the branch is asked for — otherwise every rebase would report as
 *  "detached", which is true and not the useful half. */
const IN_PROGRESS: ReadonlyArray<readonly [string, Reason]> = [
  ["rebase-merge", "rebase"],
  ["rebase-apply", "rebase"],
  ["MERGE_HEAD", "merge"],
  ["CHERRY_PICK_HEAD", "cherry-pick"],
]

/**
 * One repository, as everything above this file needs it.
 *
 * The whole surface, and it is four business verbs rather than the shape of the
 * commands behind them: nothing here says `rev-parse`, and nothing above says
 * it either.
 */
export interface Repo {
  /** Whether it can take a commit right now, and why not when it cannot. */
  readonly state: Effect.Effect<RepoState>
  /** Which served files git thinks have moved, root-relative and in git's own
   *  order. */
  readonly dirty: (keep: (file: string) => boolean) => Effect.Effect<ReadonlyArray<string>>
  /** One served file as HEAD has it, or `null` when HEAD does not. */
  readonly show: (file: string) => Effect.Effect<string | null>
  /** Commit exactly these ABSOLUTE paths with exactly this message. */
  readonly commit: (what: Committing) => Effect.Effect<Done>
}

/** Open the directory as a repository, or answer `null` for one that is not a
 *  work tree — which includes a bare repository: there is nowhere for the files
 *  to be. `null` is not a failure. A served directory is often somebody's
 *  notes under a sync folder, and `git init`-ing it behind their back is not
 *  this program's business. */
export const open = (root: string): Effect.Effect<Repo | null> =>
  Effect.map(place(root), (placed) =>
    placed === null ? null : {
      state: state(root, placed),
      dirty: (keep) => dirty(root, placed, keep),
      show: (file) => show(root, placed, file),
      commit: (what) => commit(root, what),
    })

const state = (
  root: string,
  placed: Placement,
): Effect.Effect<RepoState> =>
  Effect.gen(function*() {
    for (const [file, reason] of IN_PROGRESS) {
      if (fs.existsSync(path.join(placed.gitDir, file))) {
        return {
          _tag: "Blocked",
          reason,
          said: `${file} is present in ${placed.gitDir}`,
        } as const
      }
    }

    // A detached HEAD has no symbolic ref, and git's own refusal is the
    // sentence worth quoting. An UNBORN branch does have one, which is right:
    // a repository with no commits yet is ready to take its first.
    const branch = yield* git(root, ["symbolic-ref", "--short", "HEAD"])
    return branch.ok
      ? ({ _tag: "Ready", branch: branch.said } as const)
      : ({ _tag: "Blocked", reason: "detached", said: branch.said } as const)
  })

/**
 * `--porcelain -z` because the plain form quotes anything unusual and `-z` does
 * not; `-uall` because a brand-new outline is untracked and is exactly what a
 * first commit is for; `-- .` because the served directory may be one directory
 * of a large repository and nothing outside it is olai's to report.
 *
 * A rename arrives as one entry naming both sides, and both are kept: the ids
 * on the old side are what say what left.
 */
const dirty = (
  root: string,
  placed: Placement,
  keep: (file: string) => boolean,
): Effect.Effect<ReadonlyArray<string>> =>
  Effect.gen(function*() {
    const status = yield* git(root, ["status", "--porcelain", "-z", "-uall", "--", "."])
    if (!status.ok) return []

    const found: Array<string> = []
    const take = (repoPath: string): void => {
      if (!repoPath.startsWith(placed.prefix)) return
      const file = repoPath.slice(placed.prefix.length)
      if (file !== "" && keep(file) && !found.includes(file)) found.push(file)
    }

    // `XY <path>\0`, with a second `<path>\0` after a rename or a copy naming
    // where it came from. Read as a stream of NUL-terminated tokens rather
    // than split into lines: a path may contain a newline, which is the whole
    // reason `-z` is asked for.
    const tokens = status.out.split("\0")
    for (let at = 0; at < tokens.length; at++) {
      const entry = tokens[at]
      if (entry === undefined || entry.length < 4) continue
      take(entry.slice(3))
      if (entry[0] === "R" || entry[0] === "C") {
        at += 1
        const from = tokens[at]
        if (from !== undefined && from !== "") take(from)
      }
    }
    return found
  })

/** HEAD's copy covers every file of a repository with no commits yet, and every
 *  file that is new, with the same `null`. */
const show = (
  root: string,
  placed: Placement,
  file: string,
): Effect.Effect<string | null> =>
  Effect.map(
    git(root, ["show", `HEAD:${placed.prefix}${file}`]),
    (shown) => (shown.ok ? shown.out : null),
  )

/** What committing did. Deliberately not `CommitResult`: that one carries a
 *  change count and a repository state, and neither is a thing this file
 *  knows. */
export type Done =
  | { readonly _tag: "Committed"; readonly sha: string }
  | { readonly _tag: "Failed"; readonly said: string }

export interface Committing {
  /** Absolute paths of the files to commit. */
  readonly paths: ReadonlyArray<string>
  /** Subject, body and trailer, whole. The `olai` prefix and the writer
   *  trailer are the caller's to have put on: this file composes nothing. */
  readonly message: string
}

/**
 * Commit exactly these paths, and say what happened.
 *
 * Never `--amend`. Amending rewrites history, which is a trap the moment a
 * commit has been pushed — and an audit trail that can be edited after the
 * fact is not one.
 *
 * `--no-verify` because a served directory's hooks belong to whatever project
 * it is part of: a linter refusing an outline write would leave the bytes on
 * disk and the reason somewhere nobody is looking.
 */
const commit = (root: string, what: Committing): Effect.Effect<Done> =>
  Effect.gen(function*() {
    const staged = yield* git(root, ["add", "--", ...what.paths])
    if (!staged.ok) {
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: could not stage the write"),
        { said: staged.said },
      )
      return { _tag: "Failed", said: staged.said } as const
    }

    const committed = yield* git(root, [
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
        { commitMessage: what.message.split("\n")[0] ?? "", said: committed.said },
      )
      return { _tag: "Failed", said: committed.said } as const
    }

    const head = yield* git(root, ["rev-parse", "HEAD"])
    return { _tag: "Committed", sha: head.ok ? head.said : "" } as const
  })
