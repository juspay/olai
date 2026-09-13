import { expect, test } from "bun:test"
import { insertAt, quoted } from "./insertion.ts"
test("quotes preserve internal empty lines and end with one blank line", () => {
  expect(quoted("one")).toBe("> one\n\n")
  expect(quoted("one\n\ntwo\n")).toBe("> one\n> \n> two\n\n")
  expect(quoted("")).toBe("> \n\n")
  expect(insertAt("before after", 7, before => quoted("one", before))).toEqual({ text: "before \n> one\n\nafter", caret: 15 })
})

test("quotes start on a line without adding a redundant newline", () => {
  expect(quoted("one", "before\n")).toBe("> one\n\n")
  expect(quoted("one", "before")).toBe("\n> one\n\n")
})

test("literal paths preserve both sides and the caret without quote formatting", () => {
  expect(insertAt("read carefully", 5, "@house.olai ")).toEqual({ text: "read @house.olai carefully", caret: 17 })
})
