import { expect, test } from "bun:test"
import { quoted, textOf, textOfDiff } from "./carried.ts"
import { written } from "@olai/markdown-ui/insert.ts"
test("quotes preserve internal empty lines and end with one blank line", () => {
  expect(quoted("one")).toBe("> one\n\n")
  expect(quoted("one\n\ntwo\n")).toBe("> one\n> \n> two\n\n")
  expect(quoted("")).toBe("> \n\n")
  expect(written("before after", { from: 7 }, quoted("one"), 7)).toEqual({ text: "before > one\n\nafter", caret: 14 })
})
test("only settled source words ride a transcript carry", () => {
  expect(textOf({ id: "a", kind: "agent", text: "hello", streaming: true })).toBeNull()
  expect(textOf({ id: "a", kind: "agent", text: "hello" })).toBe("hello")
  expect(textOf({ id: "a", kind: "user", text: "question" })).toBe("question")
  expect(textOf({ id: "a", kind: "tool", text: "Read", status: "completed", detail: "words", reply: { ignored: true }, progress: "excluded" })).toBe("Read\nwords")
  expect(textOf({ id: "a", kind: "tool", text: "Read", status: "completed", reply: { ok: true } })).toBe('Read\n{\n  "ok": true\n}')
})
test("a diff carries its path and changed lines", () => {
  expect(textOfDiff("a.md", "old\n", "new\n")).toBe("a.md\n-old\n+new")
})
