/**
 * What is waiting to be committed, the verb that commits it, and the one that
 * shares it.
 *
 * **Derived from git, stored nowhere.** Same discipline as node status and
 * blockedness: anything cached here would be a second answer to a question git
 * already answers, and it would be wrong the moment somebody edits a file in
 * vim. So every reading is a fresh one — `git status --porcelain` names every
 * dirty file in the repository, `git show HEAD:<file>` is the committed side of
 * each served outline, the working side is the store's own last-good parse, and
 * the comparison is `@olai/format`'s (`changesOf`), which has no git in it at
 * all.
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
 * Three decisions this file makes:
 *
 *   - **the WHOLE REPOSITORY, in two kinds of row.** `commit-whole-repo`'s
 *     correction, and the human's own words: "the git commit thing should work
 *     across whole repo, not just .olai files edited through MCP". A dirty
 *     outline olai serves gets node-level changes, because both sides parse
 *     into records. Every other dirty file — a document, a source file, an
 *     outline outside the served root — gets a path and a status letter,
 *     because the only other thing available is a text diff and this feature
 *     has never shown one. It used to drop those files one line after `git
 *     status` had already surveyed them, so a person who edited a `.md` by hand
 *     was told nothing was waiting.
 *   - **a SELECTION, never git's index.** A commit names exactly the paths it
 *     was asked for and nothing else, on both `add` and `commit`, so a
 *     half-finished edit somebody staged by hand is left exactly as they left
 *     it. What is not named stays pending, for its own commit and its own
 *     message.
 *   - **every dirty file, whoever wrote it.** A commit asked for by the agent
 *     sweeps up the edits a person made in vim, because the alternative is to
 *     stage by writer — and the writer record is explicitly allowed to be
 *     empty, so a commit built on it would silently commit nothing after a
 *     restart.
 */

import {
  type CommitRequest,
  type CommitResult,
  changesOf,
  composed,
  type Derived,
  fileKind,
  type GitState,
  type How,
  type LastCommit,
  type Node,
  nodesOf,
  NOTHING_PENDING,
  type Other,
  outlinePaths,
  parseOutline,
  type Pending,
  type PushResult,
  type Reason,
  type RepoState,
  type Unpushed,
  Writer,
  type Wrote,
} from "@olai/format"
import * as Git from "@olai/git"
import { Effect, Result, SubscriptionRef } from "effect"

import type { Store } from "./deps.ts"
import { AUDIT, signed } from "./message.ts"

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

/**
 * What git is doing for this directory — `@olai/format`'s {@link GitState},
 * re-exported beside the {@link gitOf} that produces the value.
 *
 * It is DERIVED from {@link Pending}'s own `repo` ({@link gitOf}) and not asked
 * for separately. That is the whole of the coherence: this and the pending value
 * are read by ONE control in the header, and two probes would be two answers to
 * one question — a page saying "no git here" beside a panel offering to commit
 * four changes. One survey, two readings.
 */
export type { GitState }

/**
 * This value's answer, from the repository's.
 *
 * `Blocked` reads as `repo`, deliberately: a mid-rebase repository is a
 * perfectly good one, and what cannot happen right now is a COMMIT — which the
 * pending value already says, with the reason, and which the indicator draws
 * from there. This one answers the narrower question it has always answered,
 * which is whether writes here have a history to go into at all.
 */
export const gitOf = (repo: RepoState): GitState => {
  switch (repo._tag) {
    case "Off":
      return { status: "off", said: null }
    case "NoRepo":
      return { status: "none", said: null }
    case "Unusable":
      return { status: "error", said: repo.said }
    case "Ready":
    case "Blocked":
      return { status: "repo", said: null }
  }
}

/**
 * Why a write is not in the history, in one sentence — or `undefined` when it
 * is.
 *
 * FIVE different facts wear one `committed: false`, and telling them apart is
 * the whole of #108 plus the thing manual mode adds: `off` and `manual` are
 * SETTINGS working exactly as asked, `NoRepo` is a statement about the
 * directory, and `Unusable` / `Blocked` / a refusal are faults with git's own
 * words on them. A write waiting under the default mode must never read as an
 * error, because it is not one — it is the feature.
 *
 * `Blocked` is the arm that has to beat `manual` to the answer, and it does:
 * a write on a mid-rebase repository is NOT waiting to be asked about, it is
 * waiting for the rebase, and the tool it would be told to call will refuse.
 * Saying "waiting" there is the #108 mistake wearing manual mode's clothes.
 */
