import { expect, test } from "bun:test"
import { Effect } from "effect"
import { volatile } from "./memory.ts"

test("the conversation cache ends with its activation", async () => {
  const first = volatile()
  await Effect.runPromise(first.remember({ agent: "alpha", session: "one", model: "fast" }))
  expect(await Effect.runPromise(first.recall)).toEqual({ agent: "alpha", session: "one", model: "fast" })
  expect(await Effect.runPromise(volatile().recall)).toBeNull()
})
