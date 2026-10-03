import { expect, test } from "bun:test"
import { newChatTitle } from "./new-chat-title.ts"

test("the first nonempty trimmed line names a chat", () => {
  expect(newChatTitle("  Plan the kitchen  \nThen the garden")).toBe("Plan the kitchen")
  expect(newChatTitle(" \n\r\n  Plan the kitchen\nNext")).toBe("Plan the kitchen")
  expect(newChatTitle(" \n")).toBe("")
})
test("clipping respects word boundaries and includes its ellipsis in 60 characters", () => {
  expect(newChatTitle("🌻".repeat(61))).toBe("🌻".repeat(59) + "…")
  expect(newChatTitle("a".repeat(60))).toBe("a".repeat(60))
  expect(newChatTitle("a".repeat(61))).toBe("a".repeat(59) + "…")
  expect(newChatTitle("Plan ".repeat(20))).toBe("Plan ".repeat(11) + "Plan…")
  expect(newChatTitle("a".repeat(55) + " word another")).toBe("a".repeat(55) + "…")
})
