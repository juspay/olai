/**
 * A HOLDER PER ROW — the one thing `heldWrites` may not trade away.
 *
 * It is a factory because six rows bound the app's edit table with the same
 * ten lines and only differed in which activation held it. Sharing that
 * ALGORITHM is the point; sharing the STATE would put back the fault this
 * phase removed — one table reached by every package with nothing declared —
 * so the rule is pinned here rather than argued in a header.
 *
 * The absent arm is pinned beside it, because it is the other thing six copies
 * used to restate: a row that is holding nothing refuses in the words a verb
 * whose provider left already got, rather than throwing inside a click.
 */
import { expect, test } from "bun:test"
import { Effect, Result } from "effect"
import { NotFoundFailure } from "@olai/format"
import type { EditWriters } from "@olai/plugin-api"

import { heldWrites } from "./writes.ts"

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
  // The other row is holding nothing, whatever this one holds — and says so in
  // the words a verb with no provider has always been refused in.
  const other = await sent(theirs)
  expect(Result.isFailure(other) && (other.failure as NotFoundFailure).message)
    .toBe("the capability for title is not active")
  stop()
  // ...and the release takes back what it installed, leaving that same answer.
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
