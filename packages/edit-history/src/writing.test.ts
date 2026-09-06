import { expect, test } from "bun:test"
import { Effect, Result } from "effect"
import { NotFoundFailure } from "@olai/format"
import { registerWriter, writeEdit, type EditWriter } from "./writing.ts"
const id = "writer-test"
const fail: EditWriter = () => Effect.fail(new NotFoundFailure({ reason: "owned refusal" }))
test("an absent owner produces a typed refusal and can activate freshly", async () => {
  const edit = { verb: "title" as const, id, title: "new" }
  expect(Result.isFailure(await Effect.runPromise(Effect.result(writeEdit(edit))))).toBe(true)
  let calls = 0
  const stop = registerWriter(["title"], () => { calls++; return fail(edit) })
  await Effect.runPromise(Effect.result(writeEdit(edit)))
  expect(calls).toBe(1)
  stop()
  await Effect.runPromise(Effect.result(writeEdit(edit)))
  expect(calls).toBe(1)
  const fresh = registerWriter(["title"], fail)
  stop() // A repeated stale disposer cannot remove the fresh owner.
  const result = await Effect.runPromise(Effect.result(writeEdit(edit)))
  expect(Result.isFailure(result) && result.failure.message).toBe("owned refusal")
  fresh()
})
test("duplicate discriminator ownership is refused without partial registration", () => {
  const stop = registerWriter(["title"], fail)
  try {
    expect(() => registerWriter(["date", "title"], fail)).toThrow("already registered: title")
    const date = registerWriter(["date"], fail)
    date()
  } finally { stop() }
})
