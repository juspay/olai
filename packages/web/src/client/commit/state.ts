/**
 * What is waiting to be committed, as this tab sees it — and the one verb.
 *
 * One subscription and one procedure, and neither of them is state this browser
 * owns: `pending` is DERIVED FROM GIT on the server, on every published
 * revision and on a sweep of its own, so a tab that has been open all day is
 * looking at the repository as it is rather than at a tally it kept. There is
 * deliberately nothing here that counts writes.
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
} from "@olai/format"
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

export interface Commit {
  /** What is waiting. Always a value: a page that has heard nothing yet and a
   *  directory that is not a repository draw the same thing, which is nothing,
   *  so there is no third state worth a `null`. */
  readonly pending: Accessor<Pending>
  /** How much there is to say about. Zero is the pill not being drawn at all —
   *  including for a directory that is not a repository, and for a server
   *  started with `--commit=off`, which have nothing to say either. */
  readonly waiting: Accessor<number>
  /** True between asking and being answered. A second press while a commit is
   *  in flight would be a second commit. */
  readonly working: Accessor<boolean>
  /** The last attempt, or `null` for one that has not been made. */
  readonly attempt: Accessor<Attempt | null>
  readonly commit: (message: string) => void
}

export const createCommit = (): Commit => {
  const cell = olai.cells.pending.use()
  const [working, setWorking] = createSignal(false)
  const [attempt, setAttempt] = createSignal<Attempt | null>(null)

  const pending = (): Pending => cell.value() ?? NOTHING_PENDING

  return {
    pending,
    waiting: () => {
      const now = pending()
      if (now.repo._tag === "Off" || now.repo._tag === "NoRepo") return 0
      return now.changes.length + now.unreadable.length
    },
    working,
    attempt,
    commit: (message) => {
      if (working()) return
      setWorking(true)
      setAttempt(null)
      run(
        olai.procedures.git.commit(message.trim() === "" ? {} : { message }),
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
  }
}
