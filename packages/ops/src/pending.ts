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
  type CommitMode,
  type CommitRequest,
  type CommitResult,
  changesOf,
  fileKind,
  type Node,
  NOTHING_PENDING,
  nodesOf,
  parseOutline,
  type Pending,
  type RepoState,
  type Writer,
  type Wrote,
} from "@olai/format"
import { Effect, Result, SubscriptionRef } from "effect"

import type { Store } from "./deps.ts"
import * as Git from "./git.ts"
import { composed, signed } from "./message.ts"

export interface Options {
  /** Absolute path of the directory being served — where git runs. */
  readonly root: string
  readonly store: Store
  readonly mode: CommitMode
}

export interface Committing {
  /** What is waiting, right now. UNFAILING: every way this can go wrong — no
   *  repository, a busy one, a set that has never loaded — is a value a reader
   *  is entitled to see rather than an error that would blank the panel. */
  readonly pending: Effect.Effect<Pending>
  readonly commit: (
    request: CommitRequest,
    writer: Writer,
  ) => Effect.Effect<CommitResult>
  /** Told that one write landed. The only thing in here that is remembered,
   *  and the only thing that is allowed to be wrong. */
  readonly wrote: (writer: Writer) => void
}

/** Everything one round of questions asked of git. */
interface Survey {
  readonly placed: Git.Placement | null
  readonly repo: RepoState
  /** The dirty outlines, root-relative. Empty whenever `placed` is `null`. */
  readonly files: ReadonlyArray<string>
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

  /** One round of git questions. Three subprocesses at most, and one when the
   *  directory is not a repository. */
  const survey: Effect.Effect<Survey> = Effect.gen(function*() {
    if (options.mode === "off") {
      return { placed: null, repo: { _tag: "Off" }, files: [] } as const
    }
    const placed = yield* Git.place(options.root)
    if (placed === null) {
      return { placed: null, repo: { _tag: "NoRepo" }, files: [] } as const
    }
    const repo = yield* Git.state(options.root, placed)
    const files = yield* Git.dirty(
      options.root,
      placed,
      (file) => fileKind(file) === "outline",
    )
    return { placed, repo, files }
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
      const placed = survey.placed
      if (placed === null || survey.files.length === 0) {
        return { changes: [], unreadable: [] }
      }

      const snapshot = yield* SubscriptionRef.get(options.store.snapshot)
      const set = snapshot?.value ?? null

      const before = new Map<string, ReadonlyArray<Node>>()
      const after = new Map<string, ReadonlyArray<Node>>()
      const unreadable = new Set<string>()

      for (const file of survey.files) {
        // A file that cannot be read on ONE side is dropped from BOTH, and
        // that is the whole reason `unreadable` exists rather than being a
        // silent omission: keeping the half that parsed would report every
        // node in it as created, or every node in it as gone — a screen of
        // alarming changes with one real cause, which is that somebody's file
        // does not parse.
        if (set === null || set.broken.some((broken) => broken.file === file)) {
          unreadable.add(file)
          continue
        }

        const head = yield* Git.show(options.root, placed, file)
        if (head !== null) {
          const parsed = parseOutline(file, head)
          if (Result.isFailure(parsed)) {
            // The COMMITTED copy does not parse. Rare, and not this working
            // tree's doing — but nothing can be said about what changed in it.
            unreadable.add(file)
            continue
          }
          before.set(file, parsed.success.nodes.map((located) => located.node))
        }

        // A dirty file the set does not list has left the disk, and an absent
        // `after` side is exactly how that reads: every node in it is gone.
        if (set.files.includes(file)) {
          after.set(file, nodesOf(set.nodes, file).map((located) => located.node))
        }
      }

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
    }
  })

  const commit = (
    request: CommitRequest,
    writer: Writer,
  ): Effect.Effect<CommitResult> =>
    Effect.gen(function*() {
      const looked = yield* survey
      if (looked.repo._tag !== "Ready" || looked.placed === null) {
        return { _tag: "Blocked", repo: looked.repo } as const
      }
      if (looked.files.length === 0) return { _tag: "NothingToCommit" } as const

      const { changes } = yield* detail(looked)
      const done = yield* Git.commit({
        root: options.root,
        // Named explicitly, exactly as the per-write commit always did: a
        // served directory is a working tree with other work in it.
        paths: looked.files.map((file) => options.store.resolve(file)),
        message: signed(request.message ?? composed(changes), writer),
      })
      if (done._tag === "Failed") return done

      // The counters are what "since the last commit" means, so this is where
      // they stop meaning anything.
      counts.clear()
      return { _tag: "Committed", sha: done.sha, changes: changes.length } as const
    })

  return { pending, commit, wrote }
}
