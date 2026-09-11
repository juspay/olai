/** The devices are owned once per alerts activation. Gates live here so every
 * trigger obeys the same switches; withdrawal clears the icon before release. */
import { createEffect, onCleanup } from "solid-js"
import type { Channel, Notice } from "./contract.ts"

type Choices = Pick<Channel, "alertsOn" | "alertSoundOn">
type Devices = Pick<Channel, "notify" | "chime" | "wear">

/** Called inside the provider's root; injected devices let the gate be tested
 * without a desktop. Nothing is queued for a later gesture or preference. */
export const gateDevices = (choices: Choices, devices: Devices): Devices => {
  let active = true
  createEffect(() => { if (!choices.alertsOn()) devices.wear(0) })
  onCleanup(() => { active = false; devices.wear(0) })
  return {
    notify: async (notice: Notice) => { if (active && choices.alertsOn()) await devices.notify(notice) },
    chime: () => { if (active && choices.alertsOn() && choices.alertSoundOn()) devices.chime() },
    wear: count => { if (active) devices.wear(choices.alertsOn() ? count : 0) },
  }
}
