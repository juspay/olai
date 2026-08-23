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
  armedOn,
  COMMIT_MODES,
  type CommitMode,
  type CommitRequest,
  type CommitResult,
  changesOf,
  composed,
  type Derived,
  fileKind,
  type GitPin,
  type GitPolicy,
  type GitState,
  type How,
  isReady,
  type LastCommit,
  type Node,
  nodesOf,
  NOTHING_PENDING,
  type Other,
  outlinePaths,
  parseOutline,
  type Pending,
  policyOf,
  QUIET_MS,
  type PushResult,
  type Reason,
  type RepoState,
  type Unpushed,
  Writer,
  type Wrote,
} from "@olai/format"
import * as Git from "@olai/git"
import { Duration, Effect, Result, Stream, SubscriptionRef } from "effect"

import type { Store } from "./deps.ts"
import { AUDIT, signed } from "./message.ts"

/**
 * How writes reach git — `@olai/format`'s table, re-exported rather than
 * declared, exactly as {@link GitState} is below.
 *
 * It used to be declared here, on the argument that these are the values of a
 * CLI flag and never travel the wire. Half of that stopped being true with
 * `vault-level-settings`: a flag that was GIVEN is pinned into every browser's
 * preferences, so the mode is on the wire now and the vocabulary belongs on the
 * floor the spec and this layer both stand on.
 */
export { COMMIT_MODES, type CommitMode }

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
 * This value's answer, from the repository's — plus the four facts about the
 * DIRECTORY that no probe of it can see.
 *
 * `Blocked` reads as `repo`, deliberately: a mid-rebase repository is a
 * perfectly good one, and what cannot happen right now is a COMMIT — which the
 * pending value already says, with the reason, and which the indicator draws
 * from there. That arm answers the narrower question it has always answered,
 * which is whether writes here have a history to go into at all.
 *
 * THE FOUR THAT ARE NOT THE PROBE'S, and every one of them is here rather than
 * assembled by a caller so that "what git is doing" has exactly one derivation:
 *
 *   - `pinned` — what the operator typed, on every arm including the settled
 *     ones: a `--commit=off` serve is exactly a pinned policy, and a browser
 *     told "off" without being told who said so cannot draw the row.
 *   - `policy` — what this server DOES, which is the value the two preference
 *     rows now draw (they used to draw a preference stored in the browser).
 *   - `refused` — the last commit git said no to. #108's: a repository whose
 *     identity nobody set answers every probe happily and refuses every commit,
 *     so this OVERRIDES the probe's own status and reaches a reader as `error`.
 *   - `pushSaid` and `paused` — the last push refusal and why the loop stopped.
 *     Neither overrides the status: a push that will not go is not a repository
 *     that will not take a commit, and drawing them as one is exactly the bug
 *     that read `✓ committed · 13 unpushed` over an hour of failing pushes.
 */
const gitOf = (
  repo: RepoState,
  policy: Policy,
  settled: Settled,
): GitState => {
  const rest = {
    pinned: policy.pin,
    policy: policy.now(),
    pushSaid: settled.pushSaid,
    paused: settled.paused,
  }
  if (settled.refusal !== null) {
    return { status: "error", said: settled.refusal, ...rest }
  }
  switch (repo._tag) {
    case "Off":
      return { status: "off", said: null, ...rest }
    case "NoRepo":
      return { status: "none", said: null, ...rest }
    case "Unusable":
      return { status: "error", said: repo.said, ...rest }
    case "Ready":
    case "Blocked":
      return { status: "repo", said: null, ...rest }
  }
}

/**
 * THE THREE THINGS THIS LAYER REMEMBERS ABOUT GIT, as one value.
 *
 * Everything else about the repository is derived from it on every reading —
 * that is the rule the whole feature is built on — and these three are the
 * exceptions, because they are the class of fact no probe can see: `rev-parse`
 * answers happily in a repository with no `user.email`, `git status` says how
 * far ahead a branch is and never why it is still ahead, and nothing on disk
 * says a loop stopped.
 *
 * ONE VALUE rather than three fields, because they are coupled by a rule and
 * the rule is what would otherwise live in a comment: a refusal of EITHER verb
 * sets the pause, and only `resume` clears it. Kept together, the writers are
 * countable ({@link Committing}'s `commit`, `push` and `resume`, and nothing
 * else) and the readers take one argument.
 */
