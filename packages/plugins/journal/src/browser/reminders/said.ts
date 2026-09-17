/** Browser choices and the daily record belong to the reminders activation.
 * Followers leave with it; the stored day survives withdrawal and reconnection. */
import { Effect } from "effect"
import { isDay } from "@olai/format"
import { boolCodec, createPreference, type PreferenceCodec } from "@olai/web/client/preference.ts"

const dayCodec: PreferenceCodec<string | null> = {
  parse: raw => raw !== null && isDay(raw) ? raw : null,
  print: day => day,
}

export const createRemindersState = Effect.gen(function*() {
  const on = createPreference("olai.reminders", boolCodec(true))
  const said = createPreference("olai.reminders.said", dayCodec)
  let active = true
  yield* Effect.addFinalizer(() => Effect.sync(() => { active = false }))
  yield* Effect.acquireRelease(Effect.sync(on.follow), stop => Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(said.follow), stop => Effect.sync(stop))
  const change = <T,>(set: (value: T) => void, value: T) => {
    if (!active) throw new Error("The reminders owner is no longer active")
    set(value)
  }
  return {
    on: on.value, setOn: (value: boolean) => change(on.set, value),
    said: said.value, say: (day: string) => change(said.set, day),
  }
})
export type RemindersState = Effect.Success<typeof createRemindersState>
