import { expect, test } from "bun:test"
import { Effect, Result } from "effect"

import { BusyFailure, isOpFailure } from "@olai/format"
import { runAsync } from "./run.ts"

test("a call that fails with a declared refusal hands the refusal back", async () => {
  const refusal = new BusyFailure({ reason: "the server said no" })
  const outcome = await runAsync(Effect.fail(refusal))
  expect(Result.isFailure(outcome)).toBe(true)
  if (Result.isFailure(outcome)) expect(outcome.failure).toBe(refusal)
})

test("a call that succeeds hands its value back", async () => {
  const outcome = await runAsync(Effect.succeed(7))
  expect(Result.isSuccess(outcome)).toBe(true)
  if (Result.isSuccess(outcome)) expect(outcome.success).toBe(7)
})

test("a call whose fiber was interrupted comes back as busy, and does not reject", async () => {
  const outcome = await runAsync(Effect.interrupt)
  expect(Result.isFailure(outcome)).toBe(true)
  if (!Result.isFailure(outcome)) return
  expect(isOpFailure(outcome.failure)).toBe(true)
  expect(outcome.failure._tag).toBe("BusyFailure")
  expect(String(outcome.failure.reason)).not.toContain("fibers")
})

test("a call that dies still rejects, with the defect itself", async () => {
  const defect = new Error("a bug, not a refusal")
  await expect(runAsync(Effect.die(defect))).rejects.toBe(defect)
})

test("a call whose sibling was dropped comes back as busy, in either shape", async () => {
  const shapes = [
    Object.assign(new Error(`surface: "surface/chat/conversation/sessions" is no longer served`), {
      _tag: "SurfaceSiblingDropped",
      name: "SurfaceSiblingDropped",
    }),
    { _tag: "SurfaceSiblingDropped", key: "chat" },
  ]
  for (const shape of shapes) {
    const outcome = await runAsync(Effect.die(shape))
    expect(Result.isFailure(outcome)).toBe(true)
    if (!Result.isFailure(outcome)) return
    expect(isOpFailure(outcome.failure)).toBe(true)
    expect(outcome.failure._tag).toBe("BusyFailure")
    expect(String(outcome.failure.reason)).toContain("plugin")
    expect(String(outcome.failure.reason)).not.toContain("SurfaceSiblingDropped")
  }
})

test("a defect that only mentions a dropped sibling is still loud", async () => {
  const impostor = new Error(
    `surface: "surface/chat/conversation/sessions" is no longer served — ` +
      `the sibling "chat" was dropped from this rooted bundle`,
  )
  await expect(runAsync(Effect.die(impostor))).rejects.toBe(impostor)
})