interface Settled {
  /** What git said when it last refused a COMMIT, or `null` — cleared by the
   *  next commit that works. #108's, and the reason this is remembered at all. */
  readonly refusal: string | null
  /**
   * ... and a PUSH.
   *
   * Its own field rather than the same one, and the separation is the bug this
   * feature was filed for: a refused push leaves a repository whose every
   * commit still lands, so folding it into `refusal` would make the chip read
   * `git error` at a directory whose git is fine. What is broken is the
   * sharing, and the chip has to be able to say so while still saying
   * everything else is well.
   */
  readonly pushSaid: string | null
  /** Why the quiet window stopped, or `null` while it is running. A fact about
   *  the directory: it used to be a signal in one browser tab, so a reload was
   *  a silent retry and a second tab knew nothing. */
  readonly paused: string | null
}

/** Nothing has refused and nothing has stopped — what a server boots holding,
 *  and what a healthy directory keeps holding. */
const NOTHING_SETTLED: Settled = {
  refusal: null,
  pushSaid: null,
  paused: null,
}

/**
 * Why a write is not in the history, in one sentence — and there is ALWAYS one.
 *
 * It used to answer `undefined` for the one mode that committed the write
 * inside the write gate, and that mode is gone: nothing commits a write any
 * more, so `committed: true` was a thing no reply could carry and the boolean
 * beside this sentence went with it. Six facts wear "not yet", and telling them
 * apart is the whole of #108 plus what manual mode adds: `off` and the two
 * waits are SETTINGS working exactly as asked, `NoRepo` is a statement about
 * the directory, and `Unusable` / `Blocked` / a refusal are faults with git's
 * own words on them. A write waiting under the default mode must never read as
 * an error, because it is not one — it is the feature.
 *
 * `Blocked` is the arm that has to beat both waits to the answer, and it does:
 * a write on a mid-rebase repository is NOT waiting to be asked about or waited
 * out, it is waiting for the rebase, and the loop will not attempt into one.
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
): string => {
  if (refused !== null) return `git refused the commit: ${refused}`
  switch (repo._tag) {
    case "Off":
      return COMMITS_OFF
    case "NoRepo":
      return "the served directory is not a git work tree, so there is nothing to commit to"
    case "Unusable":
      return `git could not be asked about this directory: ${repo.said}`.trim()
    case "Blocked":
      // Not "waiting", under either mode, and that is the point: this write
      // is not waiting for somebody to ask — it is waiting for the repository,
      // and asking will refuse until that is finished. Naming the state is
      // what lets a reader (or an agent) do the one thing that helps.
      return `${busy(repo.reason)}, so the write is on disk but cannot be ` +
        `committed — finish that first, then commit`
    case "Ready":
      switch (mode) {
        case "off":
          return COMMITS_OFF
        case "manual":
          return "waiting to be committed: writes accumulate under --commit=manual (the " +
            `default) until ${commitDoor(writer)} asks for one`
        // The window, and it names nobody's door on purpose: under `auto` there
        // is nothing for this caller to press. What it is waiting for is the
        // DIRECTORY going quiet, which every other writer moves too.
        case "auto":
          return `waiting to be committed: --commit=auto records everything waiting ` +
            `once writes stop arriving for ${Math.round(QUIET_MS / 1000)} seconds`
      }
  }
}

/** The one sentence `--commit=off` gets, wherever it is reached from — the
 *  setting is one fact and two spellings of it is one place for them to
 *  drift. */
