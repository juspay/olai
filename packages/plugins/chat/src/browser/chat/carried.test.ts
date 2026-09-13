import { expect, test } from "bun:test"
import { textOf, textOfDiff } from "./carried.ts"
test("only settled source words ride a transcript carry", () => {
  expect(textOf({ id: "a", since: "2026-09-12", seq: 1, kind: "agent", text: "hello", streaming: true })).toBeNull()
  expect(textOf({ id: "a", since: "2026-09-12", seq: 1, kind: "agent", text: "hello" })).toBe("hello")
  expect(textOf({ id: "a", since: "2026-09-12", seq: 1, kind: "user", text: "question" })).toBe("question")
  expect(textOf({ id: "a", since: "2026-09-12", seq: 1, kind: "tool", text: "Read", status: "completed", detail: "words", reply: { ignored: true }, progress: "excluded" })).toBe("Read\nwords")
  expect(textOf({ id: "a", since: "2026-09-12", seq: 1, kind: "tool", text: "Read", status: "completed", reply: { ok: true } })).toBe('Read\n{\n  "ok": true\n}')
})
test("a diff carries its path and changed lines", () => {
  expect(textOfDiff("a.md", "old\n", "new\n")).toBe("a.md\n-old\n+new")
})
