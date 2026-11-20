import { expect, test } from "bun:test"
import { Effect } from "effect"

import { ephemeralLocalState } from "./local.ts"
import { forLocalState, marksOf, RECORDED } from "./live.ts"

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)
const at = (minutesAgo: number): number => Date.UTC(2026, 9, 21, 12, 0) - minutesAgo * 60_000

test("the record is newest first and capped", () => {
  const live = Array.from({ length: RECORDED + 2 }, (_, i) => ({
    node: `live-${i}`,
    touched: at(i),
  }))
  const waiting = { node: "waiting-for-its-engine", touched: at(99) }

  const marks = marksOf(live, [waiting])

  expect(marks).toHaveLength(RECORDED)
  expect(marks.map((mark) => mark.node)).toEqual(
    live.slice(0, RECORDED).map((row) => row.node),
  )
  expect(marks[0]).toEqual({ node: "live-0", touched: at(0) })
})

test("a live slot outranks the same node still waiting to be reopened", () => {
  const marks = marksOf(
    [{ node: "one", touched: at(1) }],
    [{ node: "one", touched: at(90) }, { node: "two", touched: at(2) }],
  )
  expect(marks).toEqual([
    { node: "one", touched: at(1) },
    { node: "two", touched: at(2) },
  ])
})

test("a written record survives to the next activation, and a malformed row is dropped", async () => {
  const local = ephemeralLocalState()
  const first = forLocalState(local)
  await run(first.write([
    { node: "two", touched: at(2) },
    { node: "one", touched: at(1) },
  ]))

  const next = forLocalState(local)
  expect(next.read()).toEqual([
    { node: "one", touched: at(1) },
    { node: "two", touched: at(2) },
  ])

  await run(local.save("live", { live: [{ node: "three", touched: "not a date" }] }))
  expect(forLocalState(local).read()).toEqual([])
})
