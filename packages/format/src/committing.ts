import { Schema } from "effect"

import { NodeChange } from "./changes.ts"

export const How = Schema.Literals([
  "modified",
  "added",
  "deleted",
  "renamed",
  "untracked",
])
export type How = typeof How.Type

export const Reason = Schema.Literals(["merge", "rebase", "cherry-pick", "detached"])
export type Reason = typeof Reason.Type

export const RepoState = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Off") }),
  Schema.Struct({ _tag: Schema.Literal("NoRepo") }),
  Schema.Struct({
    _tag: Schema.Literal("Ready"),
    branch: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("Blocked"),
    reason: Reason,
    said: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("Unusable"),
    said: Schema.String,
  }),
])
export type RepoState = typeof RepoState.Type

export const COMMIT_MODES = ["off", "manual", "auto"] as const
export type CommitMode = (typeof COMMIT_MODES)[number]

export const COMMIT_DEFAULT: CommitMode = "manual"

export const PUSH_MODES = ["off", "auto"] as const
export type PushMode = (typeof PUSH_MODES)[number]

export const PUSH_DEFAULT: PushMode = "off"

export const GitPolicy = Schema.Struct({
  commit: Schema.Literals(COMMIT_MODES),
  push: Schema.Literals(PUSH_MODES),
})
export type GitPolicy = typeof GitPolicy.Type

export const DEFAULT_POLICY: GitPolicy = {
  commit: COMMIT_DEFAULT,
  push: PUSH_DEFAULT,
}

export const Lock = Schema.Struct({
  since: Schema.Number,
})
export type Lock = typeof Lock.Type

export const GitState = Schema.Struct({
  status: Schema.Literals(["off", "repo", "none", "error"]),
  said: Schema.NullOr(Schema.String),
  lock: Schema.NullOr(Lock),
  policy: GitPolicy,
  pushSaid: Schema.NullOr(Schema.String),
  paused: Schema.NullOr(Schema.String),
})
export type GitState = typeof GitState.Type

export const GIT_OFF: GitState = {
  status: "off",
  said: null,
  lock: null,
  policy: DEFAULT_POLICY,
  pushSaid: null,
  paused: null,
}

export const sameGit: (a: GitState, b: GitState) => boolean = Schema
  .toEquivalence(GitState)

export const Writer = Schema.Literals([
  "chat-agent",
  "mcp",
  "web",
  "auto",
  "move",
  "sleep",
  "filer",
])
export type Writer = typeof Writer.Type

export const COMMIT_BUTTON = "the Commit button"
export const COMMIT_TOOL = "the `commit` tool"

export const isReady = (repo: RepoState): boolean => repo._tag === "Ready"

export const isPossible = (repo: RepoState): boolean =>
  repo._tag === "Ready" || repo._tag === "Blocked"

export const LastCommit = Schema.Struct({
  sha: Schema.String,
  message: Schema.String,
  writer: Schema.NullOr(Writer),
  at: Schema.String,
})
export type LastCommit = typeof LastCommit.Type

export const Wrote = Schema.Struct({
  writer: Writer,
  ops: Schema.Int,
})
export type Wrote = typeof Wrote.Type

const From = Schema.NullOr(Schema.String)

export const DirtyOutline = Schema.Struct({
  file: Schema.String,
  path: Schema.String,
  how: How,
  from: From,
})
export type DirtyOutline = typeof DirtyOutline.Type

export const Other = Schema.Struct({
  path: Schema.String,
  how: How,
  from: From,
})
export type Other = typeof Other.Type

export const Unpushed = Schema.Struct({
  upstream: Schema.String,
  commits: Schema.Int,
})
export type Unpushed = typeof Unpushed.Type

export const Pending = Schema.Struct({
  repo: RepoState,
  changes: Schema.Array(NodeChange),
  outlines: Schema.Array(DirtyOutline),
  others: Schema.Array(Other),
  unreadable: Schema.Array(Schema.String),
  served: Schema.String,
  unpushed: Schema.NullOr(Unpushed),
  wrote: Schema.Array(Wrote),
  message: Schema.String,
  last: Schema.NullOr(LastCommit),
})
export type Pending = typeof Pending.Type

export const samePending: (a: Pending, b: Pending) => boolean = Schema
  .toEquivalence(Pending)

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

export const CommitRequest = Schema.Struct({
  message: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "The commit subject and body. Omitted composes one from what changed. " +
        "An `olai` prefix is added if it is not already there.",
    }),
  ),
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

export const CommitResult = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal("Committed"),
    sha: Schema.String,
    changes: Schema.Int,
    others: Schema.Int,
  }),
  Schema.Struct({ _tag: Schema.Literal("NothingToCommit") }),
  Schema.Struct({ _tag: Schema.Literal("Blocked"), repo: RepoState }),
  Schema.Struct({
    _tag: Schema.Literal("Failed"),
    said: Schema.String,
    lock: Schema.NullOr(Lock),
  }),
])
export type CommitResult = typeof CommitResult.Type

export const UnlockResult = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Removed") }),
  Schema.Struct({
    _tag: Schema.Literal("Held"),
    since: Schema.Number,
  }),
  Schema.Struct({ _tag: Schema.Literal("Absent") }),
])
export type UnlockResult = typeof UnlockResult.Type

export const PushResult = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal("Pushed"),
    upstream: Schema.String,
    commits: Schema.Int,
    integrated: Schema.Int,
  }),
  Schema.Struct({ _tag: Schema.Literal("NothingToPush") }),
  Schema.Struct({ _tag: Schema.Literal("Blocked"), repo: RepoState }),
  Schema.Struct({ _tag: Schema.Literal("Failed"), said: Schema.String }),
])
export type PushResult = typeof PushResult.Type

