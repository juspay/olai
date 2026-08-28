/**
 * What a commit that has not happened yet looks like.
 *
 * Data, and nothing but: there is no git in this file and no way to reach one
 * from it. It is here for the same reason `./failure.ts` is — this package is
 * the floor both the ops layer and the wire spec stand on, and a vocabulary
 * spelled in either of those would have to be spelled again in the other. The
 * ops layer PRODUCES these values (`@olai/ops`), the surface CARRIES them
 * (`@olai/surface`), the browser DRAWS them, and none of the three has to agree
 * with the others by memory.
 *
 * The rule the whole feature is built on is one line long: **derive it from
 * git, store nothing** (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/git-commits.md). Same discipline as
 * node status and blockedness. Anything cached here would be a second answer to
 * a question git already answers, and it would be wrong the moment somebody
 * edits a file in vim.
 *
 * The one exception is `wrote`, and it is marked as what it is: a DECORATION on
 * the git-derived truth, allowed to be empty and never to be relied on.
 */

import { How, Reason, RepoState } from "@olai/git/state"
import { Schema } from "effect"

import { NodeChange } from "./changes.ts"

/**
 * What a repository IS, re-exported rather than declared.
 *
 * These two belong to `@olai/git` now — they are that package's own answer to
 * "can this be committed to", and it is the package that produces them. They
 * are re-exported HERE because they TRAVEL: the pending value below carries a
 * `RepoState`, the surface declares that schema, and the browser draws it. One
 * declaration, one wire shape, and consumers above go on importing them from
 * the package they already import everything else from.
 *
 * They come off the `@olai/git/state` subpath, which is the half of that
 * package with no subprocess in it — the main entry rides `@olai/child`,
 * and this module is imported by a browser.
 */
export { How, Reason, RepoState }

/**
 * How writes reach git — the values of `--commit`, and the one table of them.
 *
 * It lives on this floor rather than in `@olai/ops` because it TRAVELS now. The
 * mode used to be a fact the server kept to itself: `off` reached a browser as
 * {@link GitState}'s `off` status and the other two were indistinguishable from
 * out here. `vault-level-settings` made the flag a POLICY the client has to
 * draw — pinned, read-only, with the flag named — so the vocabulary is declared
 * once, on the floor the wire spec and the ops layer both already stand on,
 * which is the argument `RepoState` is re-exported above by.
 *
 * `manual` is the point of the whole thing: a write lands on disk and WAITS,
 * and something asks for a commit. `auto` is the SERVER's quiet-window loop —
 * what is waiting records itself once writes stop arriving for fifteen seconds,
 * whoever made them (`./window.ts`). `off` is `--no-commit`.
 *
 * `auto` used to mean one commit per write, made inside the write gate, and
 * that is retired: a train of thought arrived as a dozen commits, and the
 * browser had grown a quiet window of its own to avoid exactly that. There is
 * one window now and it belongs to the directory.
 */
export const COMMIT_MODES = ["off", "manual", "auto"] as const
export type CommitMode = (typeof COMMIT_MODES)[number]

/** What `--commit` means when nobody gave it — the default, spelled once, so
 *  "the flag was not given" and "the flag said manual" cannot come to disagree
 *  about what the server then does. */
export const COMMIT_DEFAULT: CommitMode = "manual"

/**
 * ... and the values of `--push`, which is the newer flag and has TWO.
 *
 * Deliberately not three. `--commit`'s `manual` and `off` are different facts
 * about a directory — one waits for somebody to ask, the other says olai never
 * touches git here — and pushing has no such pair: a branch that is not sent on
 * its own is sent by the Push button, and there is no third thing to be. A
 * `manual` beside this `off` would be two names for one behaviour.
 */
export const PUSH_MODES = ["off", "auto"] as const
export type PushMode = (typeof PUSH_MODES)[number]

/** What `--push` means when nobody gave it — spelled once beside
 *  {@link COMMIT_DEFAULT} and for the same reason: "nobody said" and "somebody
 *  said off" must not be able to come to disagree about what the server does. */
export const PUSH_DEFAULT: PushMode = "off"

