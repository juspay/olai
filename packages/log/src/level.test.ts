import { expect, test } from "bun:test"
import { Effect } from "effect"
import { collector } from "./lines.testlib.ts"
import { emitter } from "./emit.ts"
import { liveLevel } from "./level.ts"

test("a live level filters existing callback emitters without restarting them", async () => {
  const { layer, said } = collector()
  await Effect.gen(function*() {
    const level = yield* liveLevel
    yield* Effect.gen(function*() {
      const say = yield* emitter
      yield* Effect.logDebug("hidden before")
      level.set("debug")
      say(Effect.logDebug("visible callback"))
      yield* Effect.yieldNow
      level.set("error")
      yield* Effect.logInfo("hidden after")
      yield* Effect.logError("visible error")
    }).pipe(Effect.provide(level.layer))
  }).pipe(Effect.provide(layer), Effect.runPromise)
  const text = JSON.stringify(said)
  expect(text).toContain("visible callback")
  expect(text).toContain("visible error")
  expect(text).not.toContain("hidden before")
  expect(text).not.toContain("hidden after")
})


import { TestConsole } from "effect/testing"
import { toStderr } from "./sinks.ts"
test("the same sink follows live presentation edits", async () => {
  const lines = await Effect.gen(function*() {
    const level = yield* liveLevel
    yield* Effect.gen(function*() {
      level.setFormat("logfmt")
      yield* Effect.logInfo("before format edit")
      level.setFormat("pretty")
      yield* Effect.logInfo("after format edit")
    }).pipe(Effect.provide(level.layer))
    return yield* TestConsole.errorLines
  }).pipe(Effect.provide(toStderr), Effect.provide(TestConsole.layer), Effect.runPromise)
  expect(String(lines[0])).toContain("level=INFO")
  expect(String(lines[1])).not.toContain("level=INFO")
  expect(String(lines[1])).toContain("after format edit")
})