export const whyOf = (
  mode: CommitMode,
  repo: RepoState,
  refused: string | null,
  /** Who the write was for, so the waiting sentence names the door THAT caller
   *  actually has. An agent in a terminal told to press a Commit button is
   *  being sent after a control it cannot reach. Required: the writer is in
   *  scope at every call site, and an optional one would be a second code path
   *  meaning "we do not know who asked", which is never true here. */
  writer: Writer,
): string | undefined => {
  if (refused !== null) return `git refused the commit: ${refused}`
  switch (repo._tag) {
    case "Off":
      return "this directory is served with --commit=off, so writes are not committed"
    case "NoRepo":
      return "the served directory is not a git work tree, so there is nothing to commit to"
    case "Unusable":
      return `git could not be asked about this directory: ${repo.said}`.trim()
    case "Blocked":
      // Not "waiting", even under `manual`, and that is the point: this write
      // is not waiting for somebody to ask — it is waiting for the repository,
      // and asking will refuse until that is finished. Naming the state is
      // what lets a reader (or an agent) do the one thing that helps.
      return `${busy(repo.reason)}, so the write is on disk but cannot be ` +
        `committed — finish that first, then commit`
    case "Ready":
      return mode === "manual"
        ? "waiting to be committed: writes accumulate under --commit=manual (the " +
          `default) until ${commitDoor(writer)} asks for one`
        : undefined
  }
}

/** What a busy repository IS, in words that read. Three of the four reasons are
 *  an operation in progress and take "mid-"; a detached HEAD is a place you are
 *  standing, not something you are in the middle of, and "mid-detached" is not
 *  English. */
const busy = (reason: Reason): string =>
  reason === "detached"
    ? "the repository is on a detached HEAD"
    : `the repository is mid-${reason}`

/** The two ways a commit is ever asked for. Spelled once, because both the
 *  sentence a write carries back and the help text a subcommand advertises are
 *  built out of them — and renaming the button in one place and not the other
 *  is the kind of thing nothing fails on and everybody trips over. */
export const COMMIT_BUTTON = "the Commit button"
export const COMMIT_TOOL = "the `commit` tool"

/**
 * What ONE WRITER presses or calls — the door that caller has, for the sentence
 * its own write carries back ({@link whyOf}).
 *
 * Exhaustive over `Writer` with no `default`, deliberately: a writer added to
 * the format should be a compile error here rather than silently inheriting
 * somebody else's door. The panel's agent has the tool AND a person with the
 * button watching, so it is told both — that is a fact about that writer, not
 * a fallback.
 *
 * `capture` is the one writer with no door of its own, and it is told about
 * the button rather than about nothing: a share sheet cannot commit, but the
 * person whose vault it landed in opens olai and presses the same control
 * every other waiting write is released by. Naming a door that caller cannot
 * reach would be the alternative to naming none, and "nothing has recorded
 * this yet" with no way out of it is the sentence `git-invisible` was filed
 * against.
 */
export const commitDoor = (writer: Writer): string => {
  switch (writer) {
    case "web":
    case "capture":
      return COMMIT_BUTTON
    case "mcp":
      return COMMIT_TOOL
    case "chat-agent":
      return `${COMMIT_TOOL} or ${COMMIT_BUTTON}`
  }
}

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
   *
   * A PUSH fires it too, and that is why it is not called `onCommitted` any
   * more: pushing moves no file either, and it changes the unpushed count both
   * the panel and the header draw.
   */
  readonly onRecorded?: () => void
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
  /** Both chrome answers, from ONE survey — see {@link status}. */
  readonly status: Effect.Effect<Status>
  /** What is waiting, alone. */
  readonly pending: Effect.Effect<Pending>
  /** A commit somebody asked for: everything waiting — or exactly the paths
   *  they picked — with a message. */
  readonly commit: (
    request: CommitRequest,
    writer: Writer,
  ) => Effect.Effect<CommitResult>
  /** Send the current branch to its upstream. One verb, no arguments: the
   *  audit trail this program keeps is worth nothing on one machine, and
   *  everything else about a remote is a conversation in a terminal. */
  readonly push: Effect.Effect<PushResult>
  /** What git is doing for this directory, as the header's git indicator wants
   *  it — {@link gitOf} of the same survey {@link pending} runs, so the two
   *  values that one indicator reads cannot disagree. */
  readonly git: Effect.Effect<GitState>
  /**
   * A commit NOBODY asked for: exactly the files one write produced, with that
   * write's own summary — which is what `--commit=auto` is, and nothing in any
   * other mode.
   *
   * Answers with what the op reports: whether it committed, and — when it did
   * not — WHY, which under the default mode is "it is waiting", not a fault.
   */
  readonly automatic: (
    paths: ReadonlyArray<string>,
    summary: string,
    writer: Writer,
  ) => Effect.Effect<Outcome>
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

