import { expect, test } from "bun:test"
import { Cause, Effect, Option } from "effect"

import { type FaultWatch, type SurfaceFaulted, watchFault } from "./fault.ts"

const runtime = (): {
  readonly watch: Promise<FaultWatch>
  readonly fault: (cause: unknown) => void
  readonly close: () => void
} => {
  let fault: (cause: unknown) => void = () => {}
  let close: () => void = () => {}
  const done = new Promise<void>((resolve, reject) => {
    fault = reject
    close = resolve
  })
  return { watch: Effect.runPromise(watchFault({ done })), fault, close }
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

test("a runtime settling during shutdown is not news", async () => {
  const { fault, watch } = runtime()
  const watching = await watch

  await Effect.runPromise(watching.stopped)
  fault(Cause.fail(new Error("closed on the way out")))

  expect(Option.isNone(await within(watching))).toBe(true)
})

test("a runtime that closed cleanly while still serving is a fault", async () => {
  const { close, watch } = runtime()
  const watching = await watch

  close()

  const said = Option.getOrElse(await within(watching), () => undefined)?.message
  expect(said).toContain("surface runtime faulted")
  expect(said).toContain("closed while still serving")
})

test("a runtime that closed cleanly during shutdown is not news", async () => {
  const { close, watch } = runtime()
  const watching = await watch

  await Effect.runPromise(watching.stopped)
  close()

  expect(Option.isNone(await within(watching))).toBe(true)
})
