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
 * package with no subprocess in it — the main entry reaches
 * `node:child_process`, and this module is imported by a browser.
 */
export { How, Reason, RepoState }

/** Who asked for a write. Intent rather than identity — git only ever records
 *  the repository's own name and email, so without this an agent's edits are
 *  indistinguishable from the ones a person typed.
 *
 *  It stays HERE rather than travelling down to `@olai/git` with the repository
 *  state, and the difference is the point of that extraction: which writers
 *  olai has is a statement about olai. The git package hands back the trailer
 *  it read, verbatim, and the ops layer classifies it against this list. */
export const Writer = Schema.Literals(["chat-agent", "mcp", "web"])
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
 * One dirty OUTLINE, as a file rather than as the nodes in it.
 *
 * The node-level `changes` are what a reader mostly wants, and this is the row
 * they hang under: the file is the unit git commits, so it is the unit a
 * selection ticks — an outline's node changes travel together, because a partial
 * `.jsonl` write is not a thing that exists.
 *
 * It carries BOTH spellings because both are needed and neither can be derived
 * from the other outside the server: `file` is what `changes` and `unreadable`
 * are keyed by (served-root-relative, the store's own key), and `path` is the
 * one unambiguous name for the file in the repository — which is what a commit
 * request names, so that an outline `roadmap.jsonl` under `docs/` and some other
 * dirty `roadmap.jsonl` at the repository root can never be the same tick.
 */
export const DirtyOutline = Schema.Struct({
  file: Schema.String,
  path: Schema.String,
  how: How,
})
export type DirtyOutline = typeof DirtyOutline.Type

/**
 * One dirty file that is NOT an outline olai serves — the whole of what
 * `commit-whole-repo` adds to what is waiting.
 *
 * A person edits a `README.md` by hand and the git part of the UI used to show
 * nothing pending: `git status` had already surveyed the file and one line later
 * threw it away, because olai only writes `.jsonl` and only listed what it
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
 * --porcelain` names every dirty file in the REPOSITORY, `git show HEAD:<file>`
 * is the committed side of each dirty outline, the codec parses both, and the
 * comparison is `./changes.ts`. Cost is bounded by what is dirty — a clean
 * directory is one `git status` and no parsing at all.
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
   * Repo-root-relative paths, exactly as `pending` publishes them (an outline's
   * `path`, another file's `file`). Omitted means everything waiting, which is
   * what it always did and what the Commit button sends when nothing is
   * unticked.
   *
   * A SELECTION, and never git's index: olai does not stage, so a path named
   * here is added and committed in one breath and anything a person had staged
   * by hand is left exactly as it was. What is not named stays pending, for its
   * own commit and its own message.
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

