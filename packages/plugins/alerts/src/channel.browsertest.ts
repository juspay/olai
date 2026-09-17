import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { gateDevices } from "./channel.ts"
import type { Notice } from "./contract.ts"
const notice: Notice = { tag: "test", title: "olai", body: "question", data: { kind: "ask" } }

test("the channel gates devices, clears on Alerts off, and invalidates released devices", async () => {
  const calls: Array<string | number> = []
  const state = createRoot(dispose => {
    const [alertsOn, alerts] = createSignal(true)
    const [alertSoundOn, sound] = createSignal(true)
    const devices = gateDevices({ alertsOn, alertSoundOn }, {
      notify: async () => { calls.push("notify") }, chime: () => { calls.push("chime") }, wear: count => { calls.push(count) },
    })
    return { dispose, alerts, sound, ...devices }
  })
  state.wear(3)
  state.alerts(false)
  expect(calls).toEqual([3, 0])
  await state.notify(notice); state.chime(); state.wear(9)
  expect(calls).toEqual([3, 0, 0])
  state.alerts(true); state.sound(false)
  await state.notify(notice); state.chime()
  expect(calls).toEqual([3, 0, 0, "notify"])
  state.sound(true); state.chime()
  expect(calls.at(-1)).toBe("chime")
  state.dispose()
  expect(calls.at(-1)).toBe(0)
  const end = calls.length
  state.wear(4); state.chime(); await state.notify(notice)
  expect(calls.length).toBe(end)
})
