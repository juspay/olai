/**
 * GIT'S OWN SURFACE — what git is doing, what is waiting, and the three verbs,
 * under git's own sibling key.
 *
 * The members used to sit in `@olai/surface`'s own spec: a `git` cell, a
 * `pending` cell, and `git.commit` / `git.push` / `git.resume`. They are here
 * now. Composed they read `surface/git/git/get`, `surface/git/pending/get`,
 * `surface/git/commit` — the sibling key IS this plugin's {@link name}, so a
 * procedure called `commit` keeps the tag `surface/git/commit` the writer
 * rebind already overwrites per face.
 *
 * ## THIS ENTRY'S OWN FENCE
 *
 * The composed group is on the static graph of everything that reads the
 * surface, so this module may import the framework, `effect` and `@olai/format`
 * and nothing else: no `solid-js`, no `node:child_process`.
 */

import { defineSurface } from "@kolu/surface/define"
import {
  GIT_OFF,
  GitState,
  NOTHING_PENDING,
  Pending,
  sameGit,
  samePending,
} from "@olai/format"

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
})

/**
 * WHICH FACE SEES WHAT.
 *
 * Browser, agent and MCP all see the two cells and the commit/push verbs —
 * they were on all three faces as core members. `resume` is the browser's
 * alone: it is the preferences panel's button, and an agent has no loop of
 * its own to restart.
 */
export const faces = {
  browser: {
    git: "resource",
    pending: "resource",
  },
  agent: {
    git: "resource",
    pending: "resource",
  },
} as const
