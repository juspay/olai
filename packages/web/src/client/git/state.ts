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
 *
 * The ops layer writes sentences about these conditions too (`Applied.why`),
 * and they are deliberately not these ones. That one answers "why was MY write
 * not committed", on the reply of the write it is about; these answer "what is
 * this directory", in chrome that is on screen whether anybody has written
 * anything or not. Nothing derives one from the other and nothing has to agree
 * — and it could not be shared anyway: the layer that writes the first cannot
 * see the wire, let alone the browser.
 */

import type { GitState } from "@olai/surface"

import type { Look } from "../readout.ts"

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
    // True of both ways this state is reached — a git that could not be asked
    // about the directory at all, and a commit it refused — because what
    // happened is in the words that follow, and what a reader needs from the
    // label is the consequence.
    detail: "git failed here, so writes are landing on disk but are not being committed",
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
