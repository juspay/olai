import { REPEAT_RULES } from "@olai/format"
import { expect, test } from "bun:test"

import { noticeOf, pressOf, repeatPick, startsAt } from "./repeat.ts"

test("a node that does not repeat starts on the empty option", () => {
  expect(startsAt(undefined)).toBe("")
})

test("a repeating node starts on its own rule, verbatim", () => {
  expect(startsAt("every week on monday")).toBe("every week on monday")
})

test("a rule the list cannot show starts empty, and is said out loud", () => {
  expect(startsAt("every 2 weeks")).toBe("")
  expect(noticeOf("every 2 weeks")).toContain("every 2 weeks")
  expect(noticeOf("every week on monday")).toBeUndefined()
  expect(noticeOf(undefined)).toBeUndefined()
})

test("a chosen rule crosses as the words that were chosen", () => {
  expect(repeatPick("bins", "every week on monday")).toEqual({
    verb: "repeat",
    id: "bins",
    repeat: "every week on monday",
  })
})

test("the empty option is `null`, which is what `Stop repeating` sends", () => {
  expect(repeatPick("bins", "")).toEqual({ verb: "repeat", id: "bins", repeat: null })
})

test("the button is dead when pressing it would ask for nothing", () => {
  expect(pressOf(undefined, "")).toEqual({ label: "Set repeat", writes: false })
  expect(pressOf("every day", "every day")).toEqual({ label: "Set repeat", writes: false })
})

test("an emptied box over a repeating node is `Stop repeating`, and it writes", () => {
  expect(pressOf("every day", "")).toEqual({ label: "Stop repeating", writes: true })
})

test("a new rule writes, whether or not there was one before", () => {
  expect(pressOf(undefined, "every month")).toEqual({ label: "Set repeat", writes: true })
  expect(pressOf("every day", "every month")).toEqual({ label: "Set repeat", writes: true })
})