const COMMITS_OFF =
  "this directory is served with --commit=off, so writes are not committed"

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
    // `auto` is the quiet-window loop, which writes no FILE — it only ever
    // makes commits — so no write is ever attributed to it and this arm is
    // unreachable by construction. It is spelled rather than defaulted for the
    // reason the others are: a writer added to the format is a decision here,
    // and the button is the honest answer to "what would release this" for a
    // caller that has no door of its own.
    case "auto":
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
  /** WHAT THIS SERVER DOES about git, live — see {@link Policy}. */
  readonly policy: Policy
  /**
   * Told whenever anything about git SETTLED — a commit by whichever door, a
   * push, a refusal of either, and the loop stopping or being started again.
   *
   * It hangs HERE rather than on the transport that asked, for the same reason
   * `onRefusal` hangs on the ops layer: none of those moves one served byte, so
   * no revision will ever say so — and a caller that had to remember to
   * republish is a caller that can forget. The button did remember; the agent's
   * `commit` tool did not, and every open tab sat on a stale count until the
   * next sweep.
   *
   * A REFUSAL fires it too, which is what the push-invisibility bug turned on:
   * git said no, the remembered reason moved, and nothing told a browser for up
   * to thirty seconds — or, for a push, ever.
   */
  readonly onSettled?: () => void
  /** The quiet window, for a test that cannot wait fifteen seconds. The SPAN is
   *  a product decision and lives with the rule (`@olai/format`'s
   *  {@link QUIET_MS}); this is only how long this instance waits. */
  readonly quiet?: Duration.Input
}

/**
 * WHAT THIS SERVER DOES ABOUT GIT, and who decided — the whole of
 * `git-policy-server-side` as this layer sees it.
 *
 * Two members rather than one, because they answer different questions and both
 * travel: `now()` is what the loop and the two verbs obey, `pin` is what a
 * browser is told so it can draw the rows read-only. It is a live ACCESSOR
 * rather than a value, because the policy moves while the server runs — the
 * preferences panel sets it through `git.setPolicy` — and a value read once at
 * boot would be a loop that never noticed being turned on.
 *
 * WHERE IT IS KEPT is deliberately not here. This layer is handed the answer;
 * `@olai/server`'s `gitPolicy.ts` composes the flags with whatever was
 * remembered for this directory, outside the vault.
 */
export interface Policy {
  /** What the operator pinned — the flags as given, `null` for each one nobody
   *  gave (`@olai/format`'s {@link GitPin}). */
  readonly pin: GitPin
  /** What the server does right now, with the pin, the remembered choice and
   *  the defaults already folded in (`@olai/format`'s `policyOf`). */
  readonly now: () => GitPolicy
}

/** A policy that cannot move: the flags, the defaults, and nowhere to remember
 *  anything else. What a caller with no state directory behind it hands in —
 *  every test here, and any composition that has not opened one. */
export const fixedPolicy = (pin: GitPin): Policy => ({
  pin,
  now: () => policyOf(pin),
})

