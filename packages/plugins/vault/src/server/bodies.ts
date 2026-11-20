import type { PlatformFailure } from "@olai/store"
import { Effect, Queue, type Scope } from "effect"

export type Read =
  | { readonly _tag: "body"; readonly text: string }
  | { readonly _tag: "gone" }

export type Served =
  | { readonly _tag: "body"; readonly text: string }
  | { readonly _tag: "refused" }

export const GONE: Read = { _tag: "gone" }

const REFUSED: Served = { _tag: "refused" }

export interface Bodies {
  readonly held: (path: string) => Effect.Effect<void, never, Scope.Scope>
  readonly unread: (paths: Iterable<string>) => void
}

export interface Options {
  readonly read: (path: string) => Effect.Effect<Read, PlatformFailure>
  readonly publish: (path: string, body: Served) => void
}

export const make = (
  options: Options,
): Effect.Effect<Bodies, never, Scope.Scope> =>
  Effect.gen(function*() {
    const holders = new Map<string, number>()
    const asked = new Set<string>()
    const queue = yield* Queue.unbounded<string>()

    const ask = (path: string): void => {
      if (asked.has(path)) return
      asked.add(path)
      Queue.offerUnsafe(queue, path)
    }

    yield* Effect.forever(
      Effect.gen(function*() {
        const path = yield* Queue.take(queue)
        asked.delete(path)
        if (!holders.has(path)) return
        const got = yield* Effect.catch(
          options.read(path),
          (failure: PlatformFailure) =>
            Effect.as(Effect.logWarning(`olai server: ${failure.message}`), REFUSED),
        )
        if (got._tag === "gone") return
        options.publish(path, got)
      }),
    ).pipe(Effect.forkScoped)

    return {
      held: (path) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            holders.set(path, (holders.get(path) ?? 0) + 1)
          }),
          () =>
            Effect.sync(() => {
              const count = holders.get(path) ?? 0
              if (count > 1) holders.set(path, count - 1)
              else holders.delete(path)
            }),
        ),
      unread: (paths) => {
        for (const path of paths) if (holders.has(path)) ask(path)
      },
    }
  })
