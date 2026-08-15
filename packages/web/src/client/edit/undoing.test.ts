/**
 * The stack under CONCURRENCY — the half `undo.test.ts` cannot state.
 *
 * That file is pure and sequential: it says what the four functions do to a
 * value. What it cannot say is what happens in the middle of a replay, which
 * is the only interesting moment this module has — an entry is off the stack,
 * a write is in flight, and the reader is still typing. So the write is a
 * function here (`Apply`, handed to {@link createUndo}), and a test holds one
 * open and watches what lands while it waits.
 *
 * The one this exists for: a new op that lands mid-replay has already cleared
 * the redo side, and the replay must not put an entry back on it. That is the
 * branch rule — once a different edit is on top, what "put it back" used to
 * mean is a place the outline never went — and it was broken until every
 * mutation of the stack went through the same queue.
 */

import type { Applied, Edit } from "@olai/surface"
import { expect, test } from "bun:test"
import { Result } from "effect"
import { createRoot } from "solid-js"

import { UsageFailure } from "@olai/format"

import { createUndo, type Undo } from "./undoing.ts"

/** An edit distinguishable by the id it names. */
const edit = (id: string): Edit => ({ verb: "remove", id })

/** A write nobody has answered yet, and the two halves a test drives it by. */
interface Pending {
  readonly edit: Edit
  readonly landed: (undo?: ReadonlyArray<Edit>) => void
  readonly refused: (reason: string) => void
}

/** An `Apply` that answers nothing until a test says so. Every call is queued
 *  in `waiting`, which is also how a test knows the replay has reached the
 *  wire at all. */
const held = () => {
  const waiting: Array<Pending> = []
  const apply = (asked: Edit): Promise<Result.Result<Applied, never>> =>
    new Promise((settle) => {
      // Every edit these tests send is a `remove`, which is the one arm that
      // is nothing but an id — the payload does not matter here, only which
      // edit reached the wire and in what order.
      const named = (asked as Extract<Edit, { verb: "remove" }>).id
      waiting.push({
        edit: asked,
        landed: (undo) =>
          settle(
            Result.succeed({
              id: named,
              title: named,
              file: "house.olai",
              ...(undo === undefined ? {} : { undo }),
            }),
          ),
        refused: (reason) =>
          settle(Result.fail(new UsageFailure({ reason })) as never),
      })
    })
  return { waiting, apply: apply as Parameters<typeof createUndo>[0] }
}

/** The stack, in a root that can be torn down the way a component is. */
const running = (
  apply: Parameters<typeof createUndo>[0],
): { readonly undo: Undo; readonly dispose: () => void } =>
  createRoot((dispose) => ({ undo: createUndo(apply), dispose }))

/** Let every queued microtask run — the queue is a promise chain, so "after
 *  the key" means after the turn of the loop it was pressed in. */
const settled = async (): Promise<void> => {
  for (let turn = 0; turn < 8; turn++) await Promise.resolve()
}

test("a new op that lands mid-replay wins the branch, and redo stays empty", async () => {
  const wire = held()
  const { undo, dispose } = running(wire.apply)

  // One structural op on the stack, and ⌘Z spends it.
  undo.record([edit("undo-A")])
  await settled()
  undo.undo()
  await settled()
  expect(wire.waiting.length).toBe(1)

  // The reader carries on typing while that write is still in flight: another
  // structural op lands, which clears what redo would have put back.
  undo.record([edit("undo-B")])
  await settled()

  // And now the undo answers, with an inverse of its own — the entry that used
  // to end up on the redo side.
  wire.waiting[0]?.landed([edit("redo-A")])
  await settled()

  // Redo must be dead: the outline branched away from A the moment B landed.
  undo.redo()
  await settled()
  expect(wire.waiting.length).toBe(1)
  expect(undo.said()).toEqual({ tone: "aside", text: "nothing to redo" })

  // And ⌘Z still reaches B, which is the other half of "the new op won".
  undo.undo()
  await settled()
  expect(wire.waiting[1]?.edit).toEqual(edit("undo-B"))
  dispose()
})

test("a replay that lands with nobody having interrupted it is redoable", async () => {
  // The same shape without the interruption, so the test above is known to be
  // about the race rather than about redo never working at all.
  const wire = held()
  const { undo, dispose } = running(wire.apply)

  undo.record([edit("undo-A")])
  await settled()
  undo.undo()
  await settled()
  wire.waiting[0]?.landed([edit("redo-A")])
  await settled()

  undo.redo()
  await settled()
  expect(wire.waiting[1]?.edit).toEqual(edit("redo-A"))
  dispose()
})

test("a refused replay drops its entry, says why, and leaves the one under it", async () => {
  const wire = held()
  const { undo, dispose } = running(wire.apply)

  undo.record([edit("undo-A")])
  undo.record([edit("undo-B")])
  await settled()

  undo.undo()
  await settled()
  wire.waiting[0]?.refused("`B` has 1 row under it now")
  await settled()
  expect(undo.said()?.tone).toBe("alarm")
  expect(undo.said()?.text).toContain("row under it now")

  // Dropped rather than retried: the next ⌘Z is about the edit BEFORE it.
  undo.undo()
  await settled()
  expect(wire.waiting[1]?.edit).toEqual(edit("undo-A"))
  dispose()
})

test("a new op takes away what the last undo said", async () => {
  const wire = held()
  const { undo, dispose } = running(wire.apply)

  undo.undo()
  await settled()
  expect(undo.said()?.text).toContain("nothing to undo")

  undo.record([edit("undo-A")])
  await settled()
  expect(undo.said()).toBeNull()
  dispose()
})

test("half a replay is still half redoable", async () => {
  // The two-op entry — a mark that displaced another — refused between its two
  // writes. What LANDED answers with its own inverse, so ⌘⇧Z puts back exactly
  // the half that went, and the reason for the other half is on screen.
  const wire = held()
  const { undo, dispose } = running(wire.apply)

  undo.record([edit("undo-A1"), edit("undo-A2")])
  await settled()
  undo.undo()
  await settled()

  wire.waiting[0]?.landed([edit("redo-A1")])
  await settled()
  wire.waiting[1]?.refused("`A` is already done")
  await settled()
  expect(undo.said()?.tone).toBe("alarm")

  undo.redo()
  await settled()
  expect(wire.waiting[2]?.edit).toEqual(edit("redo-A1"))
  dispose()
})
