/**
 * Git, as something to look at.
 *
 * One pure table over the four states the server publishes (`@olai/surface`'s
 * `GitState`), in the shape `../connection/status.ts` uses for the wire — a
 * table rather than a derivation, because there is nothing left to derive: the
 * server has already decided which of the four this directory is in.
 *
 * The four, and why a reader needs each:
 *
 *   - `off` — `--no-commit`. Drawn NOWHERE, and that is the entry: the owner
 *     of a directory whose history is somebody else's job did not ask for a
 *     badge saying so, and a chrome that reported it would be reporting a
 *     setting rather than a condition.
 *   - `repo` — a work tree, and writes are committing. Quiet: three letters and
 *     a dim dot. This is the healthy default, and chrome that shouted it would
 *     teach a reader to stop looking at the one place the news ever appears.
 *   - `none` — not a work tree. Calm and informational, in the words the human
 *     asked for: plenty of directories are not repositories, and being told so
 *     is not being told off.
 *   - `error` — git tried and could not: no git on the service's PATH, a
 *     refused commit, an identity nobody set. The one alarming state, and the
 *     only one with something to quote — {@link sentence} puts git's own words
 *     in the sentence, which is the whole point of the state existing.
 *
 * WHERE any of it goes is the layout's to say (`../AppHeader.tsx`, beside the
 * connection): this file says what it looks like and what it says.
 */

import type { GitState } from "@olai/surface"

/** How one state is drawn: the dot's colour and the words beside it. */
export interface Look {
  /** The dot. A background utility, because the dot IS the colour. */
  readonly dot: string
  /** Two or three words, on screen next to the dot. */
  readonly label: string
  /** What that means, spelled out — the tip, and the `aria-label` that keeps
   *  the tip from being the only copy. */
  readonly detail: string
}

/** A `Record`, so every state must be given an appearance — including the one
 *  whose appearance is NOTHING, which is a decision and is spelled as `null`
 *  rather than as a missing key nobody would notice. */
export const LOOK: Record<GitState["status"], Look | null> = {
  off: null,
  repo: {
    // Deliberately not green: the connection's dot is the page's one green
    // claim, and a second one would dilute it. Healthy git is quiet.
    dot: "bg-muted",
    label: "git",
    detail: "this directory is a git repository — every write is committed to it",
  },
  none: {
    dot: "bg-muted/40",
    label: "Not a Git repo",
    detail:
      "the served directory is not a git work tree, so writes land on disk but are not committed anywhere",
  },
  error: {
    dot: "bg-alarm",
    label: "Git error",
    detail: "git could not be used in this directory",
  },
}

/**
 * What this state says, in full — the tip and the `aria-label`.
 *
 * The `error` state is the reason this is a function rather than a field: what
 * git SAID is the answer a reader wants, and it is the half that used to reach
 * only the server log. Everything else has nothing to quote and reads as its
 * own sentence.
 */
export const sentence = (state: GitState, look: Look): string =>
  state.said === null || state.said === ""
    ? look.detail
    : `${look.detail} — ${state.said}`
