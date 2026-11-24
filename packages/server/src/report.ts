/**
 * What the SURFACE LAYER's trouble sounds like, in olai's voice.
 *
 * `serveSurfaceApp` narrates every gate and every fault on ONE callback and
 * defaults it to `console`. {@link report} is the arm olai passes instead, and
 * this is a separate file for the reason its neighbours are:
 * `allowedOrigins.ts` owns one decision, `clientDist.ts` owns one, and this
 * owns one — how a surface-layer failure READS in this program's log. It
 * changes when `@olai/log`'s levels or annotations change, or when the
 * framework's event union grows an arm. `listener.ts` changes when the port
 * policy does, and `runtime.ts` when a binding does. Neither is a reason to
 * re-read the other.
 *
 * WHAT A TAB'S SOCKET CARRIED is told here too. kolu's union says a socket
 * opened and closed; the `ws` row that owns the socket knows more — how much
 * went each way, how long since the tab last answered, a frame too big for a
 * tab to take — and hands it over as olai's own {@link LinkFact}. Both kinds
 * arrive on the one `report`, so how a connection's life reads is decided in
 * this file and nowhere else. Every line about a connection carries `conn`
 * (this server's ordinal for it) and, when the tab stamped them on its URL,
 * `tab` and `dial`, which is what joins it to the tab's own diary.
 *
 * A CALL'S FAILURE IS REPORTED, NOT LOGGED. Effect's RPC server hands every
 * failed handler exit — a declared refusal, a defect, a response that failed
 * to encode — to the fiber's `ErrorReporter`s and to no logger, and it has
 * none by default, so until a connection carries one those failures are said
 * nowhere. {@link connectionLogging} gives each connection one, and
 * {@link gravityOf} decides how loud each failure is.
 *
 * The POLICY is the primitive's own — loud on every fault, silent on the
 * ordinary — and what differs is only the sink: these are `Effect.log*` lines,
 * so they carry the level the serve’s log-level policy filters on, the `root` annotation the
 * composition root set, and the `serve` span, and they leave by whichever
 * stream that subcommand chose. A `console.warn` would still reach a terminal;
 * it would bypass the configured log format and level that the harness and
 * journal consume.
 */

import type { SurfaceAppConnection, SurfaceAppEvent } from "@kolu/surface-app/serve"
import { SurfaceSiblingDropped } from "@kolu/surface/server"
import { type Emit, emitterOf, prettyCause, reasonOf } from "@olai/log"
import { closeMeans, duration, stampOf } from "@olai/log/link"
import type { LinkFact, LinkMeasure } from "@olai/plugin-api/transport"
import { Cause, Effect, ErrorReporter, Layer, References } from "effect"

/** The fields that say which connection a line is about. */
const which = (connection: SurfaceAppConnection<string>) => ({ conn: connection.id, ...stampOf(connection.url) })

/** How loud a failed call is, by its cause's own reasons:
 *
 *   - `defect`: something died that is not a plugin leaving — a bug, or an
 *     answer that failed to encode;
 *   - `left`: it died only because the plugin serving it left the wire, which
 *     switching a plugin off does to every call it had open;
 *   - `refused`: it failed only with declared failures. */
export type Gravity = "defect" | "left" | "refused"

export const gravityOf = (cause: Cause.Cause<unknown>): Gravity => {
  const dies = cause.reasons.filter(Cause.isDieReason)
  return dies.some((reason) => !(reason.defect instanceof SurfaceSiblingDropped))
    ? "defect"
    : dies.length > 0
    ? "left"
    : "refused"
}

/**
 * What one connection's serving stack logs under: the serve's own `logging`
 * layer, the connection named on every line, and a reporter that says each
 * failed call as a line.
 *
 * kolu builds each connection's RPC server on Effect's default runtime, so
 * without this a handler's `Effect.log*` and Effect RPC's own lines (a protocol
 * crash) would bypass the serve's level, format and annotations, and a failed
 * call — reported, never logged — would be said nowhere. The reporter emits
 * under the reporting fiber's own services, so its line carries what every
 * other line here does. `ErrorReporter.make` keeps Effect's own rules: it skips
 * interrupts and never reports one failure twice. The annotations replace
 * rather than add to the ones in force where the serve set them, which is why
 * `annotations` (the serve's `root`) is passed in. Made per call, so the
 * reporter belongs to this connection and is released with its serving scope.
 */
export const connectionLogging = (
  connection: SurfaceAppConnection<string>,
  logging: Layer.Layer<never>,
  annotations: Readonly<Record<string, unknown>>,
): Layer.Layer<never> => {
  const reporter = ErrorReporter.make(({ cause, error, fiber }) => {
    const gravity = gravityOf(cause)
    const line = gravity === "defect"
      ? Effect.annotateLogs(Effect.logError("a call failed with a defect"), { why: prettyCause(error) })
      : Effect.annotateLogs(
        Effect.logDebug(gravity === "left" ? "a call ended because its plugin left" : "a call was refused"),
        { why: reasonOf(error) },
      )
    emitterOf(fiber)(line)
  })
  return Layer.mergeAll(
    logging,
    Layer.succeed(References.CurrentLogAnnotations)({ ...annotations, ...which(connection) }),
    ErrorReporter.layer([reporter]),
  )
}

/** A socket ended. Its own close code says whether this is news: a tab that
 *  closed normally (1000) or went away (1001) has already said why in its own
 *  diary, so the server's line is `debug`. Anything else is a `warn`. */
