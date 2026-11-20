import { type Cause, Effect, Fiber, Scope } from "effect"

import { gate } from "./gate.ts"
import { roster } from "./registry.ts"

export type Listen<A> = (handler: (value: A) => Effect.Effect<void>) => Effect.Effect<
  void,
  never,
  Scope.Scope
>

export interface Bus<A> {
  readonly listen: (plugin: string) => Listen<A>
  /** One value to every handler, in subscription order, answered when the last
   *  of them has. */
  readonly tell: (value: A) => Effect.Effect<void>
}

export const broadcast = <A>(what: string): Bus<A> => {
  const handlers = roster<(value: A) => Effect.Effect<void>>()
  return {
    listen: (plugin) => (handler) =>
      Effect.flatMap(gate(plugin, what), (shut) =>
        handlers.hold((value) =>
          shut.through(
            contained(plugin, what, Effect.suspend(() => handler(value))),
            (started) =>
              started === undefined ? Effect.void : Effect.asVoid(Fiber.await(started)),
          ))),
    tell: (value) =>
      Effect.suspend(() => Effect.forEach(handlers.read(), (handler) => handler(value), {
        discard: true,
      })),
  }
}

export const failed = (
  plugin: string,
  what: string,
  cause: Cause.Cause<never>,
): Effect.Effect<void> =>
  Effect.logWarning(`plugins: "${plugin}" failed on ${what}`, cause)

export const contained = (
  plugin: string,
  what: string,
  work: Effect.Effect<void>,
): Effect.Effect<void> => Effect.catchCause(work, (cause) => failed(plugin, what, cause))
