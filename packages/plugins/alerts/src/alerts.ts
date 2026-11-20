import { createSignal } from "solid-js"
import { Effect } from "effect"
import { boolCodec, createPreference } from "@olai/web/client/preference.ts"
import { ALERTS_KEY, ALERT_SOUND_KEY } from "./keys.ts"

export const createAlerts = Effect.gen(function*() {
  const alerts = createPreference(ALERTS_KEY, boolCodec(true))
  const sound = createPreference(ALERT_SOUND_KEY, boolCodec(true))
  const [tabWaiting, setTabWaiting] = createSignal(false)
  let active = true
  yield* Effect.addFinalizer(() => Effect.sync(() => { active = false }))
  for (const preference of [alerts, sound]) {
    yield* Effect.acquireRelease(Effect.sync(preference.follow), (stop) => Effect.sync(stop))
  }
  const set = (preference: typeof alerts, value: boolean) => {
    if (!active) throw new Error("The alert provider is no longer active")
    preference.set(value)
  }
  return { tabWaiting, setTabWaiting: (value: boolean) => { if (active) setTabWaiting(value) }, alertsOn: alerts.value, alertSoundOn: sound.value,
    setAlertsOn: (value: boolean) => set(alerts, value),
    setAlertSoundOn: (value: boolean) => set(sound, value) }
})
