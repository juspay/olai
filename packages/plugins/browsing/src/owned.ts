import { gate } from "@olai/effect-cordis"
import type { Probed } from "@olai/plugin-api"
import { Effect, Exit, Fiber } from "effect"

export const ownProbe = (probe: Effect.Effect<Probed>) => Effect.gen(function*() {
  const owned = yield* gate("browsing", "session probe")
  const absent: Probed = { server: null, missing: null }
  return owned.through(probe, fiber => fiber === undefined
    ? Effect.succeed(absent)
    : Effect.map(Fiber.await(fiber), exit => Exit.isSuccess(exit) ? exit.value : absent))
})
