import { mirrorRemoteSurface } from "@kolu/surface/mirror"
import { connectPadi, type PadiSurfaceClient } from "@kolu/padi-client/dial"
import {
  PADI_SURFACE_VERSION,
  padiSurface,
  type PadiTerminal,
  type PadiUrgency,
  type TerminalAttachFrame,
} from "@kolu/padi-client/surface"
import {
  type DaemonContractSkewError,
  isContractSkewError,
} from "@kolu/surface-daemon-supervisor/dial"
import { KOLU_UNDIALED, type KoluLink } from "./wire/index.ts"
import { Cause, Duration, Effect, Schedule } from "effect"

import { rendezvousIn } from "./socket.ts"

const REDIAL = Duration.seconds(5)

export type PadiAttachFrame = TerminalAttachFrame

export interface Sink {
  readonly link: (state: KoluLink) => void
  readonly upsert: (id: string, record: PadiTerminal) => void
  readonly remove: (id: string) => void
  readonly cleared: () => void
  readonly say: (line: string) => void
  readonly face: (padi: PadiSurfaceClient | null) => void
  readonly urgency: (value: PadiUrgency) => void
  readonly live: (ids: ReadonlyArray<string>) => void
  readonly dialed: () => void
}

export const SPEAKS: string = PADI_SURFACE_VERSION

export type Dial = typeof connectPadi

export type { PadiSurfaceClient } from "@kolu/padi-client/dial"

const absent = (socket: string, told: boolean, since: string): KoluLink => ({
  ...KOLU_UNDIALED,
  status: "absent",
  socket,
  told,
  speaks: SPEAKS,
  since,
})

export const runLink = (
  sink: Sink,
  env: Record<string, string | undefined>,
  now: () => string,
  dial: Dial = connectPadi,
): Effect.Effect<never> =>
  Effect.gen(function*() {
    const where = rendezvousIn(env)
    yield* Effect.repeat(
      dialOnce(sink, where.path, where.told, now, dial),
      Schedule.spaced(REDIAL),
    )
  }) as Effect.Effect<never>

const skewOf = (err: unknown): DaemonContractSkewError | null =>
  isContractSkewError(err) ? err : null

const dialOnce = (
  sink: Sink,
  socket: string,
  told: boolean,
  now: () => string,
  dial: Dial,
): Effect.Effect<void> =>
  Effect.gen(function*() {
    sink.dialed()
    const connection = yield* dial(socket)
    sink.link({
      status: "connected",
      socket,
      told,
      stateRoot: connection.identity.stateRoot,
      surfaceVersion: connection.identity.surfaceVersion,
      speaks: SPEAKS,
      since: now(),
    })
    sink.face(connection.client.padi)
    sink.say(`olai: padi connected at ${socket}`)

    const abort = new AbortController()
    const mirrored = mirrorRemoteSurface(
      padiSurface,
      connection.client.padi,
      {
        cells: {
          urgency: (value) => sink.urgency(value as PadiUrgency),
        },
        streams: {
          activity: {
            input: {},
            onFrame: (ids) => sink.live(ids as ReadonlyArray<string>),
          },
        },
        collections: {
          terminals: {
            upsert: (id, record) => sink.upsert(id as string, record as PadiTerminal),
            remove: (id) => sink.remove(id as string),
          },
        },
      },
      {
        signal: abort.signal,
        log: sink.say,
        onFault: (fault) =>
          sink.say(`olai: padi mirror fault on ${fault.label}: ${String(fault.err)}`),
      },
    )

    yield* Effect.callback<void>((resume) => {
      let settled = false
      const done = (why: string): void => {
        if (settled) return
        settled = true
        sink.say(`olai: padi link ended (${why})`)
        resume(Effect.void)
      }
      connection.onClose(() => done("socket closed"))
      mirrored.done.then(
        () => done("mirror finished"),
        (err: unknown) => done(`mirror failed: ${String(err)}`),
      )
      return Effect.sync(() => abort.abort())
    })

    sink.face(null)
    sink.cleared()
    sink.link(absent(socket, told, now()))
  }).pipe(
    Effect.scoped,
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        const err: unknown = Cause.squash(cause)
        sink.face(null)
        sink.cleared()
        const skew = skewOf(err)
        if (skew !== null) {
          sink.link({
            status: "skew",
            socket,
            told,
            stateRoot: null,
            surfaceVersion: skew.daemonVersion,
            speaks: SPEAKS,
            since: now(),
          })
          sink.say(
            `olai: padi at ${socket} speaks ${skew.daemonVersion}, this build speaks ${SPEAKS}`,
          )
          return
        }
        sink.link(absent(socket, told, now()))
        sink.say(`olai: no padi at ${socket} (${String(err)})`)
      })
    ),
  )
