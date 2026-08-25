/**
 * Git, as plumbing. Nothing here decides anything.
 *
 * {@link open} is the socket: it answers with an {@link Opening} — a
 * {@link Repo}, a directory that is not a work tree, or a git that could not be
 * asked — and everything else is a method on the handle. Five questions and two
 * verbs, each a subprocess and each total: whether the repository can take a
 * commit right now, what has moved in it and how far ahead of its upstream it
 * is, which commit HEAD names, what THAT commit had in one of the repository's
 * files, what was last recorded under a caller's own audit filter — then commit
 * exactly these paths with exactly this message, and push the current branch.
 * What those answers MEAN is `@olai/ops`' `pending.ts`'s.
 *
 * The FIFTH is the newest, and it is one question split in two on purpose
 * (`perf-git-per-write`): a caller that reads a file out of history and keeps
 * what it read is keeping it about a COMMIT, so this socket hands out the
 * commit's name and takes it back rather than spelling `HEAD` inside the
 * command. `HEAD:<path>` is a question whose answer moves; `<sha>:<path>` is a
 * question about an object git has already frozen.
 *
 * The WHOLE REPOSITORY is what those questions are about, and that is
 * `commit-whole-repo`'s correction: the survey used to be pathspec'd to the
 * served directory, so a person who edited a `README.md` one level up was told
 * nothing was waiting. Every path comes back in three spellings ({@link Dirty})
 * so no caller has to know where the served directory sits — which is the same
 * property this file always had, now that there is something outside it to
 * report.
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
 * Only the two index touchers take it (`dirty` and `commit`). `push` is a
 * network verb with the ten-second budget, and `whyWaiting` must not queue
 * behind it; git's own ref lockfiles cover `commit` vs `push` on the refs.
 * `state` / `last` / `head` / `show` do not touch the index.
 */

import { Hung, run } from "@olai/child"
import { Effect, Semaphore } from "effect"
import * as fs from "node:fs"
import { join, resolve } from "node:path"

import type { How, Reason, RepoState } from "./state.ts"

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
      return { ok: false, said: cause.message, out: cause.out }
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
   *  repository that has none. */
  readonly last: (audit: Audit) => Effect.Effect<Recorded | null>
  /** Commit exactly these ABSOLUTE paths with exactly this message. */
  readonly commit: (what: CommitInput) => Effect.Effect<Done>
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
 */
interface Index {
  /** Where the real index is, and where its copy went. */
  readonly restore: () => void
  readonly forget: () => void
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
  return {
    restore: () => {
      if (had) fs.renameSync(backup, index)
      else fs.rmSync(index, { force: true })
    },
    forget: () => {
      if (had) fs.rmSync(backup, { force: true })
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
 */
const commit = (
  root: string,
  placed: Placement,
  what: CommitInput,
): Effect.Effect<Done> =>
  Effect.gen(function*() {
    const index = keptIndex(placed)

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
      const staged = yield* git(root, ["add", "--", ...staging])
      if (!staged.ok) {
        index.restore()
        yield* Effect.annotateLogs(
          Effect.logWarning("olai git: could not stage the write"),
          { said: staged.said },
        )
        return { _tag: "Failed", said: staged.said } as const
      }
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
      // bytes already there. Worth a line in the log, never worth failing. The
      // index goes back to what it was either way: what this call staged was
      // staged in order to commit it, and it did not.
      index.restore()
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: the write was not committed"),
        { commitMessage: what.message.split("\n")[0] ?? "", said: committed.said },
      )
      return { _tag: "Failed", said: committed.said } as const
    }

    index.forget()
    const head = yield* git(root, ["rev-parse", "HEAD"])
    return { _tag: "Committed", sha: head.ok ? head.said : "" } as const
  })

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
