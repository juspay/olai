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

const gone = (sink: LinkSink, origin: string, now: () => string): void => {
  sink.face(null)
  sink.link(absent(origin, now()))
}

const watching = (
  sink: LinkSink,
  connection: ServiceConnection,
  origin: string,
  now: () => string,
): Effect.Effect<void, unknown> =>
  Effect.gen(function*() {
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

    gone(sink, origin, now)
  })

const held = (
  sink: LinkSink,
  connection: ServiceConnection,
  origin: string,
  now: () => string,
): Effect.Effect<void> =>
  Effect.gen(function*() {
    yield* Effect.addFinalizer(() => Effect.promise(() => connection.dispose()))
    yield* watching(sink, connection, origin, now)
  }).pipe(
    Effect.scoped,
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        gone(sink, origin, now)
        sink.warn(`olai: no odu at ${origin} (${String(Cause.squash(cause))})`)
      }),
    ),
  )

const dialOnce = (
  sink: LinkSink,
  origin: string,
  now: () => string,
  dial: DialService,
): Effect.Effect<void> =>
  openConnection(origin, dial).pipe(
    Effect.flatMap((connection) => held(sink, connection, origin, now)),
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        gone(sink, origin, now)
        sink.say(`olai: no odu at ${origin} (${String(Cause.squash(cause))})`)
      }),
    ),
  )

export { DEFAULT_SERVICE_ORIGIN, SERVICE_ORIGIN_ENV }
