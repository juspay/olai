/**
 * THE ODU SERVICE LINK — one websocket, held open and re-dialed on a fixed
 * spacing, the way kolu's link holds padi.
 *
 * Olai never starts the service. Absence is ordinary: `odu mcp` bootstraps it
 * on first contact. A conversation holding odu's tools has already brought it
 * up. What this module does is dial the origin `ODU_WEB_ORIGIN` names (default
 * `127.0.0.1:18440`), read the service cell, compare major.minor against the
 * hydrated `SERVICE_CONTRACT_VERSION`, and hand the live client to the watch.
 */

import {
  dialService,
  type ServiceConnection,
} from "@odu/service-client/dial"
import {
  SERVICE_CONTRACT_VERSION,
  type ServiceCell,
} from "@odu/service-client/surface"
import { DEFAULT_SERVICE_ORIGIN, SERVICE_ORIGIN_ENV, serviceOrigin } from "@odu/service-client/endpoint"
import { isContractVersionCompatible } from "@kolu/surface/define"
import { firstFrameOrThrow } from "@kolu/surface/first-frame"
import { unenrolledStreamCall } from "@kolu/surface/client"
import { Cause, Duration, Effect, Schedule, Stream } from "effect"

import { type OduLink, ODU_UNDIALED } from "./wire/index.ts"

const REDIAL = Duration.seconds(5)

export const SPEAKS: string = SERVICE_CONTRACT_VERSION

export type DialService = (origin: string) => Promise<ServiceConnection>

export interface LinkSink {
  readonly link: (state: OduLink) => void
  readonly face: (connection: ServiceConnection | null) => void
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
}

/** The service must share our major and not be older than our minor. */
export const speaksCompatible = (speaks: string, theirs: string): boolean =>
  isContractVersionCompatible(theirs, speaks)

/** A heuristic over the error's own words: the client does not tag absence,
 *  and a refused loopback is the ordinary case. A skew or an unexpected
 *  refusal must not hide behind this. */
const absenceOf = (cause: unknown): boolean => {
  const text = cause instanceof Error ? `${cause.name} ${cause.message}` : String(cause)
  return /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ECONNRESET|connection refused|nothing serving/i.test(
    text,
  )
}

export const originIn = (
  env: Record<string, string | undefined>,
): string => serviceOrigin(env)

const absent = (origin: string, since: string): OduLink => ({
  ...ODU_UNDIALED,
  status: "absent",
  origin,
  speaks: SPEAKS,
  since,
})

const skew = (origin: string, theirs: string, since: string): OduLink => ({
  status: "skew",
  origin,
  protocolVersion: theirs,
  speaks: SPEAKS,
  since,
})

const connected = (origin: string, theirs: string, since: string): OduLink => ({
  status: "connected",
  origin,
  protocolVersion: theirs,
  speaks: SPEAKS,
  since,
})

export const runLink = (
  sink: LinkSink,
  env: Record<string, string | undefined>,
  now: () => string,
  dial: DialService = dialService,
): Effect.Effect<never> =>
  Effect.gen(function*() {
    const origin = originIn(env)
    yield* Effect.repeat(
      dialOnce(sink, origin, now, dial),
      Schedule.spaced(REDIAL),
    )
  }) as Effect.Effect<never>

const readService = (connection: ServiceConnection): Effect.Effect<ServiceCell, unknown> =>
  firstFrameOrThrow(
    unenrolledStreamCall(connection.client.surface.service.get, undefined),
    "odu: the service cell yielded no snapshot frame",
  )

/** Interruptible: `dialService` waits up to 3s for the first open, and a
 *  plugin unload must not sit on that. `acquireRelease`'s acquire is
 *  uninterruptible, so the dial is a callback; a connection that lands after
 *  interrupt is disposed rather than leaked. */
const openConnection = (
  origin: string,
  dial: DialService,
): Effect.Effect<ServiceConnection, unknown> =>
  Effect.callback<ServiceConnection, unknown>((resume, signal) => {
    void dial(origin).then(
      (conn) => {
        if (signal.aborted) {
          void conn.dispose()
          return
        }
        resume(Effect.succeed(conn))
      },
      (err) => {
        if (signal.aborted) return
        resume(Effect.fail(err))
      },
    )
  })

const dialOnce = (
  sink: LinkSink,
  origin: string,
  now: () => string,
  dial: DialService,
): Effect.Effect<void> =>
  Effect.gen(function*() {
    const connection = yield* openConnection(origin, dial)
    yield* Effect.addFinalizer(() => Effect.promise(() => connection.dispose()))
    const cell = yield* readService(connection)
    const theirs = cell.identity.protocolVersion
    if (!speaksCompatible(SPEAKS, theirs)) {
      sink.face(null)
      sink.link(skew(origin, theirs, now()))
      sink.warn(`olai: odu at ${origin} speaks ${theirs}, this build speaks ${SPEAKS}`)
      return
    }
    sink.link(connected(origin, theirs, now()))
    sink.face(connection)
    sink.say(`olai: odu connected at ${origin}`)

    // Held until the service cell's subscription dies — the socket closing,
    // a terminal close from an upgrade, or the connector's fiber interrupting.
    yield* Stream.runDrain(
      unenrolledStreamCall(connection.client.surface.service.get, undefined),
    ).pipe(
      Effect.catchCause((cause) =>
        Effect.sync(() =>
          sink.say(`olai: odu at ${origin} ended (${String(Cause.squash(cause))})`),
        ),
      ),
    )

    sink.face(null)
    sink.link(absent(origin, now()))
  }).pipe(
    Effect.scoped,
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        sink.face(null)
        sink.link(absent(origin, now()))
        const squashed = Cause.squash(cause)
        const line = `olai: no odu at ${origin} (${String(squashed)})`
        if (absenceOf(squashed)) sink.say(line)
        else sink.warn(line)
      }),
    ),
  )

export { DEFAULT_SERVICE_ORIGIN, SERVICE_ORIGIN_ENV }
