import type { Edit } from "@olai/surface"

export type Step = ReadonlyArray<Edit>

export type Side = "done" | "undone"

export interface Stack {
  readonly done: ReadonlyArray<Step>
  readonly undone: ReadonlyArray<Step>
}

export const EMPTY: Stack = { done: [], undone: [] }

export const DEPTH = 100

const capped = (steps: ReadonlyArray<Step>): ReadonlyArray<Step> =>
  steps.length <= DEPTH ? steps : steps.slice(steps.length - DEPTH)

export const recorded = (stack: Stack, step: Step): Stack => ({
  done: capped([...stack.done, step]),
  undone: [],
})

export const taken = (
  stack: Stack,
  side: Side,
): { readonly step: Step; readonly rest: Stack } | null => {
  const steps = stack[side]
  const step = steps[steps.length - 1]
  if (step === undefined) return null
  return { step, rest: { ...stack, [side]: steps.slice(0, -1) } }
}

export const kept = (stack: Stack, side: Side, step: Step): Stack => {
  const to = side === "done" ? "undone" : "done"
  return { ...stack, [to]: capped([...stack[to], step]) }
}
