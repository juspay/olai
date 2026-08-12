import type { Edit } from "@olai/surface"
import { expect, test } from "bun:test"

import { DEPTH, EMPTY, kept, recorded, type Stack, type Step, taken } from "./undo.ts"

/** An entry, distinguishable from the others by the id it names. */
const step = (id: string): Step => [{ verb: "remove", id }]

const ids = (steps: ReadonlyArray<Step>): ReadonlyArray<string> =>
  steps.map((entry) => (entry[0] as Extract<Edit, { verb: "remove" }>).id)

const after = (...names: ReadonlyArray<string>): Stack =>
  names.reduce((stack, name) => recorded(stack, step(name)), EMPTY)

test("the top of the stack is the last thing that happened", () => {
  const held = taken(after("one", "two", "three"), "done")
  expect(ids([held?.step ?? []])).toEqual(["three"])
  expect(ids(held?.rest.done ?? [])).toEqual(["one", "two"])
})

test("an empty side answers nothing rather than a step that would write", () => {
  expect(taken(EMPTY, "done")).toBeNull()
  expect(taken(EMPTY, "undone")).toBeNull()
})

test("an undo becomes a redo, and a redo becomes an undo", () => {
  // The property that keeps redo from being a second derivation: replaying an
  // inverse answers with ITS inverse, and it is filed on the other side.
  const stack = after("one")
  const held = taken(stack, "done")
  const back = kept(held?.rest ?? EMPTY, "done", step("one-back"))
  expect(ids(back.done)).toEqual([])
  expect(ids(back.undone)).toEqual(["one-back"])

  const again = taken(back, "undone")
  const forward = kept(again?.rest ?? EMPTY, "undone", step("one"))
  expect(ids(forward.done)).toEqual(["one"])
  expect(ids(forward.undone)).toEqual([])
})

test("a new op clears what redo would have put back", () => {
  const undone = kept(EMPTY, "done", step("one-back"))
  expect(ids(recorded(undone, step("two")).undone)).toEqual([])
})

test("moving an entry between the sides clears nothing", () => {
  // Only a NEW op is a branch. An undo followed by a redo followed by an undo
  // has to keep working, and it would not if either side cleared the other.
  const stack: Stack = { done: [step("one")], undone: [step("two-back")] }
  expect(ids(kept(stack, "done", step("three")).undone)).toEqual([
    "two-back",
    "three",
  ])
})

test("the stack forgets the oldest first, and stays bounded", () => {
  const full = Array.from({ length: DEPTH + 5 }, (_, at) => `n${at}`).reduce(
    (stack, name) => recorded(stack, step(name)),
    EMPTY,
  )
  expect(full.done.length).toBe(DEPTH)
  expect(ids(full.done)[0]).toBe("n5")
  expect(ids(full.done)[DEPTH - 1]).toBe(`n${DEPTH + 4}`)
})
