/**
 * Git, as plumbing. Nothing here decides anything.
 *
 * {@link open} is the socket: it answers with an {@link Opening} — a
 * {@link Repo}, a directory that is not a work tree, or a git that could not be
 * asked — and everything else is a method on the handle. SIX questions and
 * FOUR verbs, each a subprocess and each total: whether the repository can take
 * a commit right now, what has moved in it and how far ahead of its upstream it
 * is, which commit HEAD names, what THAT commit had in one of the repository's
 * files, what was last recorded under a caller's own audit filter, and where
 * the branch stands against the upstream AFTER the fetch — then commit exactly
 * these paths with exactly this message, fetch the upstream bare, integrate it
 * (rebase the unpushed commits onto it, in a worktree of olai's own, and move
 * the served tree), and push the current branch. What those answers MEAN is
 * this plugin's `ledger/pending.ts`.
 *
 * THE INTEGRATION is {@link Repo.integrate}, and it is the one verb this file
 * does not own end to end: it moves a ref and a working tree together, which
 * no other verb here has had to do. The shape of the MOVE is the shape of
 * {@link commit}'s — one uninterruptible region, a disposition on every exit —
 * and everything a policy needs to know comes back as an {@link Integrated}
 * arm: it happened, an uncommitted edit or an untracked file overlapped a path
 * the upstream changed (nothing moved), the rebase conflicted (nothing moved),
 * or it could not run at all. What those arms MEAN is the caller's.
 *
 * The FIFTH question is the newest, and it is one question split in two on
 * purpose (`perf-git-per-write`): a caller that reads a file out of history
 * and keeps what it read is keeping it about a COMMIT, so this socket hands
 * out the commit's name and takes it back rather than spelling `HEAD` inside
 * the command. `HEAD:<path>` is a question whose answer moves; `<sha>:<path>`
 * is a question about an object git has already frozen.
 *
 * The THIRD arm is what `git-invisible` (#108) bought and what this file must
 * not give back. "Your notes are not a repository" and "this service has no git
 * on its PATH" are two different pieces of news, and a socket answering `null`
 * for both is exactly the collapse that left a person staring at a
 * `committed: false` with nowhere to read why.
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
 * {@link open} itself is cheap and not a cache — a directory can become a
 * repository while the server is running, and a handle kept for life would
 * miss that. The ops layer memoizes a positive answer; this file does not
 * rely on that. The subprocess is `@olai/child`'s — git's residue on top is
 * its env (`LC_ALL=C`, `GIT_TERMINAL_PROMPT=0`), that a hang is an answer
 * rather than a throw, and the index gate, which is the caller's (#360), not
 * the socket's. What IS keyed for the life of the process is that gate:
 * `git status` refreshes the index and `git commit` writes it, and two fibers
 * doing both lose to `index.lock`. The permit is per `gitDir`, not per
 * handle, so a second {@link open} of the same repository cannot disarm it.
 * Only the index TOUCHERS take it ({@link dirty}, {@link commit} and
 * {@link integrate}, whose move spans `read-tree` and `update-ref`). `fetch`
 * and `push` are network verbs with the ten-second budget, and `whyWaiting`
 * must not queue behind them; git's own ref lockfiles cover `commit` vs
 * `push` on the refs. `state` / `standing` / `last` / `head` / `show` do not
 * touch the index.
 */

import { Hung, run } from "@olai/child"
import { Effect, Semaphore } from "effect"
import * as fs from "node:fs"
import { join, resolve } from "node:path"

import type { How, Reason, RepoState } from "@olai/format"

/** How long git gets. A commit in a notes directory is milliseconds; the
 *  budget is here so a wedged hook or a lock held by another process cannot
 *  hold a caller open forever. */
const BUDGET = 10_000

/**
 * The INDEX GATE: one permit per git directory, held by {@link dirty} and
 * {@link commit} only. See the file header. Keyed on `gitDir` so two handles
 * of one repository share it; a handle-local semaphore would re-open the
 * `index.lock` race the moment anyone called {@link open} twice.
 */
const indexGates = new Map<string, Semaphore.Semaphore>()

const indexGate = (gitDir: string): Semaphore.Semaphore => {
  const had = indexGates.get(gitDir)
  if (had !== undefined) return had
  const made = Semaphore.makeUnsafe(1)
  indexGates.set(gitDir, made)
  return made
}

