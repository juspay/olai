import { Effect, Schema, Semaphore } from "effect"
import type { Himalaya } from "./himalaya/run.ts"
import { GMAIL } from "./himalaya/verbs.ts"
import { LabelList } from "./himalaya/threads.ts"
import { MailRefusal } from "./wire.ts"

/** One cache per activation. The permit also coalesces concurrent cold reads. */
export const makeLabels = (run: Himalaya["run"]) => {
  const permit = Semaphore.makeUnsafe(1)
  let labels: typeof LabelList.Type["labels"] | undefined
  const refresh = Effect.gen(function*() {
    const raw = yield* run({ verb: GMAIL.labelsList })
    const decoded = yield* Schema.decodeUnknownEffect(LabelList)(raw).pipe(Effect.mapError(() => new MailRefusal({ reason: "Himalaya answered an invalid label list" })))
    labels = decoded.labels
  })
  const load = permit.withPermits(1)(Effect.suspend(() => labels ? Effect.void : refresh))
  const resolve = (names: ReadonlyArray<string>) => permit.withPermits(1)(Effect.gen(function*() {
    if (!labels) yield* refresh
    const find = (name: string) => labels?.find(l => l.name.toLowerCase() === name.toLowerCase())
    if (names.some(n => !find(n))) yield* refresh
    const missing = names.find(n => !find(n))
    if (missing !== undefined) return yield* Effect.fail(new MailRefusal({ reason: `this mailbox has no label ${JSON.stringify(missing)}; it has: ${labels?.map(l => l.name).join(", ")}` }))
    return names.map(n => find(n)!.id)
  }))
  const ensureIds = (ids: ReadonlyArray<string>) => permit.withPermits(1)(Effect.gen(function*() {
    if (!labels) yield* refresh
    const missing = () => ids.find(id => !labels?.some(label => label.id === id))
    if (missing() !== undefined) yield* refresh
    if (missing() !== undefined) return yield* Effect.fail(new MailRefusal({ reason: `this mailbox has no name for label id ${missing()}` }))
  }))
  return { load, resolve, ensureIds, names: (ids: ReadonlyArray<string>): string[] => ids.map(id => labels?.find(l => l.id === id)?.name ?? id), clear: () => { labels = undefined } }
}
