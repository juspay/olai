/**
 * GIT'S OWN SURFACE — what git is doing, what is waiting, and the three verbs,
 * under git's own sibling key.
 *
 * The members used to sit in `@olai/surface`'s own spec: a `git` cell, a
 * `pending` cell, and `git.commit` / `git.push` / `git.resume`. They are here
 * now. Procedures are a group then a verb, so composed they read
 * `surface/git/git/get`, `surface/git/pending/get`, `surface/git/git/commit`.
 * The browser face binds `git.commit` as `"web"` itself.
 *
 * ## THIS ENTRY'S OWN FENCE
 *
 * The composed group is on the static graph of everything that reads the
 * surface, so this module may import the framework, `effect` and `@olai/format`
 * and nothing else: no `solid-js`, no `node:child_process`.
 */

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
} from "@olai/format"
import { Schema } from "effect"

/** The sibling key, the preferences row, the docs slug, and the word
 *  `--plugins` takes. */
export const name = "git"

export const surface = defineSurface({
  cells: {
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
    },
  },
})

/**
 * WHICH FACE SEES WHAT.
 *
 * Browser sees the two cells and the three verbs. MCP tools stay named
 * `commit` / `push` (the ops table) and call through that door with the
 * face's writer; the adapter has no sibling segment for `surface://` cells,
 * and this row puts nothing on the agent face. `resume` is the browser's
 * alone: it is the commit panel's button, and an agent has no loop of its
 * own to restart.
 */
export const faces = {
  browser: {
    git: "resource",
    pending: "resource",
    "git.commit": "tool",
    "git.push": "tool",
    "git.resume": "tool",
  },
} as const
