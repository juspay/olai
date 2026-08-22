/**
 * THE QUIET WINDOW: how long a directory must be quiet before what is waiting
 * records itself, and whether it would record at all right now.
 *
 * The RULE and nothing else — no timer, no git, no I/O. `@olai/ops`' `pending.ts`
 * runs it (the debounce, the two verbs, the stop) and the BROWSER draws the
 * promise off it, which is why it lives down here on the floor both stand on
 * rather than beside the loop: a browser cannot import the ops layer, whose
 * next module down reaches `node:child_process`.
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

import { isReady, type CommitMode, type Pending } from "./committing.ts"

/**
 * How long writes must stop arriving before what is waiting becomes a commit.
 *
 * FIFTEEN SECONDS, inside the ten-to-thirty band the ruling named, and the span
 * is an argument about two things at once:
 *
 *   - it has to outlast the pauses INSIDE one piece of work — reading a line
 *     back, moving between rows, waiting for an agent's next op — or the
 *     feature's own promise breaks and one train of thought arrives as three
 *     commits;
 *   - and it has to be short enough that the audit trail is never far behind
 *     the work, so the message it composes still describes something the person
 *     remembers doing.
 *
 * It is deliberately not a knob. A setting here would be a second thing to
 * explain about a feature whose whole point is not having to think about it.
 * The preferences panel prints the span in the Git commit row's own sentence,
 * read off this value rather than spelled again.
 */
export const QUIET_MS = 15_000

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

/**
 * THE WINDOW'S OWN KEY: what the loop is waiting on, or `""` for a loop that is
 * not waiting on anything.
 *
 * ONE EXPRESSION, and it is the whole rule — asked when a survey arrives to arm
 * the window, asked again at the moment the window closes, and asked a third
 * time by the BROWSER, whose panel promises "Auto-commit will record all of
 * this" and may only promise it when this answers with something. The three
 * cannot come to want slightly different things.
 *
 * That third caller is why this is on the floor. The panel used to re-derive a
 * shorter version of it, and the shorter version had already lost a term: on a
 * clean tree under `--commit=auto` it promised to record an empty list, because
 * "the policy is the window and the repository is ready" is true of a directory
 * with nothing in it.
 *
 * EVERY RE-ARM IN THE FEATURE IS A CHANGE OF THIS STRING. A write moves the
 * flurry; turning Auto-commit on moves it from `""`; Resume moves it back from
 * `""`. The survey that says nothing new — the thirty-second sweep over a quiet
 * directory — produces the same string, which is what keeps the window from
 * being pushed out by a clock nobody typed on.
 *
 * THE CHEAP TERMS COME FIRST, and that is not tidiness: {@link flurryOf}
 * serializes every waiting change, this runs on every published revision, and
 * on the default `manual` server no amount of it could ever arm anything.
 *
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
export const armedOn = (
  /** What this server does about commits — the policy, with the defaults and
   *  the pin already folded in ({@link policyOf}). Only `auto` runs a loop;
   *  `manual` waits to be asked and `off` never touches git. */
  commit: CommitMode,
  /** Why the loop stopped, or `null` while it is running. A refused commit or
   *  push sets it and nothing clears it on olai's own initiative. */
  paused: string | null,
  /** The last survey — what is waiting, and whether the repository could take a
   *  commit at all. */
  pending: Pending,
): string =>
  commit !== "auto" || paused !== null || !isReady(pending.repo)
    ? ""
    : flurryOf(pending)
