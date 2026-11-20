import { BusyFailure, isOpFailure, type OpFailure } from "@olai/format"
import { Cause, Effect, Exit, Result } from "effect"

import { quiescence } from "./quiescence.ts"

export type Call<A> = Effect.Effect<A, unknown>

export const run = <A>(
  effect: Call<A>,
  onFailure: (failure: OpFailure) => void,
  onSuccess?: (value: A) => void,
): void => {
  void runAsync(effect).then((outcome) => {
    if (Result.isSuccess(outcome)) onSuccess?.(outcome.success)
    else onFailure(outcome.failure)
  })
}

export const runAsync = <A>(effect: Call<A>): Promise<Result.Result<A, OpFailure>> =>
  quiescence.holding(
    Effect.runPromiseExit(Effect.result(effect)).then((exit) => {
      if (Exit.isSuccess(exit)) {
        const outcome = exit.value
        return Result.isSuccess(outcome)
          ? Result.succeed(outcome.success)
          : Result.fail(asFailure(outcome.failure))
      }
      if (!Cause.hasInterruptsOnly(exit.cause)) {
        const defect = Cause.squash(exit.cause)
        if (!siblingDropped(defect)) throw defect
        return Result.fail(
          new BusyFailure({
            reason: "the plugin serving this member left the wire before the server answered it",
          }),
        )
      }
      return Result.fail(
        new BusyFailure({
          reason: "the connection this call was on was replaced before the server answered it",
        }),
      )
    }),
  )

const DROPPED = "SurfaceSiblingDropped"

const siblingDropped = (defect: unknown): boolean => {
  if (typeof defect !== "object" || defect === null) return false
  const said = defect as { readonly _tag?: unknown; readonly name?: unknown }
  return said._tag === DROPPED || said.name === DROPPED
}

export const asFailure = (failure: unknown): OpFailure =>
  isOpFailure(failure)
    ? failure
    : new BusyFailure({
      reason: failure instanceof Error ? failure.message : String(failure),
    })
