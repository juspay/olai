/**
 * The filter rule of the model picker, over values.
 *
 * Three edges decide whether the rule is right or merely near: CASE (an agent
 * names its models however it likes), WHERE the query reads (the `value` as
 * well as the `name`, because `provider/id` values let one word narrow a
 * whole provider), and what an EMPTY query means (everything, in the agent's
 * own order).
 */

import { describe, expect, test } from "bun:test"

import { type Offered, visibleModels } from "./model-filter.ts"

/** The scripted ACP double's list, as it advertises it: id-spelled values for
 *  the two pin rows, bare family words for the rest. */
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
    // Neither row's name says "model", so this only passes if the query is
    // matched against what a choice SENDS — which is what a `provider/id`
    // vocabulary (omp's) narrows by when the label never names the provider.
    expect(visibleModels(ROWS, "model").map((row) => row.name)).toEqual([
      "Fake One",
      "Fake Two",
    ])
  })

  test("a row either field matches is in once, and in the agent's position", () => {
    // "sonnet" is this row's value AND part of its name; the answer is still
    // one row, where the agent put it.
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
