/**
 * What is waiting to be committed, what git is doing about it — and the four
 * verbs.
 *
 * TWO SUBSCRIPTIONS AND FOUR PROCEDURES, and none of them is state this browser
 * owns. `pending` is DERIVED FROM GIT on the server, on every published
 * revision and on a sweep of its own, so a tab that has been open all day is
 * looking at the repository as it is rather than at a tally it kept. `git` is
 * the other half of the same survey: what the policy is, what git last refused,
 * and whether the quiet-window loop has stopped.
 *
 * **What this tab USED to keep is the whole of what `git-policy-server-side`
 * deleted.** There was a 15 s quiet window in here, behind a Web Lock so two
 * tabs of one browser would not race the work tree; a pause signal that a
 * reload silently cleared; a last-commit and a last-push outcome that lived in
 * two signals and were lost with the page. Every one of those is a fact about
 * the DIRECTORY wearing a tab's clothes, and each was wrong in its own way —
 * the directory recorded only while somebody had a tab open, two BROWSERS could
 * both lead, and a refused push was visible nowhere at all. They are the
 * server's now, and they arrive on the `git` cell, which is why what is left in
 * here is so short.
 *
 * What IS this tab's is whether one of ITS OWN requests is in flight
 * ({@link Commit.working}, {@link Commit.pushing}). That is not a fact about
 * the directory — it is about the button under this reader's finger, which must
 * not be pressed twice — so it stays a signal, and it is the only one.
 */

import {
  type CommitResult,
  type GitState,
  NOTHING_PENDING,
  type Pending,
  type PushResult,
  type UnlockResult,
} from "@olai/format"
import { GIT_OFF } from "@olai/format"
import { type Accessor, createSignal } from "solid-js"

import { gitWire } from "../wire.ts"
import { waitingIn } from "./said.ts"
import { submittedPreparation } from "./preparation.ts"
import { run } from "@olai/web/client/run.ts"

/**
 * WHAT GIT IS DOING HERE, and the Resume verb — the two preference rows'
 * whole door (read-only), and the smaller half of {@link Commit}.
 *
 * Its own factory because the Resume control wants exactly this and nothing
 * else: it does not draw what is waiting, so building the whole committer for
 * it opened a second `pending` subscription — a full frame of every dirty file
 * decoded twice per publish while the popover is up, and a subscription pair
 * churned on every open and close.
 */
export interface GitPolicySeam {
  /**
   * What git is doing for this directory — the whole of the second half of the
   * one indicator, and of the two preference rows.
   *
   * A repository with no `user.email` answers every probe happily, so the
   * survey reads `Ready` while nothing can be committed; a repository whose
   * PUSH is being refused answers every probe happily too, and the survey
   * cannot see that either. The server remembers both and publishes them here,
   * beside the policy it is running under and whether the loop has stopped.
   */
  readonly git: Accessor<GitState>
  /**
   * WHAT THE SERVER WOULD NOT TAKE FROM THE RESUME PRESS, or `null`.
   *
   * The one refusal that is genuinely this tab's, and the reason it survived
   * the move: git's own refusals are the directory's and arrive on the cell,
   * but a CALL that never reached git — the wire dropped it, or the server
   * answered a usage refusal — happened to this request and to nobody else's.
   * Nothing on the cell can say so, and a control that silently did nothing is
   * the failure this whole feature is about.
   *
   * Cleared when the next request starts, so what is on screen is about the
   * press a reader just made.
   */
  readonly resumeRefused: Accessor<string | null>
  /** Start a stopped loop again — the Resume button's verb, and the one way
   *  out. */
  readonly resume: () => void
  /**
   * ... AND THE SAME FOR THE UNLOCK PRESS, which is its OWN signal rather than
   * a share of the one above.
   *
   * The two controls can be on screen together — a lock refusal under
   * `commit: auto` pauses the loop as well, so both buttons are drawn — and one
   * signal between them would put a message about a press nobody made under
   * whichever button the reader was not looking at. It is the rule
   * {@link Commit.refused} already follows for the Commit and Push pair.
   */
  readonly unlockRefused: Accessor<string | null>
  /**
   * REMOVE THE STALE `index.lock` a commit refused over, and say what came of
   * it — the unlock button's verb.
   *
   * The answer is handed back rather than acted on here, because what follows
   * from it is a COMMIT and this factory knows nothing about drafts or ticks:
   * `Removed` and `Absent` are the panel retrying the commit it was refused,
   * `Held` is the sentence beside the button. A CALL that never reached the
   * server, AND a removal the server could not make — the file was there and
   * the git directory would not let go of it — arrive on
   * {@link unlockRefused}, exactly as {@link resume}'s does on its own:
   * `onAnswer` is the SUCCESS edge, and a failure is drawn beside the button
   * that made it.
   */
  readonly unlock: (onAnswer: (answer: UnlockResult) => void) => void
}

