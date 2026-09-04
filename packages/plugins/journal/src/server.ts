import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import {
  definePlugin,
  Ops,
  Surfaces,
  Vault,
} from "@olai/plugin-api/services"
import {
  dailyNotePathFor,
  datedAnswer,
  isDay,
  markdownIn,
  owedNow,
  pageOf,
  sameDated,
  sameOwed,
  samePageReading,
  type OpFailure,
  type Reading,
  UsageFailure,
} from "@olai/format"
import { Effect } from "effect"

import { faces, name, surface } from "./wire.ts"

export { faces, name, surface } from "./wire.ts"

const noDay = (date: string): OpFailure =>
  new UsageFailure({ reason: `\`${date}\` is not a day (YYYY-MM-DD), so there is no note to mint for it` })

const noReading = (): OpFailure =>
  new UsageFailure({ reason: "the vault has not published a reading, so the journal is not ready" })

/** The part of a published vault revision this plugin keeps. The Vault door
 * deliberately lets each tenant narrow its opaque payload at its own edge. */
interface VaultRevision {
  readonly value: Reading
}

export default definePlugin({
  name,
  needs: [Ops, Surfaces, Vault],
  apply: Effect.gen(function*() {
    const ops = yield* Ops
    const surfaces = yield* Surfaces
    const vault = yield* Vault

    // One retained revision and one pulse shared by the four readings. Keeping
    // the Reading object whole keeps its incrementally patched owed index with
    // the set and derived view it belongs to.
    let current: Reading | undefined
    const listeners = new Set<() => void>()
    const install = (_input: unknown, onEvent: () => void): (() => void) => {
      listeners.add(onEvent)
      return () => listeners.delete(onEvent)
    }
    const pulse = (): void => {
      for (const listener of listeners) listener()
    }
    yield* vault.revision((revision: VaultRevision) =>
      Effect.sync(() => {
        current = revision.value
        pulse()
      })
    )
    yield* vault.unloaded(Effect.sync(() => {
      current = undefined
      pulse()
    }))

    const reading: Effect.Effect<Reading, OpFailure> = Effect.suspend(() =>
      current === undefined ? Effect.fail(noReading()) : Effect.succeed(current)
    )
    yield* surfaces.register({
      surface,
      faces,
      deps: {
        streams: {
          dated: {
            read: (input) => Effect.runPromise(Effect.map(reading, (at) => datedAnswer(at.derived, input.month))),
            install,
            isEqual: sameDated,
          },
          owed: {
            read: (input) => Effect.runPromise(Effect.map(reading, (at) => owedNow(at.derived, input.today))),
            install,
            isEqual: sameOwed,
          },
          day: {
            read: (input) => Effect.runPromise(Effect.map(reading, (at) => pageOf(at, { kind: "day", date: input.date }))),
            install,
            isEqual: samePageReading,
          },
          agenda: {
            read: (input) => Effect.runPromise(Effect.map(reading, (at) => pageOf(at, { kind: "agenda", today: input.today }))),
            install,
            isEqual: samePageReading,
          },
        },
        // A transient vault read must be visible without taking down every
        // subscriber. The framework requires this for poll-shaped streams.
        onStreamReadError: (error, { stream }) => {
          Effect.runFork(Effect.logWarning(`journal ${stream} read failed: ${String(error)}`))
        },
        procedures: {
          note: {
            mint: ({ input }) => Effect.gen(function*() {
              if (!isDay(input.date)) return yield* Effect.fail(noDay(input.date))
              const at = yield* reading
              const file = dailyNotePathFor(
                markdownIn(at.set).map((document) => document.path),
                input.date,
              )
              return yield* Effect.map(
                Effect.mapError(ops.document(file), (failure) => failure as OpFailure),
                () => ({ file }),
              )
            }),
          },
        },
      } satisfies ImplementSurfaceDeps<typeof surface.spec>,
    })
  }),
})
