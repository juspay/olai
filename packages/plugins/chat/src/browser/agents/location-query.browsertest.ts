import { expect, test } from "bun:test"
import { Result } from "effect"
import { createRoot, createSignal } from "solid-js"
import { createLocationQuery, recentLocationIds, type LocationAnswer } from "./location-query.ts"

test("location replies clear a previous refusal and ignore replies after replacement or disposal", async () => {
  const replies: ((value: Result.Result<LocationAnswer, { message: string }>) => void)[] = []
  const owner = createRoot(stop => {
    const [filter, setFilter] = createSignal("")
    const query = createLocationQuery(filter, () => new Promise(resolve => replies.push(resolve)))
    return { ...query, setFilter, stop }
  })
  replies[0]!(Result.fail({ message: "temporarily unavailable" }))
  await Promise.resolve()
  expect(owner.failure()).toBe("temporarily unavailable")
  owner.setFilter("kitchen")
  replies[1]!(Result.succeed({ nodes: [], defaultParent: "chats" }))
  await Promise.resolve()
  expect(owner.failure()).toBeUndefined()
  expect(owner.ready()).toBe(true)
  owner.setFilter("old")
  owner.setFilter("new")
  replies[2]!(Result.fail({ message: "obsolete" }))
  await Promise.resolve()
  expect(owner.failure()).toBeUndefined()
  owner.stop()
  replies[3]!(Result.fail({ message: "disposed" }))
  await Promise.resolve()
  expect(owner.failure()).toBeUndefined()
})

test("stable recent ids do not requery on unrelated activity ticks", async () => {
  let calls = 0
  const row = (id: string, changed: string) => ({ id, changed, file: "a.olai", title: id, engine: "one", session: id,
    memory: 0, waiting: 0, standing: "asleep" as const, said: null })
  const owner = createRoot(stop => {
    const [rows, setRows] = createSignal([row("one", "2026-01-01")])
    const recent = recentLocationIds(rows)
    createLocationQuery(recent, async () => { calls++; return Result.succeed({ nodes: [], defaultParent: null }) })
    return { stop, setRows }
  })
  await Promise.resolve()
  expect(calls).toBe(1)
  owner.setRows([row("one", "2026-01-02")])
  await Promise.resolve()
  expect(calls).toBe(1)
  owner.setRows([row("two", "2026-01-03"), row("one", "2026-01-02")])
  await Promise.resolve()
  expect(calls).toBe(2)
  owner.stop()
})
