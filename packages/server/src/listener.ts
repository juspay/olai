/**
 * The listener: one call, and the two decisions that call deliberately leaves.
 *
 * The sequence this file used to spell out — an origin gate on the raw
 * pre-upgrade socket, the upgrade, a stale-tab check, heartbeat enrolment, a
 * serving stack per connection, and a teardown that DROPS what is connected
 * rather than waiting for it — was copied from kolu's own surface-app example,
 * and `docs/architecture.md` carried it as owed upstream from phase 2. It is
 * `serveSurfaceApp` now (`@kolu/surface-app/serve`, kolu#2137), and this file
 * is what is left when the copy goes.
 *
 * This header is the ONE place that argument lives; `docs/architecture.md`,
 * this package's README and `listener.test.ts` point here rather than
 * re-deriving it, because a rationale kept in four places is a rationale that
 * goes stale in three.
 *
 * What is left is what the primitive does not own, and neither is a property
 * of serving a shell:
 *
 *   - WHOSE PORT IT IS, which is this file. A busy port is the one bind
 *     failure that is not a reason to refuse to serve — the reader asked to
 *     read their outlines, not to own port 7714 — so olai retries wherever the
 *     OS says. Every other failure still IS a refusal, which is why
 *     {@link listen} recovers from exactly one `code` rather than from "listen
 *     failed". The retry is a second `serveSurfaceApp` and not a re-bind:
 *     there is no server handle to re-use, and nothing to clean up by hand,
 *     because the abandoned first call never bound and its teardown is already
 *     on the scope.
 *   - WHAT IT SAYS, which is `./report.ts`. The primitive narrates on ONE sink
 *     and defaults it to `console`; olai has a format and a stream of its own.
 *     Its own file because it has its own reason to change — the log's
 *     vocabulary, not this one's port policy.
 *
 * Two things are gone rather than moved, and both were the debt:
 *
 *   - the FRAME CAP. This file used to pass `ws` a `maxPayload` of 8 MiB while
 *     `@kolu/surface` classifies oversize at 16 MiB, so every frame in between
 *     died a layer below the one with a classifier, a documented close code and
 *     a client that knows what happened (#71). The primitive reads
 *     `RPC_MAX_FRAME_BYTES` and exposes no option to move it: the two layers
 *     can no longer disagree because there is only one number;
 *   - the SURFACE RUNTIME'S LIFETIME. The old teardown closed the runtime as
 *     its first act, which made a transport the second owner of something the
 *     composition root built. `serveSurfaceApp` takes `group` and `handlers`
 *     and nothing else, and `serve.ts` closes what it made.
 */

import { serveSurfaceApp, type SurfaceAppListenFailed } from "@kolu/surface-app/serve"
import { headerNamesOf, type IdentityConfig } from "@olai/identity"
import { codeOf, type Emit, emitter } from "@olai/log"
import { ASSET_PREFIX } from "@olai/surface"
import { Effect, Layer, type Scope } from "effect"

import { BROWSER_FACE } from "./faces.ts"
import { CurrentWho, whoOf, whoRoute } from "./identity.ts"
import { MANIFEST } from "./manifest.ts"
import { mcpRoute } from "./mcp/route.ts"
import { mediaLayer } from "./media.ts"
import { report } from "./report.ts"
import { resyncRoute } from "./resync.ts"
import type { Bound } from "./runtime.ts"

export interface ListenOptions {
  /** What is served on the wire. The lifetime is NOT this file's: `serve.ts`
   *  built the runtime and closes it, so only the two fields a transport
   *  actually needs are asked for here. */
  readonly bound: Pick<Bound, "group" | "handlers">
  /** The built browser bundle. */
  readonly clientDist: string
  /** The directory being served — where `/media/*` reads its pictures from. */
  readonly root: string
  readonly host: string
  readonly port: number
  /** Browser origins allowed to open the websocket, beyond same-origin. */
  readonly allowedOrigins: ReadonlyArray<string>
  /** What this server trusts for who is looking: the header names, and the
   *  avatar template the picture ladder may use. */
  readonly identity: IdentityConfig
  /** The internal MCP server, mounted beside the static routes — see
   *  {@link ./mcp/route.ts} for why it rides this listener rather than a
   *  transport of its own. */
  readonly mcp: Parameters<typeof mcpRoute>[0]
  /** `POST /olai/resync` — look at the disk now, ignoring mtime+size stamps.
   *  See {@link ./resync.ts}. */
  readonly resync: Parameters<typeof resyncRoute>[0]

}

/** Binds, and registers its own teardown on the enclosing scope — so a caller
 *  that closes the scope closes the sockets, and no caller has to remember a
 *  shutdown function. Returns the URL actually bound.
 *
 *  The retry says so out loud, and it says it with the address that was
 *  ACTUALLY bound — the one thing downstream already treats as the truth, so
 *  nothing else has to learn that a fallback happened. */