/**
 * WHAT THE OPERATOR PINNED, and `null` for each half nobody pinned.
 *
 * The whole of `vault-level-settings` on the wire. In a team deployment,
 * committing and pushing are the SERVER's decision and the same for everyone —
 * not whichever browser's preference happens to be set — so a flag given on the
 * command line (or through the home-manager module, which passes the same
 * flags) freezes the two git rows in every browser's preferences: drawn in the
 * pinned state, read-only, with the flag that set them named on screen.
 *
 * `null` is the DEFAULT and it is the arm that matters: a flag nobody gave
 * leaves the two rows LIVE — they set the server's own policy for this
 * directory, which every browser then draws alike. Single-user, nothing about
 * this feature is visible at all.
 *
 * There is deliberately no settings file IN THE VAULT behind this. Where a
 * choice is remembered at all it is remembered outside it (`@olai/server`'s
 * `gitPolicy.ts`, under the XDG state directory, keyed by the served path): a
 * file in the vault would travel with `git pull`, so a personal clone of a
 * team's outlines would inherit the team's auto-push, which is exactly wrong
 * (the ruling, 2026-08-21).
 */
export const GitPin = Schema.Struct({
  /** The mode `--commit` was GIVEN, or `null` when it was not given at all. */
  commit: Schema.NullOr(Schema.Literals(COMMIT_MODES)),
  /** The mode `--push` was GIVEN, or `null` when it was not given at all. */
  push: Schema.NullOr(Schema.Literals(PUSH_MODES)),
})
export type GitPin = typeof GitPin.Type

/** Nothing pinned: what a server started with neither flag publishes, and what
 *  a page holds before it has heard anything. It is also the shape a REMEMBERED
 *  choice has — either half unsaid — which is what lets {@link policyOf} take
 *  the two in one expression. */
export const NO_PIN: GitPin = { commit: null, push: null }

/**
 * WHAT THIS SERVER ACTUALLY DOES about the two verbs — both halves, together,
 * because they are one policy about one directory.
 *
 * Three sources, in the one order that can be honoured: the FLAG wins, because
 * an operator who typed it stated a policy for everybody; then what somebody
 * CHOSE here (remembered outside the vault, and `null` for a directory nobody
 * has chosen for); then the defaults, which are spelled in exactly one place
 * each ({@link COMMIT_DEFAULT}, {@link PUSH_DEFAULT}).
 *
 * It replaces a `commitModeOf` that answered only the first half, on the
 * argument that this server had no push of its own to govern. That stopped
 * being true: `--push=auto` now follows a settled commit the server itself
 * made, so a push mode is a thing this process DOES rather than a message it
 * relays to browsers.
 */
export const policyOf = (pin: GitPin, chosen: GitPin = NO_PIN): GitPolicy => ({
  commit: pin.commit ?? chosen.commit ?? COMMIT_DEFAULT,
  push: pin.push ?? chosen.push ?? PUSH_DEFAULT,
})

/**
 * The policy in force, with no `null` left in it — what the server does, and
 * what the two preference rows draw.
 *
 * Its own shape beside {@link GitPin} rather than the same one narrowed,
 * because the two answer different questions and a reader holding one must not
 * be able to mistake it for the other: the pin says WHO DECIDED (and leaves a
 * half unsaid where nobody did), this says WHAT HAPPENS (and cannot).
 */
export const GitPolicy = Schema.Struct({
  commit: Schema.Literals(COMMIT_MODES),
  push: Schema.Literals(PUSH_MODES),
})
export type GitPolicy = typeof GitPolicy.Type

/** The policy a server nobody has said anything to runs under — the two
 *  defaults, as the one value they come to. */
export const DEFAULT_POLICY: GitPolicy = {
  commit: COMMIT_DEFAULT,
  push: PUSH_DEFAULT,
}

/** Asking the server to change it — each half optional, because the two rows
 *  move one at a time and a request that had to carry both would make a browser
 *  re-state a policy it was only reading. */
export const PolicyRequest = Schema.Struct({
  commit: Schema.optionalKey(
    Schema.Literals(COMMIT_MODES).annotate({
      description:
        "how writes reach git in this directory: off, manual, or auto (the " +
        "quiet-window loop). Omitted leaves it as it is.",
    }),
  ),
  push: Schema.optionalKey(
    Schema.Literals(PUSH_MODES).annotate({
      description:
        "whether a settled commit is pushed to the branch's upstream. " +
        "Omitted leaves it as it is.",
    }),
  ),
})
export type PolicyRequest = typeof PolicyRequest.Type

