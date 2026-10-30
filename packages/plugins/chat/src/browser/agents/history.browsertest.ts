/**
 * The history list's openness, as the activation owns it (`./history.ts`): the
 * same owner and the same lifetime as `./folding.ts`'s fold.
 *
 * WHAT IS PINNED HERE is the half a unit test can pin — that the fact lives in
 * the holder and not in the frame that read it, so a panel rebuilt by a roster
 * answer comes back with the list the reader opened still up. That a REMOUNT
 * actually happens on the frame in question is the browser's to say, and
 * `the_agent.feature`'s "A stored conversation refused after restart can be
 * retried" holds it.
 */
import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { createHistory, historySeat, holdHistory } from "./history.ts"

test("a node's seat keeps what the frame that wrote it could not", () => {
  const history = createHistory()
  const seat = history.seat("door-live")
  expect(seat.read()).toEqual({ _tag: "shut" })
  seat.write({ _tag: "open", over: true })
  // ...the SAME node, read again: a second History in a rebuilt panel asks its
  // own seat and hears the reader's press.
  expect(history.seat("door-live").read()).toEqual({ _tag: "open", over: true })
  // ...and shutting is the reader's too, and it sticks.
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
    // No activation, no memory — and a picker that still works, which is what
    // the absent arm is for rather than a throw inside a render.
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
