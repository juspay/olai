/**
 * THE QUIET WINDOW: when a directory that has gone quiet records itself.
 *
 * The rules only. The timer over them, and the two verbs it drives, are
 * `./pending.ts` — for the reason the browser's retired copy split the same
 * way: these are ARGUMENTS, and an argument is a thing to unit-test, where a
 * debounce over a stream is plumbing.
 *
 * **It moved here from a browser tab, and that is the whole of this module's
 * existence.** Auto-commit shipped as a preference beside theme: a 15 s window
 * inside one page, behind a per-browser Web Lock so two tabs of it would not
 * race one work tree. Everything wrong with that follows from the frame — the
 * directory recorded only while somebody had a tab open, two BROWSERS could
 * both lead and race anyway, and `--commit=auto` was a different feature with
 * the same name (one commit per write, never pushed). Git policy is a fact
 * about the DIRECTORY, so the window is the server's and there is one of it by
 * construction: one olai per directory is a lock the kernel holds
 * (`@olai/server`'s `flock.ts`), so there is no election to get wrong.
 *
 * **What counts as an edit is what is WAITING**, read off the same survey the
 * pill draws ({@link flurryOf}). So a browser keystroke, an agent's op over
 * MCP, a `POST /capture` from a phone and a `.md` somebody saved in vim all
 * move the same window and land in the same commit. That is "all my changes end
 * up in git" — and it is a consequence of watching git rather than counting
 * writes, which is why nothing here knows who wrote anything.
 */

import { type CommitMode, type Pending, QUIET_MS } from "@olai/format"

/** The span, re-exported beside the rules it belongs to. It is DECLARED on the
 *  floor (`@olai/format`) rather than here because the preferences panel prints
 *  it — "records itself when writes stop arriving for fifteen seconds" — and a
 *  browser must not import this package: the module below it reaches
 *  `node:child_process`. */
export { QUIET_MS }

/**
 * What is waiting, as one word — the same for two readings of the same work,
 * different the moment anything about it moves, and `""` for nothing waiting at
 * all.
 *
 * The four lists the panel draws, and nothing else. What is deliberately left
 * out is everything that is not waiting WORK: the per-writer counters, the
 * unpushed count, the last commit. A window that restarted on those would be
 * one a repository with a failing push could hold open forever — the push
 * refusal republishes the survey, and the survey is what re-arms this.
 *
 * `""` is load-bearing rather than a formatting accident: it is the one answer
 * that means "there is no flurry", which is what disarms the window, and no
 * amount of waiting work can produce it.
 */
export const flurryOf = (pending: Pending): string =>
  pending.changes.length === 0 && pending.outlines.length === 0 &&
    pending.others.length === 0 && pending.unreadable.length === 0
    ? ""
    : JSON.stringify([
      pending.changes,
      pending.outlines,
      pending.others,
      pending.unreadable,
    ])

/** Everything {@link mayRecord} reads, as one value — so the arming and the
 *  check at the moment the window fires cannot ask slightly different
 *  questions. */
export interface Standing {
  /** What this server does about commits — the policy, with the defaults and
   *  the pin already folded in (`@olai/format`'s `policyOf`). Only `auto` runs
   *  a loop; `manual` waits to be asked and `off` never touches git. */
  readonly commit: CommitMode
  /** Why the loop stopped, or `null` while it is running. A refused commit or
   *  push sets it and nothing clears it on olai's own initiative. */
  readonly paused: string | null
  /** What is waiting, as {@link flurryOf} says it — and `""` for nothing, which
   *  is what makes "there is something to record" ONE spelling rather than a
   *  count here and an empty string there. */
  readonly flurry: string
  /** Whether the repository can take a commit at all — `@olai/format`'s
   *  `isReady` of the survey's `RepoState`. */
  readonly ready: boolean
}

/**
 * Whether the loop may ask for a commit right now.
 *
 * FOUR TERMS, and the fourth is the whole of "stop rather than retry blindly".
 * A repository that is not `Ready` — mid-merge, mid-rebase, on a detached HEAD
 * — is a PAUSE and never a stop: nothing is attempted while it lasts, the chip
 * already wears that face with the reason on it, and the work is recorded once
 * the person has finished, which is the one state where retrying would swallow
 * somebody's conflict resolution.
 *
 * There is no term for "git has refused something here", and the browser's copy
 * of these rules had one. It needed it: its pause lived in a tab, so a reload
 * armed a fresh loop that would hammer a repository nothing could be committed
 * in every fifteen seconds. The pause is the DIRECTORY's now — a refusal sets
 * it, and only `resume` clears it — so a remembered refusal as well would be a
 * second stop with no way out of it: pressing Resume on a git that has refused
 * is exactly the person saying "I have dealt with that, try again", and a gate
 * that only a successful commit could open would make Resume do nothing at all.
 */
export const mayRecord = (standing: Standing): boolean =>
  standing.commit === "auto" &&
  standing.paused === null &&
  standing.flurry !== "" &&
  standing.ready

/**
 * The window's own key: what the loop is waiting on, or `""` for a loop that is
 * not waiting on anything.
 *
 * ONE STRING, and every re-arm in the feature is a change of it. A write moves
 * the flurry; turning Auto-commit on moves it from `""`; Resume moves it back
 * from `""`. The survey that says nothing new — the thirty-second sweep over a
 * quiet directory — produces the same string, which is what keeps the window
 * from being pushed out by a clock nobody typed on.
 */
export const armedOn = (standing: Standing): string =>
  mayRecord(standing) ? standing.flurry : ""
