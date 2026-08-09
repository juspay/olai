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
import { Effect } from "effect"

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
    bound.done.catch((cause: unknown) => {
      options.log(`surface runtime faulted — unrecoverable: ${String(cause)}`)
      process.exit(1)
    })

    const url = yield* listen({ ...options, bound })

    options.log(`serving ${options.root} on ${url}`)
    if (!LOOPBACK.has(options.host)) {
      options.log(
        `WARNING: bound to ${options.host}, not loopback — the surface is unauthenticated, so anyone who can reach this port can read every outline in ${options.root}`,
      )
    }
  })

const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"])
