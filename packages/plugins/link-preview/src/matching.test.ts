import { expect, test } from "bun:test"
import type { LinkPreview, Route } from "olai-plugin-navigation/contract"
import { matchPreview } from "./matching.ts"
const route: Route = { kind: "at", address: null }
const face = (priority: number, matches = true): LinkPreview => ({ priority, matches: () => matches, Preview: () => null })
test("chat priority beats the generic node face regardless of activation order", () => {
  const outline = { owner: "outlines", value: face(0) }, chat = { owner: "chat", value: face(100) }
  expect(matchPreview([outline, chat], route)).toBe(chat.value)
  expect(matchPreview([chat, outline], route)).toBe(chat.value)
  expect(matchPreview([outline], route)).toBe(outline.value)
})
test("no owner claims an unsupported route and absent plugins offer nothing", () => {
  expect(matchPreview([], route)).toBeUndefined()
  expect(matchPreview([{ owner: "markdown", value: face(0, false) }], route)).toBeUndefined()
})
test("ties use stable owner names without mutating the contribution roster", () => {
  const a = { owner: "a", value: face(0) }, b = { owner: "b", value: face(0) }
  const entries = Object.freeze([b, a])
  expect(matchPreview(entries, route)).toBe(a.value)
  expect(entries[0]).toBe(b)
})
