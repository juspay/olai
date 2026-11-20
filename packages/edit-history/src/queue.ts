import { type Quiescence, quiescence } from "@olai/web/client/quiescence.ts"

export const serial = (
  counter: Pick<Quiescence, "held"> = quiescence,
): ((step: () => unknown) => void) => {
  let gate: Promise<unknown> = Promise.resolve()
  return (step) => {
    const drop = counter.held()
    gate = gate.then(step, step)
    if (drop !== undefined) void gate.then(drop, drop)
  }
}
