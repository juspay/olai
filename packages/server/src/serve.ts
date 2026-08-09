/**
 * The server: one directory, read and served.
 *
 * Shape (docs/architecture.md, and kolu's own surface-app example, which this
 * follows closely enough that fixes travel between them):
 *
 *   - we own the `http.Server` and hand its `request` event an Effect handler,
 *     rather than letting the platform own the listener. That is what leaves
 *     the `upgrade` event to us: Node fans an event out to EVERY listener, so
 *     a second, framework-owned upgrade handler would also try to answer a
 *     socket we have already upgraded;
 *   - the static shell, its immutable hashed assets and the SPA fallback are
 *     `surfaceAppLayer`, an `HttpRouter` layer — route ranking is by
 *     specificity, so merge order carries no meaning;
 *   - one `/rpc/ws` socket per tab, origin-gated before the upgrade and handed
 *     to `acceptSurfaceSocket`, which sequences the stale-tab gate, heartbeat
 *     enrolment and serving in the order kolu's own audit fixed.
 *
 * Nothing here interprets an outline. The store reads, the format validates,
 * and this file's whole job is to put the result on a socket.
 */

import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

import { surface } from "@olai/surface"
import type { OutlineError, OutlineSet } from "@olai/format"
import * as Store from "@olai/store"
import {
  implementSurface,
  inMemoryStore,
  type SurfaceHandlers,
} from "@kolu/surface/server"
import { gateWsOrigin, parseAllowedOrigins } from "@kolu/surface/ws-origin"
import {
  acceptSurfaceSocket,
  type ServableSocket,
  serveSurfaceSocket,
  surfaceAppLayer,
} from "@kolu/surface-app/server"
import { NodeHttpServer } from "@effect/platform-node"
import { Effect, Scope, Stream, SubscriptionRef } from "effect"
import { HttpRouter } from "effect/unstable/http"
import type { Rpc, RpcGroup } from "effect/unstable/rpc"
import { WebSocketServer } from "ws"

import { codec, combine } from "./codec.ts"

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
  /** Where to say what we are doing. Injected so a test can read it and the
   *  binary can be quiet. */
  readonly log: (message: string) => void
}

/** Runs until the process is signalled. Resolves with the bound URL once the
 *  listener is up, so a caller (a test, a future `olai open`) can wait for
 *  readiness without scraping stdout. */
export const serve = (options: ServeOptions) =>
  Effect.gen(function*() {
    const store = yield* Store.make({
      root: options.root,
      codec,
      combine,
    })

    const { group, handlers, close, done, pump } = yield* implement(store)

    // A faulted runtime is unrecoverable structural damage — a builder that
    // threw, a source whose install threw. Serving on past it would answer
    // subscriptions with silence.
    done.catch((cause: unknown) => {
      options.log(`surface runtime faulted — unrecoverable: ${String(cause)}`)
      process.exit(1)
    })
    yield* pump

    const server = createServer()
    server.on("request", yield* requestHandler(options.clientDist))

    const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 })
    const acceptor = acceptSurfaceSocket({
      server: wss,
      liveProcessId: PROCESS_ID,
      onReject: (claimed) => options.log(`stale tab rejected (claimed pid ${claimed})`),
    })

    wss.on("connection", (peer, request) => {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
      acceptor.accept(peer, url, () => {
        const serving = serveSurfaceSocket({
          group,
          handlers,
          // `ws`'s socket satisfies `ServableSocket` structurally; its typings
          // narrow `addEventListener` per event name, which the seam does not.
          socket: peer as unknown as ServableSocket,
        })
        // A serving site owns its `done`: it resolves on hang-up and REJECTS
        // if the serving stack failed. An ignored rejection is an unhandled one.
        serving.done.catch((cause: unknown) =>
          options.log(`surface connection failed: ${String(cause)}`)
        )
      })
    })

    server.on("upgrade", (request, socket, head) => {
      if (request.url?.startsWith(WS_PATH) !== true) {
        socket.destroy()
        return
      }
      // Cross-site websocket hijacking is gated on the raw socket, before the
      // upgrade — after it, the browser has a connection to argue about.
      if (gateWsOrigin(request, socket, { allowedOrigins: [...options.allowedOrigins] })) return
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request))
    })

    const url = yield* listen(server, options)

    return {
      url,
      shutdown: async () => {
        await close()
        acceptor.stop()
        wss.close()
        await new Promise<void>((resolve) => server.close(() => resolve()))
      },
    }
  })