/**
 * Everything git is asked to do, in one place — which is what makes the MODE
 * one module's business rather than two. `off` has nothing to say, `manual`
 * answers only when asked, and `auto` runs the quiet-window loop below; every
 * one of those is decided here, and `ops.ts` calls the same verbs whichever
 * mode it is in.
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
   * WHY THE WRITE THAT JUST LANDED IS NOT IN THE HISTORY — one sentence, and
   * there is always one ({@link whyOf}).
   *
   * It is what is left of the per-write commit, and the difference is the whole
   * of this feature: `--commit=auto` used to commit exactly the files one write
   * produced, inside the write gate, so a train of thought arrived as a dozen
   * commits. Nothing commits a write any more — the loop below sweeps the
   * repository once the directory goes quiet — so what a write reports is what
   * it is waiting FOR, which is a sentence rather than a boolean.
   *
   * It costs one `symbolic-ref`, and that is the price of an honest answer: a
   * write on a mid-rebase repository is not waiting for a window or a button,
   * and telling it so would send an agent after a tool that will refuse.
   */
  readonly whyWaiting: (writer: Writer) => Effect.Effect<string>
  /**
   * Told that one write landed AND IS WAITING. The only thing in here that is
   * remembered, and the only thing that is allowed to be wrong.
   *
   * What this counts and what {@link commit} clears are the same set, which is
   * what keeps a clean tree from reporting work that is already in the log.
   */
  readonly wrote: (writer: Writer) => void
  /**
   * WHAT THE SURVEY JUST SAID, handed to the quiet window.
   *
   * The loop is armed by the arrival of a reading rather than by a clock of its
   * own, so this is the one thing outside this module that has to be called:
   * whoever recomputes {@link status} says so here, and the window re-arms
   * exactly when what is waiting has actually moved (`@olai/format`'s `armedOn`).
   * A survey that says nothing new — the server's slow sweep over a quiet
   * directory — leaves the window where it is, which is what keeps a commit
   * from being pushed out by a clock nobody typed on.
   */
  readonly observe: (pending: Pending) => Effect.Effect<void>
  /**
   * THE LOOP ITSELF, as one effect to fork and never return from.
   *
   * One per served directory by construction: one olai holds the directory
   * (`@olai/server`'s `flock.ts`), so there is no election, no leader and no
   * lock — which is the half the browser's copy of this had to invent and get
   * wrong across two browsers.
   */
  readonly loop: Effect.Effect<void>
  /**
   * ON BOOT: share what this directory already recorded, once — and only where
   * the policy says to.
   *
   * NOTHING ABOUT A REFUSAL IS REMEMBERED ACROSS A RESTART (the human's ruling,
   * 2026-08-22): the state file keeps the policy and nothing else, so a fresh
   * process starts with no stop and no words. That is the right shape for the
   * STOP — a restart is an operator's act, and a pause written down would be a
   * blind retry's opposite with no way out of it that survives either — and it
   * is the wrong shape for the WORDS on its own, because `olai.service` is
   * `Restart=always`: a deploy or a crash would take `pushSaid` with it and the
   * chip would go back to `✓ committed · N unpushed` with the reason nowhere,
   * which is the whole of `push-failure-invisible` restored.
   *
   * So the words are re-earned rather than remembered. One `git push` at boot,
   * the same bare one every other door runs — never a force, never a pull — and
   * whatever git says lands on the cell through the same path a pressed Push
   * takes.
   *
   * ONLY WHERE THERE ARE COMMITS TO SEND, and that check is here rather than
   * left to {@link push} — the one place the two verbs genuinely want different
   * answers. A branch with NO UPSTREAM is not a branch that is behind: `push`
   * lets that one through to git, because a person who pressed the button is
   * owed git's own words about the remote they have not set. A boot nobody
   * asked for is owed nothing of the kind, and letting it through would stop
   * the loop of every directory whose branch has never been pushed, at every
   * start, with a refusal about a thing that is not wrong.
   *
   * Under `manual` and `off` nothing is attempted at all. A directory whose
   * pushes are somebody's own button press has not asked this process to make
   * one, and a boot that pushed anyway would be the flag meaning something
   * different on the first survey than on every one after it.
   */
  readonly catchUp: Effect.Effect<void>
  /**
   * Start the loop again after git stopped it — the person saying they have
   * dealt with whatever it said.
   *
   * The ONE way out, and a procedure rather than a side effect of some other
   * gesture: the stop is a fact about the directory now, so turning a toggle
   * off and on in one browser cannot be what clears it. Nothing clears it on
   * olai's own initiative, because a loop that un-paused itself is the blind
   * retry wearing a different hat.
   */
  readonly resume: Effect.Effect<void>
}

/** The one state git is never asked about, so it is spelled once. */
const OFF: RepoState = { _tag: "Off" }

/** What the two chrome controls draw, from one look at the repository. */
export interface Status {
  readonly pending: Pending
  readonly git: GitState
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
  /** What this server DOES about commits, ASKED EVERY TIME rather than derived
   *  once: the policy moves while the server runs (`git.setPolicy`), and a mode
   *  read at boot would be a loop that never noticed being turned on. */
  const mode = (): CommitMode => options.policy.now().commit

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
   * THE THREE THINGS THIS LAYER REMEMBERS about git — see {@link Settled}.
   *
   * One place, written by the three functions below and by nothing else, so
   * "what has git said here, and is the loop stopped" is one read at every
   * reader and the rule that couples them is a line of code rather than a
   * comment.
   */
  let settled: Settled = NOTHING_SETTLED

