import { prettyCause } from "@olai/log"
import { Data, Deferred, Effect, Exit } from "effect"

export class SurfaceFaulted extends Data.TaggedError("SurfaceFaulted")<{
  readonly cause: unknown
}> {
  override get message(): string {
    return `surface runtime faulted — unrecoverable:\n${prettyCause(this.cause)}`
  }
}

export interface FaultWatch {
  readonly faulted: Effect.Effect<never, SurfaceFaulted>
  readonly close: Effect.Effect<void>
}

export const watchFault = (
  runtime: { readonly done: Promise<void>; readonly close: () => Promise<void> },
): Effect.Effect<FaultWatch> =>
  Effect.gen(function*() {
    const fault = yield* Deferred.make<never, SurfaceFaulted>()
    let serving = true

    const fail = (cause: unknown) => {
      if (!serving) return
      Deferred.doneUnsafe(fault, Exit.fail(new SurfaceFaulted({ cause })))
    }
    void runtime.done.then(() => fail("closed while still serving"), fail)

    return {
      faulted: Deferred.await(fault),
      close: Effect.promise(() => {
        serving = false
        return runtime.close()
      }),
    }
  })
