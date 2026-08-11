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

/** The trailer that puts {@link Writer} in the commit permanently. */
export const WRITER_TRAILER = "X-Olai-Writer"

/** Every message olai writes starts with this. In a project repository the
 *  prefix is what separates tool writes from a person's: `git log --grep
 *  '^olai'` is the audit view, and `--invert-grep` gives back real history. */
export const MESSAGE_PREFIX = "olai"

/** Why the repository cannot take a commit right now. Nothing today checks for
 *  any of them, which is how an agent marking a node done mid-conflict can
 *  swallow a resolution — and it is the hole that decided manual over
 *  automatic. */
export const Reason = Schema.Literals(["merge", "rebase", "cherry-pick", "detached"])
export type Reason = typeof Reason.Type

/**
 * Whether the served directory can be committed to.
 *
 * Four arms, and each is a different thing to draw: `Off` and `NoRepo` mean
 * there is nothing to show at all — a directory of notes under Dropbox is not
 * this program's business, and neither is a server started with `--commit=off`
 * — while `Blocked` is the one that says so out loud, because a button that
 * quietly did nothing would be worse than no button.
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
])
export type RepoState = typeof RepoState.Type

/** Whether a commit could be asked for at all. */
export const isReady = (repo: RepoState): boolean => repo._tag === "Ready"

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
})
export type Pending = typeof Pending.Type

/**
 * When two readings say the same thing, so the cell carrying them can stay
 * quiet.
 *
 * It earns its place: this value is recomputed on a timer as well as on every
 * revision, and without this every open tab would get a frame every thirty
 * seconds saying exactly what it already knew. The comparison is deep because
 * the equality has to be about what is SAID — a fresh derivation is a fresh
 * object every time, so identity would never hold.
 */
export const samePending = (a: Pending, b: Pending): boolean =>
  sameRepo(a.repo, b.repo) &&
  a.message === b.message &&
  same(a.unreadable, b.unreadable, (x, y) => x === y) &&
  same(a.wrote, b.wrote, (x, y) => x.writer === y.writer && x.ops === y.ops) &&
  same(
    a.changes,
    b.changes,
    (x, y) =>
      x.id === y.id && x.file === y.file && x.kind === y.kind &&
      x.sort === y.sort && x.title === y.title &&
      same(x.fields, y.fields, (p, q) => p === q),
  )

const sameRepo = (a: RepoState, b: RepoState): boolean => {
  if (a._tag !== b._tag) return false
  if (a._tag === "Ready" && b._tag === "Ready") return a.branch === b.branch
  if (a._tag === "Blocked" && b._tag === "Blocked") {
    return a.reason === b.reason && a.said === b.said
  }
  return true
}

const same = <A>(
  a: ReadonlyArray<A>,
  b: ReadonlyArray<A>,
  eq: (x: A, y: A) => boolean,
): boolean =>
  a.length === b.length && a.every((entry, at) => eq(entry, b[at] as A))

/** What a page holds before the first frame, and what a server with commits
 *  turned off keeps holding. A value a reader ends up looking at (which is
 *  nothing at all), not a placeholder for one. */
export const NOTHING_PENDING: Pending = {
  repo: { _tag: "Off" },
  changes: [],
  unreadable: [],
  wrote: [],
  message: "",
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

/** How olai commits, and it is a three-state answer rather than a boolean:
 *  `manual` is the default and the whole point, `auto` is for a headless server
 *  with no browser to press anything, and `off` is `--no-commit`. */
export const COMMIT_MODES = ["off", "manual", "auto"] as const
export type CommitMode = (typeof COMMIT_MODES)[number]
