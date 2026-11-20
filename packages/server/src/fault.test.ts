import { expect, test } from "bun:test"
import { Cause, Effect, Option } from "effect"

import { type FaultWatch, type SurfaceFaulted, watchFault } from "./fault.ts"

const runtime = () => {
  let closed = 0
  const { promise: done, resolve: settle, reject: fault } = Promise.withResolvers<void>()
  const close = async (): Promise<void> => {
    closed += 1
  }
  return { watch: Effect.runPromise(watchFault({ done, close })), fault, settle, closed: () => closed }
}

const within = (watch: FaultWatch): Promise<Option.Option<SurfaceFaulted>> =>
  Effect.runPromise(Effect.timeoutOption(Effect.flip(watch.faulted), SETTLE_MS))

const SETTLE_MS = "50 millis"

test("a faulted runtime is a typed failure, rendered — not an exit code", async () => {
  const { fault, watch } = runtime()
  const watching = await watch

  fault(Cause.fail(new Error("the errors cell lost its source")))

  const said = Option.getOrElse(await within(watching), () => undefined)?.message
  expect(said).toContain("surface runtime faulted")
  expect(said).toContain("the errors cell lost its source")
  expect(said).not.toContain("[object Object]")
})

test("closing the watch closes the runtime it watches", async () => {
  const { watch, closed } = runtime()
  const watching = await watch

  await Effect.runPromise(watching.close)

  expect(closed()).toBe(1)
})

test("a runtime settling during shutdown is not news", async () => {
  const { fault, watch } = runtime()
  const watching = await watch

  await Effect.runPromise(watching.close)
  fault(Cause.fail(new Error("closed on the way out")))

  expect(Option.isNone(await within(watching))).toBe(true)
})

test("a runtime that closed cleanly while still serving is a fault", async () => {
  const { settle, watch } = runtime()
  const watching = await watch

  settle()

  const said = Option.getOrElse(await within(watching), () => undefined)?.message
  expect(said).toContain("surface runtime faulted")
  expect(said).toContain("closed while still serving")
})

test("a runtime that closed cleanly during shutdown is not news", async () => {
  const { settle, watch } = runtime()
  const watching = await watch

  await Effect.runPromise(watching.close)
  settle()

  expect(Option.isNone(await within(watching))).toBe(true)
})
