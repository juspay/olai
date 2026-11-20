import type { Applied, Edit } from "@olai/surface"
import { expect, test } from "bun:test"
import { Result } from "effect"
import { createRoot } from "solid-js"

import { UsageFailure } from "@olai/format"

import { createUndo, type Undo } from "./undoing.ts"

const edit = (id: string): Edit => ({ verb: "remove", id })

interface Pending {
  readonly edit: Edit
  readonly landed: (undo?: ReadonlyArray<Edit>) => void
  readonly refused: (reason: string) => void
}

const held = () => {
  const waiting: Array<Pending> = []
  const apply = (asked: Edit): Promise<Result.Result<Applied, never>> =>
    new Promise((settle) => {
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

const running = (
  apply: Parameters<typeof createUndo>[0],
): { readonly undo: Undo; readonly dispose: () => void } =>
  createRoot((dispose) => ({ undo: createUndo(apply), dispose }))

const settled = async (): Promise<void> => {
  for (let turn = 0; turn < 8; turn++) await Promise.resolve()
}

test("a new op that lands mid-replay wins the branch, and redo stays empty", async () => {
  const wire = held()
  const { undo, dispose } = running(wire.apply)

  undo.record([edit("undo-A")])
  await settled()
  undo.undo()
  await settled()
  expect(wire.waiting.length).toBe(1)

  undo.record([edit("undo-B")])
  await settled()

  wire.waiting[0]?.landed([edit("redo-A")])
  await settled()

  undo.redo()
  await settled()
  expect(wire.waiting.length).toBe(1)
  expect(undo.said()).toEqual({ tone: "aside", text: "Nothing to redo" })

  undo.undo()
  await settled()
  expect(wire.waiting[1]?.edit).toEqual(edit("undo-B"))
  dispose()
})

test("a replay that lands with nobody having interrupted it is redoable", async () => {
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
  expect(undo.said()?.text).toContain("Nothing to undo")

  undo.record([edit("undo-A")])
  await settled()
  expect(undo.said()).toBeNull()
  dispose()
})

test("half a replay is still half redoable", async () => {
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

test("undo waits for a pending write before spending its inverse or an older entry", async () => {
  const wire = held()
  const { undo, dispose } = running(wire.apply)
  const pending = Promise.withResolvers<ReadonlyArray<Edit> | undefined>()
  undo.record([edit("older")])
  undo.record(pending.promise)
  undo.undo()
  await settled()
  expect(wire.waiting).toHaveLength(0)
  expect(undo.said()).toBeNull()

  pending.resolve([edit("latest")])
  await settled()
  expect(wire.waiting[0]?.edit).toEqual(edit("latest"))
  wire.waiting[0]?.landed([edit("redo-latest")])
  await settled()
  undo.undo()
  await settled()
  expect(wire.waiting[1]?.edit).toEqual(edit("older"))
  wire.waiting[1]?.landed()
  await settled()
  dispose()
})

test("a refused pending write leaves the previous undo available", async () => {
  const wire = held()
  const { undo, dispose } = running(wire.apply)
  const pending = Promise.withResolvers<ReadonlyArray<Edit> | undefined>()
  undo.record([edit("older")])
  undo.record(pending.promise)
  undo.undo()
  await settled()
  expect(wire.waiting).toHaveLength(0)
  pending.resolve(undefined)
  await settled()
  expect(wire.waiting[0]?.edit).toEqual(edit("older"))
  wire.waiting[0]?.landed()
  await settled()
  dispose()
})
