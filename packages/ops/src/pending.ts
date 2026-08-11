/**
 * What is waiting to be committed, and the one verb that commits it.
 *
 * **Derived from git, stored nowhere.** Same discipline as node status and
 * blockedness: anything cached here would be a second answer to a question git
 * already answers, and it would be wrong the moment somebody edits a file in
 * vim. So every reading is a fresh one — `git status --porcelain` names the
 * dirty outlines, `git show HEAD:<file>` is the committed side, the working
 * side is the store's own last-good parse, and the comparison is
 * `@olai/format`'s (`changesOf`), which has no git in it at all.
 *
 * Cost is bounded by what is dirty. A clean directory is one `rev-parse`, one
 * `status`, and no parsing whatsoever.
 *
 * The one thing that cannot be derived is WHO wrote it — git only knows the
 * bytes moved — so that is a counter this module keeps in memory and clears on
 * a successful commit. It is a DECORATION on the git-derived truth and never a
 * replacement: it is empty after a restart, it knows nothing about edits made
 * outside olai, and the panel then draws the changes with no writer beside
 * them. Nothing downstream may assume it is complete.
 *
 * Two decisions this file makes, both of which the design left open:
 *
 *   - **only outlines.** `.jsonl` files are the only files olai writes; a
 *     document, a source file or a half-staged patch in the same working tree
 *     is somebody else's work and is never staged here.
 *   - **every dirty outline, whoever wrote it.** A commit asked for by the
 *     agent sweeps up the outline edits a person made in vim, because the
 *     alternative is to stage by writer — and the writer record is explicitly
 *     allowed to be empty, so a commit built on it would silently commit
 *     nothing after a restart.
 */

import {
  type CommitRequest,
  type CommitResult,
  changesOf,
  fileKind,
  type Node,
  NOTHING_PENDING,
  parseOutline,
  type Located,
  type Pending,
  type RepoState,
  type Writer,
  type Wrote,
} from "@olai/format"
import { Effect, Result, SubscriptionRef } from "effect"

import type { Store } from "./deps.ts"
import * as Git from "./git.ts"
import { composed, MESSAGE_PREFIX, signed } from "./message.ts"

/**
 * How writes reach git.
 *
 * `manual` is the point of the whole thing: a write lands on disk and WAITS,
 * and something asks for a commit. `auto` is for a headless server with no
 * browser to press anything, and commits each write on its own the way olai
 * used to. `off` is `--no-commit`.
 *
 * Here rather than in `@olai/format`: these are the values of a CLI flag and
 * they never travel the wire, so the bottom package has no business knowing
 * that olai has one.
 */
export const COMMIT_MODES = ["off", "manual", "auto"] as const
export type CommitMode = (typeof COMMIT_MODES)[number]

export interface Options {
  /** Absolute path of the directory being served — where git runs. */
  readonly root: string
  readonly store: Store
  readonly mode: CommitMode
  /**
   * Told whenever a commit lands, by whichever door.
   *
   * It hangs HERE rather than on the transport that asked, for the same reason
   * `onRefusal` hangs on the ops layer: a commit changes what is waiting
   * without changing one served byte, so no revision will ever say so — and a
   * caller that had to remember to republish is a caller that can forget.
   * The button did remember; the agent's `commit` tool and `--commit=auto`
   * did not, and every open tab sat on a stale count until the next sweep.
   */
  readonly onCommitted?: () => void
}

/**
 * Everything git is asked to do, in one place — which is what makes the MODE
 * one module's business rather than two. `off` has nothing to say, `manual`
 * answers only when asked, and `auto` also takes the {@link Committing.automatic}
 * door; every one of those is decided here, and `ops.ts` calls the same two
 * verbs whichever mode it is in.
 */
export interface Committing {
  /** What is waiting, right now. UNFAILING: every way this can go wrong — no
   *  repository, a busy one, a set that has never loaded — is a value a reader
   *  is entitled to see rather than an error that would blank the panel. */
  readonly pending: Effect.Effect<Pending>
  /** A commit somebody asked for: everything waiting, with a message. */
  readonly commit: (
    request: CommitRequest,
    writer: Writer,
  ) => Effect.Effect<CommitResult>
  /**
   * A commit NOBODY asked for: exactly the files one write produced, with that
   * write's own summary — which is what `--commit=auto` is, and nothing in any
   * other mode. Answers whether it committed, which is what an op reports.
   */
  readonly automatic: (
    paths: ReadonlyArray<string>,
    summary: string,
    writer: Writer,
  ) => Effect.Effect<boolean>
  /**
   * Told that one write landed AND IS WAITING. The only thing in here that is
   * remembered, and the only thing that is allowed to be wrong.
   *
   * A write that committed itself is not waiting, so it is not counted — see
   * `ops.ts`. What this counts and what {@link commit} clears are then the same
   * set, which is what keeps a clean tree from reporting work that is already
   * in the log.
   */
  readonly wrote: (writer: Writer) => void
}

