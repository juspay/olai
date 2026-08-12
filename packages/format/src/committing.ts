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
 * git, store nothing** (docs/brainstorming/git-commits.md). Same discipline as
 * node status and blockedness. Anything cached here would be a second answer to
 * a question git already answers, and it would be wrong the moment somebody
 * edits a file in vim.
 *
 * The one exception is `wrote`, and it is marked as what it is: a DECORATION on
 * the git-derived truth, allowed to be empty and never to be relied on.
 */

import { Schema } from "effect"

import { NodeChange } from "./changes.ts"

/** Who asked for a write. Intent rather than identity — git only ever records
 *  the repository's own name and email, so without this an agent's edits are
 *  indistinguishable from the ones a person typed. */
export const Writer = Schema.Literals(["chat-agent", "mcp", "web"])
export type Writer = typeof Writer.Type

/** Why the repository cannot take a commit right now. Nothing used to check
 *  for any of them, which is how an agent marking a node done mid-conflict
 *  could swallow a resolution — the hole that decided manual over automatic,
 *  and the reason this type exists. Every commit path now refuses when the
 *  answer is one of these. */
export const Reason = Schema.Literals(["merge", "rebase", "cherry-pick", "detached"])
export type Reason = typeof Reason.Type

/**
 * Whether the served directory can be committed to.
 *
 * Five arms, and EVERY ONE OF THEM IS DRAWN. That is the decision the whole
 * control turns on: this feature exists to be an audit trail of what the tool
 * wrote, so "there is no audit trail here" is the single most important thing
 * it can say, and a pill that disappeared is exactly how a person would never
 * find that out. Same argument as the connection dot, which stays green when it
 * is healthy rather than vanishing.
 *
 * `Off` and `NoRepo` are SETTINGS, not faults — a directory of notes under
 * Dropbox is not this program's business, and neither is a server started with
 * `--commit=off`. They are drawn dim and inert, with no warning colour.
 * `Blocked` and `Unusable` are the two a reader is owed an explanation for, and
 * `Blocked` is the one a person can act on.
 *
 * `Unusable` is #108's, and it is why this is five arms rather than the four the
 * design drew: git RAN and could not answer — no binary on the PATH, dubious
 * ownership, a repository it refuses to use. Folding that into `NoRepo` would
 * say "your notes are not a repository" to somebody whose notes are, which is
 * the exact bug `git-invisible` was filed for. One state, one sentence, and git
 * keeps its own words.
 */
export const RepoState = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Off") }),
  Schema.Struct({ _tag: Schema.Literal("NoRepo") }),
  Schema.Struct({ _tag: Schema.Literal("Ready"), branch: Schema.String }),
  Schema.Struct({
    _tag: Schema.Literal("Blocked"),
    reason: Reason,
    /** Git's own words, kept as a field rather than folded into a sentence. */
    said: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("Unusable"),
    /** Git's own words, for the same reason `Blocked` keeps them. */
    said: Schema.String,
  }),
])
export type RepoState = typeof RepoState.Type

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
 * Everything a Commit button and a `commit` tool both need.
 *
 * `changes` and `unreadable` are derived from git every time they are asked
 * for: `git status --porcelain` names the dirty outlines, `git show HEAD:<file>`
 * is the committed side, the codec parses both, and the comparison is
 * `./changes.ts`. Cost is bounded by what is dirty — a clean directory is one
 * `git status` and no parsing at all.
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
  /** Dirty outlines whose working copy does not parse. Listed rather than
   *  dropped: a file that cannot be read is exactly the one a reader needs
   *  told about, and committing it is still allowed — the bytes are the
   *  bytes. */
  unreadable: Schema.Array(Schema.String),
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
  unreadable: [],
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
  }),
  Schema.Struct({ _tag: Schema.Literal("NothingToCommit") }),
  Schema.Struct({ _tag: Schema.Literal("Blocked"), repo: RepoState }),
  Schema.Struct({ _tag: Schema.Literal("Failed"), said: Schema.String }),
])
export type CommitResult = typeof CommitResult.Type

