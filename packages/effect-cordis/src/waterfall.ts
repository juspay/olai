import { Deferred, Effect, Exit, Fiber, Scope } from "effect"

import { failed } from "./broadcast.ts"
import { type Gate, gate, wasCut } from "./gate.ts"
import { type Host, provide } from "./host.ts"
import { roster } from "./registry.ts"
import { serviceTag, type ServiceKey } from "./service.ts"

const SILENT = Symbol("effect-cordis/waterfall/silent")
type Asked<A> = { readonly passed: A } | typeof SILENT

export type Middleware<A> = (value: A, next: (value: A) => Effect.Effect<A>) => Effect.Effect<A>

export interface Chain<A> {
  readonly use: (middleware: Middleware<A>) => Effect.Effect<void, never, Scope.Scope>
}

export type Dispatch<A> = (initial: A) => Effect.Effect<A>

export interface Waterfall<A> {
  readonly key: ServiceKey<Chain<A>>
  readonly open: (host: Host) => Effect.Effect<Dispatch<A>, never, Scope.Scope>
}

export const waterfall = <A>(cordis: string): Waterfall<A> => {
  const key = serviceTag<Chain<A>>(cordis)
  return {
    key,
    open: (host) =>
      Effect.gen(function*() {
        const chain = roster<{
          readonly plugin: string
          readonly middleware: Middleware<A>
          readonly gate: Gate
        }>()
        const occasion = `the "${cordis}" waterfall`
        yield* provide(host, key, (plugin) => ({
          use: (middleware) =>
            Effect.flatMap(gate(), (shut) =>
              chain.hold({ plugin, middleware, gate: shut })),
        }))
        return (initial: A) => {
          const links = chain.read()
          const step = (at: number, value: A): Effect.Effect<A> =>
            at >= links.length ? Effect.succeed(value) : Effect.gen(function*() {
              const link = links[at]!
              const asking = Deferred.makeUnsafe<Asked<A>>()
              const answered = Deferred.makeUnsafe<A>()
              let asked: "no" | "asking" | "answered" = "no"
              const next = (passed: A): Effect.Effect<A> =>
                Effect.suspend(() => {
                  if (asked === "no") asked = "asking"
                  Deferred.doneUnsafe(asking, Effect.succeed({ passed }))
                  return Deferred.await(answered)
                })
              return yield* link.gate.through(
                Effect.ensuring(
                  Effect.suspend(() => link.middleware(value, next)),
                  Effect.sync(() => { Deferred.doneUnsafe(asking, Effect.succeed(SILENT)) }),
                ),
                (running) =>
                  running === undefined ? step(at + 1, value) : Effect.gen(function*() {
                    const request = yield* Deferred.await(asking)
                    if (request !== SILENT) {
                      const carried = yield* step(at + 1, request.passed)
                      asked = "answered"
                      yield* Deferred.succeed(answered, carried)
                    }
                    const exit = yield* Fiber.await(running)
                    if (Exit.isSuccess(exit)) return exit.value
                    const onward = asked === "no"
                      ? step(at + 1, value)
                      : Effect.succeed(value)
                    if (wasCut(exit)) return yield* onward
                    return yield* Effect.flatMap(failed(link.plugin, occasion, exit.cause), () => onward)
                  }),
              )
            })
          return step(0, initial)
        }
      }),
  }
}
