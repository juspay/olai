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

export interface GitPolicySeam {
  readonly git: Accessor<GitState>
  readonly resumeRefused: Accessor<string | null>
  readonly resume: () => void
  readonly unlockRefused: Accessor<string | null>
  readonly unlock: (onAnswer: (answer: UnlockResult) => void) => void
}

export interface Commit extends GitPolicySeam {
  readonly pending: Accessor<Pending>
  readonly heard: Accessor<boolean>
  readonly waiting: Accessor<number>
  readonly working: Accessor<boolean>
  readonly refused: Accessor<string | null>
  readonly commit: (message: string, paths?: ReadonlyArray<string>) => void
  readonly pushing: Accessor<boolean>
  readonly push: () => void
}

export const canRecord = (working: boolean, pushing: boolean): boolean =>
  !working && !pushing

export const createGitPolicy = (): GitPolicySeam => {
  const git = gitWire().cells.git.use()
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
    refused,
    pending,
    heard: () => cell.value() !== undefined,
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
