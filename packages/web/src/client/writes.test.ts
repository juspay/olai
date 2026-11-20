import { expect, test } from "bun:test"
import { Effect, Result } from "effect"
import { NotFoundFailure } from "@olai/format"
import type { EditWriters } from "@olai/plugin-api"

import { heldWrites, writingWith } from "./writes.ts"

const table = (said: string): EditWriters => ({
  register: () => Effect.void as never,
  write: () => Effect.fail(new NotFoundFailure({ reason: said })),
})

const sent = (writes: ReturnType<typeof heldWrites>) =>
  Effect.runPromise(Effect.result(writes.writeEdit({ verb: "title", id: "a", title: "b" } as never)))

test("two rows get two holders, and one row's table is not another's", async () => {
  const mine = heldWrites()
  const theirs = heldWrites()
  const stop = mine.holdEdits(table("mine"))
  const answer = await sent(mine)
  expect(Result.isFailure(answer) && (answer.failure as NotFoundFailure).message).toBe("mine")
  const other = await sent(theirs)
  expect(Result.isFailure(other) && (other.failure as NotFoundFailure).message)
    .toBe("the capability for title is not active")
  stop()
  const after = await sent(mine)
  expect(Result.isFailure(after) && (after.failure as NotFoundFailure).message)
    .toBe("the capability for title is not active")
})

test("a replacement is not cleared by the activation it replaced", async () => {
  const held = heldWrites()
  const first = held.holdEdits(table("first"))
  const second = held.holdEdits(table("second"))
  first()
  const answer = await sent(held)
  expect(Result.isFailure(answer) && (answer.failure as NotFoundFailure).message).toBe("second")
  second()
})

test("a pointer's write reserves its undo entry before the reply arrives", async () => {
  const reply = Promise.withResolvers<void>()
  const inverse = [{ verb: "title", id: "a", title: "old" }]
  const { applied } = writingWith(() =>
    Effect.promise(() => reply.promise).pipe(Effect.as({ undo: inverse } as never)))
  const recorded: Array<unknown> = []
  const done = applied({ verb: "title", id: "a", title: "b" } as never, (step) => void recorded.push(step))
  expect(recorded).toHaveLength(1)
  expect(recorded[0]).toBeInstanceOf(Promise)
  reply.resolve()
  await done
  expect(await recorded[0]).toBe(inverse)
})
