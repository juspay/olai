import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import type { Owed } from "@olai/format"
import type { Channel } from "olai-plugin-alerts/contract"
import { createReminders } from "./circuit.ts"
import { agendaRoute } from "../routes.ts"

const stage = (boot?: Owed) => createRoot(dispose => {
  const [day, setDay] = createSignal("2026-09-11")
  const [owed, setOwed] = createSignal<Owed | undefined>(boot)
  const [said, setSaid] = createSignal<string | null>(null)
  const [on, setOn] = createSignal(true)
  const [alertsOn, setAlerts] = createSignal(true)
  const [called, setCalled] = createSignal("olai [box]")
  const calls: string[] = []
  let press: (() => void) | undefined
  let released = 0
  const channel: Pick<Channel, "alertsOn" | "notify" | "chime" | "onPress"> = {
    alertsOn,
    notify: async notice => { expect(said()).toBe(day()); calls.push(`notify:${notice.body}`) },
    chime: () => { calls.push("chime") }, // No oscillator: skipped sounds still spend the day.
    onPress: (kind, action) => {
      expect(String(kind)).toBe("due")
      press = () => action({ kind } as Parameters<typeof action>[0])
      return () => { released++; press = undefined }
    },
  }
  createReminders({ today: day, owed, channel, called,
    state: { on, setOn, said, say: day => { calls.push(`said:${day}`); setSaid(day) } },
    go: route => { expect(route).toBe(agendaRoute); calls.push("agenda") },
  })
  return { dispose, calls, day: setDay, owed: setOwed, said, on: setOn, alerts: setAlerts, called: setCalled, press: () => press?.(), released: () => released }
})

test("the claim precedes notification and chime; frames, reconnects and naming never replay a skipped chime", () => {
  const s = stage({ overdue: 2, today: 3 })
  expect(s.calls).toEqual(["said:2026-09-11", "notify:Agenda: 2 overdue, 3 on today", "chime"])
  s.owed({ overdue: 2, today: 4 }); s.owed(undefined); s.owed({ overdue: 2, today: 4 }); s.called("olai [other]")
  expect(s.calls).toHaveLength(3)
  s.press(); expect(s.calls.at(-1)).toBe("agenda")
  s.dispose(); s.press(); s.owed({ overdue: 9, today: 9 })
  expect(s.calls).toHaveLength(4); expect(s.released()).toBe(1)
})

test("a day switched off is not spent; the first later frame and the next day can each announce", () => {
  const s = stage()
  s.on(false); s.owed({ overdue: 0, today: 1 })
  expect(s.calls).toEqual([]); expect(s.said()).toBeNull()
  s.alerts(false); s.on(true)
  expect(s.calls).toEqual([])
  s.alerts(true)
  expect(s.calls).toHaveLength(3)
  s.owed(undefined); s.day("2026-09-12")
  expect(s.calls).toHaveLength(3)
  s.owed({ overdue: 1, today: 0 })
  expect(s.calls.slice(3)).toEqual(["said:2026-09-12", "notify:Agenda: 1 overdue", "chime"])
  s.dispose()
})

test("no clock, no frame and an empty agenda say nothing", () => {
  const s = stage()
  s.day(""); s.owed({ overdue: 1, today: 0 }); expect(s.calls).toEqual([])
  s.owed({ overdue: 0, today: 0 }); s.day("2026-09-12"); expect(s.calls).toEqual([])
  s.owed({ overdue: 0, today: 1 }); expect(s.calls).toHaveLength(3)
  s.dispose()
})

import { createReactiveSubscription } from "@kolu/surface/solid"
import { Effect, Exit, Scope, Stream } from "effect"
import { holdJournalWire, type JournalClient } from "../wire.ts"
import { createOwed } from "../dates.ts"

test("the real owed adapter clears yesterday's frame before the reminder reads a new day", async () => {
  const scope = Scope.makeUnsafe()
  const requested: string[] = []
  const use = (input: () => { today: string } | null) => createReactiveSubscription(input, request => {
    requested.push(request.today)
    return Stream.make({ overdue: request.today === "2026-09-11" ? 1 : 0, today: 0 })
  })
  await Effect.runPromise(Scope.provide(holdJournalWire(() => ({ streams: { owed: { use } } }) as unknown as JournalClient), scope))
  const s = createRoot(dispose => {
    const [day, setDay] = createSignal("")
    const [said, say] = createSignal<string | null>(null)
    const calls: string[] = []
    createReminders({ today: day, owed: createOwed(() => day() || undefined),
      state: { on: () => true, setOn: () => {}, said, say }, called: () => undefined, go: () => {},
      channel: { alertsOn: () => true, notify: async () => { calls.push(day()) }, chime: () => {}, onPress: () => () => {} },
    })
    return { dispose, day: setDay, said, calls }
  })
  try {
    await Bun.sleep(0)
    expect(requested).toEqual([])
    s.day("2026-09-11"); await Bun.sleep(0)
    expect(s.calls).toEqual(["2026-09-11"])
    s.day("2026-09-12")
    expect(s.said()).toBe("2026-09-11")
    await Bun.sleep(0)
    expect(requested).toEqual(["2026-09-11", "2026-09-12"])
    expect(s.calls).toEqual(["2026-09-11"])
  } finally {
    s.dispose()
    await Effect.runPromise(Scope.close(scope, Exit.void))
  }
})
