import type { Applied, Edit } from "@olai/surface"
import type { OpFailure } from "@olai/format"
import { type Accessor, createSignal } from "solid-js"
import { Result } from "effect"

import type { Said } from "@olai/web/client/saying.ts"
import { serial } from "./queue.ts"
import { EMPTY, kept, recorded, type Side, type Stack, type Step, taken } from "./undo.ts"

export interface Undo {
  readonly record: (step: Step | undefined | Promise<Step | undefined>) => void
  readonly undo: () => void
  readonly redo: () => void
  readonly clear: () => void
  readonly said: Accessor<Said | null>
}

export type Apply = (edit: Edit) => Promise<Result.Result<Applied, OpFailure>>

export const createUndo = (apply: Apply): Undo => {
  const [stack, setStack] = createSignal<Stack>(EMPTY)
  const [said, setSaid] = createSignal<Said | null>(null)

  const enqueue = serial()

  const sent = async (
    step: Step,
    side: Side,
  ): Promise<{ readonly back: ReadonlyArray<Edit>; readonly said: Said | null }> => {
    const back: Array<Edit> = []
    let note: string | undefined
    for (const edit of step) {
      const outcome = await apply(edit)
      if (Result.isFailure(outcome)) {
        return { back, said: { tone: "alarm", text: `${REFUSED[side]} ${outcome.failure.message}` } }
      }
      back.unshift(...(outcome.success.undo ?? []))
      note = outcome.success.nudge ?? note
    }
    return { back, said: note === undefined ? null : { tone: "aside", text: note } }
  }

  const replay = async (side: Side): Promise<void> => {
    const held = taken(stack(), side)
    if (held === null) {
      setSaid({ tone: "aside", text: NOTHING[side] })
      return
    }
    setStack(held.rest)
    setSaid(null)

    const { back, said } = await sent(held.step, side)
    if (back.length === 0) {
      setSaid(said)
      return
    }
    setStack((current) => kept(current, side, back))
    if (said !== null) setSaid(said)
  }

  const press = (side: Side) => () => enqueue(() => replay(side))

  return {
    record: (pending) => {
      if (pending === undefined) return
      enqueue(async () => {
        const step = await pending
        if (step === undefined || step.length === 0) return
        setStack((current) => recorded(current, step))
        setSaid(null)
      })
    },
    undo: press("done"),
    redo: press("undone"),
    clear: () => {
      enqueue(() => {
        setStack(EMPTY)
        setSaid(null)
      })
    },
    said,
  }
}

const NOTHING: Record<Side, string> = {
  done: "Nothing to undo",
  undone: "Nothing to redo",
}

const REFUSED: Record<Side, string> = {
  done: "Couldn't undo that edit:",
  undone: "Couldn't redo that edit:",
}
