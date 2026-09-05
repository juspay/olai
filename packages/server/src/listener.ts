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
import type { FaceExposure } from "@kolu/surface/expose"
import { codeOf, type Emit, emitter } from "@olai/log"
import { ASSET_PREFIX } from "@olai/surface"
import { Effect, Layer, type Scope } from "effect"

import { CurrentWho, type Reading, whoRoute } from "./identity.ts"
import { manifestOf } from "./manifest.ts"
import { pluginChunks } from "./dynamic/route.ts"
import { mcpRoute } from "./mcp/route.ts"
import { mediaLayer } from "./media.ts"
import { report } from "./report.ts"
import { resyncRoute } from "./resync.ts"
import type { Bound } from "./runtime.ts"

export interface ListenOptions {
  /**
   * What is served on the wire. The lifetime is NOT this file's: `serve.ts`
   * built the runtime and closes it, so only the two fields a transport
   * actually needs are asked for here.
   *
   * IT IS HANDED ON AS ACCESSORS rather than read here, and that is the whole
   * of the loader surface's transport half. `Bound`'s `group` and `handlers`
   * are getters over a runtime whose served set MOVES — a plugin switched off
   * drops its sibling, one switched on mounts a new one — and reading them here
   * would hand the listener the composition as it stood when the port bound.
   * That is what it used to do, and a re-mounted sibling's tags then resolved
   * to the RETIRED mount's refusing handler for the life of the process, on
   * every socket afterwards including a reloaded page's.
   */
  readonly bound: Pick<Bound, "group" | "handlers">
  /**
   * WHAT A TAB MAY CALL, as the composition root minted it — `./runtime.ts`'s
   * `bind` returns the browser face beside the group it describes, because a
   * face and a group that disagree about which plugins are composed is a
   * refusal (`restrictHandlers` compares the two as a set equality). It used to
   * be read straight off `./faces.ts` here, which was safe only while the
   * surface was one fixed thing; it is a composition now, so the exposure
   * travels WITH the group rather than being looked up beside it.
   *
   * A THUNK for the same reason `bound`'s fields are accessors, and it is the
   * field that makes the pairing load-bearing: a face is a default-deny
   * allowlist DERIVED from the sibling set, so a roster that moved and a gate
   * that did not is exactly the set inequality that refusal exists to raise.
   * The two have to move together or the listener refuses every socket the
   * moment a plugin arrives.
   *
   * NOT OMITTABLE, even though upstream allows it: an absent exposure serves
   * the whole surface, and that default is exactly what this listener must
   * never fall back to. The surface carries the ops request vocabulary, and a
   * browser must not speak it — `ops.*` is not on the browser face, so a tab
   * that calls one is refused per request rather than finding a member missing.
   */
  readonly expose: () => FaceExposure
  /** The built browser bundle. */
  readonly clientDist: string
  /** The directory being served — where `/media/*` reads its pictures from. */
  readonly root: string
  /** The machine this server says it runs on, ALREADY MINTED — the
   *  composition root's single reading (`./hostname.ts` says why it is the
   *  root's), so the manifest and `app.get` cannot drift. */
  readonly hostname: string
  readonly host: string
  readonly port: number
  /** Browser origins allowed to open the websocket, beyond same-origin. */
  readonly allowedOrigins: ReadonlyArray<string>
  /**
   * WHICH HEADERS A SOCKET MAY CARRY — a VALUE, because the seam fixes the
   * allowlist when the port binds and there is no re-reading it.
   *
   * It is read where it is spent, which is `./serve.ts`: this file takes
   * the answer rather than a way to ask, so the once-only read is one line
   * in the composition root at the moment it happens rather than a
   * `.headers` inside a thunk everything else reads live. A row offered
   * mid-serve therefore names its headers at the NEXT START
   * (`@olai/plugin-api`'s `Identity` argues why the seam is shaped that
   * way, and `packages/plugins/identity/docs.md` says what it costs an open
   * tab).
   *
   * A VALUE is what is TRUE today, and it is meant to be read as a claim
   * rather than as a style: a thunk here would say the names are re-read
   * and they are not. The day the seam closes upstream — the allowlist read
   * per accept, the way the served generation already is — this field
   * becomes a thunk and this paragraph goes with it, which is one edit in
   * two files and no new vocabulary.
   */
  readonly upgradeHeaders: ReadonlyArray<string>
  /**
   * ...AND WHO A REQUEST IS, which is the other clock: read per request,
   * for {@link ListenOptions.bound}'s reason. The roster MOVES, and a serve
   * that switched the identity row off holds a socket whose every later
   * request must read as nobody.
   *
   * A function of headers and nothing more — this file never learns that a
   * plugin is behind it, which is what keeps the two clocks from being one
   * parameter that reads live in one place and once in another.
   */
  readonly who: Reading
  /** The internal MCP server, mounted beside the static routes — see
   *  {@link ./mcp/route.ts} for why it rides this listener rather than a
   *  transport of its own. */
  readonly mcp: Parameters<typeof mcpRoute>[0]
  /** `POST /olai/resync` — look at the disk now, ignoring mtime+size stamps.
   *  See {@link ./resync.ts}. */
  readonly resync: Parameters<typeof resyncRoute>[0]
  /** `GET /_olai/plugins/*` — the browser half of a plugin this VAULT defines,
   *  compiled by this serve. `null` for a serve with no vault behind it. See
   *  {@link ./dynamic/route.ts}. */
  readonly plugins: Parameters<typeof pluginChunks>[0]
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
    // THE GENERATION, READ AT EACH ACCEPT AND NEVER HERE — one `live`, which is
    // what a `ServedGenerationSource` is: a caller with a fixed surface passes
    // the triple itself, and one whose served set MOVES passes a function that
    // names the triple that is current then.
    //
    // ONE FUNCTION RATHER THAN THREE, and the shape is what makes the rule
    // keepable: the group, the handler record and the gate are one generation,
    // and two of them re-read with the third stale is the set inequality
    // `restrictHandlers` refuses on — a socket terminated, not a member denied.
    // Three separate accessors leave that to the caller to remember; one leaves
    // nothing to remember.
    live: () => ({
      group: options.bound.group,
      handlers: options.bound.handlers,
      expose: options.expose(),
    }),
    clientDist: options.clientDist,
    // The same spelling the build took — `@olai/surface`'s ASSET_PREFIX, so a
    // vault file under `assets/` is a page rather than a miss under the
    // immutable prefix. One constant, both processes.
    assetPrefix: ASSET_PREFIX,
    // What is in the manifest is `./manifest.ts`, and its NAME is the word
    // the composition root already read once (`./hostname.ts` says why the
    // reading is the root's): the machine this process runs on joins
    // `name`, so an olai installed from each of two boxes is two apps a
    // person can tell apart — and the tab and the wordmark draw the same
    // word off `app.get`. That it is served at `/manifest.webmanifest` —
    // beside a `no-store` shell, immutable hashed assets, a 404 on an asset
    // miss and the SPA fallback that makes `/<file>` a real URL — is the
    // shell half of the call, and SERVED is what makes a per-machine name
    // possible at all: a manifest that shipped in `clientDist` would be
    // frozen at build time, before the machine existed as an answer.
    manifest: manifestOf(options.hostname),
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
    // olai's own FIVE routes: the one that answers with bytes from the SERVED
    // directory rather than from the bundle, the one an agent speaks to, the
    // one that forces a re-read of the disk (`POST /olai/resync`), the one
    // that says who this request is (`GET /olai/who`), and the one that answers
    // with a plugin this SERVE compiled out of somebody's vault.
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
      whoRoute(options.who),
      // ...and the fifth, which is the only one that answers with something
      // this SERVE compiled: the browser half of a plugin the vault defines
      // (`./dynamic/route.ts`). It is a route rather than a chunk in the
      // bundle because its source did not exist when the bundle was built.
      pluginChunks(options.plugins),
    ),
    host: options.host,
    port,
    allowedOrigins: options.allowedOrigins,
    // The identity headers this serve trusts, as the composition root read
    // them off the mounted row — unique, so a login that doubles as the
    // email claim is named once (a repeated name is a bind defect
    // upstream). Empty is what a serve with no identity row hands over: no
    // name is trusted because nothing is reading one.
    upgradeHeaders: options.upgradeHeaders,
    // ...and the READING is per connection, through the door as it stands
    // when the socket is accepted — so a row switched off mid-serve makes
    // every socket opened afterwards anonymous with no rebind.
    services: (connection) => Layer.succeed(CurrentWho)(options.who(connection.headers)),
    onEvent: (event) => report(event, say),
  })

/** What the OS reports for a port that is already listening. */
const IN_USE = "EADDRINUSE"

/** Ask the OS for a port. Not a magic number: `0` IS the request. */
const ANY_PORT = 0