/**
 * What git is doing for the served directory, for the git indicator in the app
 * header (`git-invisible`, #108) and for the agent that reads the same cell
 * over MCP.
 *
 * FLAT — a status, the words that go with it, what the operator pinned, what
 * the server is DOING, and what the loop last came to — because this value
 * TRAVELS:
 * the ops layer derives it from its own survey's `RepoState` (`gitOf`, which
 * owns the one-survey coherence argument), the surface declares it as the
 * `git` cell (which says how each of the four states is drawn), and the
 * browser draws it. It used to be declared once per layer — an interface in
 * `@olai/ops`, a schema in `@olai/surface`, "deliberately the same shape"
 * kept in step by a comment — which is exactly the hand-kept mirror this file
 * exists to retire. One declaration now, HERE, for the reason `RepoState` is
 * re-exported above: this package is the floor both of those stand on.
 */
export const GitState = Schema.Struct({
  status: Schema.Literals(["off", "repo", "none", "error"]),
  /** What git said, for the state that has something to quote — the reason a
   *  reader gets rather than "something went wrong". `null` otherwise: a
   *  healthy repository is not quoting anything. */
  said: Schema.NullOr(Schema.String),
  /**
   * What the OPERATOR pinned — see {@link GitPin}.
   *
   * It rides HERE rather than on a cell of its own, and that is one channel
   * rather than thrift: this cell is already "what git is for this directory",
   * a `--no-commit` serve already reaches a browser through it as `off`, and
   * the preferences panel that draws the pin is drawing the same server's
   * answer about the same directory. A second cell would be a second thing to
   * seed, a second thing to keep in step, and a second moment for a page to be
   * holding one of them and not the other.
   *
   * It MOVES NEVER: the flags are read once, at boot. Riding a value that is
   * recomputed on a timer costs nothing for the reason the status does not —
   * {@link sameGit} is what keeps a republish that says nothing new quiet.
   */
  pinned: GitPin,
  /**
   * WHAT THIS SERVER DOES about the two verbs, with the defaults filled in and
   * whatever anybody chose already folded in ({@link policyOf}).
   *
   * The whole of `git-policy-server-side` on the wire, and the reason the two
   * preference rows can be drawn at all now: they used to draw a value stored
   * in that browser, so two tabs of two browsers could each believe something
   * different about one directory and only one of them could be right. This is
   * the directory's own answer, so every tab draws the same one and a reload
   * changes nothing.
   *
   * Beside {@link GitState.pinned} rather than instead of it, because the two
   * are different questions: this says what happens, the pin says whether a
   * reader may change it.
   */
  policy: GitPolicy,
  /**
   * What git said when it last refused a PUSH, or `null` when the last one
   * worked (and for a directory nothing has ever been pushed from).
   *
   * Its own field beside {@link GitState.said} rather than folded into it, and
   * the separation is the bug this feature was filed for: a refused push leaves
   * a repository whose every commit still lands, so the status stays `repo` and
   * the pill read `✓ committed · 13 unpushed` over a push that had been failing
   * for an hour. One field per verb is what lets the chip say the true thing
   * about both at once.
   *
   * REMEMBERED, like the commit refusal, because no probe can see it: `git
   * status` says how far ahead the branch is, never why it is still ahead.
   */
  pushSaid: Schema.NullOr(Schema.String),
  /**
   * WHY THE LOOP STOPPED, or `null` while it is running — git's own words, from
   * whichever verb refused.
   *
   * A fact about the DIRECTORY now, which is the whole of the move: it used to
   * be a signal in one tab's memory, so a reload was a silent retry and a second
   * tab never knew. The loop does not go round again while this is set — a loop
   * that un-paused itself is the blind retry wearing a different hat — and the
   * one way out is the `git.resume` procedure, which the preferences panel's
   * Resume button calls.
   */
  paused: Schema.NullOr(Schema.String),
})
export type GitState = typeof GitState.Type

/** What a page reads before the first frame arrives, and what a `--no-commit`
 *  serve stays in — beside its type for the reason {@link NOTHING_PENDING} is
 *  beside `Pending` below. `off` is the right default twice over: it is the
 *  calmest of the four, so a page cannot flash "git error" at a healthy
 *  repository on its way to the truth. (What the page says before it has heard
 *  ANYTHING is not this value — the pill has a face of its own for that,
 *  because "we have not been told" and "commits are off" are two different
 *  claims.) */