  /**
   * Every commit path ends here, so the remembered refusal is set in one place
   * and — just as importantly — CLEARED by the next thing that works.
   *
   * A refusal also STOPS the loop, and only while the loop is the thing that
   * would go round again: under `manual` a refused commit is a button press
   * that failed, which the panel already draws, and marking the directory
   * "auto-commit paused" over it would be chrome about a loop nobody armed.
   */
  const committed = (said: string | null): void => {
    settled = { ...settled, refusal: said, paused: stopBy(said) }
  }

  /** ... and the push's own end, with the same two jobs. */
  const pushed = (said: string | null): void => {
    settled = { ...settled, pushSaid: said, paused: stopBy(said) }
  }

  /**
   * What a refusal does to the loop, or `null` for one that leaves it running.
   *
   * ONE STOP FOR BOTH VERBS, which is the divergence ruling: piling more
   * automatic commits onto a branch that has already refused a push makes the
   * eventual resolution worse, so a refused push stops the committing too. It
   * does not pull, does not rebase, does not force and does not try again.
   *
   * The FIRST reason wins, and a verb that WORKED does not clear the stop. A
   * stop already on the record is the one a person is about to read, and only
   * they may lift it ({@link Committing.resume}) — a commit that landed after a
   * push was refused says nothing about whether the branch can be sent.
   */
  const stopBy = (said: string | null): string | null =>
    settled.paused ?? (said !== null && mode() === "auto" ? said : null)

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
    if (mode() === "off") {
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
    // A branch with nothing unshared has no unresolved push refusal, whoever
    // resolved it — including somebody who pushed from a terminal, which olai
    // would otherwise go on warning about until the next press of its own
    // button. The STOP is not cleared with it: that is a person's to lift.
    if (looked.unpushed === null || looked.unpushed.commits === 0) {
      settled = { ...settled, pushSaid: null }
    }
    const git = gitOf(looked.repo, options.policy, settled)
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
        committed(done.said)
        // A refusal changes what a reader is owed without moving one byte, and
        // for thirty seconds nothing said so. THIS is the republish that was
        // missing: the words are on the cell the moment git says them.
        options.onSettled?.()
        return done
      }
      committed(null)

      // The counters are what "since the last commit" means, so a commit that
      // swept EVERYTHING is where they stop meaning anything. A piecemeal one
      // leaves them alone: an op cannot be attributed to a file from a
      // per-writer tally, so clearing on a partial commit would under-report
      // work that is still waiting — and this value is explicitly allowed to be
      // wrong in the other direction.
      if (request.paths === undefined) counts.clear()
      options.onSettled?.()

      // ... AND THE PUSH, which is what `--push=auto` now means: a settled
      // commit is shared, whichever door made it — the Commit button, the
      // agent's `commit` tool, or the quiet window. It used to fire in the
      // BROWSER, inside the success callback of one tab's own request, so a
      // commit an agent made or a headless serve made was never pushed and the
      // count grew with nothing saying why.
      //
      // ONE ROUND TRIP PER COMMIT, and that is the argument the old
      // `--commit=auto` could not make: it committed every write, so pushing
      // would have put a network call inside every keystroke. The window is
      // what makes this affordable.
      //
      // The push's own refusal is remembered and stops the loop ({@link sent}),
      // and the commit STANDS either way: nothing here is rolled back, and
      // nothing is retried.
      if (options.policy.now().push === "auto") yield* push

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
    if (mode() === "off") return { _tag: "Blocked", repo: OFF } as const
    const opening = yield* repository
    if (opening._tag !== "Opened") {
      return { _tag: "Blocked", repo: opening } as const
    }
    // Two independent questions, asked together — the same shape `survey` above
    // uses, and it earns it twice over now that this verb is on the commit path
    // rather than behind a button: `state` is a subprocess AND a synchronous
    // walk of the git directory, so serialising them stalls the loop's own
    // round trip for no reason.
    const [repo, dirt] = yield* Effect.all(
      [opening.repo.state, opening.repo.dirty],
      { concurrency: 2 },
    )
    if (repo._tag !== "Ready") return { _tag: "Blocked", repo } as const
    if (dirt._tag === "Unusable") {
      // A survey git refused: the count this verb reports on cannot be read, so
      // it is the same news the panel gets rather than a push into the dark.
      return { _tag: "Blocked", repo: { _tag: "Unusable", said: dirt.said } } as const
    }
    const upstream = dirt.upstream
    if (upstream !== null && upstream.ahead === 0) {
      return { _tag: "NothingToPush" } as const
    }