export interface Commit extends GitPolicySeam {
  /** What is waiting. Always a value, so nothing downstream branches on an
   *  absence — see {@link Commit.heard} for the one thing that absence means. */
  readonly pending: Accessor<Pending>
  /**
   * Whether the server has said anything yet.
   *
   * Its own fact rather than a `null` on the value above, because "we have not
   * been told" and "commits are off" are two different things and the default
   * value cannot be both. Before the first frame the pill said `commits off`,
   * which is a SETTING somebody could go and change — a claim this page had no
   * business making about a server it had not heard from.
   */
  readonly heard: Accessor<boolean>
  /** How much is waiting: the node-level changes, the outlines nothing could be
   *  read in, and every OTHER dirty file in the repository. Zero is a clean
   *  tree — and also every directory olai cannot commit in, because the server
   *  answers those with nothing rather than making the browser decide. */
  readonly waiting: Accessor<number>
  /** True between asking and being answered. A second press while a commit is
   *  in flight would be a second commit. */
  readonly working: Accessor<boolean>
  /**
   * WHAT THE SERVER WOULD NOT TAKE FROM A COMMIT OR PUSH PRESS, or `null`.
   *
   * Git's own refusals are the directory's and arrive on the cell; a CALL that
   * never reached git — the wire dropped it, or the server answered a usage
   * refusal — happened to this press and to nobody else's. Nothing on the cell
   * can say so, and a control that silently did nothing is the failure this
   * whole feature is about.
   *
   * Declared here rather than inherited, and that is the half a reader has to
   * be able to see: the seam's two accessors are for the Resume and unlock
   * buttons ({@link GitPolicySeam.resumeRefused}, `unlockRefused`), and a
   * `refused` that came from the seam would be a signal the Panel never read
   * while these two presses wrote into it.
   */
  readonly refused: Accessor<string | null>
  /**
   * Record what is waiting.
   *
   * `paths` is the SELECTION — omitted when everything is ticked, which is what
   * the server reads as a full sweep. Passing the whole list explicitly would
   * commit the same files and mean something narrower: a piecemeal commit
   * deliberately leaves the per-writer counters alone, because an op cannot be
   * attributed to a file.
   *
   * WHETHER IT IS PUSHED AFTERWARDS IS NOT ASKED HERE. That is the directory's
   * policy and the server's to apply, to this commit and to every other one —
   * which is what makes an agent's `commit` and the quiet window's own share
   * what they record, where the browser-side composition this replaced could
   * only ever push what one tab had committed.
   */
  readonly commit: (message: string, paths?: ReadonlyArray<string>) => void
  /** True while a push is in flight, for the same reason {@link working} is. */
  readonly pushing: Accessor<boolean>
  /** Send the current branch. No argument: there is nothing to choose. */
  readonly push: () => void
}

