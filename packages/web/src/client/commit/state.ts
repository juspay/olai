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
} from "@olai/format"
import { GIT_OFF } from "@olai/surface"
import { type Accessor, createSignal } from "solid-js"

import { waitingIn } from "./said.ts"
import { type Call, run } from "../run.ts"
import { olai } from "../wire.ts"

/**
 * WHAT GIT IS DOING HERE, and the Resume verb — the two preference rows'
 * whole door (read-only), and the smaller half of {@link Commit}.
 *
 * Its own factory because the preferences panel wants exactly this and nothing
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
   * WHAT THE SERVER WOULD NOT TAKE FROM THIS TAB, or `null`.
   *
   * The one refusal that is genuinely this tab's, and the reason it survived
   * the move: git's own refusals are the directory's and arrive on the cell,
   * but a CALL that never reached git — the wire dropped it, or the server
   * answered a usage refusal — happened to this request and to nobody else's.
   * Nothing on the cell can say so, and a control that silently did nothing is
   * the failure this whole feature is about.
   *
   * It belongs to the SEAM the press went through, and is drawn beside the
   * control that made it: the preferences panel draws its own, the commit panel
   * draws the pill's.
   *
   * Cleared when the next request starts, so what is on screen is about the
   * press a reader just made.
   */
  readonly refused: Accessor<string | null>
  /** Start a stopped loop again — the Resume button's verb, and the one way
   *  out. */
  readonly resume: () => void
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
 * The `git` cell and the Resume verb — no `pending`, no committer, and nothing
 * else this browser owns beyond whether ITS OWN resume request is still out.
 *
 * The preferences panel takes this one. Each `.use()` is a subscription of its
 * own, so handing that panel the whole committer meant a second full `Pending`
 * frame decoded per publish for a component that never draws one — and it is
 * mounted inside a `<Show>`, so the pair was set up and torn down on every
 * open and close of the popover.
 */
export const createGitPolicy = (): GitPolicySeam => {
  const git = olai.cells.git.use()
  const [refused, setRefused] = createSignal<string | null>(null)

  /** One shape for both verbs: clear what the last press said, ask, and put
   *  whatever the server would not take where the person who pressed can read
   *  it. Neither answers anything — what changed is the cell. */
  const ask = (call: Call<unknown>) => (): void => {
    setRefused(null)
    run(call, (failure) => setRefused(failure.message))
  }

  return {
    git: () => git.value() ?? GIT_OFF,
    refused,
    resume: ask(olai.procedures.git.resume({})),
  }
}

export const createCommit = (): Commit => {
  const cell = olai.cells.pending.use()
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
      olai.procedures.git.push({}),
      (failure) => {
        setPushing(false)
        setRefused(failure.message)
      },
      (_result: PushResult) => setPushing(false),
    )
  }

  return {
    ...policy,
    // This committer's OWN refusals rather than the seam's: a press of Commit
    // or Push is drawn beside those buttons, and a Resume a preferences panel
    // made is drawn beside the row it sits on. One signal for both would be
    // a message under whichever control the reader was not looking at.
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
      setWorking(true)
      setRefused(null)
      run(
        olai.procedures.git.commit({
          ...(message.trim() === "" ? {} : { message }),
          ...(paths === undefined ? {} : { paths }),
        }),
        (failure) => {
          setWorking(false)
          setRefused(failure.message)
        },
        (_result: CommitResult) => setWorking(false),
      )
    },
    pushing,
    push: send,
  }
}