export const GIT_OFF: GitState = {
  status: "off",
  said: null,
  pinned: NO_PIN,
  policy: DEFAULT_POLICY,
  pushSaid: null,
  paused: null,
}

/**
 * When two readings of what git is doing say the same thing.
 *
 * The same claim {@link samePending} makes below and for the same reason —
 * these two are the OTHER halves of one survey, recomputed by one statement on
 * one pair of clocks (`server/runtime.ts`'s `republishGit`), so a cell that
 * swallowed a repeat on one side and framed it on the other is one survey
 * arriving as two kinds of news. Without it a healthy repository put a fresh
 * `repo` on every open tab's wire twice a minute, which is a frame saying
 * exactly what the last one did.
 *
 * DERIVED from the schema, exactly as `samePending` is: written out by hand it
 * would be two field comparisons beside the declaration of those same two
 * fields, and the third field added to {@link GitState} would simply not be
 * compared — a frame that is never sent, which is the failure an `equals` is
 * here to prevent in the other direction.
 */
export const sameGit: (a: GitState, b: GitState) => boolean = Schema
  .toEquivalence(GitState)

/** Who asked for a write. Intent rather than identity — git only ever records
 *  the repository's own name and email, so without this an agent's edits are
 *  indistinguishable from the ones a person typed.
 *
 *  It stays HERE rather than travelling down to `@olai/git` with the repository
 *  state, and the difference is the point of that extraction: which writers
 *  olai has is a statement about olai. The git package hands back the trailer
 *  it read, verbatim, and the ops layer classifies it against this list.
 *
 *  THERE ARE FOUR, and there were five. `capture` was the bespoke
 *  `POST /capture` door and went with it; a `cli` replaced it for one commit,
 *  for a terminal on a unix socket of its own, and went when that socket did.
 *  Neither is here, because the trailer is written and never parsed back: a
 *  literal nothing can produce is dead vocabulary rather than compatibility.
 *
 *  **A TERMINAL HAS NO WORD OF ITS OWN, and that follows from the design rather
 *  than being an omission.** `olai surface` is a client of `/mcp` — the same
 *  protocol at the same path under the same rule as any other HTTP client
 *  (ruled, human 2026-08-23) — so its writes are recorded under whatever that
 *  door is served as, exactly as an agent's are. This word records a DOOR, and
 *  a terminal does not have one to itself any more. What it costs is real and
 *  worth saying: `git log` can no longer separate a line typed in a terminal
 *  from a tool call by an agent on the same listener. What it buys is that
 *  there is only one door to reason about at all.
 *
 *  WHO captured is a different question and IS answered, elsewhere: the
 *  identity that door has rides the captured node itself, as a property
 *  (`@olai/format`'s `inbox.ts`, which the `capture` tool composes through).
 *
 *  `auto` is the fifth and is the only one that never writes a FILE: it is the
 *  server's own quiet-window loop, which makes commits and nothing else
 *  (`./window.ts`, run by `@olai/ops`). It is here rather than reusing `web` because that
 *  would be a lie a headless serve tells in every commit it makes — there is no
 *  page, no button and possibly no browser anywhere — and the trailer is the
 *  permanent half of "who did this". */
export const Writer = Schema.Literals([
  "chat-agent",
  "mcp",
  "web",
  "auto",
])
export type Writer = typeof Writer.Type

/** Whether a commit could be asked for at all. */
export const isReady = (repo: RepoState): boolean => repo._tag === "Ready"

/** Whether committing is a thing that could ever happen here. `false` is the
 *  two SETTINGS — no repository, or commits turned off — plus the git that could
 *  not be asked at all, which is a FAULT and is drawn as one (the header's git
 *  indicator wears it as `git error`, with git's own words), rather than
 *  something a Commit button can offer to do anything about. */
export const isPossible = (repo: RepoState): boolean =>
  repo._tag === "Ready" || repo._tag === "Blocked"

/**
 * The last commit OLAI made here — not the repository's HEAD.
 *
 * A person's own commits are not what this feature reports on, so it is HEAD as
 * seen through the same filter the audit view uses: the `olai` message prefix.
 * The trailer is what says WHO, and it is separate because a commit can carry
 * the prefix without one (a person typing it by hand, a trailer stripped by a
 * rebase) — reporting `null` there is more honest than guessing.
 */