/** The one state git is never asked about, so it is spelled once. */
const OFF: RepoState = { _tag: "Off" }

/** What the two chrome controls draw, from one look at the repository. */
export interface Status {
  readonly pending: Pending
  readonly git: GitState
}

/** What one write's own commit attempt came to — the two fields an op reports
 *  (`@olai/format`'s `writing.ts`, as `WriteResult`), so the reason never has to be inferred
 *  from the boolean. */
export interface Outcome {
  readonly committed: boolean
  readonly why?: string
}

/**
 * One dirty outline olai serves, in the spellings the three readers of it need:
 * the store's key, the repository's own name for it, and where it is on disk.
 *
 * The arithmetic between them belongs to `@olai/git`'s handle, which is where
 * the placement lives — this is that answer, narrowed to the files this layer
 * has something to say about.
 */
interface Served {
  /** Served-root-relative: what `changes` and the store are keyed by. */
  readonly file: string
  /** Repo-root-relative: what a commit request names it. */
  readonly path: string
  /** Absolute: what `git.commit` takes. */
  readonly at: string
  readonly how: How
  /** Where a RENAMED outline came from, in the same three spellings — `null`
   *  for every other row. Both halves are wanted: the commit has to name the
   *  departing side or the rename lands in two pieces, and the COMMITTED side
   *  of a rename is HEAD's copy of the file it came from rather than of a file
   *  HEAD has never had. */
  readonly from: Git.Spelled | null
}

/** Everything one round of questions asked of git. */
interface Survey {
  /** The repository, when there is one to ask anything else of. */
  readonly git: Git.Repo | null
  readonly repo: RepoState
  /** Where the served directory sits from the repository root — `""` when it IS
   *  the root. What the panel's scope line says, and what makes a repo-relative
   *  path out of a served one. */
  readonly served: string
  /** The dirty outlines olai serves. Empty whenever `git` is `null`. */
  readonly outlines: ReadonlyArray<Served>
  /** Every OTHER dirty file in the repository, repo-relative. */
  readonly others: ReadonlyArray<Git.Dirty>
  /** What is committed here and nowhere else, or `null` for a branch with no
   *  upstream at all. */
  readonly unpushed: Unpushed | null
  /** The last commit olai made here, or `null` for one it never has. */
  readonly last: Pending["last"]
}

/** The survey for a directory nothing was asked about — `--commit=off`, a
 *  directory that is not a work tree, a git that could not be asked. Spelled
 *  once, because three arms answer with it and a fourth field added to the
 *  survey must not be able to appear in two of them and not the third. */
