/**
 * The listener: HTTP for the browser bundle, WebSocket for the surface.
 *
 * The shape is kolu's own surface-app example, followed closely enough that
 * fixes travel between them — which is also the reason this file exists as a
 * named seam rather than as forty lines inside `serve`. The composition root's
 * job is to say "store, then surface, then listener"; the sequencing of an
 * origin gate, an upgrade, a stale-tab check and a serving stack is a separate
 * concern with a separate reason to change, and it is one this repo should not
 * own for long (see the note in docs/architecture.md).
 *
 * Two invariants are load-bearing:
 *
 *   - we own the `http.Server` and hand its `request` event an Effect handler,
 *     rather than letting the platform own the listener. That is what leaves
 *     the `upgrade` event to us: Node fans an event out to EVERY listener, so
 *     a second, framework-owned upgrade handler would also try to answer a
 *     socket we have already upgraded;
 *   - the order is origin gate (raw socket, pre-upgrade) → `handleUpgrade` →
 *     stale-tab gate → heartbeat enrolment → serve. `acceptSurfaceSocket` owns
 *     the last three; this file owns the first two.
 */

import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

import { gateWsOrigin } from "@kolu/surface/ws-origin"
import {
  acceptSurfaceSocket,
  type ServableSocket,
  serveSurfaceSocket,
  surfaceAppLayer,
} from "@kolu/surface-app/server"
import { NodeHttpServer } from "@effect/platform-node"
import { Data, Effect, Layer, Scope } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { WebSocketServer } from "ws"

import { MANIFEST } from "./manifest.ts"
import { mediaLayer } from "./media.ts"
import type { Bound } from "./runtime.ts"

const WS_PATH = "/rpc/ws"

export class ListenFailed extends Data.TaggedError("ListenFailed")<{
  readonly host: string
  readonly port: number
  readonly cause: unknown
}> {
  override get message(): string {
    return `cannot listen on ${this.host}:${this.port}: ${
      this.cause instanceof Error ? this.cause.message : String(this.cause)
    }`
  }
}

export interface ListenOptions {
  readonly bound: Bound
  /** The built browser bundle. */
  readonly clientDist: string
  /** The directory being served — where `/media/*` reads its pictures from. */
  readonly root: string
  readonly host: string
  readonly port: number
  /** Browser origins allowed to open the websocket, beyond same-origin. */
  readonly allowedOrigins: ReadonlyArray<string>
  readonly log: (message: string) => void
}

/** Binds, and registers its own teardown on the enclosing scope — so a caller
 *  that closes the scope closes the sockets, and no caller has to remember a
 *  shutdown function. Returns the URL actually bound. */
