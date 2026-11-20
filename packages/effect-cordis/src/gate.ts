import { Cause, Effect, Exit, Fiber, Scope } from "effect"

import { type Quieting, quieting } from "./lifecycle.ts"

export interface Gate {
  readonly through: <A, B>(
    work: Effect.Effect<A>,
    use: (started: Fiber.Fiber<A> | undefined) => Effect.Effect<B>,
  ) => Effect.Effect<B>
}

export const gate = (plugin: string, what: string): Effect.Effect<Gate, never, Scope.Scope> =>
  Effect.gen(function*() {
    const held = open(plugin, what)
    yield* quieting(held.quiet)
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        held.quiet.shut()
        await held.quiet.cut()
        held.ended()
      })
    )
    return held.gate
  })

interface Held {
  readonly gate: Gate
  readonly quiet: Quieting
  readonly ended: () => void
}

interface Inside {
  fiber: Fiber.Fiber<unknown> | undefined
  cut: boolean
  readonly out: Promise<void>
  readonly left: () => void
}

const open = (_plugin: string, _what: string): Held => {
  let shut = false
  const inside = new Set<Inside>()
  let cutting: Promise<void> | undefined
  const over = Promise.withResolvers<void>()
  const stop = (call: Inside): void => {
    call.cut = true
    call.fiber?.interruptUnsafe()
  }
  return {
    gate: {
      through: <A, B>(
        work: Effect.Effect<A>,
        use: (started: Fiber.Fiber<A> | undefined) => Effect.Effect<B>,
      ) =>
        Effect.uninterruptibleMask((restore) =>
          Effect.flatMap(Effect.context<never>(), (services) =>
            Effect.suspend(() => {
              if (shut) return restore(use(undefined))
              const settled = Promise.withResolvers<void>()
              const call: Inside = {
                fiber: undefined,
                cut: false,
                out: settled.promise,
                left: () => settled.resolve(),
              }
              inside.add(call)
              let started: Fiber.Fiber<A>
              try {
                started = Effect.runForkWith(services)(work)
              } catch (thrown) {
                inside.delete(call)
                call.left()
                throw thrown
              }
              call.fiber = started
              started.addObserver(() => {
                inside.delete(call)
                call.left()
              })
              if (call.cut) started.interruptUnsafe()
              return Effect.onExit(
                restore(Effect.suspend(() => use(started))),
                (exit) => Exit.isSuccess(exit) ? Effect.void : Fiber.interrupt(started),
              )
            }))),
    },
    quiet: {
      shut: () => { shut = true },
      cut: () =>
        cutting ??= (async () => {
          const cut = [...inside]
          inside.clear()
          if (cut.length === 0) return
          for (const call of cut) stop(call)
          await Promise.all(cut.map((call) => call.out))
        })(),
      done: over.promise,
    },
    ended: () => over.resolve(),
  }
}

export const wasCut = <A>(exit: Exit.Exit<A>): boolean =>
  Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)
