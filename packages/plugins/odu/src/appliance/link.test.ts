import { Effect, Fiber } from "effect"
import { expect, test } from "bun:test"

import { runLink, speaksCompatible } from "./link.ts"

test("the same major is speakable when the service is at least as new", () => {
  expect(speaksCompatible("1.3", "1.3")).toBe(true)
  expect(speaksCompatible("1.3", "1.4")).toBe(true)
  expect(speaksCompatible("1.3", "1.0")).toBe(false)
})

test("a different major is skew", () => {
  expect(speaksCompatible("1.3", "2.0")).toBe(false)
  expect(speaksCompatible("1.3", "")).toBe(false)
})

test("an interrupted dial does not wait out the ready deadline", async () => {
  const started = Date.now()
  const fiber = Effect.runFork(
    runLink(
      { link: () => {}, face: () => {}, say: () => {}, warn: () => {} },
      { ODU_WEB_ORIGIN: "http://127.0.0.1:1" },
      () => "2026-09-12T00:00:00.000Z",
    ),
  )
  await Bun.sleep(30)
  await Effect.runPromise(Fiber.interrupt(fiber))
  expect(Date.now() - started).toBeLessThan(1000)
})