/**
 * Whether a Commit press may start.
 *
 * Working is a commit already in flight. Pushing is a push still in the air —
 * `push` returns at the door if one is, so a commit that landed on top of it
 * would be a commit whose own push the server made while this tab thought it
 * was still sending the last. The Push button already waits; Commit waits for
 * the same reason.
 */
export const canRecord = (working: boolean, pushing: boolean): boolean =>
  !working && !pushing

/**
 * The `git` cell and the two verbs that act on the DIRECTORY — no `pending`, no
 * committer, and nothing else this browser owns beyond whether one of ITS OWN
 * presses of those two is still out.
 *
 * The smaller half of {@link Commit}, and its own factory because a consumer
 * that draws no rows should not pay for them: each `.use()` is a subscription
 * of its own, so handing one the whole committer means a full `Pending` frame
 * decoded per publish for a component that never draws one.
 */
export const createGitPolicy = (): GitPolicySeam => {
  const git = gitWire().cells.git.use()
  // ONE SIGNAL PER CONTROL, which is the rule the committer's own refusals
  // follow: these two buttons are on screen together whenever a lock refusal
  // has paused the loop, so a shared signal would draw a press's failure under
  // the button that did not make it.
  const [resumeRefused, setResumeRefused] = createSignal<string | null>(null)
  const [unlockRefused, setUnlockRefused] = createSignal<string | null>(null)

  return {
    git: () => git.value() ?? GIT_OFF,
    resumeRefused,
    resume: () => {
      setResumeRefused(null)
      run(
        gitWire().procedures.git.resume({}),
        (failure) => setResumeRefused(failure.message),
      )
    },
    unlockRefused,
    unlock: (onAnswer) => {
      setUnlockRefused(null)
      run(
        gitWire().procedures.git.unlock({}),
        (failure) => setUnlockRefused(failure.message),
        onAnswer,
      )
    },
  }
}

export const createCommit = (): Commit => {
  const cell = gitWire().cells.pending.use()
  const policy = createGitPolicy()
  const [working, setWorking] = createSignal(false)
  const [pushing, setPushing] = createSignal(false)
  const [refused, setRefused] = createSignal<string | null>(null)

  const pending = (): Pending => cell.value() ?? NOTHING_PENDING

  /** The Push button's verb. What it DID is on the cell — `pushSaid` when git
   *  refused, and the unpushed count when it did not — so nothing is kept
   *  here but whether this tab's own request is still out, and whether the
   *  server took it at all. */
  const send = (): void => {
    if (pushing()) return
    setPushing(true)
    setRefused(null)
    run(
      gitWire().procedures.git.push({}),
      (failure) => {
        setPushing(false)
        setRefused(failure.message)
      },
      (_result: PushResult) => setPushing(false),
    )
  }

  return {
    ...policy,
    // THE COMMIT AND PUSH PAIR'S OWN refusals — the one line at the foot of
    // this panel. The seam carries its own two (`resumeRefused`,
    // `unlockRefused`) rather than sharing this signal, because those two
    // buttons are drawn TOGETHER whenever a lock refusal has paused the loop:
    // one signal would print a press's failure under the button that did not
    // make it.
    refused,
    pending,
    heard: () => cell.value() !== undefined,
    // ONE count, shared with the face the pill wears and the sentence beside it
    // (`./said.ts`): the node changes, plus every other dirty file in the
    // repository now that a `.md` edited by hand is one of them.
    waiting: () => waitingIn(pending()),
    working,
    commit: (message, paths) => {
      if (!canRecord(working(), pushing())) return
      const complete = submittedPreparation()
      setWorking(true)
      setRefused(null)
      run(
        gitWire().procedures.git.commit({
          ...(message.trim() === "" ? {} : { message }),
          ...(paths === undefined ? {} : { paths }),
        }),
        (failure) => {
          setWorking(false)
          setRefused(failure.message)
        },
        (result: CommitResult) => {
          if (result._tag === "Committed") complete()
          setWorking(false)
        },
      )
    },
    pushing,
    push: send,
  }
}
