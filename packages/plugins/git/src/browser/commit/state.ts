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
import type { Picked } from "./selection.ts"
import { submittedPreparation } from "./preparation.ts"
import { run } from "@olai/web/client/run.ts"

export type Control = "commit" | "push" | "resume" | "unlock"

type Refusals = Readonly<Record<Control, string | null>>

const NOTHING_REFUSED: Refusals = { commit: null, push: null, resume: null, unlock: null }

interface Refused {
  readonly refusedBy: (control: Control) => string | null
  readonly refuse: (control: Control, said: string | null) => void
}

const createRefusals = (): Refused => {
  const [refusals, setRefusals] = createSignal<Refusals>(NOTHING_REFUSED)
  return {
    refusedBy: (control) => refusals()[control],
    refuse: (control, said) => setRefusals((was) => ({ ...was, [control]: said })),
  }
}

export interface GitPolicySeam {
  readonly git: Accessor<GitState>
  readonly refusedBy: (control: Control) => string | null
  readonly resume: () => void
  readonly unlock: (onAnswer: (answer: UnlockResult) => void) => void
}

export interface Commit extends GitPolicySeam {
  readonly pending: Accessor<Pending>
  readonly heard: Accessor<boolean>
  readonly waiting: Accessor<number>
  readonly working: Accessor<boolean>
  readonly commit: (message: string, picked: Picked) => void
  readonly pushing: Accessor<boolean>
  readonly push: () => void
}

export const canRecord = (working: boolean, pushing: boolean): boolean =>
  !working && !pushing

export const createGitPolicy = (refusals: Refused): GitPolicySeam => {
  const git = gitWire().cells.git.use()

  return {
    git: () => git.value() ?? GIT_OFF,
    refusedBy: refusals.refusedBy,
    resume: () => {
      refusals.refuse("resume", null)
      run(
        gitWire().procedures.git.resume({}),
        (failure) => refusals.refuse("resume", failure.message),
      )
    },
    unlock: (onAnswer) => {
      refusals.refuse("unlock", null)
      run(
        gitWire().procedures.git.unlock({}),
        (failure) => refusals.refuse("unlock", failure.message),
        onAnswer,
      )
    },
  }
}

export const createCommit = (): Commit => {
  const cell = gitWire().cells.pending.use()
  const refusals = createRefusals()
  const policy = createGitPolicy(refusals)
  const [working, setWorking] = createSignal(false)
  const [pushing, setPushing] = createSignal(false)

  const pending = (): Pending => cell.value() ?? NOTHING_PENDING

  const clearWrites = (): void => {
    refusals.refuse("commit", null)
    refusals.refuse("push", null)
  }

  const send = (): void => {
    if (pushing()) return
    setPushing(true)
    clearWrites()
    run(
      gitWire().procedures.git.push({}),
      (failure) => {
        setPushing(false)
        refusals.refuse("push", failure.message)
      },
      (_result: PushResult) => setPushing(false),
    )
  }

  return {
    ...policy,
    pending,
    heard: () => cell.value() !== undefined,
    waiting: () => waitingIn(pending()),
    working,
    commit: (message, picked) => {
      if (!canRecord(working(), pushing())) return
      const complete = submittedPreparation()
      setWorking(true)
      clearWrites()
      run(
        gitWire().procedures.git.commit({
          ...(message.trim() === "" ? {} : { message }),
          ...(picked._tag === "FullSweep" ? {} : { paths: picked.paths }),
        }),
        (failure) => {
          setWorking(false)
          refusals.refuse("commit", failure.message)
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
