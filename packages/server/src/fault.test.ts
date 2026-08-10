/**
 * The path that used to call `process.exit(1)`, and could therefore not be
 * tested at all: a test process that exits does not fail, it disappears.
 *
 * Three outcomes, and the difference between them is the whole of this module.
 * A runtime that FAULTED is news and stops the server. A runtime that settled
 * because we are shutting down is not — that is every ordinary Ctrl+C, and the
 * shutdown a failed `listen` starts, which is how a busy port once managed to
 * report `[object Object]` instead of "address already in use".
 */

import { expect, test } from "bun:test"
import { Cause, Effect, Option } from "effect"

import { type FaultWatch, type SurfaceFaulted, watchFault } from "./fault.ts"

/** A surface runtime whose `done` this test settles by hand. */
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

/** What `faulted` did within the deadline — the failure, or `None` for the two
 *  of the three cases where it is meant to never settle at all. "Never" is a
 *  thing a bare `await` cannot assert: it hangs the runner instead of failing
 *  it, and the runner then reports only that something took too long. */
const within = (watch: FaultWatch): Promise<Option.Option<SurfaceFaulted>> =>
  Effect.runPromise(Effect.timeoutOption(Effect.flip(watch.faulted), SETTLE_MS))

/** Long enough that a fault that IS coming has arrived — it is one already-
 *  settled promise away — and short enough that three of these are free. */
const SETTLE_MS = "50 millis"

test("a faulted runtime is a typed failure, rendered — not an exit code", async () => {
  const { fault, watch } = runtime()
  const watching = await watch

  fault(Cause.fail(new Error("the errors cell lost its source")))

  const said = Option.getOrElse(await within(watching), () => undefined)?.message
  expect(said).toContain("surface runtime faulted")
  // The reason this is a failure a caller can render rather than a line a
  // handler printed: it says what happened.
  expect(said).toContain("the errors cell lost its source")
  expect(said).not.toContain("[object Object]")
})

// The regression. `stopped` is registered by `serve` in the order that makes it
// true BEFORE anything starts closing, and this is what it buys: the runtime
// settling on the way out says nothing, so whatever started the shutdown is
// still the failure that gets reported.
test("a runtime settling during shutdown is not news", async () => {
  const { fault, watch } = runtime()
  const watching = await watch

  await Effect.runPromise(watching.stopped)
  fault(Cause.fail(new Error("closed on the way out")))

  expect(Option.isNone(await within(watching))).toBe(true)
})

test("a runtime that closed cleanly is not a fault either", async () => {
  const { close, watch } = runtime()
  const watching = await watch

  close()

  expect(Option.isNone(await within(watching))).toBe(true)
})