const NOTHING_ASKED = {
  git: null,
  served: "",
  outlines: [],
  others: [],
  unpushed: null,
  last: null,
} as const

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
   * What the last commit attempt said, when it refused — the ONE thing here
   * that is remembered about git rather than derived from it, and #108's.
   *
   * It has to be remembered because it is the one failure a probe cannot see: a
   * repository with no `user.email` is a perfectly good repository right up
   * until something tries to commit in it. Kept as the sentence rather than as a
   * second state, so what a reader is told stays a function of the two.
   */
  let refusal: string | null = null

  /** Every commit path ends here, so the remembered refusal is set in one place
   *  and — just as importantly — CLEARED by the next thing that works. */
  const settled = (said: string | null): void => {
    refusal = said
  }

  /**
   * The repository, once it is one.
   *
   * A POSITIVE answer is kept: a directory does not stop being a work tree, and
   * neither its git directory nor its name from the repository root moves. A
   * negative one is asked again every round, so a `git init` while the server
   * is running is picked up on the next sweep — which is the half the old
   * memoised work-tree check got wrong, and the half that matters, since the
   * expensive direction is the one that repeats. A git that could not be ASKED
   * is re-asked for the same reason: installing git is a thing somebody does
   * while the server is up.
   */
  let opened: Git.Repo | null = null
  const repository: Effect.Effect<Git.Opening> = Effect.suspend(() =>
    opened !== null
      ? Effect.succeed({ _tag: "Opened", repo: opened } as const)
      : Effect.map(Git.open(options.root), (opening) => {
        if (opening._tag === "Opened") opened = opening.repo
        return opening
      })
  )

  /** One round of git questions. Four subprocesses at most, and one when the
   *  directory is not a repository. */
  const survey: Effect.Effect<Survey> = Effect.gen(function*() {
    if (options.mode === "off") {
      return { ...NOTHING_ASKED, repo: OFF } as const
    }
    const opening = yield* repository
    if (opening._tag !== "Opened") {
      // Both non-repository answers reach a reader as themselves: `NoRepo` is a
      // statement about the directory, `Unusable` is git's own refusal with its
      // own words. Telling them apart here is what keeps the indicator honest.
      return { ...NOTHING_ASKED, repo: opening } as const
    }
    const git = opening.repo
    // Independent questions, asked together: what state the repository is in,
    // what has moved in it (and how far ahead of its upstream it is, off the
    // same subprocess), and what olai last recorded there.
    const [repo, dirt, last] = yield* Effect.all(
      [git.state, git.dirty, git.last(AUDIT)],
      { concurrency: 3 },
    )

    // A status git REFUSED is not a clean tree, and answering with one would be
    // #108 in miniature: the pill would read `✓ committed`, the unpushed line
    // would vanish, and the reason would be nowhere. It reaches a reader as the
    // state that already exists for it — `Unusable`, with git's own words — so
    // the header says `git error` and the panel refuses to offer a commit into
    // a repository nothing can read.
    if (dirt._tag === "Unusable") {
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: the working tree could not be surveyed"),
        { said: dirt.said },
      )
      return {
        ...NOTHING_ASKED,
        repo: { _tag: "Unusable", said: dirt.said },
        last: last === null ? null : recorded(last),
      } as const
    }

    // WHICH dirty files are which is a statement about the format, so it is
    // made here rather than handed to the plumbing as a callback. An outline
    // olai SERVES has a working-side parse to compare against; an outline
    // outside the served root does not, so it is another file like any other.
    //
    // A rename is judged by the side it ARRIVED at, because that is the side
    // that has a working copy: `README.md` renamed to `notes.olai` is an
    // outline row now, and `notes.olai` renamed to `README.md` is not one any
    // more. The row names both halves either way, so nothing is lost to the
    // reader — what the arriving side decides is whether there are NODES to
    // compare, and there are only ever nodes where there is a file to parse.
    const outlines: Array<Served> = []
    const others: Array<Git.Dirty> = []
    for (const entry of dirt.files) {
      if (entry.served !== null && fileKind(entry.served) === "outline") {
        outlines.push({
          file: entry.served,
          path: entry.path,
          at: entry.at,
          how: entry.how,
          from: entry.from,
        })
      } else {
        others.push(entry)
      }
    }

    return {
      git,
      repo,
      served: git.served,
      outlines,
      others,
      unpushed: dirt.upstream === null
        ? null
        : { upstream: dirt.upstream.name, commits: dirt.upstream.ahead },
      last: last === null ? null : recorded(last),
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
      if (git === null || survey.outlines.length === 0) {
        return { changes: [], unreadable: [] }
      }

      const snapshot = yield* SubscriptionRef.get(options.store.snapshot)
      const at = snapshot?.value ?? null

      // The revision, cut the three ways the walk below reads it: what each
      // outline holds, which files the set knows, which of them did not parse.
      // Taken fresh on every survey, because none of the three is a walk: the
      // first is a LOOKUP in the index the validator built and the snapshot
      // carries, and the other two are sets over the FILE LIST. They used to be
      // one memoised value, and the memo was for the first one — a walk of
      // every record in the corpus, run on every write and every thirty-second
      // sweep. Slice 2 made it a lookup, and a cache for two sets of file names
      // is machinery outliving its reason.
      const served: Pick<Derived, "byFile"> = at?.derived ?? { byFile: new Map() }
      const known = new Set(at === undefined || at === null ? [] : outlinePaths(at.set))
      const broken = new Set((at?.set.broken ?? []).map((entry) => entry.file))

      // A file that cannot be read on ONE side is dropped from BOTH, and that
      // is the whole reason `unreadable` exists rather than being a silent
      // omission: keeping the half that parsed would report every node in it
      // as created, or every node in it as gone — a screen of alarming changes
      // with one real cause, which is that somebody's file does not parse.
      const unreadable = new Set<string>()
      const readable = survey.outlines.filter((one) => {
        if (at === null || broken.has(one.file)) {
          unreadable.add(one.file)
          return false
        }
        return true
      })

      // CONCURRENTLY: each is its own subprocess, and they do not depend on
      // each other. Bounded, because a `git pull` can make a hundred outlines
      // dirty at once and a hundred simultaneous processes is its own problem.
      // HEAD's copy is asked for under the name HEAD HAD IT UNDER, which for a
      // rename is the side it came from — read against the name it has now,
      // which HEAD has never had, every node in it reports as created.
      const committed = readable.map(was)
      const heads = yield* Effect.all(committed.map((one) => git.show(one.ask)), {
        concurrency: 8,
      })

      const before = new Map<string, ReadonlyArray<Node>>()
      const after = new Map<string, ReadonlyArray<Node>>()
      readable.forEach((one, at) => {
        const head = heads[at]
        // ... and keyed under it too, in the namespace the working side uses:
        // `changesOf` matches by id ACROSS files, so a node in both maps under
        // two names is one node that moved. See {@link Was} for why the name
        // asked for and the name keyed by are not the same string.
        const key = committed[at]?.key ?? one.file
        if (head !== undefined && head !== null) {
          const parsed = parseOutline(key, head)
          if (Result.isFailure(parsed)) {
            // The COMMITTED copy does not parse. Rare, and not this working
            // tree's doing — but nothing can be said about what changed in it.
            //
            // Unless it was never an outline at all: a rename INTO the format
            // — a `.md` becoming a `.olai`, which is the migration this was
            // filed during — has no committed outline to compare against, and
            // that is an absence rather than a fault to report.
            if (fileKind(key) === "outline") unreadable.add(one.file)
            return
          }
          before.set(key, parsed.success.nodes.map((located) => located.node))
        }
        // A dirty file the set does not list has left the disk, and an absent
        // `after` side is exactly how that reads: every node in it is gone.
        if (known.has(one.file)) {
          after.set(one.file, nodesOf(served, one.file).map((located) => located.node))
        }
      })

      return { changes: changesOf(before, after), unreadable: [...unreadable] }
    })

  /**
   * Both answers, from ONE survey.
   *
   * This is the coherence made structural rather than claimed. The two chrome
   * controls draw two values, and asking for them separately meant two
   * surveys — two `readdir` of the git directory and two `symbolic-ref` per
   * republish, for one question — with a window in between where the
   * repository could move and the two could disagree about the directory they
   * are both describing. That window is the exact thing the arrangement exists
   * to close, so the publisher takes them together.
   */
  const status: Effect.Effect<Status> = Effect.gen(function*() {
    const looked = yield* survey
    const git = refusal === null
      ? gitOf(looked.repo)
      : ({ status: "error", said: refusal } as const)
    if (looked.repo._tag === "Off") return { pending: NOTHING_PENDING, git }
    const { changes, unreadable } = yield* detail(looked)
    const others = looked.others.map(otherOf)
    return {
      pending: {
        repo: looked.repo,
        changes,
        outlines: looked.outlines.map(({ file, path, how, from }) => ({
          file,
          path,
          how,
          from: from?.path ?? null,
        })),
        others,
        unreadable,
        served: looked.served,
        unpushed: looked.unpushed,
        wrote: counted(),
        // The suggestion for EVERYTHING waiting, which is what the panel opens
        // with and what an agent that supplies no message gets. Unticking a row
        // recomposes it in the browser, from this same function.
        message: composed(changes, others),
        last: looked.last,
      },
      git,
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

      const picked = pick(looked, request.paths)
      // A path nobody is waiting on is a MISTAKE somebody made — an agent that
      // guessed a filename, a panel holding a selection the sweep has moved
      // past — and it comes back as git's kind of refusal rather than being
      // quietly dropped. Committing "the rest of it" under a request that named
      // something else is the silent half-success this codebase keeps refusing
      // to ship.
      if (picked.missing.length > 0) {
        return {
          _tag: "Failed",
          said: `nothing is waiting on ${picked.missing.join(", ")}, so nothing was ` +
            `committed — ask again with what \`pending\` lists`,
        } as const
      }
      if (picked.outlines.length + picked.others.length === 0) {
        return { _tag: "NothingToCommit" } as const
      }

      // The node-level detail for the outlines actually going in, so both the
      // composed message and the count report on the commit that was made
      // rather than on everything that happened to be dirty.
      const { changes } = yield* detail({ ...looked, outlines: picked.outlines })
      const others = picked.others.map(otherOf)
      const done = yield* looked.git.commit({
        // Named explicitly, exactly as the per-write commit always did, and now
        // for a second reason: these are the files somebody TICKED. A served
        // directory is a working tree with other work in it, olai never stages,
        // and what is left out stays waiting.
        //
        // BOTH HALVES of a rename, and it is one tick that carries them: the
        // row a person ticked names the side that arrived, and a commit of that
        // side alone lands the rename in two pieces — an add here and a
        // deletion still staged, waiting to be swept into somebody's next
        // commit as an unrelated one.
        paths: [...picked.outlines, ...picked.others].flatMap((one) =>
          one.from === null ? [one.at] : [one.from.at, one.at]
        ),
        message: signed(request.message ?? composed(changes, others), writer),
      })
      if (done._tag === "Failed") {
        settled(done.said)
        return done
      }
      settled(null)

      // The counters are what "since the last commit" means, so a commit that
      // swept EVERYTHING is where they stop meaning anything. A piecemeal one
      // leaves them alone: an op cannot be attributed to a file from a
      // per-writer tally, so clearing on a partial commit would under-report
      // work that is still waiting — and this value is explicitly allowed to be
      // wrong in the other direction.
      if (request.paths === undefined) counts.clear()
      options.onRecorded?.()
      return {
        _tag: "Committed",
        sha: done.sha,
        changes: changes.length,
        others: others.length,
      } as const
    })

  /**
   * Push, which is the one verb this program has for sharing what it recorded.
   *
   * "I think 'push' is the only thing that makes me use CLI outside of olai" —
   * the human, and this is the whole of the answer. The current branch to the
   * upstream it already has, and nothing else: no remote to pick, no refspec,
   * no `--force`, and no branch or pull or fetch UI. Resolving a divergence
   * stays a conversation in a terminal.
   *
   * `NothingToPush` is asked BEFORE pushing rather than read out of git's own
   * "Everything up-to-date", because the count is what the panel is offering to
   * send and a person pressing the button is entitled to be told it was already
   * there. A branch with no upstream falls through to git, whose refusal names
   * the thing to do about it better than this file could.
   *
   * A BUSY REPOSITORY is refused with its reason, exactly as a commit is, and
   * for the same reason one rule serves both: mid-rebase there is no branch to
   * push, so git answers "you are not currently on a branch" — true, and the
   * less useful half of it. `Blocked` names the rebase, which is the thing to
   * finish. The panel already hides the button in those states (a detached HEAD
   * tracks nothing, so there is no unpushed count to draw); this is what the
   * agent's tool gets, and the two faces answer the same way.
   */
  const push: Effect.Effect<PushResult> = Effect.gen(function*() {
    if (options.mode === "off") return { _tag: "Blocked", repo: OFF } as const
    const opening = yield* repository
    if (opening._tag !== "Opened") {
      return { _tag: "Blocked", repo: opening } as const
    }
    const repo = yield* opening.repo.state
    if (repo._tag !== "Ready") return { _tag: "Blocked", repo } as const

    const dirt = yield* opening.repo.dirty
    if (dirt._tag === "Unusable") {
      // A survey git refused: the count this verb reports on cannot be read, so
      // it is the same news the panel gets rather than a push into the dark.
      return { _tag: "Blocked", repo: { _tag: "Unusable", said: dirt.said } } as const
    }
    const upstream = dirt.upstream
    if (upstream !== null && upstream.ahead === 0) {
      return { _tag: "NothingToPush" } as const
    }

    const sent = yield* opening.repo.push
    if (sent._tag === "Refused") {
      // VERBATIM, exactly as a refused commit is: authentication, a
      // non-fast-forward, a branch with no upstream. What git said is the only
      // thing that says what to do next, and this is the one failure a person
      // cannot see any other way from inside the app.
      return { _tag: "Failed", said: sent.said } as const
    }
    // What is waiting has changed without a served byte moving — the same
    // reason a commit republishes.
    options.onRecorded?.()
    return {
      _tag: "Pushed",
      upstream: upstream?.name ?? "",
      commits: upstream?.ahead ?? 0,
    } as const
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
  ): Effect.Effect<Outcome> =>
    Effect.gen(function*() {
      if (paths.length === 0) return { committed: false }
      // `off` asks git nothing at all — that is what the opt-out is for.
      if (options.mode === "off") {
        return { committed: false, ...said(whyOf("off", OFF, null, writer)) }
      }

      // One MEMOISED `rev-parse` for a directory that is a work tree. A
      // directory that is NOT one, or a git that cannot be asked, is the whole
      // answer already.
      const opening = yield* repository
      if (opening._tag !== "Opened") {
        return { committed: false, ...said(whyOf(options.mode, opening, null, writer)) }
      }

      /**
       * Both remaining modes ask whether the repository can take a commit, and
       * `manual` asking is a CORRECTION.
       *
       * It used to short-circuit here on the reasoning that a write is waiting
       * either way, so whether the repository was mid-rebase changed nothing —
       * and that was the #108 mistake in miniature. A write on a busy
       * repository is not waiting for somebody to press a button; it is
       * waiting for a rebase to finish, and nothing the agent can do will sweep
       * it until that happens. Telling it "waiting… until the `commit` tool
       * asks for one" sends it to call a tool that will refuse, and the person
       * reading the transcript learns the real reason only from the refusal.
       *
       * The cost is one `symbolic-ref` inside the store's write gate per op,
       * which is what the short-circuit was avoiding. It is worth paying: the
       * write itself has just re-serialized and fsynced an outline, `auto`
       * spawns two git processes on the same path without anybody minding, and
       * the alternative is a reply that is confidently wrong.
       */
      const repo = yield* opening.repo.state
      if (options.mode === "manual") {
        return { committed: false, ...said(whyOf("manual", repo, null, writer)) }
      }

      // `auto` is the only mode that goes on, and the busy check is the part
      // that is NEW: an agent marking a node done in the middle of a rebase
      // could swallow the resolution, and a mode with nobody watching is
      // exactly where that would happen unseen.
      if (repo._tag !== "Ready") {
        yield* Effect.annotateLogs(
          Effect.logWarning(
            "olai git: the repository is busy, so the write was not committed",
          ),
          { reason: repo._tag === "Blocked" ? repo.reason : repo._tag, summary },
        )
        return { committed: false, ...said(whyOf("auto", repo, null, writer)) }
      }

      const done = yield* opening.repo.commit({
        paths,
        message: signed(summary, writer),
      })
      if (done._tag === "Committed") {
        settled(null)
        options.onRecorded?.()
        return { committed: true }
      }
      settled(done.said)
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: the write was not committed"),
        { commitMessage: summary, said: done.said },
      )
      return { committed: false, ...said(whyOf("auto", repo, done.said, writer)) }
    })

  /** The repository's state on its own — what {@link Committing.git} wants,
   *  without the status walk and the parsing {@link pending} does for the
   *  panel. */
  const repoState: Effect.Effect<RepoState> = Effect.gen(function*() {
    if (options.mode === "off") return OFF
    const opening = yield* repository
    if (opening._tag !== "Opened") return opening
    return yield* opening.repo.state
  })

  return {
    status,
    pending: Effect.map(status, (both) => both.pending),
    commit,
    push,
    automatic,
    wrote,
    /**
     * This value's answer on its own, for a caller that wants only it: the
     * directory's own state, unless a commit refused.
     *
     * The refusal override is #108's and is kept deliberately: a repository
     * whose identity nobody set answers `rev-parse` perfectly happily, so the
     * probe alone reads healthy while every commit fails — which is the silence
     * that bug was filed for. It clears itself the moment something works.
     *
     * The PUBLISHER does not use this — it takes {@link status}, which answers
     * both from one survey. This is the narrow question asked alone.
     */
    git: Effect.map(repoState, (repo) =>
      refusal === null ? gitOf(repo) : { status: "error", said: refusal }),
  }
}