export const listen = (options: ListenOptions) =>
  Effect.gen(function*() {
    const server = createServer()
    server.on("request", yield* requestHandler(options))

    const sockets = new WebSocketServer({
      noServer: true,
      maxPayload: 8 * 1024 * 1024,
    })
    // The gate compares the `pid` a reconnecting tab presents against the id
    // this process answers `system/identity` with — one id, minted and read by
    // the framework, so no id is threaded through here and the two ends cannot
    // be pointed at different ones. A tab that presents none has never been
    // served by anybody and is simply accepted; a tab that presents a DIFFERENT
    // one is bound to a process that is gone, so it is closed with the stale
    // code and its wire retires rather than reconnecting into a server whose
    // bundle it does not match.
    const acceptor = acceptSurfaceSocket({
      server: sockets,
      onReject: (claimed) => options.log(`stale tab rejected (claimed pid ${claimed})`),
    })

    sockets.on("connection", (peer, request) => {
      const url = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "localhost"}`,
      )
      acceptor.accept(peer, url, () => {
        const serving = serveSurfaceSocket({
          group: options.bound.group,
          handlers: options.bound.handlers,
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
      // Cross-site websocket hijacking is refused on the raw socket, before
      // the upgrade — after it, the browser has a connection to argue about.
      if (gateWsOrigin(request, socket, { allowedOrigins: [...options.allowedOrigins] })) {
        return
      }
      sockets.handleUpgrade(request, socket, head, (ws) =>
        sockets.emit("connection", ws, request))
    })

    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        await options.bound.close()
        acceptor.stop()
        sockets.close()
        await new Promise<void>((resolve) => server.close(() => resolve()))
      })
    )

    return yield* bindOrFallBack(server, options)
  })

/** What the OS reports for a port that is already listening. */
const IN_USE = "EADDRINUSE"

/** Ask the OS for a port. Not a magic number: `0` IS the request. */
const ANY_PORT = 0

const codeOf = (cause: unknown): string | undefined =>
  typeof cause === "object" && cause !== null && "code" in cause
    ? String((cause as { readonly code: unknown }).code)
    : undefined

/**
 * Bind — and if the port is simply taken, bind once more wherever the OS says.
 *
 * A busy port is the one listen failure that is not a reason to refuse to
 * serve: the reader asked to read their outlines, not to own port 7714. Every
 * other failure still is one (a host that is not this machine's, a privileged
 * port, a socket the kernel will not give us), which is why this recovers from
 * exactly one `code` rather than from "listen failed".
 *
 * The retry says so out loud, and it says it with the address that was ACTUALLY
 * bound — the one thing downstream already treats as the truth. Nothing else
 * has to learn that a fallback happened.
 */
const bindOrFallBack = (
  server: ReturnType<typeof createServer>,
  options: ListenOptions,
): Effect.Effect<string, ListenFailed> =>
  Effect.catchIf(
    bind(server, options),
    (failure) => codeOf(failure.cause) === IN_USE && options.port !== ANY_PORT,
    (asked) =>
      bind(server, { ...options, port: ANY_PORT }).pipe(
        Effect.tap((url) =>
          Effect.sync(() =>
            options.log(`port ${options.port} in use — serving on ${url} instead`)
          )
        ),
        // The retry is OUR idea, not the operator's. If even a port the OS
        // picks will not bind, the failure to report is still the one for what
        // they asked for: "cannot listen on 127.0.0.1:0" would send them
        // looking for a port nobody typed.
        Effect.mapError(() => asked),
      ),
  )

/** The `request` handler, as an Effect handler over two layers.
 *  `surfaceAppLayer` owns the freshness contract: a `no-store` shell,
 *  immutable hashed assets, a 404 on an asset miss (never the shell), and the
 *  SPA fallback that makes `/o/<file>` a real URL, and it serves the web app
 *  manifest at `/manifest.webmanifest` — what is IN that manifest is
 *  `./manifest.ts`. `mediaLayer` owns the one route that answers with bytes
 *  from the SERVED directory rather than from the bundle — merge order carries
 *  no meaning, because `HttpRouter` ranks by specificity and `/media/*` is more
 *  specific than the shell's catch-all. */
const requestHandler = (options: { readonly clientDist: string; readonly root: string }) =>
  Effect.gen(function*() {
    const scope = Scope.makeUnsafe()
    const layer = Layer.merge(
      mediaLayer(options.root),
      surfaceAppLayer({
        clientDist: options.clientDist,
        manifest: MANIFEST,
      }),
    )
    const httpEffect = yield* HttpRouter.toHttpEffect(layer)
    return yield* NodeHttpServer.makeHandler(httpEffect, { scope })
  })

/** Bind, then read the address back. Crash rather than substitute the
 *  requested bind for the bound one: this line's whole job is to say where we
 *  actually landed. */
const bind = (
  server: ReturnType<typeof createServer>,
  options: ListenOptions,
): Effect.Effect<string, ListenFailed> =>
  Effect.callback<string, ListenFailed>((resume) => {
    // The error listener is the whole reason this is not a bare `listen`:
    // EADDRINUSE is the realistic failure — a fixed default port, a harness
    // spawning servers — and without it Node raises it as an uncaught event
    // rather than as this fiber's failure.
    server.once("error", (cause) =>
      resume(new ListenFailed({ host: options.host, port: options.port, cause })))
    server.listen({ host: options.host, port: options.port }, () => {
      const info = server.address() as AddressInfo | string | null
      if (info === null || typeof info === "string") {
        resume(
          new ListenFailed({
            host: options.host,
            port: options.port,
            cause: `expected a TCP address, got ${JSON.stringify(info)}`,
          }),
        )
        return
      }
      resume(Effect.succeed(`http://${info.address}:${info.port}`))
    })
  })
