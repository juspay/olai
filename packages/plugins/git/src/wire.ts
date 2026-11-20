import { defineSurface } from "@kolu/surface/define"
import {
  CommitRequest,
  CommitResult,
  GIT_OFF,
  GitState,
  NOTHING_PENDING,
  OpFailure,
  Pending,
  PushResult,
  sameGit,
  samePending,
  UnlockResult,
} from "@olai/format"
import { Schema } from "effect"

export const name = "git"

export const surface = defineSurface({
  cells: {
    repository: { schema: Schema.NullOr(Schema.String), default: null, verbs: ["get"] },
    git: {
      schema: GitState,
      default: GIT_OFF,
      verbs: ["get"],
      equals: sameGit,
    },
    pending: {
      schema: Pending,
      default: NOTHING_PENDING,
      verbs: ["get"],
      equals: samePending,
      arrayKey: "path",
    },
  },
  procedures: {
    git: {
      commit: {
        input: CommitRequest,
        output: CommitResult,
        error: OpFailure,
      },
      push: {
        input: Schema.Struct({}),
        output: PushResult,
        error: OpFailure,
      },
      resume: {
        input: Schema.Struct({}),
        output: Schema.Struct({}),
        error: OpFailure,
      },
      unlock: {
        input: Schema.Struct({}),
        output: UnlockResult,
        error: OpFailure,
      },
    },
  },
})

export const faces = {
  browser: {
    repository: "resource",
    git: "resource",
    pending: "resource",
    "git.commit": "tool",
    "git.push": "tool",
    "git.resume": "tool",
    "git.unlock": "tool",
  },
} as const