const ended = (
  event: Extract<SurfaceAppEvent<string>, { readonly _tag: "Disconnected" }>,
  say: Emit,
  measure?: LinkMeasure,
): void => {
  const line = event.code === 1000 || event.code === 1001 ? Effect.logDebug : Effect.logWarning
  say(
    Effect.annotateLogs(line("tab disconnected"), {
      ...which(event.connection),
      code: event.code,
      means: closeMeans(event.code),
      ...(event.reason === "" ? {} : { reason: event.reason }),
      ...(measure === undefined ? {} : {
        lived: duration(measure.lived),
        inFrames: measure.inFrames,
        inBytes: measure.inBytes,
        outFrames: measure.outFrames,
        outBytes: measure.outBytes,
        largestOut: measure.largestOut,
        ...(measure.sincePong === undefined ? {} : { sincePong: duration(measure.sincePong) }),
        ...(measure.sinceInbound === undefined ? {} : { sinceInbound: duration(measure.sinceInbound) }),
      }),
    }),
  )
}

/** Narrate one listener event. `say` is the caller's emitter — a line from a
 *  Node callback, run under the fiber's own logging settings ({@link
 *  ../../log/src/emit.ts}). */
export const report = (event: SurfaceAppEvent<string> | LinkFact, say: Emit): void => {
  switch (event._tag) {
    // A connection opening is the ordinary case, so it is `debug`: a reader
    // with a tab open is not news, and an `info` line per socket per reload is
    // how a log stops being read.
    case "Connected":
      say(
        Effect.annotateLogs(Effect.logDebug("tab connected"), {
          ...which(event.connection),
          ...(event.connection.remoteAddress === undefined ? {} : { peer: event.connection.remoteAddress }),
        }),
      )
      return
    // The framework's own close, when nothing measured the socket. The `ws`
    // row reports `LinkEnded` instead; the sentence is the same.
    case "Disconnected":
      ended(event, say)
      return
    case "LinkEnded":
      ended(event.ended, say, event.measure)
      return
    // The tab will fail to decode this frame, fail every call it has in
    // flight, and redial. Said at send time, once per frame, because nothing
    // after this point on the server knows it happened.
    case "FrameOverCap":
      say(
        Effect.annotateLogs(Effect.logWarning("sent a frame larger than a tab accepts"), {
          ...which(event.connection),
          bytes: event.bytes,
          cap: event.cap,
          ...(event.kind === undefined ? {} : { kind: event.kind }),
          ...(event.request === undefined ? {} : { request: event.request }),
        }),
      )
      return
    // A tab that presents a DIFFERENT process id is bound to a process that is
    // gone, so it is closed and its wire retires rather than reconnecting into
    // a server whose bundle it does not match. Ordinary after a restart, and
    // worth one line because it explains a tab that stopped updating.
    case "StaleTab":
      say(
        Effect.annotateLogs(Effect.logInfo("stale tab rejected"), {
          claimed: event.claimedPid,
          ...stampOf(event.url),
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
    // THE LIVE GENERATION `restrictHandlers` refused — the face and the group
    // this accept was handed disagree about which plugins are composed, so the
    // socket is TERMINATED upstream rather than served narrowed. An ERROR
    // rather than a warning, and the only one in this file: nobody's tab is
    // reconnecting into anything until the roster and the gate agree again,
    // which is a boot-class refusal that happened to arrive at an accept.
    //
    // It had no arm at all until the arm below needed one, and the two are
    // written together because their DIFFERENCE is the design: this one takes
    // the socket, that one serves it anonymously.
    case "GenerationRefused":
      say(
        Effect.annotateLogs(Effect.logError("surface generation refused — this socket was dropped"), {
          url: event.url.pathname,
          why: prettyCause(event.error),
        }),
      )
      return
    // THE LIVE ALLOWLIST COULD NOT BE PRODUCED for this accept, so the socket
    // is served with no named headers and every request on it reads as
    // nobody. A WARNING rather than an error on {@link report}'s own terms:
    // nothing is broken — anonymous is a state this app already defines, and
    // the next accept re-reads the list — but somebody is looking at a serve
    // that cannot name them, which is not a thing to find out from a chip.
    //
    // A SERVE THAT BOOTED WITH A BAD NAME never gets this far — `./serve.ts`
    // checks the list it comes up with — so what lands here is the row
    // switched on MID-SERVE with a name no request can carry, and the race
    // upstream names between an offer and an accept. Both are cases where
    // there is no bind left to refuse at, which is why the line has to say
    // enough to act on: what was wrong, and which connection paid for it.
    case "UpgradeHeadersRefused":
      say(
        Effect.annotateLogs(Effect.logWarning("upgrade headers refused — this socket is anonymous"), {
          url: event.url.pathname,
          why: prettyCause(event.error),
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
          ...which(event.connection),
          why: prettyCause(event.cause),
        }),
      )
      return
    // AN ARM THIS FILE HAS NOT HEARD OF IS A COMPILE ERROR, and it is here
    // because the alternative was tried: `GenerationRefused` shipped upstream,
    // this switch went on compiling, and a terminated socket was narrated by
    // nothing until the arm above was written. A `never` is the only thing
    // that makes "the framework's event union grew an arm" — this module's own
    // reason to change, one paragraph up — arrive as a red build rather than
    // as a silence somebody notices from a log that is missing a line.
    default: {
      const unreported: never = event
      return unreported
    }
  }
}
