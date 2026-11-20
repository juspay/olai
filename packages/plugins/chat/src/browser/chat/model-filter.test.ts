import { describe, expect, test } from "bun:test"

import { type Offered, visibleModels } from "./model-filter.ts"

const ROWS: ReadonlyArray<Offered> = [
  { value: "fake-model-1", name: "Fake One" },
  { value: "fake-model-2", name: "Fake Two" },
  { value: "sonnet", name: "Fake Sonnet" },
  { value: "haiku", name: "Fake Haiku" },
  { value: "opus[1m]", name: "Fake Opus (1M context)" },
]

describe("filtering the models the picker offers", () => {
  test("an empty query is the whole list, in the agent's order", () => {
    expect(visibleModels(ROWS, "")).toBe(ROWS)
    expect(visibleModels(ROWS, "   ")).toEqual(ROWS)
  })

  test("matching is case-insensitive on the name", () => {
    expect(visibleModels(ROWS, "HAIKU")).toEqual([{ value: "haiku", name: "Fake Haiku" }])
  })

  test("the VALUE is read as well as the name", () => {
    expect(visibleModels(ROWS, "model").map((row) => row.name)).toEqual([
      "Fake One",
      "Fake Two",
    ])
  })

  test("a row either field matches is in once, and in the agent's position", () => {
    expect(visibleModels(ROWS, "sonnet")).toEqual([{ value: "sonnet", name: "Fake Sonnet" }])
    expect(visibleModels(ROWS, "fake").map((row) => row.name)).toEqual(
      ROWS.map((row) => row.name),
    )
  })

  test("the query is trimmed of whitespace", () => {
    expect(visibleModels(ROWS, "  haiku ")).toEqual([{ value: "haiku", name: "Fake Haiku" }])
  })

  test("nothing matching is an empty list", () => {
    expect(visibleModels(ROWS, "zzz")).toEqual([])
  })
})