const holdIndex = <A, E, R>(
  gitDir: string,
  op: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => indexGate(gitDir).withPermit(op)

interface Said {
  readonly ok: boolean
  /** stdout and stderr together, trimmed — what a log line quotes. */
  readonly said: string
  /** stdout, verbatim. Trailing newlines are data when the answer is a list. */
  readonly out: string
  /** GIT NEVER ANSWERED, as opposed to answering no. Both are `ok: false`,
   *  and for every caller but one that is the right collapse — a wedged hook
   *  and a refusal are equally "the write did not go through". {@link commit}
   *  is the exception: it has a backup to dispose of, and "git refused" and
   *  "git was killed at the budget, possibly after moving HEAD" want opposite
   *  answers. See its `hung` arm. */
  readonly hung?: true
}

/** Run git, and answer with whether it worked and what it said. Never fails:
 *  every outcome is an answer the caller decides what to do with. The
 *  subprocess is `@olai/child`'s; the residue on top is git's own env
 *  (`LC_ALL=C`, `GIT_TERMINAL_PROMPT=0`) and that a hang is an answer rather
 *  than a throw — a wedged hook cannot fail a write that has already landed. */
const git = (root: string, argv: ReadonlyArray<string>): Effect.Effect<Said> =>
  Effect.promise(async () => {
    try {
      const result = await run("git", [...argv], {
        cwd: root,
        timeout: BUDGET,
        maxBuffer: 32 * 1024 * 1024,
        // `LC_ALL=C` so git's own sentences are the ones {@link NOT_A_REPO}
        // reads — the classification below is a string match, and a translated
        // git would be reported as unusable rather than as no repository.
        // `GIT_TERMINAL_PROMPT=0` so a repository that wants a credential fails
        // instead of sitting on a prompt nobody can answer.
        env: { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" },
      })
      return { ok: result.ok, said: result.said, out: result.out }
    } catch (cause) {
      if (!(cause instanceof Hung)) throw cause
      return { ok: false, said: cause.message, out: cause.out, hung: true }
    }
  })

/**
 * Where the served directory sits in a repository — two answers out of one
 * subprocess, because both are wanted together and each would otherwise be a
 * spawn of its own, plus a third climbed from them ({@link topOf}).
 */
interface Placement {
  readonly gitDir: string
  /** `""` when the served directory IS the repository root, `"docs/"` when it
   *  is a directory inside one. Git's own `--show-prefix` spelling: always
   *  `/`-separated, always with a trailing slash when it is not empty. */
  readonly prefix: string
  /** The repository root, absolute. What turns a path git printed into a path
   *  a caller can hand back to {@link commit} — which is the whole reason the
   *  arithmetic lives on this side of the socket. */
  readonly top: string
}

/** git's own answer for "there is no repository here", pinned to English by the
 *  `LC_ALL=C` the runner sets. Matched rather than inferred from the exit code
 *  because 128 is also what a repository git REFUSES to use answers with —
 *  dubious ownership is the one people actually hit — and calling that "not a
 *  git repo" is exactly the collapse #108 exists to stop. Anything unrecognised
 *  is reported as unusable, which is the safe direction. */
const NOT_A_REPO = /not a git repository/i

/** Where {@link place} got to. The public {@link Opening} is this with the
 *  placement swapped for the handle built from it. */
type Placing =
  | { readonly _tag: "Placed"; readonly placement: Placement }
  | { readonly _tag: "NoRepo" }
  | { readonly _tag: "Unusable"; readonly said: string }

const NO_REPO = { _tag: "NoRepo" } as const

const place = (root: string): Effect.Effect<Placing> =>
  Effect.map(
    git(root, [
      "rev-parse",
      "--is-inside-work-tree",
      "--absolute-git-dir",
      "--show-prefix",
    ]),
    ({ ok, out, said }) => {
      if (!ok) {
        return NOT_A_REPO.test(said)
          ? NO_REPO
          : ({ _tag: "Unusable", said } as const)
      }
      // Three lines, in the order they were asked for. `--show-prefix` prints
      // an EMPTY line at the repository root, which is why the raw stdout is
      // split rather than the trimmed message.
      const lines = out.split("\n")
      // A bare repository answers `false`: there is nowhere for the files to be.
      if (lines[0]?.trim() !== "true") return NO_REPO
      const gitDir = lines[1]?.trim()
      if (gitDir === undefined || gitDir === "") return NO_REPO
      const prefix = lines[2]?.trim() ?? ""
      return {
        _tag: "Placed",
        placement: { gitDir, prefix, top: topOf(root, prefix) },
      } as const
    },
  )

/**
 * The repository root, from the served root and how far down it sits.
 *
 * Climbed rather than asked for, and both halves of that are deliberate. Git
 * would answer it (`--show-toplevel`), but a BARE repository makes that whole
 * `rev-parse` fail — "this operation must be run in a work tree" — and a failed
 * call is read as `Unusable`, which would report somebody's bare clone as a
 * broken git rather than as the "nowhere for the files to be" it is.
 *
 * Climbing is also the more useful answer: it is built out of the caller's own
 * root, so an absolute path this file hands back and one the caller resolves
 * for itself are the same string, symlinks and all. Asking git would have
 * produced its realpath, and two spellings of one file is exactly the kind of
 * thing that fails only on somebody's machine.
 */
const topOf = (root: string, prefix: string): string =>
  prefix === ""
    ? root
    : resolve(root, prefix.split("/").filter((step) => step !== "").map(() => "..").join("/"))

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
  /** Where the served directory sits from the repository root: `""` when it IS
   *  the root, `"docs/"` when it is a directory inside one. A PROPERTY rather
   *  than a verb — it was asked once, when the handle opened, and a caller that
   *  reports on the whole repository has to be able to say which part of it
   *  olai is actually serving. */
  readonly served: string
  /** Whether it can take a commit right now, and why not when it cannot. */
  readonly state: Effect.Effect<RepoState>
  /** Every file in the REPOSITORY git thinks has moved, in git's own order,
   *  and how far ahead of its upstream the branch is. Every one of them: WHICH
   *  of those matter is a statement about the format, and this file has none of
   *  that in it. */
  readonly dirty: Effect.Effect<Dirt>
  /** Which commit HEAD names, or `null` where it names none — a branch with no
   *  commits yet, a git that could not answer.
   *
   *  What a caller that means to REMEMBER anything it read out of history has to
   *  have: an answer about a NAMED COMMIT stays true forever, and an answer
   *  about `HEAD` stops being true the moment somebody commits. */
  readonly head: Effect.Effect<string | null>
  /** One file of the REPOSITORY as a NAMED COMMIT has it — named the way
   *  {@link Dirty} names it, repo-root-relative — in the three arms of
   *  {@link Shown}.
   *
   *  The COMMIT is the caller's word rather than `HEAD` spelled in here, and
   *  that is the whole of `perf-git-per-write`: `HEAD:<path>` is a question
   *  whose answer moves under a caller that keeps it, and `<sha>:<path>` is a
   *  question about an object git has already made immutable — so the answer can
   *  be remembered under the name it was asked about and cannot go stale.
   *  {@link Repo.head}'s answer is what used to be meant. */
  readonly show: (commit: string, path: string) => Effect.Effect<Shown>
  /** The last commit the caller's own audit filter claims, or `null` for a
   *  repository that has none.
   *
   *  `--grep` does the filtering in git rather than here, so a repository with
   *  a hundred thousand of somebody else's commits still costs one walk. */
  readonly last: (audit: Audit) => Effect.Effect<Recorded | null>
  /** Commit exactly these ABSOLUTE paths with exactly this message. */
  readonly commit: (what: CommitInput) => Effect.Effect<Done>
  /** Fetch the current branch's upstream, bare — the only fetch this file ever
   *  makes, and the one that makes {@link Repo.standing}'s `behind` readable. */
  readonly fetch: Effect.Effect<Fetched>
  /** Where the branch stands against the upstream it tracks, or `null` when it
   *  tracks nothing. FRESH counts, never `git status`'s: `behind` is stale
   *  until a fetch, and the fetch happens on the push path only. */
  readonly standing: Effect.Effect<Standing | null>
  /** Take in {@link Standing} — rebase the unpushed commits onto the upstream
   *  in a worktree of olai's own, then move the served tree onto the result —
   *  and say what happened. */
  readonly integrate: (onto: Standing) => Effect.Effect<Integrated>
  /** Send the current branch to its upstream, and say what git said. */
  readonly push: Effect.Effect<Sent>
}

/**
 * What opening a directory found.
 *
 * THREE arms, not two, and the third is the whole of #108: `NoRepo` is a
 * statement about the directory — a served directory is often somebody's notes
 * under a sync folder, and `git init`-ing it behind their back is not this
 * program's business — while `Unusable` is a statement about git, which ran and
 * could not answer. Neither is a failure of this effect; both are answers.
 */
export type Opening =
  | { readonly _tag: "Opened"; readonly repo: Repo }
  | { readonly _tag: "NoRepo" }
  | { readonly _tag: "Unusable"; readonly said: string }

export const open = (root: string): Effect.Effect<Opening> =>
  Effect.map(place(root), (placing) => {
    if (placing._tag !== "Placed") return placing
    const gitDir = placing.placement.gitDir
    return {
      _tag: "Opened" as const,
      repo: {
        served: placing.placement.prefix,
        state: state(root, placing.placement),
        dirty: holdIndex(gitDir, dirty(root, placing.placement)),
        head: head(root),
        show: (commit: string, path: string) => show(root, commit, path),
        last: (audit: Audit) => last(root, audit),
        commit: (what: CommitInput) =>
          holdIndex(gitDir, commit(root, placing.placement, what)),
        // NOT on the index gate, and deliberately: fetch is a network verb
        // with the ten-second budget, and `integrate` decides its own gate
        // where the move is made. `whyWaiting` must never queue behind either.
        fetch: fetch(root),
        standing: standing(root),
        integrate: (onto: Standing) =>
          integrate(root, placing.placement, onto),
        push: push(root),
      },
    }
  })

const state = (
  root: string,
  placed: Placement,
): Effect.Effect<RepoState> =>
  Effect.gen(function*() {
    // ONE directory read rather than a stat per marker: they all live at the
    // top of the git directory, and this runs on every revision and every
    // sweep.
    const inGitDir = new Set(
      fs.existsSync(placed.gitDir) ? fs.readdirSync(placed.gitDir) : [],
    )
    for (const [file, reason] of IN_PROGRESS) {
      if (inGitDir.has(file)) {
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
 * One path, in the three spellings its three readers need.
 *
 * Three, deliberately, and it is the same argument the placement itself makes:
 * git speaks repo-relative paths, a served set is keyed by served-relative
 * ones, and a commit takes absolute ones — so a consumer holding any one of
 * them would be a consumer doing this arithmetic, with the prefix carried
 * around to do it with. It is done once, here, where the placement lives.
 *
 * Its own shape rather than three fields on {@link Dirty}, because a rename has
 * TWO paths and each needs all three: the side that arrived and the side that
 * left are spelled the same way, and a second set of flattened fields would be
 * this arithmetic written out twice.
 */
export interface Spelled {
  /** Repo-root-relative, which is what git printed: what a reader is SHOWN,
   *  and the one unambiguous name for a file across a whole repository. */
  readonly path: string
  /** Served-root-relative, or `null` for a file OUTSIDE the served directory.
   *  The `null` is the whole of what "whole repository" costs a caller: it
   *  says this file is dirty and olai does not serve it, so nothing above can
   *  have anything to say about its contents. */
  readonly served: string | null
  /** Absolute — what {@link commit} takes. */
  readonly at: string
}

/** One file that has moved, and — for a rename — the side it moved from. */
export interface Dirty extends Spelled {
  readonly how: How
  /**
   * Where a `renamed` file CAME FROM, in the same three spellings — `null` for
   * every other kind of entry.
   *
   * A rename is ONE thing that happened, and git prints both halves of it on
   * one line. It used to be split into two entries here — a `renamed` arrival
   * and a `deleted` departure with nothing joining them — and every reader
   * above had to guess they belonged together, which none of them did: one
   * drew the departure as a file about to be deleted, and one committed the
   * arrival on its own and left the other half staged.
   *
   * The departing side is NOT also a top-level entry, deliberately. It is not a
   * file waiting to be committed; it is half of this one.
   *
   * A COPY IS NOT A RENAME and does not fill this in, which is the difference
   * between a source that has LEFT and one that is still sitting there. Git can
   * be configured to detect copies (`status.renames=copies`), and it then prints
   * `C dest\0src` for a file that was copied — but `src` is untouched by that
   * act, so there is nothing about it to report and nothing of it to commit.
   * Folding it in here did both: it hid a staged edit to `src` when the porcelain
   * happened to print the copy first, and it put `src` on the pathspec of any
   * commit that ticked the copy, which would have swept that edit in unasked.
   */
  readonly from: Spelled | null
}

/** Where the branch stands against the branch it tracks. `null` when there is
 *  no upstream at all, which is a different fact from "nothing to push" and is
 *  kept apart from it: a branch nobody has ever pushed has nowhere to go, and
 *  offering to push it would be offering to guess a remote. */
export interface Upstream {
  /** Git's own name for it — `origin/master`. */
  readonly name: string
  /** Commits on this branch that the upstream does not have. */
  readonly ahead: number
}

/**
 * What one look at the working tree found — two answers out of one subprocess,
 * exactly as {@link place} takes three, and for the same reason: both are
 * wanted together by the one caller that asks, and asking separately would be a
 * second spawn per sweep for a question `--branch` answers on the line it is
 * already printing.
 *
 * TWO ARMS, and the second is the same rule the socket itself follows: a status
 * git REFUSED is not an empty one. It used to answer with no files and no
 * upstream, which reads as a clean tree — so a repository that had become
 * unreadable under a running server drew `✓ committed` and hid the unpushed
 * line, which is precisely the silence #108 was filed for, one call over. Git's
 * own words come back instead, for the caller to publish.
 */
export type Dirt =
  | {
    readonly _tag: "Surveyed"
    readonly files: ReadonlyArray<Dirty>
    readonly upstream: Upstream | null
  }
  | { readonly _tag: "Unusable"; readonly said: string }

/**
 * `--porcelain -z` because the plain form quotes anything unusual and `-z` does
 * not; `-uall` because a brand-new outline is untracked and is exactly what a
 * first commit is for; `--branch` for the header line that says where the
 * branch stands against its upstream.
 *
 * NO PATHSPEC, which is the change `commit-whole-repo` is: it used to ask about
 * `.` — the served directory — and a person who edited a `README.md` one level
 * up was told nothing was waiting. Olai reports on the repository it is in, and
 * says which part of it it serves ({@link Repo.served}).
 *
 * `status.relativePaths=false` is pinned rather than assumed: the parsing below
 * strips the served prefix off what git printed, which is only right while git
 * prints repo-relative paths. It is the porcelain default, and a reader's
 * config is not something to be at the mercy of.
 *
 * A rename arrives as ONE entry naming both sides, and it stays one: the
 * departing side rides on {@link Dirty.from} rather than becoming a second
 * entry of its own. Both facts about it are wanted by the readers above — the
 * ids on the old side are what say what left, and both paths have to be named
 * on the commit for the rename to land as one — and neither of them is "there
 * is a file here waiting to be deleted", which is what a second entry said.
 */
const dirty = (
  root: string,
  placed: Placement,
): Effect.Effect<Dirt> =>
  Effect.gen(function*() {
    const status = yield* git(root, [
      "-c",
      "status.relativePaths=false",
      "status",
      "--porcelain",
      "-z",
      "-uall",
      "--branch",
    ])
    if (!status.ok) return { _tag: "Unusable", said: status.said } as const

    const files: Array<Dirty> = []
    const seen = new Set<string>()
    const spell = (path: string): Spelled => ({
      path,
      served: path.startsWith(placed.prefix)
        ? path.slice(placed.prefix.length)
        : null,
      at: join(placed.top, path),
    })
    const take = (path: string, how: How, from: string | undefined): void => {
      // The departing side of a rename is accounted for by THIS entry, so a
      // later token naming it cannot become a row of its own. Marked BEFORE the
      // duplicate check rather than after: a stream that named this destination
      // twice would otherwise leave the second entry's source unclaimed, which
      // is the one way a departure could still come back as a row of its own.
      if (from !== undefined && from !== "") seen.add(from)
      if (path === "" || seen.has(path)) return
      seen.add(path)
      files.push({
        ...spell(path),
        how,
        from: from === undefined || from === "" ? null : spell(from),
      })
    }

    // `XY <path>\0`, with a second `<path>\0` after a rename or a copy naming
    // where it came from, and `## …\0` first because `--branch` was asked for.
    // Read as a stream of NUL-terminated tokens rather than split into lines: a
    // path may contain a newline, which is the whole reason `-z` is asked for.
    let upstream: Upstream | null = null
    const tokens = status.out.split("\0")
    for (let at = 0; at < tokens.length; at++) {
      const entry = tokens[at]
      if (entry === undefined) continue
      if (entry.startsWith("## ")) {
        upstream = tracking(entry.slice(3))
        continue
      }
      if (entry.length < 4) continue
      const how = howOf(entry[0] ?? " ", entry[1] ?? " ")
      // A rename or a copy is followed by a SECOND token naming where it came
      // from. BOTH consume it — the cursor has to move either way or every
      // entry after this one is read as a path — and only a RENAME keeps it:
      // see {@link Dirty.from} for why a copy's source is somebody else's row.
      // Taken off the stream here rather than inside {@link take}, so an entry
      // that returns early still leaves the cursor past the token it owns.
      const paired = entry[0] === "R" || entry[0] === "C"
      const other = paired ? tokens[++at] : undefined
      take(entry.slice(3), how, entry[0] === "R" ? other : undefined)
    }
    return { _tag: "Surveyed", files, upstream } as const
  })

/**
 * The porcelain letters, read.
 *
 * X is the index and Y is the work tree, and this collapses them ON PURPOSE:
 * olai never touches the index, so "added in the index, modified since" is one
 * file that is new as far as anything here is concerned. The order is what a
 * reader is best served by — a new file is NEW even after it was edited again,
 * and a file that has left says so ahead of whatever it was doing before.
 */
const howOf = (x: string, y: string): How => {
  if (x === "?") return "untracked"
  if (x === "R" || y === "R") return "renamed"
  if (x === "A" || y === "A" || x === "C" || y === "C") return "added"
  if (x === "D" || y === "D") return "deleted"
  return "modified"
}

/**
 * The `--branch` header, read: `main...origin/main [ahead 2, behind 1]`.
 *
 * `null` for every shape that has no upstream in it — a branch nobody has
 * pushed (`## main`), a detached HEAD (`## HEAD (no branch)`), a repository
 * with no commits yet. BEHIND is deliberately not reported: what to do about a
 * divergence is a conversation with a person in a terminal, and this program
 * has one verb.
 */
const tracking = (header: string): Upstream | null => {
  const [, tracked] = header.split("...")
  if (tracked === undefined) return null
  const name = tracked.split(" [")[0]?.trim() ?? ""
  if (name === "") return null
  const ahead = /\bahead (\d+)/.exec(tracked)
  return { name, ahead: ahead === null ? 0 : Number(ahead[1]) }
}

/**
 * WHICH COMMIT, before anything is asked about one.
 *
 * `--verify` because the answer has to be one object or none: a branch with no
 * commits yet, and a git that could not be asked at all, are the same `null`
 * here — and they are the same answer one call down too, since a commit that
 * cannot be named holds no copy of anything. Classifying them apart would be a
 * distinction no caller of this file can act on.
 *
 * A DETACHED HEAD answers with the commit it is sitting on, which is right and
 * is why this is not `symbolic-ref`: what {@link show} needs is the object,
 * and a rebase's detached head has one like any other.
 */
const head = (root: string): Effect.Effect<string | null> =>
  Effect.map(
    git(root, ["rev-parse", "--verify", "HEAD"]),
    (said) => (said.ok ? said.out.trim() : null),
  )

/**
 * What one file of one commit came back as.
 *
 * THREE ARMS, not two, and the third is {@link Dirt}'s reason one call over: a
 * `show` git REFUSED is not a commit that does not have the file. They used to
 * be one `null` — every non-zero exit folded together — and a caller cannot
 * tell them apart from that: "this commit does not have that path" means every
 * node in the working copy is NEW, while "git could not answer" means nothing
 * can be said about the file at all. Reporting the second as the first is a
 * screen of alarming rows with one real cause, which is the same collapse
 * `git-invisible` (#108) closed at the socket.
 *
 * It matters more than it used to because an answer here is REMEMBERED
 * (`@olai/ops`' `committed.ts`): a bitten budget or a stream past the buffer
 * used to cost one bad revision and now would cost every revision until HEAD
 * moved. Which arm a caller may keep is the caller's decision and the reason
 * this is three values rather than a string and a boolean.
 */
export type Shown =
  | { readonly _tag: "Text"; readonly text: string }
  /** The commit does not have that path — git said so, in as many words. */
  | { readonly _tag: "Absent" }
  /** git ran and could not answer, with what it said. */
  | { readonly _tag: "Unusable"; readonly said: string }

const ABSENT = { _tag: "Absent" } as const

/**
 * git's own words for "that commit does not have that path", both of the
 * spellings it has.
 *
 * MATCHED rather than inferred from the exit code, for {@link NOT_A_REPO}'s
 * reason and pinned to English by the same `LC_ALL=C`: 128 is also what an
 * invalid revision, a repository git refuses to use and a hook that wrote to
 * stderr answer with, and calling any of those "the file is new" is exactly the
 * collapse {@link Shown} exists to stop. Anything unrecognised is `Unusable`,
 * which is the safe direction — a caller declines to remember it and asks
 * again, where the other mistake is silent and lasts a generation.
 *
 * The path itself is not matched across a newline (`.` does not), so a file
 * whose name contains one falls through to `Unusable`: an answer nobody keeps,
 * asked again next revision, rather than a wrong one kept.
 */
const NOT_IN_COMMIT = /^fatal: path .*(?:does not exist in|exists on disk, but not in) '/m

/**
 * A commit's copy of one file.
 *
 * REPO-ROOT-RELATIVE, which is the spelling {@link Dirty} hands out and the one
 * name a file has that is the same wherever olai is serving from. It took the
 * SERVED spelling and prefixed it, which is the same string for everything
 * under the served root and unable to name anything above it — so a rename INTO
 * a served subdirectory (`git mv Notes.md docs/Notes.olai`) had no way to ask
 * for the side it came from, and the caller fell back to asking for a name HEAD
 * has never had. `<commit>:<path>` is repo-root-relative in git's own object
 * syntax whatever directory it runs in, so this is a prefix that had nothing to
 * do.
 *
 * THE COMMIT IS A PARAMETER, and the reason is the one {@link Repo.show} gives:
 * a caller that remembers what came back is remembering it about a commit, and
 * `HEAD` is the one name that does not stay put. It reads the OBJECT STORE and
 * neither the index nor the working tree, which is why a `git add` or a
 * `git checkout <sha> -- <file>` cannot change what it answers.
 */
const show = (
  root: string,
  commit: string,
  path: string,
): Effect.Effect<Shown> =>
  Effect.map(git(root, ["show", `${commit}:${path}`]), (shown) => {
    if (shown.ok) return { _tag: "Text", text: shown.out } as const
    return NOT_IN_COMMIT.test(shown.said)
      ? ABSENT
      : ({ _tag: "Unusable", said: shown.said } as const)
  })

/**
 * How a caller recognises its OWN commits in somebody's repository.
 *
 * Both halves are the caller's vocabulary rather than this file's: that olai
 * prefixes every subject with `olai` and signs it `X-Olai-Writer` is a
 * statement about how olai writes commits, and it lives beside the composer
 * that writes them (`@olai/ops`' `message.ts`). Handed in, this package stays
 * a git that can be pointed at any convention.
 */
export interface Audit {
  /** What the subject starts with. Filtered by git itself, so a repository
   *  full of somebody else's commits still costs one walk. */
  readonly prefix: string
  /** The trailer key that names who asked. */
  readonly trailer: string
}

/** One commit, as this file can read one back.
 *
 *  The trailer arrives RAW — the string `git log` printed, `""` for a commit
 *  carrying none — because what the values of that trailer are is a statement
 *  about who writes commits here, and this file has none of that in it. The
 *  caller classifies (`@olai/ops`' `pending.ts`). */
export interface Recorded {
  readonly sha: string
  /** The subject line. */
  readonly message: string
  /** ISO 8601, author date. */
  readonly at: string
  /** The `X-Olai-Writer` trailer's value, verbatim, or `""`. */
  readonly trailer: string
}

/**
 * The last commit somebody's prefix claims, as HEAD seen through that filter.
 *
 * `--grep` does the filtering in git rather than here, so a repository with a
 * hundred thousand of somebody else's commits still costs one walk that stops
 * at the first match. The four fields come back NUL-separated because a subject
 * may contain anything a person can type, a newline included.
 *
 * The prefix is the caller's, not this file's: what olai's commits look like is
 * a statement about how olai writes them, and it lives beside the composer.
 *
 * WHOLE REPOSITORY, and it used to be `-- .`. The old restriction said an olai
 * serving `docs/` should not report a commit made elsewhere in the same
 * repository — and that reasoning INVERTED the moment a commit could sweep the
 * whole tree: a commit that recorded a dirty root `README.md` and nothing under
 * `docs/` is olai's own work, and hiding it would leave the panel saying
 * nothing was ever recorded here a second after it recorded something.
 */
const last = (
  root: string,
  audit: Audit,
): Effect.Effect<Recorded | null> =>
  Effect.map(
    git(root, [
      "log",
      "-1",
      `--grep=^${audit.prefix}`,
      `--format=%H%x00%s%x00%aI%x00%(trailers:key=${audit.trailer},valueonly)`,
    ]),
    ({ ok, out }) => {
      if (!ok) return null
      const [sha, message, at, writer] = out.split("\0")
      if (sha === undefined || sha.trim() === "") return null
      return {
        sha: sha.trim(),
        message: message ?? "",
        at: at ?? "",
        // Whatever the trailer said, including nothing. A commit carrying the
        // prefix but no trailer is not a lie to correct — it is a commit whose
        // writer nothing recorded — and WHICH strings are writers is the
        // caller's vocabulary, not this file's.
        trailer: writer?.trim() ?? "",
      }
    },
  )

/** What committing did. Deliberately not `CommitResult`: that one carries a
 *  change count and a repository state, and neither is a thing this file
 *  knows. */
export type Done =
  | { readonly _tag: "Committed"; readonly sha: string }
  | { readonly _tag: "Failed"; readonly said: string }

/**
 * Whether a path has working-tree content to stage.
 *
 * `lstat` rather than `existsSync`, which follows symlinks: a symbolic link
 * whose target is gone is still a file git tracks and still a file a commit
 * must be able to name.
 */
const there = (at: string): boolean =>
  fs.lstatSync(at, { throwIfNoEntry: false }) !== undefined

export interface CommitInput {
  /** Absolute paths of the files to commit. A path that has LEFT the working
   *  tree is welcome here and is how a deletion or the departing half of a
   *  rename is recorded — see {@link commit}. */
  readonly paths: ReadonlyArray<string>
  /** Subject, body and trailer, whole. The `olai` prefix and the writer
   *  trailer are the caller's to have put on: this file composes nothing. */
  readonly message: string
}

/**
 * The index, put back exactly as it was — the failure path's whole story.
 *
 * A commit here is `add` then `commit -- <paths>`, and the `add` writes the
 * REAL index. When the commit then refuses, what it leaves behind is a
 * selection somebody staged without asking for it, which a later `git commit`
 * in a terminal would sweep into a commit of their own. That is not a small
 * leak: `--no-verify` skips hooks and skips nothing else, so a repository
 * configured to SIGN its commits with no key to sign them refuses every single
 * olai commit — and staged the selection every single time.
 *
 * So the index file is COPIED before the staging and put back if anything goes
 * wrong. A copy and a rename rather than bytes through this process: the rename
 * is atomic, so an interrupted restore cannot leave a half-written index, which
 * would be far worse than the leak it is fixing.
 *
 * The obvious alternative — do the whole thing under a temporary
 * `GIT_INDEX_FILE` so the real index is never touched at all — is WRONG, and
 * measurably so. Commit an untracked `b.txt` that way and the real index, which
 * never learnt about it, reads `D  b.txt`: a file present in HEAD and absent
 * from the index is a staged DELETION. Git's own `git commit -- <paths>` writes
 * the committed paths back into the real index for exactly that reason, and
 * that write is the one this file must keep making.
 *
 * ## THE THIRD WAY OUT, which this used to have no answer for
 *
 * A refusal is not the only way a commit ends. A serve that stops, a git row
 * switched off in the panel, a SIGTERM — every one of them INTERRUPTS the
 * fiber, and the two calls that used to put the index back were ordinary
 * statements after an awaited subprocess. An interrupt landing on that await
 * abandoned the generator where it stood: the staging survived, the backup was
 * orphaned in `.git/`, and nothing would ever put either right. Reproduced both
 * halves — a commit stopped during `git add` left `A  slow.md` staged with no
 * commit, and one stopped inside a `post-commit` hook left the commit landed
 * with a pre-`add` backup beside it whose restoration reads `D  fresh.olai`, a
 * staged deletion of the file that had just been committed.
 *
 * So the disposition is the INDEX'S, decided once and acted on once, and
 * {@link commit} hands the deciding moment to it rather than spelling both
 * calls at four returns. Every way out of that function runs {@link
 * Index.settle} — refusal, defect, interrupt and success alike — and the only
 * thing that changes what `settle` DOES is a commit that reported it landed.
 */
interface Index {
  /** The commit landed: the index is now agreeing with a commit that exists,
   *  so what {@link settle} must do is drop the copy rather than write it
   *  back. Said only by a `git commit` that answered `ok`, from inside the
   *  same uninterruptible region that observed it — a flag set after an
   *  interruptible subprocess is a flag an interrupt can arrive in front of. */
  readonly keep: () => void
  /** Put the index back, or drop the copy if {@link keep} was said. Once: a
   *  second call after a defect would rename a backup that is no longer
   *  there. */
  readonly settle: () => void
}

let backups = 0

const keptIndex = (placed: Placement): Index => {
  const index = join(placed.gitDir, "index")
  // Unique per call: two commits in flight in one process would otherwise
  // restore each other's copy.
  const backup = join(placed.gitDir, `olai-index-${process.pid}-${++backups}`)
  // A repository nobody has staged anything in has no index file yet, and
  // "there was none" is a state to put back rather than a reason to skip.
  const had = fs.existsSync(index)
  if (had) fs.copyFileSync(index, backup)
  // THE SAFE ANSWER IS THE DEFAULT, which is the whole reason this is a flag
  // and not a reading of how the Effect ended. `Failed` is an ordinary SUCCESS
  // value here, so a successful exit does not mean git committed; and an
  // interrupt arriving after git moved HEAD is a FAILED exit over a commit
  // that landed. Neither direction is legible from the outside.
  let keep = false
  let settled = false
  return {
    keep: () => { keep = true },
    settle: () => {
      if (settled) return
      settled = true
      if (keep) {
        if (had) fs.rmSync(backup, { force: true })
        return
      }
      if (had) fs.renameSync(backup, index)
      else fs.rmSync(index, { force: true })
    },
  }
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
 *
 * SIGNING IS NOT SKIPPED, and that is the other half of the same decision
 * rather than an oversight — there is no `--no-gpg-sign` here. A hook is the
 * project's rule about the commits people type, and it can refuse this write
 * for reasons that have nothing to do with it. Signing is the repository
 * owner's statement about their OWN history, and an olai commit is a commit in
 * it: where a key exists it is signed like every other one, and where none
 * does, every commit in that repository fails the same way in a terminal too.
 * Forcing the signature off would quietly write unsigned commits into a history
 * whose owner asked for signed ones, which is the same class of mistake as
 * swallowing an error. What the refusal must not do is leave the index dirty —
 * see {@link keptIndex}.
 *
 * ## THE TWO STEPS THAT TOUCH GIT ARE UNINTERRUPTIBLE, and only those two
 *
 * Interruption is what {@link keptIndex}'s third section is about, and a
 * disposition flag only answers it if olai can never be stopped BETWEEN git
 * doing something and olai writing down what git did. So the `add` and the
 * `commit` are each an uninterruptible step: a stop arriving inside one is
 * held until that subprocess has answered and its answer has been recorded,
 * and then it lands on the step boundary where the finalizer below settles the
 * index. Nothing else here is uninterruptible — the `rev-parse` afterwards is
 * plain, because an abandoned one costs a sha and not an index.
 *
 * WHAT THAT COSTS is that a shutdown waits out a wedged git. THREE steps at
 * {@link BUDGET} and not two, because the `hung` arm below asks the index one
 * more question from inside the same uninterruptible region — plus up to three
 * seconds of `@olai/child`'s stopping grace each, so about thirty-nine seconds
 * in the pathological case, against a service manager that allows ninety. Reading the
 * ref back in the finalizer instead was tried and is worse: at the moment of an
 * interrupt HEAD may already have moved while olai's own git is still alive
 * inside a `post-commit` hook, so the read races olai's own child and answers
 * either side of the update depending on scheduling — and it would also call a
 * fourth subprocess onto the path this file's header calls out as hot.
 */
const commit = (
  root: string,
  placed: Placement,
  what: CommitInput,
): Effect.Effect<Done> =>
  // EVERY WAY OUT, IN ONE PLACE — and the copy is made in the same step that
  // says how to dispose of it. `keptIndex` writes a file, which makes it an
  // acquisition however plainly it is spelled, and a `const` followed by a
  // `yield*` that installs the finalizer is the exact gap the MCP endpoint's
  // own header names one plugin over: an interrupt observed at that step
  // boundary leaves the backup on disk with nothing that will ever settle it.
  // `acquireUseRelease` closes it, and the release runs on every exit — a
  // refusal, a defect and an interrupt are three ways of not having committed,
  // and the fourth is the one the body says so about. There is no reading of
  // the exit here, deliberately: see {@link keptIndex}.
  Effect.acquireUseRelease(
    Effect.sync(() => keptIndex(placed)),
    (index) =>
      Effect.gen(function*() {
        // ONLY THE PATHS THAT ARE THERE, which is the whole of `commit-op-staged-rename`.
        //
        // The `add` exists for one reason — an untracked file is not committable
        // without it — so a path with no working-tree content has nothing for it to
        // do. It used to be handed every path anyway, and `git add` looks at the
        // working tree and the index and NOWHERE ELSE: the departing half of a
        // staged `git mv` is in neither, so git refused the whole call with
        // `fatal: pathspec '<old>' did not match any files` and a person watched
        // their own rename come back as git's raw words.
        //
        // Skipping it loses nothing. `git commit -- <paths>` records a departure
        // out of HEAD and the index without any staging at all, which is exactly
        // what git's own porcelain does for a `git rm`, and it is why the commit
        // below still names every path it was given.
        const staging = what.paths.filter(there)
        if (staging.length > 0) {
          const staged = yield* Effect.uninterruptible(git(root, ["add", "--", ...staging]))
          if (!staged.ok) {
            yield* Effect.annotateLogs(
              Effect.logWarning("olai git: could not stage the write"),
              { said: staged.said },
            )
            return { _tag: "Failed", said: staged.said } as const
          }
        }

        const committed = yield* Effect.uninterruptible(Effect.gen(function*() {
          const said = yield* git(
            root,
            ["commit", "--no-verify", "-m", what.message, "--", ...what.paths],
          )
          // SAID HERE, inside the step that observed it. These are the only two
          // sentences in the file that can move the index's disposition, and
          // both are a line away from the answer they read.
          if (said.ok) {
            index.keep()
            return said
          }
          if (said.hung !== true) return said
          // GIT NEVER ANSWERED, which is not the same as git saying no and must
          // not be treated as it. A `commit` killed at {@link BUDGET} may have
          // moved HEAD already — a `post-commit` hook that outlives the budget
          // does exactly that — and restoring the pre-`add` backup over a
          // landed commit stages a DELETION of the file just recorded, which is
          // the corruption {@link keptIndex}'s header exists to prevent,
          // reached through the timeout rather than through an interrupt.
          //
          // So the index is ASKED. `git commit -- <paths>` writes those paths
          // back into the real index, so a landed commit leaves nothing staged
          // for them and a commit that never ran leaves what the `add` staged.
          // One extra subprocess, on the one path where olai does not know what
          // happened, and no race behind it: `@olai/child` kills the child and
          // awaits it before this arm is reached, so nothing of olai's is still
          // moving HEAD while this reads.
          //
          // The one reading it can get wrong is a commit that never ran and
          // staged nothing — and there the backup and the live index are the
          // same bytes, so keeping either is keeping the same thing.
          //
          // ...AND ONE RESIDUE, named rather than papered over: git's own
          // window between moving the ref and writing the index back is
          // microseconds wide, and the budget's kill lands in a HOOK, which is
          // after both. A commit killed inside that window would read as not
          // landed. Nothing in this file can narrow it further; what can is
          // git growing a way to ask.
          const staged = yield* git(root, ["diff", "--cached", "--name-only", "--", ...what.paths])
          if (staged.ok && staged.out.trim() === "") index.keep()
          return said
        }))
        if (!committed.ok) {
          // The ordinary case is "nothing to commit" — a write that produced the
          // bytes already there. Worth a line in the log, never worth failing.
          // What becomes of the index was decided above, where the answer was
          // read; this arm is the sentence, not the disposition.
          yield* Effect.annotateLogs(
            Effect.logWarning("olai git: the write was not committed"),
            { commitMessage: what.message.split("\n")[0] ?? "", said: committed.said },
          )
          return { _tag: "Failed", said: committed.said } as const
        }

        const head = yield* git(root, ["rev-parse", "HEAD"])
        return { _tag: "Committed", sha: head.ok ? head.said : "" } as const
      }),
    (index) => Effect.sync(index.settle),
  )

/** What pushing did. `said` on BOTH arms, because git talks on both: what it
 *  wrote to a remote is worth showing once, and why it would not is worth
 *  showing verbatim. */
export type Sent =
  | { readonly _tag: "Pushed"; readonly said: string }
  | { readonly _tag: "Refused"; readonly said: string }

/**
 * Push the current branch, and say what git said.
 *
 * ONE VERB and no arguments, which is the whole of the decision: `git push`
 * with nothing after it sends the current branch to the upstream it is
 * configured for, and every other spelling is a choice somebody has to make.
 * No remote to pick, no refspec, never `--force`, and no `-u` inventing an
 * upstream for a branch that has none — a branch nobody has ever pushed is a
 * conversation with a person, and git's own refusal is how it starts.
 *
 * A REFUSAL IS AN ANSWER, exactly as a refused commit is: authentication that
 * failed, a remote that has moved on, a hook that said no. The words are git's
 * and they are kept whole, because "could not push" without them is the shape
 * of silence this program keeps being filed for. `GIT_TERMINAL_PROMPT=0` (the
 * runner sets it) is what makes a credential that would have prompted come back
 * as a sentence instead of hanging until the budget runs out.
 */
const push = (root: string): Effect.Effect<Sent> =>
  Effect.gen(function*() {
    const sent = yield* git(root, ["push"])
    if (!sent.ok) {
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: the branch was not pushed"),
        { said: sent.said },
      )
      return { _tag: "Refused", said: sent.said } as const
    }
    return { _tag: "Pushed", said: sent.said } as const
  })

/** What the upstream held that this branch did not, once the fetch has run —
 *  `null` when the current branch tracks nothing at all, which is a different
 *  fact from "nothing behind" (the branch nobody has ever pushed has no
 *  upstream to be behind). */
export interface Standing {
  /** Git's own full name for it — `refs/remotes/origin/main`. */
  readonly upstream: string
  /** The same ref as a reader would write — `origin/main`. */
  readonly name: string
  /** Commits here that the upstream does not have. */
  readonly ahead: number
  /** Commits the upstream has that this branch does not — the count {@link
   *  integrate} will take in. Meaningless until the repository has been
   *  fetched, which is why nothing else in this file ever asks for it: the
   *  sweep must not put a fetch in front of a status. */
  readonly behind: number
}

/** What the fetch said. */
export type Fetched =
  | { readonly _tag: "Fetched" }
  | { readonly _tag: "Refused"; readonly said: string }

/**
 * Fetch the current branch's upstream, bare: no merge, no rebase, nothing
 * else. The ONLY place this file ever fetches — see {@link Standing}, which
 * is what the count becomes readable.
 */
const fetch = (root: string): Effect.Effect<Fetched> =>
  Effect.gen(function*() {
    const said = yield* git(root, ["fetch"])
    if (!said.ok) {
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: the fetch was refused"),
        { said: said.said },
      )
      return { _tag: "Refused", said: said.said } as const
    }
    return { _tag: "Fetched" } as const
  })

/**
 * Where the branch stands against the upstream it tracks, read FRESH — the
 * only two refs this file is ever asked to compare, and the one place the
 * arithmetic is spelled.
 *
 * `null` when there is no upstream at all — the same `null` {@link tracking}
 * answers with, for the same reason: a branch with nowhere to go is not a
 * branch that has fallen behind. Neither rev-list call touches the index, and
 * this is deliberately NOT on the gate.
 */
const standing = (root: string): Effect.Effect<Standing | null> =>
  Effect.gen(function*() {
    const ref = yield* git(root, ["rev-parse", "--symbolic-full-name", "@{upstream}"])
    if (!ref.ok) return null
    const upstream = ref.out.trim()
    if (upstream === "") return null
    const [behind, ahead] = (yield* git(
      root,
      ["rev-list", "--left-right", "--count", `${upstream}...HEAD`],
    )).out.trim().split(/\s+/)
    const name = upstream.replace(/^refs\/remotes\//, "")
    return {
      upstream,
      name,
      ahead: Number(ahead ?? 0),
      behind: Number(behind ?? 0),
    } as const
  })

/** What the integration said. `taken` is how many commits were brought in —
 *  the `behind` count as it stood before the rebase, so the caller can say
 *  what changed without re-asking. */
export type Integrated =
  | { readonly _tag: "Integrated"; readonly from: string; readonly to: string; readonly taken: number }
  /** An uncommitted edit, or an untracked file, in a path the upstream
   *  changed — nothing moved, and the caller decides what to say. */
  | { readonly _tag: "Overlapped"; readonly said: string }
  /** The rebase met a content conflict and was aborted; nothing moved. */
  | { readonly _tag: "Conflicted"; readonly said: string }
  /** Everything else that tried: a worktree that would not be made, the
   *  branch moving under the rebase, a git that hung. */
  | { readonly _tag: "Refused"; readonly said: string }

let integrations = 0

/**
 * Take in what the upstream has, and move the served tree onto the result —
 * the one verb this file does not own end to end, because it moves a ref
 * (`update-ref`) and the working tree (`read-tree`) in one uninterruptible
 * step and the plumbing has never had to hold two of git's writes together.
 *
 * THE SEQUENCE, which is the whole of the decision:
 *
 *   1. a linked worktree of OLAI'S OWN, inside the git directory beside the
 *      copies `/keptIndex` writes there: `worktree add --no-checkout --detach
 *      <gitDir>/olai-integrate-<pid>-<n> <HEAD>`, then `reset --hard` inside
 *      it. `--no-checkout` plus `reset --hard` is what keeps the project's
 *      `post-checkout` hook from running, and the served tree's `status` does
 *      not see the worktree at all. Next to nothing here is index-gated, but
 *      THIS is: no olai commit may land between the rebase reading `HEAD` and
 *      the ref moving. `fetch`, `standing` and `push` stay off the gate, as
 *      `push` is today, so `whyWaiting` never queues behind the network.
 *   2. the rebase, IN that worktree, config keys rather than flags so an older
 *      git ignores them instead of refusing them: `updateRefs` off so no other
 *      branch of the person's is moved, `rerere` off so a recorded resolution
 *      can never be taken on olai's behalf — a conflict is a conversation,
 *      every time — and `--no-verify` for the reason `/commit` skips its
 *      hooks. Signing is NOT skipped, for the reason it is not skipped on
 *      commit: the rebase honours `commit.gpgsign`, and where a key is
 *      missing the commit before it would already have failed.
 *   3. THE MOVE, one `Effect.uninterruptible` region so a stop cannot land
 *      between `read-tree` and `update-ref`:
 *      a. `read-tree -m -u` from the old HEAD to the rebased one IN THE SERVED
 *         TREE. A two-tree merge: it updates the index and working tree for
 *         every path that differs between the two commits, keeps a hand-staged
 *         entry and an unstaged edit for every path that does not, and refuses
 *         before writing anything when a path the upstream changed has local
 *         changes (`Entry 'x' not uptodate. Cannot merge.`) or an untracked
 *         file would be overwritten — both observed, with the tree untouched
 *         afterwards. That refusal is the OVERLAP answer.
 *      b. `update-ref -m "olai: integrated <upstream>" refs/heads/<branch>
 *         <rebased> <old>`. The third argument is a compare-and-swap: a
 *         commit typed in a terminal during the rebase makes this refuse
 *         rather than being dropped from the branch.
 *      c. when the compare-and-swap refuses, `read-tree -m -u` the other way
 *         puts the tree back, and the outcome is a refusal with words.
 *
 * THE WORKTREE IS REMOVED ON EVERY EXIT from the worktree add onward —
 * success, conflict, overlap, refusal, defect, interrupt — via
 * `Effect.acquireUseRelease` on the model of `/keptIndex`: every exit,
 * including when the row is switched off or the server stops. A rebase that
 * CONFLICTS is aborted here, so no `rebase-merge` state survives anywhere the
 * person can see, and the served tree was never touched at all.
 *
 * CRASH RESIDUE HAS AN OWNER TOO: at the start of every call, worktrees named
 * `olai-integrate-<pid>-<n>` whose `pid` is not alive are removed with
 * `git worktree remove --force` and `git worktree prune`. A live pid that is
 * not this process is left alone.
 *
 * WHAT THIS COSTS a shutdown: a stop arriving inside an integrate waits out at
 * most the uninterruptible move — five subprocesses at {@link BUDGET}:
 * `rev-parse` for the rebased tip, `read-tree` to move the tree,
 * `symbolic-ref` to name the branch, `update-ref` as the compare-and-swap,
 * and a second `read-tree` only when the compare-and-swap refuses, to put the
 * tree back — on top of the commit's own three. The rebase itself is
 * interruptible and its abort is the worktree's removal.
 */
const integrate = (
  root: string,
  placed: Placement,
  onto: Standing,
): Effect.Effect<Integrated> =>
  Effect.gen(function*() {
    const head = yield* git(root, ["rev-parse", "--verify", "HEAD"])
    if (!head.ok || head.out.trim() === "") {
      return { _tag: "Refused", said: head.said } as const
    }
    const from = head.out.trim()
    const worktreeName = `olai-integrate-${process.pid}-${++integrations}`
    const worktree = join(placed.gitDir, worktreeName)

    // CRASH RESIDUE WITH A DEAD OWNER: worktrees named `olai-integrate-<pid>-<n>`
    // whose `pid` is not alive are removed at the start of every integrate,
    // and the registry pruned. A live pid that is not this process is left
    // alone — it is somebody else's in flight.
    const sweep = yield* git(root, ["worktree", "list", "--porcelain"])
    if (sweep.ok) {
      for (const entry of sweep.out.split("\n")) {
        const match = /^worktree (.*\/olai-integrate-(\d+)-(\d+))$/.exec(entry)
        if (match === null) continue
        const pid = match[2]
        if (pid === undefined || pid === String(process.pid)) continue
        if (isAlive(Number(pid))) continue
        const at = match[1]
        if (at === undefined) continue
        yield* git(root, ["worktree", "remove", "--force", at])
      }
      yield* git(root, ["worktree", "prune"])
    }

    return yield* holdIndex(
      placed.gitDir,
      Effect.acquireUseRelease(
        Effect.gen(function*() {
          yield* git(root, ["worktree", "add", "--no-checkout", "--detach", worktree, from])
          // `-C`, never `--git-dir`: the checkout directory holds a `.git`
          // file pointing at `.git/worktrees/<name>`, which is where the
          // rebase's state lives, and `--git-dir` does not follow it.
          return yield* git(
            root,
            ["-C", worktree, "reset", "--hard", "--quiet", "HEAD"],
          )
        }),
        (prepared) =>
          Effect.gen(function*() {
            if (!prepared.ok) {
              return { _tag: "Refused", said: prepared.said } as const
            }
            const rebased = yield* git(root, [
              "-C",
              worktree,
              "-c",
              "rebase.updateRefs=false",
              "-c",
              "rebase.autoStash=false",
              "-c",
              "rerere.enabled=false",
              "rebase",
              "--no-verify",
              onto.upstream,
            ])
            if (!rebased.ok) {
              // A CONFLICT is told apart from a refusal, because what a person
              // has to do is so different: a conflict names the file and is a
              // conversation; a refusal is something to look at.
              if (/CONFLICT \(content\)|CONFLICT \(modify\/delete\)|CONFLICT \(add\/add\)/.test(rebased.said)) {
                yield* git(root, ["-C", worktree, "rebase", "--abort"])
                yield* Effect.annotateLogs(
                  Effect.logWarning("olai git: the take-in conflicted, nothing moved"),
                  { said: rebased.said },
                )
                return { _tag: "Conflicted", said: rebased.said } as const
              }
              // Everything else the rebase refused with is a refusal: the
              // rebase could not run, or git hung at the budget.
              return { _tag: "Refused", said: rebased.said } as const
            }

            // THE MOVE — uninterruptible, in one place, for the reason in the
            // comment above. `read-tree` first, because a refusal there is the
            // OVERLAP answer and leaves the tree where it was; then the ref
            // compare-and-swap; then nothing, because the update is done.
            return yield* Effect.uninterruptible(Effect.gen(function*() {
              const to = (yield* git(root, ["-C", worktree, "rev-parse", "HEAD"])).out.trim()
              if (to === "" || to === from) {
                return { _tag: "Integrated", from, to: to === "" ? from : to, taken: 0 } as const
              }
              const moved = yield* git(root, ["read-tree", "-m", "-u", from, to])
              if (!moved.ok) {
                // A path the upstream changed has an uncommitted edit, or an
                // untracked file would be overwritten: nothing moved, and the
                // tree is exactly as it was. The served tree's `state` stays
                // `Ready`, and what the caller does about it is ITS decision.
                return { _tag: "Overlapped", said: moved.said } as const
              }
              const branch = (yield* git(root, ["symbolic-ref", "--short", "HEAD"])).out.trim()
              const ref = branch === "" ? "HEAD" : `refs/heads/${branch}`
              const set = yield* git(root, [
                "update-ref",
                "-m",
                `olai: integrated ${onto.name}`,
                ref,
                to,
                from,
              ])
              if (set.ok) {
                return { _tag: "Integrated", from, to, taken: onto.behind } as const
              }
              // The compare-and-swap refused: the branch moved under us. The
              // tree was already updated, so it is put BACK, and the outcome
              // is a refusal with words rather than a branch that lost a
              // commit typed in a terminal.
              yield* git(root, ["read-tree", "-m", "-u", to, from])
              return { _tag: "Refused", said: set.said } as const
            }))
          }),
        () =>
          Effect.gen(function*() {
            yield* git(root, ["worktree", "remove", "--force", worktree])
            yield* git(root, ["worktree", "prune"])
          }),
      ),
    )
  })

/** Whether a pid belongs to a live process — the other half of the crash
 *  residue sweep: a worktree whose owner is dead is garbage, one whose owner
 *  is alive but is not us is somebody else's. `kill(pid, 0)` answers without
 *  signalling. */
const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