export const LastCommit = Schema.Struct({
  sha: Schema.String,
  /** The subject line. The body is the per-node list, which is what the
   *  pending panel draws for itself. */
  message: Schema.String,
  writer: Schema.NullOr(Writer),
  /** ISO 8601, so "12m ago" is the reader's clock and their time zone rather
   *  than the server's. */
  at: Schema.String,
})
export type LastCommit = typeof LastCommit.Type

/** One writer's share of what is waiting. Counts, not messages: the messages
 *  are the changes, which come from git. */
export const Wrote = Schema.Struct({
  writer: Writer,
  ops: Schema.Int,
})
export type Wrote = typeof Wrote.Type

/**
 * Where a RENAMED row came from — repo-root-relative, and `null` on every row
 * that did not move.
 *
 * A rename is ONE thing that happened, so it is one row with two names on it
 * rather than an arrival beside a departure with nothing joining them. Both
 * kinds of row carry it, and for the reason they both spell their own name
 * `path`: a consumer reading either list writes `one.from` without having to
 * remember which list it is holding.
 *
 * It is what turns `Reading.md deleted` — a person's own vault, the morning
 * after the outline extension changed, with the file that actually holds their
 * notes nowhere on screen — into `Reading.md → Kept.olai`.
 *
 * Repo-root-relative on BOTH rows, like `path`, because that is the one name a
 * file has that cannot collide across a repository. A list that draws SERVED
 * names shortens it for the reader, which is a rendering question and belongs
 * where the drawing is.
 */
const From = Schema.NullOr(Schema.String)

/**
 * One dirty OUTLINE, as a file rather than as the nodes in it.
 *
 * The node-level `changes` are what a reader mostly wants, and this is the row
 * they hang under: the file is the unit git commits, so it is the unit a
 * selection ticks — an outline's node changes travel together, because a partial
 * `.olai` write is not a thing that exists.
 *
 * It carries BOTH spellings because both are needed and neither can be derived
 * from the other outside the server: `file` is what `changes` and `unreadable`
 * are keyed by (served-root-relative, the store's own key), and `path` is the
 * one unambiguous name for the file in the repository — which is what a commit
 * request names, so that an outline `roadmap.olai` under `docs/` and some other
 * dirty `roadmap.olai` at the repository root can never be the same tick.
 */
export const DirtyOutline = Schema.Struct({
  file: Schema.String,
  path: Schema.String,
  how: How,
  from: From,
})
export type DirtyOutline = typeof DirtyOutline.Type

/**
 * One dirty file that is NOT an outline olai serves — the whole of what
 * `commit-whole-repo` adds to what is waiting.
 *
 * A person edits a `README.md` by hand and the git part of the UI used to show
 * nothing pending: `git status` had already surveyed the file and one line later
 * threw it away, because olai only writes `.olai` and only listed what it
 * writes. These are path-level rows and deliberately nothing more — no diff, no
 * parsing, no node list. What would be shown is a text diff, and this feature
 * has never shown one.
 *
 * Documents, source files, an outline OUTSIDE the served root (olai does not
 * serve it, so there is no working-side parse to compare against), and anything
 * else somebody's working tree holds. `.gitignore` is respected for free, since
 * this comes from `git status`.
 *
 * `path` is repo-root-relative — what a reader is shown, and the name a commit
 * request ticks. It is spelled the same as {@link DirtyOutline}'s `path` and
 * means the same thing, deliberately: the two lists are two kinds of ROW and one
 * namespace of keys, so a consumer collecting a selection out of both writes
 * `one.path` either way rather than remembering which list calls it what.
 */
export const Other = Schema.Struct({
  path: Schema.String,
  how: How,
  from: From,
})
export type Other = typeof Other.Type

/**
 * What is committed here and not shared anywhere.
 *
 * `null` when the branch has no upstream at all, and that is a different fact
 * from `commits: 0`: a branch nobody has ever pushed has nowhere to go, and
 * offering to push it would be offering to guess a remote. Picking one is a
 * conversation in a terminal, which is where resolving a divergence stays.
 *
 * BEHIND is deliberately absent for the same reason. This program has one push
 * verb; it has no pull, no fetch and no branch UI, because it is an audit-trail
 * recorder rather than a git client.
 */
export const Unpushed = Schema.Struct({
  /** Git's own name for the upstream — `origin/master`. */
  upstream: Schema.String,
  /** Commits on this branch the upstream does not have. */
  commits: Schema.Int,
})
export type Unpushed = typeof Unpushed.Type

