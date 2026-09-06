/** Fresh browser preferences per chat activation. The provider has no shell or
 * preferences dependency; its UI integration can wait without stopping alerts.
 * Withdrawals detach storage listeners and invalidate retained setters. */
import { createSignal } from "solid-js"
import { Effect } from "effect"
import { serviceTag } from "@olai/plugin-api/contracts"
import { boolCodec, createPreference } from "@olai/web/client/preference.ts"
import { ALERTS_KEY, ALERT_SOUND_KEY } from "@olai/web/client/settings/alerts.ts"

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
    if (!active) throw new Error("The chat alert provider is no longer active")
    preference.set(value)
  }
  return { tabWaiting, setTabWaiting: (value: boolean) => { if (active) setTabWaiting(value) }, alertsOn: alerts.value, alertSoundOn: sound.value,
    setAlertsOn: (value: boolean) => set(alerts, value),
    setAlertSoundOn: (value: boolean) => set(sound, value) }
})
type Alerts = Effect.Success<typeof createAlerts>
export const alertSettings = serviceTag<Alerts>("chat.alerts")
let current: Alerts | undefined
export const holdAlerts = (state: Alerts) => Effect.acquireRelease(
  Effect.sync(() => { current = state }),
  () => Effect.sync(() => { if (current === state) current = undefined }),
)
export const useAlerts = (): Alerts => {
  if (current === undefined) throw new Error("Chat alert settings are unavailable")
  return current
}
export const alertsOn = () => useAlerts().alertsOn()
export const alertSoundOn = () => useAlerts().alertSoundOn()
export const setAlertsOn = (value: boolean) => useAlerts().setAlertsOn(value)
export const setAlertSoundOn = (value: boolean) => useAlerts().setAlertSoundOn(value)