/** Everything one round of questions asked of git. */
interface Survey {
  /** The repository, when there is one to ask anything else of. */
  readonly git: Git.Repo | null
  readonly repo: RepoState
  /** The dirty outlines, root-relative. Empty whenever `git` is `null`. */
  readonly files: ReadonlyArray<string>
  /** The last commit olai made here, or `null` for one it never has. */
  readonly last: Pending["last"]
}

/** The node-level answer for one survey: what changed, and what could not be
 *  read well enough to say. */
interface Detail {
  readonly changes: Pending["changes"]
  readonly unreadable: ReadonlyArray<string>
}

export const make = (options: Options): Committing => {
  /** Ops per writer since the last commit. A counter rather than the list of
   *  edits the design first drew: the panel says "chat-agent 3 · you 1", and
   *  every other field of that list would be a thing stored for nobody. */
  const counts = new Map<Writer, number>()
  const wrote = (writer: Writer): void => {
    counts.set(writer, (counts.get(writer) ?? 0) + 1)
  }
  const counted = (): ReadonlyArray<Wrote> =>
    [...counts].map(([writer, ops]) => ({ writer, ops }))

  /**
   * The repository, once it is one.
   *
   * A POSITIVE answer is kept: a directory does not stop being a work tree, and
   * neither its git directory nor its name from the repository root moves. A
   * negative one is asked again every round, so a `git init` while the server
   * is running is picked up on the next sweep — which is the half the old
   * memoised work-tree check got wrong, and the half that matters, since the
   * expensive direction is the one that repeats.
   */
  let opened: Git.Repo | null = null
  const repository: Effect.Effect<Git.Repo | null> = Effect.suspend(() =>
    opened !== null ? Effect.succeed(opened) : Effect.map(
      Git.open(options.root),
      (git) => {
        opened = git
        return git
      },
    )
  )

  /** One round of git questions. Four subprocesses at most, and one when the
   *  directory is not a repository. */
  const survey: Effect.Effect<Survey> = Effect.gen(function*() {
    if (options.mode === "off") {
      return { git: null, repo: { _tag: "Off" }, files: [], last: null } as const
    }
    const git = yield* repository
    if (git === null) {
      return { git: null, repo: { _tag: "NoRepo" }, files: [], last: null } as const
    }
    // Independent questions, asked together: what state the repository is in,
    // what has moved in it, and what olai last recorded there.
    const [repo, dirty, last] = yield* Effect.all(
      [git.state, git.dirty, git.last(MESSAGE_PREFIX)],
      { concurrency: 3 },
    )
    return {
      git,
      repo,
      // WHICH dirty files matter is a statement about the format, so it is made
      // here rather than handed to the plumbing as a callback.
      files: dirty.filter((file) => fileKind(file) === "outline"),
      last,
    }
  })

  /**
   * The two sides, parsed and compared.
   *
   * The COMMITTED side comes out of git and through the format's own parser.
   * The WORKING side is the store's last-good parse of the same file, which is
   * the same bytes read by the probe that keeps the page live — so a page and
   * this panel can never disagree about what a file says, and nothing is read
   * from disk twice.
   */
  const detail = (survey: Survey): Effect.Effect<Detail> =>
    Effect.gen(function*() {
      const git = survey.git
      if (git === null || survey.files.length === 0) {
        return { changes: [], unreadable: [] }
      }

      const snapshot = yield* SubscriptionRef.get(options.store.snapshot)
      const set = snapshot?.value ?? null

      // ONE pass over the set for all of it. `nodesOf` filters and sorts the
      // whole node list per call, and `files`/`broken` are scanned per file —
      // which is the corpus walked once per dirty outline, on every revision
      // and every sweep.
      const served: ReadonlyMap<string, ReadonlyArray<Located>> = set === null
        ? new Map()
        : Map.groupBy(set.nodes, (located) => located.file)
      const known = new Set(set?.files ?? [])
      const broken = new Set((set?.broken ?? []).map((entry) => entry.file))

      // A file that cannot be read on ONE side is dropped from BOTH, and that
      // is the whole reason `unreadable` exists rather than being a silent
      // omission: keeping the half that parsed would report every node in it
      // as created, or every node in it as gone — a screen of alarming changes
      // with one real cause, which is that somebody's file does not parse.
      const unreadable = new Set<string>()
      const readable = survey.files.filter((file) => {
        if (set === null || broken.has(file)) {
          unreadable.add(file)
          return false
        }
        return true
      })

      // CONCURRENTLY: each is its own subprocess, and they do not depend on
      // each other. Bounded, because a `git pull` can make a hundred outlines
      // dirty at once and a hundred simultaneous processes is its own problem.
      const heads = yield* Effect.all(readable.map((file) => git.show(file)), {
        concurrency: 8,
      })

      const before = new Map<string, ReadonlyArray<Node>>()
      const after = new Map<string, ReadonlyArray<Node>>()
      readable.forEach((file, at) => {
        const head = heads[at]
        if (head !== undefined && head !== null) {
          const parsed = parseOutline(file, head)
          if (Result.isFailure(parsed)) {
            // The COMMITTED copy does not parse. Rare, and not this working
            // tree's doing — but nothing can be said about what changed in it.
            unreadable.add(file)
            return
          }
          before.set(file, parsed.success.nodes.map((located) => located.node))
        }
        // A dirty file the set does not list has left the disk, and an absent
        // `after` side is exactly how that reads: every node in it is gone.
        if (known.has(file)) {
          after.set(file, (served.get(file) ?? []).map((located) => located.node))
        }
      })

      return { changes: changesOf(before, after), unreadable: [...unreadable] }
    })

  const pending: Effect.Effect<Pending> = Effect.gen(function*() {
    const looked = yield* survey
    if (looked.repo._tag === "Off") return NOTHING_PENDING
    const { changes, unreadable } = yield* detail(looked)
    return {
      repo: looked.repo,
      changes,
      unreadable,
      wrote: counted(),
      message: composed(changes),
      last: looked.last,
    }
  })

  const commit = (
    request: CommitRequest,
    writer: Writer,
  ): Effect.Effect<CommitResult> =>
    Effect.gen(function*() {
      const looked = yield* survey
      if (looked.repo._tag !== "Ready" || looked.git === null) {
        return { _tag: "Blocked", repo: looked.repo } as const
      }
      if (looked.files.length === 0) return { _tag: "NothingToCommit" } as const

      const { changes } = yield* detail(looked)
      const done = yield* looked.git.commit({
        // Named explicitly, exactly as the per-write commit always did: a
        // served directory is a working tree with other work in it.
        paths: looked.files.map((file) => options.store.resolve(file)),
        message: signed(request.message ?? composed(changes), writer),
      })
      if (done._tag === "Failed") return done

      // The counters are what "since the last commit" means, so this is where
      // they stop meaning anything.
      counts.clear()
      options.onCommitted?.()
      return { _tag: "Committed", sha: done.sha, changes: changes.length } as const
    })

  /**
   * The per-write commit, which is the whole of `--commit=auto`.
   *
   * It is here rather than in the write loop for one reason: the repository
   * check, the `olai` prefix, the writer trailer and the subprocess are the
   * same four things a commit somebody asked for does, and having them in two
   * modules would mean a change to how olai commits rippling into both.
   *
   * The repository check is also the part that is NEW. An agent marking a node
   * done in the middle of a rebase could swallow the resolution, and a mode with
   * nobody watching is exactly where that would happen unseen.
   *
   * It does NOT clear the writer counters the way {@link commit} does, and that
   * is deliberate: this commit names only the paths one write produced, so an op
   * that landed earlier while the repository was busy is still on disk and still
   * waiting. Clearing here would under-report it. What keeps the counters honest
   * on this path is that a write which commits itself is never counted at all.
   */
  const automatic = (
    paths: ReadonlyArray<string>,
    summary: string,
    writer: Writer,
  ): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      if (options.mode !== "auto" || paths.length === 0) return false
      const git = yield* repository
      if (git === null) return false
      const repo = yield* git.state
      if (repo._tag !== "Ready") {
        yield* Effect.annotateLogs(
          Effect.logWarning(
            "olai git: the repository is busy, so the write was not committed",
          ),
          { reason: repo._tag === "Blocked" ? repo.reason : repo._tag, summary },
        )
        return false
      }
      const done = yield* git.commit({ paths, message: signed(summary, writer) })
      if (done._tag === "Committed") options.onCommitted?.()
      return done._tag === "Committed"
    })

  return { pending, commit, automatic, wrote }
}
