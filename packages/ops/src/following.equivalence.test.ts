import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import { expect, test } from "bun:test"
import { NO_KINDS, outlinesIn } from "@olai/format"
import { Result } from "effect"

import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import { folding } from "./following.ts"
import { assembling } from "./following.testlib.ts"
import { plan, type Scope, scoping } from "./plan.ts"
import { BROKEN, DOCUMENTS, OUTLINES, SCRIPT } from "./plans.testlib.ts"

const start = (): Scope =>
  scoping(
    readingOf(
      setOf(
        OUTLINES,
        DOCUMENTS.map((document) => document),
        BROKEN,
      ),
    ),
    steady(),
    NO_KINDS, "outline-olai"
  )

const shapeOf = (at: Scope) => ({
  documents: at.set.documents,
  broken: at.set.broken,
})

const viewOf = (at: Scope) => ({
  byFile: [...at.derived.byFile].map(([file, records]) => [file, records.length] as const),
  byId: [...at.derived.byId.keys()],
  status: [...at.derived.status],
})

const isAbout = (at: Scope): boolean => {
  const outlines = outlinesIn(at.set).filter((outline) => outline.nodes.length > 0)
  if (at.derived.byFile.size !== outlines.length) return false
  let which = 0
  for (const [file, records] of at.derived.byFile) {
    const outline = outlines[which++]
    if (outline === undefined || outline.path !== file) return false
    if (outline.nodes.length !== records.length) return false
    for (let index = 0; index < records.length; index++) {
      if (records[index] !== outline.nodes[index]) return false
    }
  }
  return true
}

test("the carried fold leaves the set the assembling one left, at every op", () => {
  const spliced = start()
  const assembled = start()
  const carriedFold = folding(spliced)
  const assemblingFold = assembling(assembled)

  let one: Scope = spliced
  let other: Scope = assembled
  let folds = 0
  for (const step of SCRIPT) {
    const made = plan(one, step.op)
    const also = plan(other, step.op)
    expect([step.what, Result.isSuccess(made)]).toEqual([step.what, Result.isSuccess(also)])
    if (Result.isFailure(made)) {
      if (!Result.isFailure(also)) throw new Error(`\`${step.what}\` refused on one arm only`)
      expect([step.what, made.failure.message]).toEqual([step.what, also.failure.message])
      continue
    }
    if (Result.isFailure(also)) throw new Error(`\`${step.what}\` refused on one arm only`)
    expect([step.what, JSON.stringify(made.success)])
      .toEqual([step.what, JSON.stringify(also.success)])

    const next = carriedFold(made.success)
    const alsoNext = assemblingFold(also.success)
    if (Result.isFailure(next) || Result.isFailure(alsoNext)) {
      throw new Error(`the fold refused at ${step.what}`)
    }
    one = next.success
    other = alsoNext.success
    folds += 1
    expect([step.what, shapeOf(one)]).toEqual([step.what, shapeOf(other)])
    expect([step.what, viewOf(one)]).toEqual([step.what, viewOf(other)])
    expect([step.what, isAbout(one)]).toEqual([step.what, true])
    expect([step.what, isAbout(other)]).toEqual([step.what, true])
  }
  expect(folds).toBeGreaterThan(25)
})

test("one asking per batch: the carried answers are the SAME answers, until membership moves", () => {
  const at = start()
  const fold = folding(at)

  const outlines = at.asked.outlines
  const serves = at.asked.serves
  const broken = at.asked.broken

  let carried: Scope = at
  for (const op of [
    { op: "todo", id: "loose" },
    { op: "title", id: "loose", title: "a line with a name" },
    { op: "desc", id: "loose", desc: "a note" },
    { op: "todo", id: "seeds" },
    { op: "done", id: "seeds" },
  ] as const) {
    const made = plan(carried, op)
    if (Result.isFailure(made)) throw new Error(`\`${op.op}\` refused: ${made.failure.message}`)
    const next = fold(made.success)
    if (Result.isFailure(next)) throw new Error("the fold refused")
    carried = next.success
    expect(carried.asked.outlines).toBe(outlines)
    expect(carried.asked.serves).toBe(serves)
    expect(carried.asked.broken).toBe(broken)
    expect(carried.asked.at("house.olai")).toBe(
      carried.set.documents.find((document) => document.path === "house.olai"),
    )
  }

  const before = start()
  const reasking = assembling(before)
  const made = plan(before, { op: "todo", id: "loose" })
  if (Result.isFailure(made)) throw new Error("`todo` refused")
  const after = reasking(made.success)
  if (Result.isFailure(after)) throw new Error("the fold refused")
  expect(after.success.asked.outlines).not.toBe(before.asked.outlines)
  expect(after.success.asked.broken).not.toBe(before.asked.broken)
})

test("a file MINTED mid-batch reaches what carries — the answers move, and they are right", () => {
  const at = start()
  const fold = folding(at)
  const outlines = at.asked.outlines

  const made = plan(at, { op: "create", file: "notes/plans.olai" })
  if (Result.isFailure(made)) throw new Error(`refused: ${made.failure.message}`)
  const next = fold(made.success)
  if (Result.isFailure(next)) throw new Error("the fold refused")

  expect(next.success.asked.outlines).not.toBe(outlines)
  expect(next.success.asked.serves.has("notes/plans.olai")).toBe(true)
  expect(next.success.asked.at("notes/plans.olai")?.holds).toBe("nodes")
  const into = plan(next.success, { op: "add", file: "notes/plans.olai", title: "a first row" })
  expect(Result.isSuccess(into)).toBe(true)
})

test("a file MENDED mid-batch leaves `broken`, and what carries hears about it", () => {
  const at = start()
  const fold = folding(at)
  expect(at.asked.broken.has("torn.olai")).toBe(true)

  const made = plan(at, { op: "todo", id: "loose" })
  if (Result.isFailure(made)) throw new Error("`todo` refused")
  const next = fold(made.success)
  if (Result.isFailure(next)) throw new Error("the fold refused")
  expect(next.success.asked.broken).toBe(at.asked.broken)
  expect(next.success.asked.broken.has("torn.olai")).toBe(true)
})

test("an intermediate context is a value: a later op does not move an earlier one's answers", () => {
  const at = start()
  const fold = folding(at)
  const scopes: Array<Scope> = []
  let carried: Scope = at
  for (const op of [
    { op: "desc", id: "loose", desc: "the first note" },
    { op: "desc", id: "loose", desc: "the second note" },
    { op: "desc", id: "loose", desc: "the third note" },
  ] as const) {
    const made = plan(carried, op)
    if (Result.isFailure(made)) throw new Error(`\`${op.op}\` refused: ${made.failure.message}`)
    const next = fold(made.success)
    if (Result.isFailure(next)) throw new Error("the fold refused")
    carried = next.success
    scopes.push(carried)
  }

  const noteAt = (scope: Scope): string | undefined => {
    const document = scope.asked.at("house.olai")
    if (document === undefined || document.holds !== "nodes") return undefined
    const found = document.nodes.find((located) => located.node.id === "loose")
    return found === undefined || "mirror" in found.node ? undefined : found.node.desc
  }
  expect(scopes.map(noteAt)).toEqual(["the first note", "the second note", "the third note"])
  for (const scope of scopes) {
    expect(scope.asked.at("house.olai")).toBe(
      scope.set.documents.find((document) => document.path === "house.olai"),
    )
  }
})
