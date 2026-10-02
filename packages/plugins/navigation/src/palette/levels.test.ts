/**
 * THE OPEN PATH, AS DATA — drilling, going back, resolving against what is
 * contributed now, and a value level's choice and submit. The drawing and the
 * Solid scopes are `./Palette.tsx`'s and are driven in a browser
 * (`../../e2e/features/palette_levels.feature`); what is here is every rule
 * that does not need one.
 */
import { expect, test } from "bun:test"

import { boxOf } from "./items.ts"
import type { PaletteItem } from "./items.ts"
import {
  chosenOption,
  drill,
  openStep,
  type PaletteOption,
  type PaletteValue,
  popTo,
  resolvePath,
  rootStands,
  type Step,
  standing,
  stepOption,
  submitting,
  updateStep,
} from "./levels.ts"

const OPTIONS: ReadonlyArray<PaletteOption> = [
  { id: "a", label: "Apple" },
  { id: "b", label: "Banana" },
  { id: "c", label: "Cherry" },
]

const GROUP = { kind: "group" as const, children: [] }
const SOURCE = { adapter: "the fixture's" }

const value = (more: Partial<PaletteValue> = {}): PaletteValue => ({
  kind: "value",
  options: OPTIONS,
  submit: () => Promise.resolve({}),
  ...more,
})

test("each opening is its own step, even of the same row", () => {
  const one = openStep("fruit", "Fruit", GROUP, SOURCE)
  const two = openStep("fruit", "Fruit", GROUP, SOURCE)
  expect(one.serial).not.toBe(two.serial)
  expect(one.controller).not.toBe(two.controller)
  expect(one.busy).toBe(false)
  expect(openStep("note", "Note", GROUP, SOURCE, "draft").text).toBe("draft")
})

test("a step keeps the level it opened and where its path came from, for a redraw to rebuild", () => {
  const level = value({ initial: "draft" })
  const step = openStep("v", "V", level, SOURCE)
  expect(step.level).toBe(level)
  expect(step.source).toBe(SOURCE)
  // A value level starts with its own text unless the opener says otherwise.
  expect(step.text).toBe("draft")
  expect(openStep("v", "V", level, SOURCE, "carried").text).toBe("carried")
  expect(openStep("g", "G", GROUP, SOURCE).text).toBe("")
})

test("the root of a path stands while its source is present, available and still offers the row as a level", () => {
  const row = (id: string, opens: boolean): PaletteItem => ({
    id,
    label: id,
    action: opens ? { kind: "level", level: GROUP } : { kind: "run", run: () => Promise.resolve({}) },
    taking: (act) => act(),
    search: id,
  })
  const offered = [row("fruit", true), row("plain", false)]
  expect(rootStands(true, true, offered, "fruit")).toBe(true)
  expect(rootStands(false, true, offered, "fruit")).toBe(false)
  expect(rootStands(true, false, offered, "fruit")).toBe(false)
  expect(rootStands(true, true, [], "fruit")).toBe(false)
  // Still offered, but no longer as a level.
  expect(rootStands(true, true, offered, "plain")).toBe(false)
})

test("drilling pushes; popping keeps the prefix, empties the new top and names what went", () => {
  const a = { ...openStep("a", "A", GROUP, SOURCE), text: "typed at a" }
  const b = openStep("b", "B", GROUP, SOURCE)
  const c = openStep("c", "C", GROUP, SOURCE)
  const path = drill(drill(drill([], a), b), c)
  expect(path.map((step) => step.id)).toEqual(["a", "b", "c"])

  const once = popTo(path, 2)
  expect(once.kept.map((step) => step.id)).toEqual(["a", "b"])
  expect(once.dropped.map((step) => step.id)).toEqual(["c"])

  const twice = popTo(path, 1)
  expect(twice.kept.map((step) => step.id)).toEqual(["a"])
  expect(twice.kept[0]!.text).toBe("")
  expect(twice.kept[0]!.serial).toBe(a.serial)
  expect(twice.dropped.map((step) => step.id)).toEqual(["b", "c"])

  const root = popTo(path, 0)
  expect(root.kept).toEqual([])
  expect(root.dropped).toHaveLength(3)
})

test("popping to where the path already is changes nothing, and out-of-range depths clamp", () => {
  const path = [openStep("a", "A", GROUP, SOURCE)]
  expect(popTo(path, 1).kept).toBe(path)
  expect(popTo(path, 1).dropped).toEqual([])
  expect(popTo(path, 9).kept).toBe(path)
  expect(popTo(path, -1).kept).toEqual([])
})

test("a step is updated by serial, and an update for a step that is gone is nothing", () => {
  const a = openStep("a", "A", GROUP, SOURCE)
  const path = [a]
  expect(updateStep(path, a.serial, (step) => ({ ...step, text: "x" }))[0]!.text).toBe("x")
  expect(updateStep(path, a.serial + 1000, (step) => ({ ...step, text: "x" }))).toEqual(path)
})

