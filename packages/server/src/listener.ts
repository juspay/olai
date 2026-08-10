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
 * What is left is what the primitive does not own, and neither is a property
 * of serving a shell:
 *
 *   - WHOSE PORT IT IS. A busy port is the one bind failure that is not a
 *     reason to refuse to serve — the reader asked to read their outlines, not
 *     to own port 7714 — so olai retries wherever the OS says. Every other
 *     failure still IS a refusal, which is why {@link listen} recovers from
 *     exactly one `code` rather than from "listen failed". The retry is a
 *     second `serveSurfaceApp` and not a re-bind: there is no server handle to
 *     re-use, and nothing to clean up by hand, because the abandoned first
 *     call never bound and its teardown is already on the scope.
 *   - WHAT IT SAYS. The primitive narrates on ONE sink and defaults it to
 *     `console`; olai has a format and a stream of its own (`@olai/log`), and
 *     a `console.warn` in the middle of a logfmt stream is a line nothing
 *     downstream can read. {@link report} is that sink.
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

import {
  serveSurfaceApp,
  type SurfaceAppEvent,
  type SurfaceAppListenFailed,
} from "@kolu/surface-app/serve"
import { type Emit, emitter, prettyCause } from "@olai/log"
import { Effect, Layer, type Scope } from "effect"

import { MANIFEST } from "./manifest.ts"
import { mcpRoute } from "./mcp/route.ts"
import { mediaLayer } from "./media.ts"
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
  /** The internal MCP server, mounted beside the static routes — see
   *  {@link ./mcp/route.ts} for why it rides this listener rather than a
   *  transport of its own. */
  readonly mcp: Parameters<typeof mcpRoute>[0]
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
 *  second one that could drift from it. */
const app = (options: ListenOptions, port: number, say: Emit) =>
  serveSurfaceApp({
    group: options.bound.group,
    handlers: options.bound.handlers,
    clientDist: options.clientDist,
    // What is in the manifest is `./manifest.ts`; that it is served at
    // `/manifest.webmanifest`, beside a `no-store` shell, immutable hashed
    // assets, a 404 on an asset miss and the SPA fallback that makes
    // `/o/<file>` a real URL, is the shell half of the call.
    manifest: MANIFEST,
    // olai's own two routes: the one that answers with bytes from the SERVED
    // directory rather than from the bundle, and the one an agent speaks to.
    // MERGED rather than ordered — `HttpRouter` ranks by specificity, so
    // `POST /mcp` and `GET /media/*` both beat the shell's catch-all whichever
    // went in first.
    routes: Layer.merge(mcpRoute(options.mcp), mediaLayer(options.root)),
    host: options.host,
    port,
    allowedOrigins: options.allowedOrigins,
    onEvent: (event) => report(event, say),
  })

/**
 * What the listener says, in olai's voice.
 *
 * Loud on every fault and silent on the ordinary, which is the primitive's own
 * policy — what differs is only the sink: these are `Effect.log*` lines, so
 * they carry the level `--log-level` filters on, the `root` annotation the
 * composition root set, and the `serve` span, and they leave by whichever
 * stream that subcommand chose.
 *
 * A connection opening or closing is the ordinary case and has no line: a
 * reader with a tab open is not news, and one line per socket per reload is
 * how a log stops being read.
 */
const report = (event: SurfaceAppEvent, say: Emit): void => {
  switch (event._tag) {
    case "Connected":
    case "Disconnected":
      return
    // A tab that presents a DIFFERENT process id is bound to a process that is
    // gone, so it is closed and its wire retires rather than reconnecting into
    // a server whose bundle it does not match. Ordinary after a restart, and
    // worth one line because it explains a tab that stopped updating.
    case "StaleTab":
      say(
        Effect.annotateLogs(Effect.logInfo("stale tab rejected"), {
          claimed: event.claimedPid,
        }),
      )
      return
    // Cross-site websocket hijacking, refused on the raw socket before the
    // upgrade. Nobody's browser does this by accident.
    case "DisallowedOrigin":
      say(
        Effect.annotateLogs(Effect.logWarning("websocket upgrade refused"), {
          origin: event.origin ?? "none",
          url: event.url.pathname,
        }),
      )
      return
    case "SocketError":
      say(
        Effect.annotateLogs(Effect.logWarning("surface socket failed"), {
          why: prettyCause(event.error),
        }),
      )
      return
    // One connection's serving stack, not the listener's: the rest keep
    // serving. Rendered with `prettyCause` because what arrives here is an
    // Effect `Cause`, and a `Cause` read by a template literal is
    // `[object Object]`.
    case "ServingFailed":
      say(
        Effect.annotateLogs(Effect.logWarning("surface connection failed"), {
          why: prettyCause(event.cause),
        }),
      )
      return
  }
}

/** What the OS reports for a port that is already listening. */
const IN_USE = "EADDRINUSE"

/** Ask the OS for a port. Not a magic number: `0` IS the request. */
const ANY_PORT = 0

const codeOf = (cause: unknown): string | undefined =>
  typeof cause === "object" && cause !== null && "code" in cause
    ? String((cause as { readonly code: unknown }).code)
    : undefined