/** One dirty file that is not a served outline, as the wire carries it. The
 *  REPO-relative path is its name, because that is the one name it has that
 *  cannot collide with a served one — and that is the spelling a rename names
 *  its other half in too. */
const otherOf = (entry: Git.Dirty): Other => ({
  path: entry.path,
  how: entry.how,
  from: entry.from?.path ?? null,
})

/**
 * The COMMITTED side of one dirty outline: what to ask HEAD for, and what to
 * call it in the comparison.
 *
 * TWO NAMES, because the two questions want different ones and answering both
 * with one is a bug in whichever direction it is resolved.
 */
interface Was {
  /** Repo-root-relative, which is what `git.show` takes — and the only spelling
   *  a rename's source is guaranteed to have. Keyed by the SERVED one, a rename
   *  INTO the served directory (`git mv Notes.md docs/Notes.olai` while olai
   *  serves `docs/`) has a source with no served name at all, so it fell back
   *  to the arriving name — which HEAD has never had — and every node in the
   *  file read as created. */
  readonly ask: string
  /** What `changesOf` keys the BEFORE side by, in the same namespace the after
   *  side uses. Served, and it has to be: `changesOf` reports a node whose file
   *  differs as having MOVED, so keying the before side repo-relative would
   *  make every node of every unmoved outline read as moved the moment olai
   *  served a subdirectory. A source with no served name keeps its repo one,
   *  which differs from the arriving name — correctly, since it did move. */
  readonly key: string
}