/**
 * Everything a Commit button and a `commit` tool both need.
 *
 * All of it is derived from git every time it is asked for: `git status
 * --porcelain` names every dirty file in the REPOSITORY, the copy the current
 * commit holds is the committed side of each dirty outline, the codec parses
 * both, and the comparison is `./changes.ts`. Cost is bounded by what CHANGED:
 * a clean directory parses nothing at all, and a keystroke costs nothing per
 * file that was already waiting, since a commit's copy of a file cannot change
 * and is read once per commit (`@olai/ops`' `committed.ts`). What a revision
 * spends in subprocesses is counted where they are spent, in that layer's own
 * header, rather than quoted twice.
 *
 * TWO KINDS OF ROW, and the difference is what olai can say about a file rather
 * than what it is allowed to commit. An outline it serves gets node-level
 * detail, because both sides parse into records and the comparison is in hand.
 * Everything else gets a path and a status letter, because the only other thing
 * available is a text diff — and this feature has never shown one.
 *
 * `wrote` is the one thing that cannot come from git, so it is the one thing
 * that is allowed to be wrong: it is empty after a restart and knows nothing
 * about edits made in an editor. The panel then draws the changes with no
 * writer beside them, which is fine. **Nothing downstream may assume it is
 * complete.**
 */
export const Pending = Schema.Struct({
  repo: RepoState,
  changes: Schema.Array(NodeChange),
  /**
   * The dirty outlines olai serves, one row each — the GROUPS the node-level
   * `changes` hang under, and the unit a selection ticks.
   *
   * Carried rather than derived from `changes` by grouping, and it earns that
   * three times over: it names each file's repo-relative path (which a commit
   * request needs and a node change has no room for), it says HOW the file
   * moved (a brand-new outline is `untracked`, which no node comparison can
   * tell you), and it holds an outline whose bytes moved without any node
   * changing — a reformat, a reordered line — which would otherwise be dirty,
   * committable, and invisible.
   *
   * The invariant between the three lists, stated so it can be checked: every
   * `changes[].file` and every `unreadable[]` is one of these `file`s. It is not
   * the other way round, which is the reason `changes` is not simply NESTED in
   * here — a node that was archived is ONE change that left one file and arrived
   * in another (`./changes.ts` compares by id across files, deliberately), so a
   * change is not owned by a single file and a nested list would have to
   * duplicate it or drop half of it.
   */
  outlines: Schema.Array(DirtyOutline),
  /** Every OTHER dirty file in the repository — see {@link Other}. */
  others: Schema.Array(Other),
  /** Dirty outlines whose working copy does not parse. Listed rather than
   *  dropped: a file that cannot be read is exactly the one a reader needs
   *  told about, and committing it is still allowed — the bytes are the
   *  bytes. */
  unreadable: Schema.Array(Schema.String),
  /**
   * Which part of the repository olai serves, from the repository root — `""`
   * when it IS the root, `"docs/"` when it is a directory inside one.
   *
   * On the wire because the scope is now something a reader has to be TOLD: the
   * panel reports on the whole repository, and a `README.md` two directories
   * above the outlines is a row in it. "whole repository · olai serves docs/"
   * is the sentence, and the second half of it is this.
   */
  served: Schema.String,
  /** What is committed and not pushed — see {@link Unpushed}. */
  unpushed: Schema.NullOr(Unpushed),
  wrote: Schema.Array(Wrote),
  /** The message a commit gets when nobody supplies one. Composed here so the
   *  panel can show it before it is used and a person can edit it. */
  message: Schema.String,
  /**
   * The last commit olai made here, or `null` for a directory it has never
   * committed in.
   *
   * The `null` is load-bearing and not an absence to paper over. What is
   * WAITING does not say whether anything was ever recorded, and those are two
   * different facts about the same directory: a clean tree that just committed
   * and a clean tree where olai has never written anything both have nothing
   * pending, and telling the second one "✓ committed" would be a lie. Same
   * reasoning as the manifest cell's `null` — "never" is a state that cannot be
   * expressed by an empty value.
   */
  last: Schema.NullOr(LastCommit),
})
export type Pending = typeof Pending.Type

