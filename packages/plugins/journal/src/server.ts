import { type ImplementSurfaceDeps, inMemoryChannel } from "@kolu/surface/server"
import {
  Clock,
  definePlugin,
  Ops,
  Surfaces,
  Vault,
  Vocabulary,
} from "@olai/plugin-api/services"
import {
  dailyNotePathFor,
  isDay,
  type KindVocabulary,
  markdownIn,
  sameDated,
  sameOwed,
  samePageReading,
  type OpFailure,
  type Reading,
  UsageFailure,
} from "@olai/format"
import { standing } from "@olai/ops"
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
  needs: [Clock, Ops, Surfaces, Vault, Vocabulary],
  apply: Effect.gen(function*() {
    const clock = yield* Clock
    const ops = yield* Ops
    const surfaces = yield* Surfaces
    const vault = yield* Vault
    const vocabulary = yield* Vocabulary

    // One retained revision and one pulse shared by the four readings. Keeping
    // the Reading object whole keeps its incrementally patched owed index with
    // the set and derived view it belongs to.
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
    const views = standing(clock.now, () => vocabulary.current() as KindVocabulary)
    yield* surfaces.register({
      surface,
      faces,
      deps: {
        streams: {
          dated: {
            read: (input) => Effect.runPromise(Effect.map(reading, (at) => views.dated(at, input))),
            install,
            isEqual: sameDated,
          },
          owed: {
            read: (input) => Effect.runPromise(Effect.map(reading, (at) => views.owed(at, input))),
            install,
            isEqual: sameOwed,
          },
          day: {
            read: (input) => Effect.runPromise(Effect.map(reading, (at) => views.page(at, input))),
            install,
            isEqual: samePageReading,
          },
          agenda: {
            read: (input) => Effect.runPromise(Effect.map(reading, (at) => views.page(at, input))),
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