export const listen = (
  options: ListenOptions,
): Effect.Effect<string, SurfaceAppListenFailed, Scope.Scope> =>
  Effect.gen(function*() {
    // Everything the listener has to say, it says from a Node callback — a
    // websocket that hung up, a tab closed at the handshake — so the fiber's
    // logging settings are captured once, here, rather than lost per line.
    const say = yield* emitter

    return yield* Effect.catchIf(
      app(options, options.port, say),
      (failure) => codeOf(failure.cause) === IN_USE && options.port !== ANY_PORT,
      (asked) =>
        app(options, ANY_PORT, say).pipe(
          Effect.tap((url) =>
            Effect.annotateLogs(Effect.logInfo("port in use — serving elsewhere"), {
              asked: options.port,
              url,
            })
          ),
          // The retry is OUR idea, not the operator's. If even a port the OS
          // picks will not bind, the failure to report is still the one for
          // what they asked for: "cannot listen on 127.0.0.1:0" would send
          // them looking for a port nobody typed.
          Effect.mapError(() => asked),
        ),
    )
  })

/** The whole listener, at one port. Spelled once and called twice, which is
 *  what makes the fallback above a retry of the SAME server rather than a
 *  second one that could drift from it.
 *
 *  The port arrives as an ARGUMENT and is taken off the options: the retry's
 *  whole point is that it binds somewhere else, so a `port` still sitting in
 *  scope here would be a field that is right at one call site and wrong at the
 *  other. */
const app = (options: Omit<ListenOptions, "port">, port: number, say: Emit) =>
  serveSurfaceApp({
    group: options.bound.group,
    handlers: options.bound.handlers,
    // WHAT A TAB MAY CALL, and the reason this argument exists at all: the
    // surface carries the ops request vocabulary now, and a browser must not
    // speak it (`./faces.ts`). Everything a page draws or presses is named
    // there; `ops.*` is not, and a tab that calls one is refused per request
    // with `SurfaceMemberNotExposed` rather than finding a member missing.
    //
    // Not an omission-able option here even though upstream allows one: an
    // absent `expose` serves the whole surface, and that default is exactly
    // what this listener must never fall back to.
    expose: BROWSER_FACE,
    clientDist: options.clientDist,
    // The same spelling the build took — `@olai/surface`'s ASSET_PREFIX, so a
    // vault file under `assets/` is a page rather than a miss under the
    // immutable prefix. One constant, both processes.
    assetPrefix: ASSET_PREFIX,
    // What is in the manifest is `./manifest.ts`; that it is served at
    // `/manifest.webmanifest`, beside a `no-store` shell, immutable hashed
    // assets, a 404 on an asset miss and the SPA fallback that makes
    // `/<file>` a real URL, is the shell half of the call.
    manifest: MANIFEST,
    // WHICH `/sw.js` this origin serves, and the one thing about it worth
    // arguing: olai has always been "live or nothing", and the framework's
    // DEFAULT worker is the self-destructing one that keeps it that way by
    // retiring anything an older build left registered.
    //
    // `notify` is not a step back from that. It registers NO `fetch` handler,
    // so it intercepts no navigation and caches nothing — it cannot serve a
    // stale shell, which is the only thing "no service worker" was ever a
    // shorthand for — and on activate it purges any cache a legacy worker left
    // and reloads the windows that worker was controlling, which is exactly
    // what the self-destructing one did. What it adds is the ONE thing an
    // installed PWA cannot do without a worker: `registration.showNotification`
    // is the only notification path that works in `standalone` display mode, so
    // the chat's attention alerts (`packages/web/src/client/chat/attention/`)
    // have nowhere else to go.
    serviceWorker: "notify",
    // olai's own FOUR routes: the one that answers with bytes from the SERVED
    // directory rather than from the bundle, the one an agent speaks to, the
    // one that forces a re-read of the disk (`POST /olai/resync`), and the one
    // that says who this request is (`GET /olai/who`).
    //
    // There were five. `POST /capture` was a bespoke door for ONE verb, built
    // because `/mcp`'s per-process bearer left a terminal no way in; `capture`
    // is a tool on the surface now and the terminal speaks MCP at this route, so
    // the door has no reason to exist and nothing replaced it. MERGED rather
    // than ordered —
    // `HttpRouter` ranks by specificity, so each of those beats the shell's
    // catch-all whichever went in first.
    routes: Layer.mergeAll(
      mcpRoute(options.mcp),
      mediaLayer(options.root),
      resyncRoute(options.resync),
      whoRoute(options.identity),
    ),
    host: options.host,
    port,
    allowedOrigins: options.allowedOrigins,
    // The identity headers this process trusts — unique, so a login that
    // doubles as the email claim is named once (a repeated name is a bind
    // defect upstream). Empty-by-default on the seam; naming them HERE is
    // the app saying the proxy in front owns them.
    upgradeHeaders: headerNamesOf(options.identity.headers),
    services: (connection) =>
      Layer.succeed(CurrentWho)(whoOf(connection.headers, options.identity)),
    onEvent: (event) => report(event, say),
  })

/** What the OS reports for a port that is already listening. */
const IN_USE = "EADDRINUSE"

/** Ask the OS for a port. Not a magic number: `0` IS the request. */
const ANY_PORT = 0