const WS_PATH = "/rpc/ws"

/** One id per process, minted once. It is what a reconnecting tab compares
 *  itself against: a tab holding a bundle from a server that has since
 *  restarted is told to reload rather than served stale code. */
const PROCESS_ID = crypto.randomUUID().slice(0, 8)

/**
 * Bind the surface's two members to the store.
 *
 * The stream is `SubscriptionRef.changes` verbatim — current value first, then
 * every later one — which is already snapshot-then-deltas, so phase 3's live
 * store needs no change here at all. The error cell is pumped by a fiber
 * following the other ref, for the same reason: today it publishes once,
 * tomorrow it publishes on every reload, and the wiring is the same wiring.
 */
const implement = (store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>>) =>
  Effect.gen(function*() {
    const errors = inMemoryStore<ReadonlyArray<OutlineError>>(
      SubscriptionRef.getUnsafe(store.errors) ?? [],
    )

    const runtime = implementSurface(surface, {
      cells: { errors: { store: errors } },
      streams: {
        outlines: {
          source: () =>
            Stream.map(SubscriptionRef.changes(store.snapshot), (snapshot) =>
              snapshot === null
                ? ({ kind: "unreadable" } as const)
                : ({ kind: "outlines", rev: snapshot.rev, set: snapshot.value } as const)),
        },
      },
    } as never)

    return {
      group: runtime.group as RpcGroup.RpcGroup<Rpc.Any>,
      handlers: runtime.handlers as SurfaceHandlers,
      close: () => runtime.close(),
      done: runtime.done,
      // Writes go through the framework's cell face, never `store.set`, so the
      // cell's dedup and its publish both fire.
      pump: Effect.forkScoped(
        Stream.runForEach(SubscriptionRef.changes(store.errors), (next) =>
          Effect.sync(() => {
            runtime.ctx.cells.errors.set(next ?? [])
          })),
      ),
    }
  })

/** The `request` handler, as an Effect handler over the static layer. */
const requestHandler = (clientDist: string) =>
  Effect.gen(function*() {
    const scope = Scope.makeUnsafe()
    const layer = surfaceAppLayer({
      clientDist,
      manifest: { name: "olai", themeColor: "#1b1b1f", icons: [] },
    })
    const httpEffect = yield* HttpRouter.toHttpEffect(layer)
    return yield* NodeHttpServer.makeHandler(httpEffect, { scope })
  })

/** Bind, then read the address back. Crash rather than substitute the
 *  requested bind for the bound one: this line's whole job is to say where we
 *  actually landed. */
const listen = (
  server: ReturnType<typeof createServer>,
  options: ServeOptions,
): Effect.Effect<string> =>
  Effect.callback<string>((resume) => {
    server.listen({ host: options.host, port: options.port }, () => {
      const info = server.address() as AddressInfo | string | null
      if (info === null || typeof info === "string") {
        throw new Error(`listen: expected a TCP address, got ${JSON.stringify(info)}`)
      }
      const url = `http://${info.address}:${info.port}`
      options.log(`serving ${options.root} on ${url}`)
      if (!LOOPBACK.has(options.host)) {
        options.log(
          `WARNING: bound to ${options.host}, not loopback — the surface is unauthenticated, so anyone who can reach this port can read every outline in ${options.root}`,
        )
      }
      resume(Effect.succeed(url))
    })
  })

const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"])
