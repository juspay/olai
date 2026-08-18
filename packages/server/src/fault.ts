/**
 * Which runtime failures are news, and what happens to the one that is.
 *
 * The surface runtime's `done` settles for TWO reasons — it faulted, or it is
 * being closed — and the discriminator is not fulfill vs reject. Settling
 * while we are still meant to be serving is news either way: a reject is the
 * fault that used to print `[object Object]`, and a fulfill is the runtime
 * walking off while `olai web` is still waiting on it, which used to be a
 * hang that said nothing. The second reason — an ordinary close — happens on
 * every shutdown, including the shutdown a failed `listen` starts, and
 * treating THAT as a fault meant a busy port printed the runtime's close
 * over the perfectly good "cannot listen on 127.0.0.1:7714: address already
 * in use" and then exited before the runtime could report it at all. So the
 * watch only speaks while we are still meant to be serving, and
 * {@link FaultWatch.stopped} is what says we are not.
 *
 * A fault IS unrecoverable structural damage: serving past it would answer
 * subscriptions with silence, which is worse than stopping. But stopping is
 * `Effect`'s job, not `process.exit`'s. This used to exit(1) from inside the
 * `catch`, which ran none of the finalizers `serve.ts` documents as
 * load-bearing — the listener's sockets, the agent subprocess — and took the
 * test runner with it whenever a test got near the path. So the fault arrives
 * as a typed FAILURE on an effect the caller is already waiting on, the scope
 * unwinds the way every other shutdown does, and `runMain` sets the exit code
 * on the way out.
 *
 * Its own file because it is the one piece of `serve.ts` that can be driven
 * without a listener, a store or a browser — which is the only reason the arm
 * that matters is testable at all.
 */

import { prettyCause } from "@olai/log"
import { Data, Deferred, Effect, Exit } from "effect"

/** The runtime is gone and nothing is going to answer. Carries the settle
 *  rendered, because the whole failure of the code this replaces was that it
 *  did not. */
export class SurfaceFaulted extends Data.TaggedError("SurfaceFaulted")<{
  readonly cause: unknown
}> {
  override get message(): string {
    return `surface runtime faulted — unrecoverable:\n${prettyCause(this.cause)}`
  }
}

export interface FaultWatch {
  /** Fails with {@link SurfaceFaulted} if the runtime faults. Never settles
   *  otherwise, which is what makes it the thing `olai web` waits on: the
   *  server stays up by having nothing to return. */
  readonly faulted: Effect.Effect<never, SurfaceFaulted>
  /** We are no longer meant to be serving, so a settling runtime is a shutdown
   *  rather than news. Idempotent, and registered by the caller in the ORDER
   *  that makes it true before anything starts closing. */
  readonly stopped: Effect.Effect<void>
}

/** Watch a surface runtime for the one failure that is worth stopping for. */
export const watchFault = (
  runtime: { readonly done: Promise<void> },
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
      stopped: Effect.sync(() => {
        serving = false
      }),
    }
  })
