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

const refused = (origin: string, why: string, since: string): OduLink => ({
  status: "skew",
  origin,
  refusal: why,
  since,
})

const connected = (origin: string, since: string): OduLink => ({
  status: "connected",
  origin,
  refusal: null,
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
    const note = skewNote(cell, origin, CI_NEEDS)
    if (note !== null) sink.warn(`olai: ${note}`)

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
