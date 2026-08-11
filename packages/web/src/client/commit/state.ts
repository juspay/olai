/**
 * What is waiting to be committed, as this tab sees it — and the one verb.
 *
 * One subscription and one procedure, and neither of them is state this browser
 * owns: `pending` is DERIVED FROM GIT on the server, on every published
 * revision and on a sweep of its own, so a tab that has been open all day is
 * looking at the repository as it is rather than at a tally it kept. There is
 * deliberately nothing here that counts writes.
 *
 * What IS this tab's is the draft message. It belongs to the person typing it,
 * so it is a signal — seeded from the composed suggestion when the panel opens
 * and never overwritten under their hands afterwards.
 */

import { type CommitResult, NOTHING_PENDING, type OpFailure, type Pending } from "@olai/format"
import { type Accessor, createSignal } from "solid-js"

import { run } from "../run.ts"
import { olai } from "../wire.ts"

export interface Commit {
  /** What is waiting. Always a value: a page that has heard nothing yet and a
   *  directory that is not a repository draw the same thing, which is nothing,
   *  so there is no third state worth a `null`. */
  readonly pending: Accessor<Pending>
  /** True between asking and being answered. A second press while a commit is
   *  in flight would be a second commit. */
  readonly working: Accessor<boolean>
  /** What the last attempt refused with — the transport's answer, when the
   *  procedure itself failed rather than answering. */
  readonly refused: Accessor<OpFailure | null>
  /** What the last attempt ANSWERED. `Committed` is the one a reader never
   *  sees for long: the cell it changes republishes immediately and the panel
   *  goes away with it. */
  readonly answered: Accessor<CommitResult | null>
  readonly commit: (message: string) => void
}

export const createCommit = (): Commit => {
  const cell = olai.cells.pending.use()
  const [working, setWorking] = createSignal(false)
  const [refused, setRefused] = createSignal<OpFailure | null>(null)
  const [answered, setAnswered] = createSignal<CommitResult | null>(null)

  return {
    pending: () => cell.value() ?? NOTHING_PENDING,
    working,
    refused,
    answered,
    commit: (message) => {
      if (working()) return
      setWorking(true)
      setRefused(null)
      setAnswered(null)
      run(
        olai.procedures.git.commit(message.trim() === "" ? {} : { message }),
        (failure) => {
          setWorking(false)
          setRefused(failure)
        },
        (result) => {
          setWorking(false)
          setAnswered(result)
        },
      )
    },
  }
}
