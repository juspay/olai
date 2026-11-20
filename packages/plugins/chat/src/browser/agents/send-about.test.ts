import { expect, test } from "bun:test"

import { ABOUT_NODE, ABOUT_NOTE } from "./send-about.ts"

test("the box on a row says row, and says nothing about nodes", () => {
  expect(ABOUT_NODE).toBe("Sending starts a chat about this row · the rows under it are its memory")
  expect(ABOUT_NODE).not.toContain("node")
})

test("the box on a note says note", () => {
  expect(ABOUT_NOTE).toBe("Sending starts a chat about this note · the chat is kept in its front matter")
})
