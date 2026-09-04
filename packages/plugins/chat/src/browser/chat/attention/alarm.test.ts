import { expect, test } from "bun:test"

import { alarmFor, type Awaiting } from "./alarm.ts"

const at = (count: number, watched: boolean): Awaiting => ({ count, watched })

test("a question arriving at nobody rings and badges", () => {
  expect(alarmFor(at(0, false), at(1, false))).toEqual({ alert: true, badge: 1 })
})

test("a question arriving in front of somebody does neither", () => {
  // The ruling's whole second half: the form appearing IS the alert, and a
  // banner about what is already on screen is nagging.
  expect(alarmFor(at(0, true), at(1, true))).toEqual({ alert: false, badge: 0 })
})

test("a second question arriving at nobody rings again", () => {
  expect(alarmFor(at(1, false), at(2, false))).toEqual({ alert: true, badge: 2 })
})

test("the same question, still waiting, does not ring twice", () => {
  // The reason `alert` reads the CHANGE and `badge` reads the state: coming
  // back and leaving again must not re-ring what was already announced.
  expect(alarmFor(at(1, false), at(1, false))).toEqual({ alert: false, badge: 1 })
})

test("walking away from a question you were shown badges without ringing", () => {
  // It arrived while they were looking, so nothing arrived at nobody — but it
  // is still waiting on them, and the icon is what says so from the dock.
  expect(alarmFor(at(1, true), at(1, false))).toEqual({ alert: false, badge: 1 })
})

test("looking at the panel clears the badge, answered or not", () => {
  // The ruling: it sticks until the human focuses the pane, not until the
  // notification is dismissed.
  expect(alarmFor(at(2, false), at(2, true))).toEqual({ alert: false, badge: 0 })
})

test("answering clears the badge", () => {
  expect(alarmFor(at(1, false), at(0, false))).toEqual({ alert: false, badge: 0 })
})

test("the first reading a page takes never rings", () => {
  // A tab restored into the background with a question already open: nothing
  // ARRIVED here — the page did — so it badges and says nothing.
  expect(alarmFor(undefined, at(2, false))).toEqual({ alert: false, badge: 2 })
})

test("a page that opens onto a question it can see does nothing at all", () => {
  expect(alarmFor(undefined, at(1, true))).toEqual({ alert: false, badge: 0 })
})

test("a question asked again after being answered rings again", () => {
  expect(alarmFor(at(1, false), at(0, false))).toEqual({ alert: false, badge: 0 })
  expect(alarmFor(at(0, false), at(1, false))).toEqual({ alert: true, badge: 1 })
})
