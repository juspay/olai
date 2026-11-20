import { type Cause, Effect, Fiber, Scope } from "effect"

import { gate } from "./gate.ts"
import { roster } from "./registry.ts"

export type Handler<A> = (value: A) => Effect.Effect<void>

export type Listen<A> = (handler: Handler<A>) => Effect.Effect<void, never, Scope.Scope>

export interface Bus<A> {
  readonly listen: (plugin: string) => Listen<A>
  readonly tell: (value: A) => Effect.Effect<void>
}

const shielded = <A>(
  plugin: string,
  what: string,
  handler: Handler<A>,
): Effect.Effect<Handler<A>, never, Scope.Scope> =>
  Effect.map(gate(), (shut) => (value: A) =>
    shut.through(
      contained(plugin, what, Effect.suspend(() => handler(value))),
      (started) => started === undefined ? Effect.void : Effect.asVoid(Fiber.await(started)),
    ))

export const broadcast = <A>(what: string): Bus<A> => {
  const handlers = roster<Handler<A>>()
  return {
    listen: (plugin) => (handler) => Effect.flatMap(shielded(plugin, what, handler), handlers.hold),
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