test("the path stands as far as the live contributions still offer it", () => {
  const path = [openStep("a", "A", GROUP, SOURCE), openStep("b", "B", GROUP, SOURCE), openStep("c", "C", GROUP, SOURCE)]
  expect(standing(path, () => true)).toBe(3)
  expect(standing(path, (_depth, step) => step.id !== "b")).toBe(1)
  expect(standing(path, (depth) => depth !== 0)).toBe(0)
  expect(standing([], () => false)).toBe(0)
})

test("a requested path resolves level by level and stops at the first id that does not", () => {
  const tree: Record<string, ReadonlyArray<string>> = { root: ["fruit"], fruit: ["citrus"], citrus: [] }
  const levels = ["root", "fruit", "citrus"]
  const find = (depth: number, id: string) => (tree[levels[depth]!] ?? []).includes(id) ? id : undefined
  expect(resolvePath(["fruit", "citrus"], find)).toEqual(["fruit", "citrus"])
  expect(resolvePath(["fruit", "nope", "citrus"], find)).toEqual(["fruit"])
  expect(resolvePath(["gone", "citrus"], find)).toEqual([])
  expect(resolvePath([], find)).toEqual([])
})

test("exactly one option is chosen: the one moved to, else the level's default, else the first", () => {
  expect(chosenOption(OPTIONS, undefined)?.id).toBe("a")
  expect(chosenOption(OPTIONS, undefined, "b")?.id).toBe("b")
  expect(chosenOption(OPTIONS, "c", "b")?.id).toBe("c")
  // An option that left the list does not leave nothing chosen.
  expect(chosenOption(OPTIONS, "gone", "also-gone")?.id).toBe("a")
  expect(chosenOption([], "a")).toBeUndefined()
})

test("the arrows move the choice and wrap at both ends", () => {
  expect(stepOption(OPTIONS, OPTIONS[0], 1)?.id).toBe("b")
  expect(stepOption(OPTIONS, OPTIONS[2], 1)?.id).toBe("a")
  expect(stepOption(OPTIONS, OPTIONS[0], -1)?.id).toBe("c")
  expect(stepOption(OPTIONS, { id: "gone", label: "Gone" }, 1)?.id).toBe("a")
  expect(stepOption(OPTIONS, undefined, -1)?.id).toBe("c")
  expect(stepOption([], OPTIONS[0], 1)).toBeUndefined()
})

test("submit sends the text with the chosen option", () => {
  const step: Step = { ...openStep("v", "V", GROUP, SOURCE), text: "hello", option: "b" }
  expect(submitting(value(), step, OPTIONS)).toEqual({ kind: "send", text: "hello", option: OPTIONS[1] })
  const fresh: Step = { ...openStep("v", "V", GROUP, SOURCE), text: "hello" }
  expect(submitting(value({ chosen: "c" }), fresh, OPTIONS)).toEqual({ kind: "send", text: "hello", option: OPTIONS[2] })
})

test("the validator's sentence refuses the submit, and sees the text and the option", () => {
  const seen: Array<[string, string | undefined]> = []
  const level = value({
    validate: (text, option) => {
      seen.push([text, option?.id])
      return text.trim() === "" ? "Type something first." : null
    },
  })
  expect(submitting(level, { ...openStep("v", "V", GROUP, SOURCE), text: "  " }, OPTIONS))
    .toEqual({ kind: "refused", sentence: "Type something first." })
  expect(submitting(level, { ...openStep("v", "V", GROUP, SOURCE), text: "ok", option: "c" }, OPTIONS).kind).toBe("send")
  expect(seen).toEqual([["  ", "a"], ["ok", "c"]])
})

test("a second submit while one is in flight is refused before anything else is asked", () => {
  let asked = 0
  const level = value({ validate: () => { asked++; return null } })
  const busy: Step = { ...openStep("v", "V", GROUP, SOURCE), text: "hello", busy: true }
  expect(submitting(level, busy, OPTIONS)).toEqual({ kind: "busy" })
  expect(asked).toBe(0)
})

test("inside a level the box is the level's: no prefix and no filter reads it, but a question still stands over it", () => {
  const command = { prefix: ">", said: "ask", placeholder: "", run: () => Promise.resolve(null) }
  expect(boxOf("> hello", null, [command], [], true)).toEqual({ kind: "level" })
  expect(boxOf("> hello", null, [command], [], false).kind).toBe("command")
  const question = { kind: "confirm" as const, label: "Go", question: "Sure?", edit: { verb: "trash", id: "x" } as never }
  expect(boxOf("", question, [command], [], true).kind).toBe("answering")
})
