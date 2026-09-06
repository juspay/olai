import { expect, test } from "bun:test"
import { Result } from "effect"
import type { App } from "@olai/surface"
import { calledApp, createName, followName } from "./named.ts"

const app = (hostname: string): App => ({ hostname, startedAt: "2026-09-05T00:00:00Z" })
const readout = () => ({ status: "live" as const, needsReload: false })
test("departed deployment cannot publish a late reply; reactivation starts fresh", async () => {
  let land!: (value: Result.Result<App, unknown>) => void
  const late = new Promise<Result.Result<App, unknown>>(resolve => { land = resolve })
  const seen: string[] = []
  const first = createName({ readout, ask: () => late, named: value => seen.push(value) })
  first.dispose()
  land(Result.succeed(app("old")))
  await Promise.resolve()
  expect(first.called()).toBeUndefined()
  expect(seen).toEqual([])
  const stop = followName({ readout, ask: async () => Result.succeed(app("new")) })
  await Promise.resolve()
  expect(calledApp()).toBe("olai [new]")
  stop()
  expect(calledApp()).toBeUndefined()
  let asks = 0
  const last = followName({ readout, ask: async () => { asks++; return Result.succeed(app("third")) } })
  await Promise.resolve()
  expect(asks).toBe(1)
  expect(calledApp()).toBe("olai [third]")
  last()
})
