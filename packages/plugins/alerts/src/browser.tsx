import { definePlugin, Offers } from "@olai/plugin-api"
import { Effect } from "effect"
import { createEffect, createRoot } from "solid-js"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { sections } from "olai-plugin-preferences/contract"
import { appearance } from "olai-plugin-theme/contract"
import { name } from "./index.ts"
import { alertsChannel, type Channel } from "./contract.ts"
import { createAlerts } from "./alerts.ts"
import { followNotifications, readNotifications } from "./notify.ts"
import { createChime } from "./chime.ts"
import { createBadge } from "./badge.ts"
import { gateDevices } from "./channel.ts"
import { AlertRows } from "./AlertRows.tsx"

export { name } from "./index.ts"
export default definePlugin({ name, needs: [], apply: Effect.void })

/** Offer withdrawal drains consumers while the devices still exist. Each
 * acquisition has its release; preferences UI and theme are optional consumers. */
export const components = {
  channel: definePlugin({ name: "channel", needs: [Offers], apply: Effect.gen(function*() {
    yield* Effect.acquireRelease(Effect.sync(followNotifications), stop => Effect.sync(stop))
    const seam = readNotifications()
    const choices = yield* createAlerts
    const sound = yield* Effect.acquireRelease(Effect.sync(() => createChime()), sound => Effect.sync(sound.dispose))
    const owned = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      const devices = gateDevices(choices, { notify: seam.notify, chime: sound.chime, wear: createBadge(choices.setTabWaiting) })
      const channel: Channel = { ...choices, ...devices, consent: seam.consent, ask: seam.ask, onPress: seam.onPress }
      return { dispose, channel }
    })), owned => Effect.sync(owned.dispose))
    yield* (yield* Offers).own("channel", () => owned.channel)
  }) }),
  controls: definePlugin({ name: "controls", needs: [alertsChannel, rendererSlots], apply: Effect.gen(function*() {
    const channel = yield* alertsChannel
    yield* (yield* rendererSlots).contribute(sections, () => <AlertRows channel={channel} />)
  }) }),
  "tab-attention": definePlugin({ name: "tab-attention", needs: [alertsChannel, appearance], apply: Effect.gen(function*() {
    const channel = yield* alertsChannel
    const view = yield* appearance
    yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      createEffect(() => view.chrome.waiting(channel.tabWaiting()))
      return dispose
    })), dispose => Effect.sync(() => { view.chrome.waiting(false); dispose() }))
  }) }),
}
