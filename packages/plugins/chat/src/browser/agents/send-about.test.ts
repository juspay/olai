/** THE WORDS UNDER A START BOX (`./send-about.ts`) — one sentence per kind of
 *  item, in the nouns the rest of olai uses for them. A node is a ROW
 *  everywhere a person reads about one: the menu's *Close the chat* says the
 *  tie comes off this row, the sidebar lists rows, and the outline is rows. A
 *  box that called it a node would be the only face spelling the data model at
 *  somebody. */
import { expect, test } from "bun:test"

import { ABOUT_NODE, ABOUT_NOTE } from "./send-about.ts"

test("the box on a row says row, and says nothing about nodes", () => {
  expect(ABOUT_NODE).toBe("Sending starts a chat about this row · the rows under it are its memory")
  expect(ABOUT_NODE).not.toContain("node")
})

test("the box on a note says note", () => {
  expect(ABOUT_NOTE).toBe("Sending starts a chat about this note · the chat is kept in its front matter")
})
