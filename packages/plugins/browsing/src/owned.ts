import { gate } from "@olai/effect-cordis"
import type { Probed } from "@olai/plugin-api"
import { Effect, Exit, Fiber } from "effect"

/** SessionStart withdraws the registration, but a session opener may already
 * hold its snapshot. The gate refuses those late calls and interrupts and joins
 * running probes before the activation releases scratch. Acquire it after
 * scratch so the same ordering holds in a bare scope, too. */
export const ownProbe = (probe: Effect.Effect<Probed>) => Effect.gen(function*() {
  const owned = yield* gate("browsing", "session probe")
  const absent: Probed = { server: null, missing: null }
  return owned.through(probe, fiber => fiber === undefined
    ? Effect.succeed(absent)
    : Effect.map(Fiber.await(fiber), exit => Exit.isSuccess(exit) ? exit.value : absent))
})
