/**
 * What is waiting to be committed, as this tab sees it — and the two verbs.
 *
 * One subscription and two procedures, and none of them is state this browser
 * owns: `pending` is DERIVED FROM GIT on the server, on every published
 * revision and on a sweep of its own, so a tab that has been open all day is
 * looking at the repository as it is rather than at a tally it kept. There is
 * deliberately nothing here that counts writes — or commits.
 *
 * What IS this tab's is the last ATTEMPT — one signal rather than a refusal
 * beside an answer, because exactly one of those two can be true at a time and
 * two optionals with coupled presence is a state the panel would have to
 * reassemble. What the attempt is CALLED is not here either: this module knows
 * that a commit was refused, `said.ts` knows how to say so.
 */

import {
  type CommitResult,
  NOTHING_PENDING,
  type OpFailure,
  type Pending,
  type PushResult,
} from "@olai/format"
import { GIT_OFF, type GitState } from "@olai/surface"
import { type Accessor, createSignal } from "solid-js"

import { run } from "../run.ts"
import { olai } from "../wire.ts"

/**
 * What the last attempt did.
 *
 * The procedure's four answers, plus the fifth thing that can happen to a
 * procedure: it never answered at all. `Refused` is that one — the wire, or a
 * server that would not take the call — and it is an arm here rather than a
 * second signal so that "what is there to say" is one read.
 */
export type Attempt =
  | CommitResult
  | { readonly _tag: "Refused"; readonly failure: OpFailure }

/** The same five shapes for the other verb. Its own signal rather than a
 *  second arm on {@link Attempt}, because the two answers sit in two places on
 *  screen: a refused commit belongs beside the button that made it, and a
 *  refused push beside the branch it would not send. */
export type PushAttempt =
  | PushResult
  | { readonly _tag: "Refused"; readonly failure: OpFailure }

export interface Commit {
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
  /**
   * What git is doing for this directory at all — the second half of the one
   * indicator (`one-git-indicator`, folding #108's readout into this pill).
   *
   * Its own cell rather than something read off {@link Commit.pending}'s `repo`,
   * and the difference is exactly one state: a commit that git REFUSED. A
   * repository with no `user.email` answers every probe happily, so the survey
   * reads `Ready` while nothing can be committed — the server remembers the
   * refusal and publishes it here, and no reading of the directory can. Both
   * are recomputed from ONE survey in one statement on the server, so this is a
   * second READING and never a second probe.
   */
  readonly git: Accessor<GitState>
  /** How much is waiting: the node-level changes, the outlines nothing could be
   *  read in, and every OTHER dirty file in the repository. Zero is a clean
   *  tree — and also every directory olai cannot commit in, because the server
   *  answers those with nothing rather than making the browser decide. */
  readonly waiting: Accessor<number>
  /** True between asking and being answered. A second press while a commit is
   *  in flight would be a second commit. */
  readonly working: Accessor<boolean>
  /** The last attempt, or `null` for one that has not been made. */
  readonly attempt: Accessor<Attempt | null>
  /**
   * Record what is waiting.
   *
   * `paths` is the SELECTION — omitted when everything is ticked, which is what
   * the server reads as a full sweep. Passing the whole list explicitly would
   * commit the same files and mean something narrower: a piecemeal commit
   * deliberately leaves the per-writer counters alone, because an op cannot be
   * attributed to a file.
   */
  readonly commit: (message: string, paths?: ReadonlyArray<string>) => void
  /** True while a push is in flight, for the same reason {@link working} is. */
  readonly pushing: Accessor<boolean>
  /** What the last push did, or `null` for one nobody has asked for. */
  readonly pushed: Accessor<PushAttempt | null>
  /** Send the current branch. No argument: there is nothing to choose. */
  readonly push: () => void
}

export const createCommit = (): Commit => {
  const cell = olai.cells.pending.use()
  // The spec declares `off` as this cell's default and the framework seeds the
  // subscription with it, so a page reads "say nothing" before the first frame
  // rather than flashing a state it has not been told.
  const git = olai.cells.git.use()
  const [working, setWorking] = createSignal(false)
  const [attempt, setAttempt] = createSignal<Attempt | null>(null)
  const [pushing, setPushing] = createSignal(false)
  const [pushed, setPushed] = createSignal<PushAttempt | null>(null)

  const pending = (): Pending => cell.value() ?? NOTHING_PENDING

  return {
    pending,
    heard: () => cell.value() !== undefined,
    git: () => git.value() ?? GIT_OFF,
    // Every FILE that is waiting, plus the node changes inside the outlines —
    // which is what the pill counts, and what it has always counted, now that
    // the documents and the source files somebody edited are in the answer.
    waiting: () =>
      pending().changes.length + pending().unreadable.length + pending().others.length,
    working,
    attempt,
    commit: (message, paths) => {
      if (working()) return
      setWorking(true)
      setAttempt(null)
      run(
        olai.procedures.git.commit({
          ...(message.trim() === "" ? {} : { message }),
          ...(paths === undefined ? {} : { paths }),
        }),
        (failure) => {
          setWorking(false)
          setAttempt({ _tag: "Refused", failure })
        },
        (result) => {
          setWorking(false)
          setAttempt(result)
        },
      )
    },
    pushing,
    pushed,
    push: () => {
      if (pushing()) return
      setPushing(true)
      setPushed(null)
      run(
        olai.procedures.git.push({}),
        (failure) => {
          setPushing(false)
          setPushed({ _tag: "Refused", failure })
        },
        (result) => {
          setPushing(false)
          setPushed(result)
        },
      )
    },
  }
}