    const outcome = yield* opening.repo.push
    if (outcome._tag === "Refused") {
      // VERBATIM, exactly as a refused commit is: authentication, a
      // non-fast-forward, a branch with no upstream. What git said is the only
      // thing that says what to do next, and this is the one failure a person
      // cannot see any other way from inside the app.
      //
      // REMEMBERED now, and republished — which is the bug this feature is
      // named after. The words used to reach one tab's memory and the server's
      // log and nowhere else, so a reload lost them and a second tab never had
      // them, while the chip went on reading `✓ committed` over a count that
      // never came down.
      pushed(outcome.said)
      options.onSettled?.()
      return { _tag: "Failed", said: outcome.said } as const
    }
    pushed(null)
    // What is waiting has changed without a served byte moving — the same
    // reason a commit republishes.
    options.onSettled?.()
    return {
      _tag: "Pushed",
      upstream: upstream?.name ?? "",
      commits: upstream?.ahead ?? 0,
    } as const
  })

  /**
   * Why the write that just landed is not in the history — and nothing else.
   *
   * What used to be here was the per-write commit: `--commit=auto` staged
   * exactly the files one write produced and committed them, inside the write
   * gate, on every op. It is RETIRED. It turned one train of thought into a
   * dozen commits, which is the thing manual mode was introduced to end, and
   * the browser had already grown a quiet window to avoid it — so olai shipped
   * two features called Auto-commit that meant different things. There is one
   * window now and it belongs to the directory ({@link loop}).
   *
   * The probe survives the retirement, and for the reason it was added: a write
   * on a mid-rebase repository is not waiting for a window, and telling an
   * agent it is sends it to call a tool that will refuse.
   */
  const whyWaiting = (writer: Writer): Effect.Effect<string> =>
    Effect.gen(function*() {
      // `off` asks git nothing at all — that is what the opt-out is for.
      if (mode() === "off") return whyOf("off", OFF, null, writer)

      // One MEMOISED `rev-parse` for a directory that is a work tree. A
      // directory that is NOT one, or a git that cannot be asked, is the whole
      // answer already.
      const opening = yield* repository
      if (opening._tag !== "Opened") return whyOf(mode(), opening, null, writer)

      const repo = yield* opening.repo.state
      return whyOf(mode(), repo, settled.refusal, writer)
    })

  // ── the quiet window ───────────────────────────────────────────────────

  /**
   * WHAT THE WINDOW IS WAITING ON, as a value a stream can debounce.
   *
   * `Effect.runSync` because {@link make} is a plain function and this is the
   * one piece of state in it that has to be observable: `SubscriptionRef.make`
   * asks for nothing, does no I/O and cannot fail, so running it here is the
   * construction it looks like rather than an escape hatch. The alternative —
   * making this whole factory an effect — would put a `yield*` in front of
   * every composition root for one ref.
   */
  const arming = Effect.runSync(SubscriptionRef.make(""))

  /**
   * THE LAST SURVEY, held so the window can be asked its own question again at
   * the moment it closes.
   *
   * It is not stale by construction: a survey that said anything new would have
   * re-armed the window, so a window that fired is a window nothing has
   * republished under for fifteen seconds. What CAN have moved in that gap is
   * the policy and the pause, and those are read fresh below — which is why
   * `@olai/format`'s rule takes them apart from the reading.
   */
  let looked: Pending = NOTHING_PENDING

  const observe = (pending: Pending): Effect.Effect<void> => {
    looked = pending
    return SubscriptionRef.set(arming, armedOn(mode(), settled.paused, pending))
  }

  /**
   * The commit the window makes, asked for exactly as the button asks for it.
   *
   * `{}` is no message and no selection: no message so the server composes the
   * same summary the panel would have suggested, and no selection so it is a
   * full sweep of the repository — which is the one that clears the per-writer
   * counters and the only honest reading of "everything that was waiting". One
   * committer, a new trigger; nothing here knows how a commit is made, and the
   * push that may follow is that verb's ({@link commit}).
   *
   * `auto` is the writer, and it is the writer this feature added: nobody
   * pressed anything and there may be no browser anywhere, so `web` in the
   * trailer would be a lie in every commit a headless serve makes.
   *
   * THE SAME RULE IS ASKED AGAIN at the moment the window closes rather than
   * trusted from when it was armed — one expression, both moments
   * (`@olai/format`'s `armedOn`) — because fifteen seconds is long enough
   * for somebody to turn the policy off and for git to refuse something else.
   * It costs no survey: a reading that said anything new would have re-armed
   * the window rather than let it close.
   */
  const record: Effect.Effect<void> = Effect.gen(function*() {
    if (armedOn(mode(), settled.paused, looked) === "") return
    yield* commit({}, "auto")
  })

  /**
   * The loop, as the ecosystem's own debounce over what {@link observe} says.
   *
   * `Stream.debounce` drops every reading inside the window and keeps only the
   * last, which is exactly the rule: a burst of writes is ONE commit, and the
   * window runs from the last of them. `Stream.changes` in front of it is what
   * makes a survey saying nothing new cost nothing — the server's slow sweep
   * over a quiet directory would otherwise push the window out every thirty
   * seconds and a busy repository would never record at all.
   *
   * A DEFECT here must not take the loop with it. Everything `record` calls
   * answers rather than fails, so the only way through this is a bug — and a
   * bug that silently ended the recording is the exact failure mode this
   * feature exists to remove. It is logged and the stream carries on.
   */
  const loop: Effect.Effect<void> = Stream.runForEach(
    Stream.debounce(
      Stream.changes(SubscriptionRef.changes(arming)),
      options.quiet ?? Duration.millis(QUIET_MS),
    ),
    (flurry) =>
      flurry === "" ? Effect.void : Effect.catchCause(record, (cause) =>
        Effect.annotateLogs(
          Effect.logError("olai git: the auto-commit loop failed to record"),
          { cause: String(cause) },
        )),
  )

  const catchUp: Effect.Effect<void> = Effect.gen(function*() {
    if (options.policy.now().push !== "auto") return
    const looked = yield* survey
    if (looked.unpushed === null || looked.unpushed.commits === 0) return
    yield* push
  })

  const resume: Effect.Effect<void> = Effect.sync(() => {
    if (settled.paused === null) return
    settled = { ...settled, paused: null }
    // The republish is what puts the loop back on the arming stream, and it is
    // the whole of what a person is answered with: what is waiting has not
    // moved, so nothing else would say so, and a resumed loop would otherwise
    // sit there until the next write. Pressing it on a loop that is already
    // running says nothing, because there is nothing to say.
    options.onSettled?.()
  })

  /** The repository's state on its own — what {@link Committing.git} wants,
   *  without the status walk and the parsing {@link pending} does for the
   *  panel. */
  const repoState: Effect.Effect<RepoState> = Effect.gen(function*() {
    if (mode() === "off") return OFF
    const opening = yield* repository
    if (opening._tag !== "Opened") return opening
    return yield* opening.repo.state
  })

  return {
    status,
    pending: Effect.map(status, (both) => both.pending),
    commit,
    push,
    whyWaiting,
    wrote,
    observe,
    loop,
    catchUp,
    resume,
    /**
     * This value's answer on its own, for a caller that wants only it: the
     * directory's own state, plus the four facts no probe of it can see
     * ({@link gitOf}).
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
      gitOf(repo, options.policy, settled)),
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
 *  `chat-agent` is a session `olai web` spawns and `auto` is that serve's own
 *  quiet window, so neither has a `--help` of its own. `web` and `mcp` do — and
 *  a TERMINAL is a client of `mcp` rather than a face of its own, so it has no
 *  row here either (`@olai/format`'s `Writer`). */
export type CommitFace = Exclude<Writer, "chat-agent" | "auto">
