/**
 * The rules Auto-commit runs on: what a FLURRY is, when the loop may record,
 * and what stops it.
 *
 * Three decisions, and each is here rather than inside the timer beside it
 * (`./auto.ts`) for the reason `./record.ts` is separate from `./state.ts`:
 * they are arguments, and an argument is a thing to unit-test. The timer is
 * plumbing over them.
 *
 * **The trigger is a debounced flurry, and that is the human's ruling.** A
 * commit records when edits stop arriving for a quiet window; a burst of typing
 * or of agent ops lands as ONE commit. Not one per op — that is what
 * `--commit=auto` already is, and turning one train of thought into a dozen
 * commits is the thing manual mode was introduced to end. The unit of an audit
 * trail is a piece of work.
 *
 * **What counts as an edit is what is WAITING**, read off the same published
 * value the pill draws ({@link flurryOf}). So an agent writing over MCP moves
 * it, a `.md` edited in vim moves it on the server's next sweep, and both land
 * in the same commit as whatever was typed here — "all their changes", which
 * is the goal. What does NOT move it is anything that is not waiting work: the
 * per-writer counters, the unpushed count, the last commit. A window that
 * restarted on those would be one a busy repository could hold open forever.
 */

import { isReady, type Pending, type RepoState } from "@olai/format"
import type { GitState } from "@olai/surface"

import { canRecord } from "./record.ts"
import { trouble, pushTrouble, waitingIn } from "./said.ts"
import type { Attempt, PushAttempt } from "./state.ts"

/**
 * How long edits must stop arriving before what is waiting becomes a commit.
 *
 * FIFTEEN SECONDS, inside the ten-to-thirty band the ruling named, and the
 * span is an argument about two things at once:
 *
 *   - it has to be longer than the pauses INSIDE one train of thought —
 *     reading a line back, moving between rows, waiting for an agent's next op
 *     — or the feature's own promise breaks and a piece of work arrives as
 *     three commits;
 *   - and short enough that the audit trail is never far behind the work. A
 *     commit that lands a quarter of a minute after you stop typing is still a
 *     commit about something you remember, so the message it composes reads as
 *     a description of what you just did.
 *
 * Anything shorter starts fragmenting ordinary typing; anything much longer
 * turns "it commits itself" into "it commits eventually", which is the shape
 * people stop trusting. It is deliberately not a preference: a knob here would
 * be a second thing to explain about a feature whose whole point is not having
 * to think about it.
 */
export const QUIET_MS = 15_000

/**
 * What is waiting, as one word — the same for two readings of the same work,
 * different the moment anything about it moves, and `""` for nothing waiting
 * at all.
 *
 * The four lists the panel draws and the pill counts, and nothing else: see
 * this file's header for why the counters beside them are left out.
 *
 * `""` is load-bearing rather than a formatting accident: it is the one answer
 * that means "there is no flurry", which is what disarms the timer, and it
 * cannot be produced by any amount of waiting work.
 */
export const flurryOf = (pending: Pending): string =>
  waitingIn(pending) === 0 ? "" : JSON.stringify([
    pending.changes,
    pending.outlines,
    pending.others,
    pending.unreadable,
  ])

/** Everything {@link mayRecord} reads, as one value — so the timer and the
 *  check at the moment it fires cannot ask slightly different questions. */
export interface Standing {
  /** Whether this browser asked for Auto-commit at all. */
  readonly armed: boolean
  /** Why the loop stopped, or `null` while it is running ({@link stoppedBy}). */
  readonly paused: string | null
  /** Whether this is the tab of this browser that records (`./elected.ts`). */
  readonly alone: boolean
  /** Whether the server has said anything yet. A page that has heard nothing
   *  knows nothing, and a commit is not a thing to guess at. */
  readonly heard: boolean
  /** What is waiting, as {@link flurryOf} says it — and `""` for nothing,
   *  which is what makes "there is something to record" ONE spelling rather
   *  than a count here and an empty string there. */
  readonly flurry: string
  readonly repo: RepoState
  readonly git: GitState
  readonly working: boolean
  readonly pushing: boolean
}

/**
 * Whether the loop may ask for a commit right now.
 *
 * A repository that is not `Ready` — mid-merge, mid-rebase, on a detached HEAD
 * — is a PAUSE and never a stop: the loop simply does not attempt while it
 * lasts, the pill already wears that face with the reason on it, and the work
 * is recorded once the person has finished what they were doing. That is the
 * ruling's "stop rather than retry blindly" in the state where retrying is
 * exactly what would swallow somebody's conflict resolution.
 *
 * A git that FAILED is the other half and reads the same way here, because the
 * server remembers a refused commit and publishes it (`@olai/ops`' `gitOf`) —
 * so a repository nothing can be committed in is not asked again every fifteen
 * seconds.
 */
export const mayRecord = (standing: Standing): boolean =>
  standing.armed &&
  standing.paused === null &&
  standing.alone &&
  standing.heard &&
  standing.flurry !== "" &&
  isReady(standing.repo) &&
  standing.git.status === "repo" &&
  canRecord(standing.working, standing.pushing)

/**
 * What stops the loop, or `null` for an attempt it may carry on after.
 *
 * TWO of the five answers stop it, and they are the two that are a FAULT
 * rather than a state: a commit git refused, and a call the server would not
 * take. The other three end by themselves — a commit that landed, nothing to
 * commit (somebody else got there first), and a busy repository, which
 * {@link mayRecord} already declines to attempt into.
 *
 * The words are `./said.ts`'s, because they are the words the panel already
 * puts on screen for the same attempt, and a second sentence for one event is
 * a second sentence to keep true.
 */
export const stoppedBy = (attempt: Attempt | null): string | null =>
  attempt !== null && (attempt._tag === "Failed" || attempt._tag === "Refused")
    ? trouble(attempt)
    : null

/**
 * ... and the same for the push, which is where a DIVERGENCE arrives.
 *
 * This is the conflict case the ruling is about. Somebody else — another
 * machine of yours, an agent, a colleague — has moved the upstream, so git
 * refuses the push as a non-fast-forward. The loop stops there and hands over
 * git's own words, which are the ones that say what to do; it does not pull,
 * it does not rebase, it does not force, and it does not try again. Piling more
 * automatic commits onto a branch that has already diverged makes the eventual
 * resolution worse, so ONE stop covers both verbs.
 */
export const stoppedByPush = (attempt: PushAttempt | null): string | null =>
  attempt !== null && (attempt._tag === "Failed" || attempt._tag === "Refused")
    ? pushTrouble(attempt)
    : null
