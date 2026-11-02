/**
 * THE ODU SERVICE LINK — one websocket, held open and re-dialed on a fixed
 * spacing, the way kolu's link holds padi.
 *
 * Olai never starts the service. Absence is ordinary: `odu mcp` bootstraps it
 * on first contact. A conversation holding odu's tools has already brought it
 * up. What this module does is dial the origin `ODU_WEB_ORIGIN` names (default
 * `127.0.0.1:18440`), read the service cell, and ask ODU whether this build
 * may read what answered.
 *
 * ## THE ROWS OLAI READS ARE THE RUNS, AND NOTHING ELSE
 *
 * odu's host mounts the cache, the door and the tunnel beside the runs, and
 * since juspay/odu#141 each row carries its OWN contract version — the one
 * number that used to version the whole composed wire refused a runs-only
 * reader every time the cache moved. So this link declares what it reads
 * ({@link CI_NEEDS}, the `ci` row) and is judged on that alone.
 *
 * The judging is odu's own {@link admitService}, beside the versions it is
 * about, and this module holds NO comparison of its own: a second judge is the
 * one that gets the direction of the comparison backwards, because "older
 * reader, newer daemon" is fine and its mirror is not. What comes back is a
 * VALUE — adopt, or a refusal with odu's whole sentence in it, which the link
 * cell carries verbatim to the face.
 *
 * {@link skewNote} is the other half of that additive rule, and it is said out
 * loud rather than swallowed: a daemon adopted on the same major whose minor
 * is behind this build lacks the verbs added since, and a reader meeting
 * "unknown verb" later deserves to have been told once.
 */

import {
  dialService,
  type ServiceConnection,
} from "@odu/service-client/dial"
import {
  admitService,
  CI_NEEDS,
  type ServiceCell,
  skewNote,
} from "@odu/service-client/surface"
import { DEFAULT_SERVICE_ORIGIN, SERVICE_ORIGIN_ENV, serviceOrigin } from "@odu/service-client/endpoint"
import { firstFrameOrThrow } from "@kolu/surface/first-frame"
import { unenrolledStreamCall } from "@kolu/surface/client"
import { Cause, Duration, Effect, Schedule, Stream } from "effect"

import { type OduLink, ODU_UNDIALED } from "./wire/index.ts"

const REDIAL = Duration.seconds(5)

export type DialService = (origin: string) => Promise<ServiceConnection>

export interface LinkSink {
  readonly link: (state: OduLink) => void
  readonly face: (connection: ServiceConnection | null) => void
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
}

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
  since,
})

/** The daemon answered and odu refused it for this build — odu's whole
 *  sentence, carried as odu wrote it. */
const refused = (origin: string, why: string, since: string): OduLink => ({
  status: "skew",
  origin,
  refusal: why,
  since,
})

const connected = (origin: string, since: string): OduLink => ({
  status: "connected",
  origin,
  refusal: "",
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
    const verdict = admitService(cell, origin, CI_NEEDS)
    if (verdict.kind === "refuse") {
      sink.face(null)
      sink.link(refused(origin, verdict.message, now()))
      sink.warn(`olai: ${verdict.message}`)
      return
    }
    sink.link(connected(origin, now()))
    sink.face(connection)
    sink.say(`olai: odu connected at ${origin}`)
    // Adopted, and behind on a minor: odu's own note, so the "unknown verb" a
    // later call may answer with arrives already explained.
    const note = skewNote(cell, origin, CI_NEEDS)
    if (note !== null) sink.warn(`olai: ${note}`)

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
