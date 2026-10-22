/**
 * THE RECORD A RESTART READS — its order, its cap, and what it refuses to hold.
 *
 * The scheduler's own tests open real conversations and kill a real server's
 * state; these are the decisions that must not need either: an entry more than
 * a capacity old loses its place, a history slot is never written, and a row
 * that cannot say when it was touched is not guessed at.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"

import { ephemeralLocalState } from "./local.ts"
import { forLocalState, marksOf, RECORDED } from "./live.ts"

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)
const at = (minutesAgo: number): number => Date.UTC(2026, 9, 21, 12, 0) - minutesAgo * 60_000

test("the record is newest first, capped, and never names a history slot", () => {
  const live = Array.from({ length: RECORDED + 2 }, (_, i) => ({
    node: `live-${i}`,
    touched: at(i),
  }))
  const history = { node: "read-from-the-past", touched: at(-1), history: true }
  const refused = { node: "refused-open", touched: at(-1), refused: true }
  const waiting = { node: "waiting-for-its-engine", touched: at(99) }

  const marks = marksOf([...live, history, refused], [waiting])

  // The cap keeps the newest eight, and the history slot's brand-new instant
  // does not buy it a place — it is not a conversation this server is having.
  expect(marks).toHaveLength(RECORDED)
  expect(marks.map((mark) => mark.node)).toEqual([
    ...live.slice(0, RECORDED).map((row) => row.node),
  ])
  expect(marks[0]).toEqual({ node: "live-0", touched: new Date(at(0)).toISOString() })
})

test("a live slot outranks the same node still waiting to be reopened", () => {
  const marks = marksOf(
    [{ node: "one", touched: at(1) }],
    [{ node: "one", touched: at(90) }, { node: "two", touched: at(2) }],
  )
  expect(marks).toEqual([
    { node: "one", touched: new Date(at(1)).toISOString() },
    { node: "two", touched: new Date(at(2)).toISOString() },
  ])
})

test("a written record survives to the next activation, and a malformed row is dropped", async () => {
  const local = ephemeralLocalState()
  const first = forLocalState(local)
  await run(first.write([
    { node: "two", touched: new Date(at(2)).toISOString() },
    { node: "one", touched: new Date(at(1)).toISOString() },
  ]))

  const next = forLocalState(local)
  expect(next.read().map((mark) => mark.node)).toEqual(["one", "two"])

  // A row a previous build wrote without an instant cannot decide a budget, so
  // it names nothing rather than being reopened on a guess.
  await run(next.write([{ node: "three", touched: "not a date" }]))
  expect(next.read()).toEqual([])
})
