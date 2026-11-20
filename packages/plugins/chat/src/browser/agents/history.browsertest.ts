import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { createHistory, historySeat, holdHistory } from "./history.ts"

test("a node's seat keeps what the frame that wrote it could not", () => {
  const history = createHistory()
  const seat = history.seat("door-live")
  expect(seat.read()).toEqual({ _tag: "shut" })
  seat.write({ _tag: "open", over: true })
  expect(history.seat("door-live").read()).toEqual({ _tag: "open", over: true })
  seat.write({ _tag: "shut" })
  expect(history.seat("door-live").read()).toEqual({ _tag: "shut" })
})

test("one node's history is not another's", () => {
  const history = createHistory()
  history.seat("door-live").write({ _tag: "open", over: true })
  expect(history.seat("kitchen").read()).toEqual({ _tag: "shut" })
})

test("the door answers the activation that holds it, and a seat with none at all", () => {
  createRoot((dispose) => {
    const release = holdHistory(createHistory())
    const held = historySeat("door-live")
    held.write({ _tag: "open", over: true })
    expect(historySeat("door-live").read()).toEqual({ _tag: "open", over: true })
    release()
    const none = historySeat("door-live")
    expect(none.read()).toEqual({ _tag: "shut" })
    none.write({ _tag: "open", over: true })
    expect(none.read()).toEqual({ _tag: "shut" })
    dispose()
  })
})

test("a rebuilt activation starts shut", () => {
  createRoot((dispose) => {
    const first = holdHistory(createHistory())
    historySeat("door-live").write({ _tag: "open", over: true })
    const second = holdHistory(createHistory())
    expect(historySeat("door-live").read()).toEqual({ _tag: "shut" })
    first()
    second()
    dispose()
  })
})