const was = (one: Served): Was =>
  one.from === null
    ? { ask: one.path, key: one.file }
    : { ask: one.from.path, key: one.from.served ?? one.from.path }

/** What a commit is going to name, out of what is waiting. */
interface Picked {
  readonly outlines: ReadonlyArray<Served>
  readonly others: ReadonlyArray<Git.Dirty>
  /** Paths that were asked for and are not waiting on anything. Never dropped
   *  quietly — see the refusal in {@link Committing.commit}. */
  readonly missing: ReadonlyArray<string>
}

/**
 * The selection, matched against what is actually waiting.
 *
 * ONE NAMESPACE, repo-root-relative, for both kinds of row — which is why an
 * outline carries its repository path at all. Keyed by the served spelling, an
 * outline `roadmap.olai` under `docs/` and a dirty `roadmap.olai` at the
 * repository root would be the same tick, and the commit would name the wrong
 * file. Rare, and permanent once it is in somebody's history.
 *
 * An omitted selection is EVERYTHING, which is what it has always been and what
 * the button sends when nothing is unticked.
 */
const pick = (
  looked: Survey,
  paths: ReadonlyArray<string> | undefined,
): Picked => {
  if (paths === undefined) {
    return { outlines: looked.outlines, others: looked.others, missing: [] }
  }
  const wanted = new Set(paths)
  const outlines = looked.outlines.filter((one) => wanted.has(one.path))
  const others = looked.others.filter((one) => wanted.has(one.path))
  const found = new Set([
    ...outlines.map((one) => one.path),
    ...others.map((one) => one.path),
  ])
  return { outlines, others, missing: paths.filter((path) => !found.has(path)) }
}

