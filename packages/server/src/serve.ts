/**
 * One directory, read and served.
 *
 * This is the composition root, and it should read as one: a store over the
 * directory, the surface bound to it, a listener in front. Each of the three
 * lives in its own file with its own reason to change; what is left here is
 * the order they go in and the one thing that is genuinely this layer's
 * business — the warning you get for binding somewhere the world can reach.
 */

import type { OutlineError, OutlineSet } from "@olai/format"
import * as Store from "@olai/store"
import { Cause, Effect } from "effect"

import { codec } from "./codec.ts"
import { listen } from "./listener.ts"
import { bind } from "./runtime.ts"

export interface ServeOptions {
  /** The directory to serve, recursively. */
  readonly root: string
  readonly port: number
  readonly host: string
  /** The built browser bundle. A nix-built binary is pointed at the bundle
   *  derivation; the dev loop points at the tree it just built. */
  readonly clientDist: string
  /** Browser origins allowed to open the websocket, beyond same-origin. */
  readonly allowedOrigins: ReadonlyArray<string>
  /** Where to say what we are doing. Injected so a test can read it and a
   *  future caller can silence it. */
  readonly log: (message: string) => void
}

/** Serves until the enclosing scope closes. Everything it opens is registered
 *  as a finalizer of that scope, so shutting down is closing the scope and no
 *  caller holds a teardown function it might forget to call. */
export const serve = (options: ServeOptions) =>
  Effect.gen(function*() {
    const store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>> = yield* Store
      .make({ root: options.root, codec })

    const bound = yield* bind(store)

    // A faulted runtime is unrecoverable structural damage. Serving past it
    // would answer subscriptions with silence, which is worse than stopping.
    //
    // But `done` settles for TWO reasons — it faulted, or it is being closed —
    // and only the first is news. The second happens on every shutdown,
    // including the shutdown a failed `listen` starts, and treating it as a
    // fault meant a busy port printed `[object Object]` over the perfectly
    // good "cannot listen on 127.0.0.1:7714: address already in use" and then
    // exited before the runtime could report it at all. So the handler only
    // speaks while we are still meant to be serving.
    let serving = true
    const stopped = Effect.sync(() => {
      serving = false
    })
    bound.done.catch((cause: unknown) => {
      if (!serving) return
      options.log(`surface runtime faulted — unrecoverable:\n${render(cause)}`)
      process.exit(1)
    })

    const url = yield* Effect.onError(listen({ ...options, bound }), () => stopped)
    // Registered AFTER the listener's own, so it runs BEFORE it: finalizers
    // run in reverse, and this one has to be true by the time anything starts
    // closing the runtime.
    yield* Effect.addFinalizer(() => stopped)

    options.log(`serving ${options.root} on ${url}`)
    if (!LOOPBACK.has(options.host)) {
      options.log(
        `WARNING: bound to ${options.host}, not loopback — the surface is unauthenticated, so anyone who can reach this port can read every outline in ${options.root}`,
      )
    }
  })

const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"])

/** What a rejection from the surface runtime actually says.
 *
 *  `done` rejects with an Effect `Cause`, and `String(cause)` on one of those
 *  is `[object Object]` — the least informative thing available about the one
 *  failure we exit the process for. `Cause.pretty` is what renders it, and
 *  the other two arms are for a rejection that never went through Effect. */
const render = (cause: unknown): string =>
  Cause.isCause(cause)
    ? Cause.pretty(cause)
    : cause instanceof Error
    ? cause.stack ?? cause.message
    : String(cause)
