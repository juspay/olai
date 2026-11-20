import { expect, test } from "bun:test"

import { AUDIT, signed } from "./message.ts"

test("a signed message carries the prefix and the writer trailer", () => {
  expect(signed("reconcile the roadmap", "chat-agent")).toBe(
    "olai: reconcile the roadmap\n\nX-Olai-Writer: chat-agent\n",
  )
})

test("what is already prefixed is not prefixed twice", () => {
  expect(signed("olai: 3 edits to roadmap — x done", "web")).toStartWith(
    "olai: 3 edits to roadmap — x done\n\n",
  )
})

test("an empty message is still a message", () => {
  expect(signed("   ", "mcp")).toStartWith("olai: commit\n")
})

test("the audit filter is the prefix and the trailer this file writes", () => {
  const message = signed("anything", "web")
  expect(message).toStartWith(`${AUDIT.prefix}:`)
  expect(message).toContain(`${AUDIT.trailer}: web`)
})
