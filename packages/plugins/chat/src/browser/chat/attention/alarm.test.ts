import { expect, test } from "bun:test"

import { alarmFor, type Awaiting } from "./alarm.ts"

const at = (count: number, watched: boolean): Awaiting => ({ count, watched })

test("a question arriving at nobody rings and badges", () => {
  expect(alarmFor(at(0, false), at(1, false))).toEqual({ alert: true, badge: 1 })
})

test("a question arriving in front of somebody does neither", () => {
  expect(alarmFor(at(0, true), at(1, true))).toEqual({ alert: false, badge: 0 })
})

test("a second question arriving at nobody rings again", () => {
  expect(alarmFor(at(1, false), at(2, false))).toEqual({ alert: true, badge: 2 })
})

test("the same question, still waiting, does not ring twice", () => {
  expect(alarmFor(at(1, false), at(1, false))).toEqual({ alert: false, badge: 1 })
})

test("walking away from a question you were shown badges without ringing", () => {
  expect(alarmFor(at(1, true), at(1, false))).toEqual({ alert: false, badge: 1 })
})

test("looking at the panel clears the badge, answered or not", () => {
  expect(alarmFor(at(2, false), at(2, true))).toEqual({ alert: false, badge: 0 })
})

test("answering clears the badge", () => {
  expect(alarmFor(at(1, false), at(0, false))).toEqual({ alert: false, badge: 0 })
})

test("the first reading a page takes never rings", () => {
  expect(alarmFor(undefined, at(2, false))).toEqual({ alert: false, badge: 2 })
})

test("a page that opens onto a question it can see does nothing at all", () => {
  expect(alarmFor(undefined, at(1, true))).toEqual({ alert: false, badge: 0 })
})

test("a question asked again after being answered rings again", () => {
  expect(alarmFor(at(1, false), at(0, false))).toEqual({ alert: false, badge: 0 })
  expect(alarmFor(at(0, false), at(1, false))).toEqual({ alert: true, badge: 1 })
})