/**
 * When two readings say the same thing, so the cell carrying them can stay
 * quiet.
 *
 * It earns its place: this value is recomputed on a timer as well as on every
 * revision, and without it every open tab would get a frame every thirty
 * seconds saying exactly what it already knew. The equality has to be about
 * what is SAID rather than about identity — a fresh derivation is a fresh
 * object every time, so `===` would never hold.
 *
 * DERIVED from the schema, and that is the whole point: written out by hand it
 * was three levels of field-by-field comparison beside the declaration of those
 * same fields, and the next field added to any of them would simply not be
 * compared. The failure mode of that is a frame that is never sent — a browser
 * showing stale data, with nothing anywhere raising an error — which is exactly
 * what an `equals` is here to prevent, in the other direction.
 */
export const samePending: (a: Pending, b: Pending) => boolean = Schema
  .toEquivalence(Pending)

/** What a page holds before the first frame, and what a server with commits
 *  turned off keeps holding. A value a reader ends up looking at (which is
 *  nothing at all), not a placeholder for one. */
export const NOTHING_PENDING: Pending = {
  repo: { _tag: "Off" },
  changes: [],
  outlines: [],
  others: [],
  unreadable: [],
  served: "",
  unpushed: null,
  wrote: [],
  message: "",
  last: null,
}

/** Asking for a commit. An omitted message is the composed one — which is what
 *  the button sends back untouched, and what an agent that has nothing better
 *  to say leaves out. */
export const CommitRequest = Schema.Struct({
  message: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "The commit subject and body. Omitted composes one from what changed. " +
        "An `olai` prefix is added if it is not already there.",
    }),
  ),
  /**
   * WHICH files to commit, if not all of them.
   *
   * Repo-root-relative paths, exactly as `pending` publishes them — `path` on
   * both kinds of row, which is why the two are spelled alike. Omitted means
   * everything waiting, which is what it always did and what the Commit button
   * sends when nothing is unticked.
   *
   * A SELECTION, and never git's index: a path named here is added and
   * committed in one breath, anything a person had staged by hand is left
   * exactly as it was, and a commit that REFUSES puts the index back
   * bit-identical rather than leaving its own staging behind. What is not named
   * stays pending, for its own commit and its own message.
   */
  paths: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Repository-root-relative paths to commit, as `pending` lists them. " +
        "Omitted commits everything waiting. Anything left out stays pending " +
        "for a commit of its own. Never touches git's index, so hand-staged " +
        "work is undisturbed.",
    }),
  ),
})
export type CommitRequest = typeof CommitRequest.Type

/**
 * What asking for one answers with.
 *
 * Four arms rather than a boolean, because the four are four different things
 * to say to a person and to an agent: it happened, there was nothing to do, the
 * repository is busy, git said no.
 */
export const CommitResult = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal("Committed"),
    sha: Schema.String,
    /** How many node-level changes went in. */
    changes: Schema.Int,
    /** How many files went in that no node-level change describes — a
     *  document, a source file, an outline olai does not serve. Both counts,
     *  because a commit can be entirely one or entirely the other and
     *  "committed 0 changes" would read as nothing having happened. */
    others: Schema.Int,
  }),
  Schema.Struct({ _tag: Schema.Literal("NothingToCommit") }),
  Schema.Struct({ _tag: Schema.Literal("Blocked"), repo: RepoState }),
  Schema.Struct({ _tag: Schema.Literal("Failed"), said: Schema.String }),
])
export type CommitResult = typeof CommitResult.Type

/**
 * What asking for a PUSH answers with — the same four shapes as a commit, and
 * deliberately so: it is the same kind of act (something a person asks for,
 * which git may refuse) and a reader has already learnt to read these.
 *
 * `Pushed` names what went and where, because "pushed" on its own is not an
 * audit trail either. `NothingToPush` is a branch already in sync, which is an
 * answer rather than a fault. `Blocked` covers the two settings and the
 * directory that is not a repository. `Failed` is git's own words, whole:
 * authentication, a non-fast-forward, a branch with no upstream, a remote hook
 * that said no. Resolving any of those stays a conversation in a terminal, and
 * the words are how it starts.
 */
export const PushResult = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal("Pushed"),
    upstream: Schema.String,
    commits: Schema.Int,
  }),
  Schema.Struct({ _tag: Schema.Literal("NothingToPush") }),
  Schema.Struct({ _tag: Schema.Literal("Blocked"), repo: RepoState }),
  Schema.Struct({ _tag: Schema.Literal("Failed"), said: Schema.String }),
])
export type PushResult = typeof PushResult.Type

