/** Which pane a conversation is already drawn in — the whole of the
 *  drawn-once rule (`./beside.ts`). */
import { describe, expect, test } from "bun:test"
import type { AgentItem } from "@olai/format"
import { atFile, zoomNode, type Route } from "olai-plugin-navigation/routes"

import { besideIn } from "./beside.ts"
import { chatRouteOf } from "./route.ts"

const NOTE: AgentItem = { kind: "note", path: "notes/plan.md" }
const NODE: AgentItem = { kind: "node", id: "install" }
const chat = chatRouteOf

describe("the pane a chat is drawn in", () => {
  test("a chat page in the layout is found by the item's key", () => {
    expect(besideIn([atFile("notes/plan.md"), chat(NOTE)], "/notes/plan.md", 0)).toBe(1)
    expect(besideIn([chat(NODE), atFile("house.olai")], "install", 1)).toBe(0)
  })

  test("another item's chat is not this item's", () => {
    expect(besideIn([chat(NODE), atFile("house.olai")], "/notes/plan.md", 1)).toBeNull()
  })

  test("the item's own page is not its chat's page", () => {
    expect(besideIn([atFile("notes/plan.md"), zoomNode("install")], "/notes/plan.md", 1)).toBeNull()
    expect(besideIn([zoomNode("install"), atFile("house.olai")], "install", 1)).toBeNull()
  })

  // THE READER'S OWN PANE IS NOT "BESIDE" IT: the chat page draws the
  // conversation, and a page that counted itself would draw a sentence about
  // its own column instead.
  test("the pane asking is never the answer", () => {
    expect(besideIn([chat(NOTE)], "/notes/plan.md", 0)).toBeNull()
    expect(besideIn([chat(NOTE), chat(NOTE)], "/notes/plan.md", 0)).toBe(1)
    expect(besideIn([chat(NOTE), chat(NOTE)], "/notes/plan.md", 1)).toBe(0)
  })

  test("with no pane drawing it, nothing is beside", () => {
    expect(besideIn([], "install", 0)).toBeNull()
    expect(besideIn([atFile("house.olai")], "install", 0)).toBeNull()
  })
})