/**
 * One commit git read back, as the wire carries it.
 *
 * The whole of what the `@olai/git` extraction left behind here, and it is one
 * function: the plumbing hands over the trailer VERBATIM, because which strings
 * are writers is a statement about olai and not about git. A trailer nothing
 * recognises — a commit typed by hand, one whose trailer a rebase mangled, one
 * written by some other tool that borrowed the key — reads as `null`, which is
 * more honest than a guess and is exactly what the panel draws as "writer not
 * recorded".
 */
const recorded = (last: Git.Recorded): LastCommit => ({
  sha: last.sha,
  message: last.message,
  at: last.at,
  writer: WRITERS.has(last.trailer) ? (last.trailer as Writer) : null,
})

/** The writers, as a set to test a trailer against — READ OFF the schema
 *  rather than listed again beside it. A second list is what would go on
 *  answering `null` ("writer not recorded") for a writer the format had grown,
 *  which is a quiet wrong answer on a panel rather than anything that fails. */
const WRITERS: ReadonlySet<string> = new Set<string>(Writer.literals)

/** An optional field, present only when there is something to say — so an op
 *  that committed carries no `why` key at all. */
const said = (why: string | undefined): { readonly why?: string } =>
  why === undefined ? {} : { why }

/**
 * What a SUBCOMMAND offers — which is not the same question {@link commitDoor}
 * answers, and the difference is where the two came apart.
 *
 * `olai web` hands its own panel agent the same `commit` tool an outside agent
 * gets (`bespokeFrom(TOOLS)`, over a face composed as `chat-agent`), so a web
 * serve genuinely has BOTH doors and its `--help` should say so. A terminal agent has
 * no browser and no button, so it has one. Keying the help text on a WRITER
 * instead read the narrower fact and quietly dropped the tool from
 * `olai web --help`.
 *
 * So: one writer has one door, one face may offer two.
 */
export const commitDoors = (face: CommitFace): string => {
  switch (face) {
    case "web":
      return `${COMMIT_BUTTON} or ${COMMIT_TOOL}`
    case "mcp":
      return COMMIT_TOOL
  }
}

/** The subcommands. Derived from `Writer` rather than spelled again — one name
 *  for who is asking — minus the two that are not faces a person can start:
 *  `chat-agent` is a session `olai web` spawns, and `capture` is an HTTP route
 *  ON that serve, so neither is something with a `--help` of its own. */
export type CommitFace = Exclude<Writer, "chat-agent" | "capture">
