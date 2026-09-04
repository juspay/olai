import { type ImplementSurfaceDeps, inMemoryChannel } from "@kolu/surface/server"
import {
  definePlugin,
  Ops,
  Surfaces,
  Vault,
} from "@olai/plugin-api/services"
import {
  dailyNotePathFor,
  isDay,
  markdownIn,
  sameDated,
  sameOwed,
  samePageReading,
  type OpFailure,
  type PageReading,
  type Reading,
  UsageFailure,
} from "@olai/format"
import { Effect } from "effect"

import { dated, owed } from "./readings.ts"
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

    // One retained revision and one pulse for the two small derived readings.
    // Keeping the Reading object whole keeps its incrementally patched owed
    // index with the set it describes; day and agenda pages go through core's
    // one standing page cache below.
    let current: Reading | undefined
    const revisions = inMemoryChannel<void>()
    const replace = (next: Reading | undefined): void => {
      current = next
      revisions.publish(undefined)
    }
    const install = (_input: unknown, onEvent: () => void): (() => void) =>
      revisions.consume({ onEvent, onError: () => {} })
    yield* vault.revision((revision: VaultRevision) =>
      Effect.sync(() => replace(revision.value))
    )
    yield* vault.unloaded(Effect.sync(() => replace(undefined)))

    const reading: Effect.Effect<Reading, OpFailure> = Effect.suspend(() =>
      current === undefined ? Effect.fail(noReading()) : Effect.succeed(current)
    )
    const page = (request: unknown): Effect.Effect<PageReading, OpFailure> =>
      Effect.map(
        Effect.mapError(ops.page(request), (failure) => failure as OpFailure),
        (answer) => answer as PageReading,
      )
    yield* surfaces.register({
      surface,
      faces,
      deps: {
        streams: {
          dated: {
            read: (input) => Effect.runPromise(Effect.map(reading, (at) => dated(at.derived, input))),
            install,
            isEqual: sameDated,
          },
          owed: {
            read: (input) => Effect.runPromise(Effect.map(reading, (at) => owed(at.derived, input))),
            install,
            isEqual: sameOwed,
          },
          day: {
            read: (input) => Effect.runPromise(page(input)),
            install,
            isEqual: samePageReading,
          },
          agenda: {
            read: (input) => Effect.runPromise(page(input)),
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
              return yield* Effect.as(
                Effect.mapError(ops.document(file), (failure) => failure as OpFailure),
                { file },
              )
            }),
          },
        },
      } satisfies ImplementSurfaceDeps<typeof surface.spec>,
    })
  }),
})
