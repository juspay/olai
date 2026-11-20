import { describe, expect, test } from "bun:test"
import type { AgentItem } from "@olai/format"
import { atFile, zoomNode, type Route } from "olai-plugin-navigation/routes"

import { besideIn, drawnIn } from "./beside.ts"
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

  test("the pane that draws is never its own answer", () => {
    expect(besideIn([chat(NOTE)], "/notes/plan.md", 0)).toBeNull()
  })

  test("with two panes on one chat the leftmost draws and the other points at it", () => {
    expect(besideIn([chat(NOTE), chat(NOTE)], "/notes/plan.md", 0)).toBeNull()
    expect(besideIn([chat(NOTE), chat(NOTE)], "/notes/plan.md", 1)).toBe(0)
  })

  test("a press is told the pane holding it, its own included", () => {
    expect(drawnIn([chat(NOTE)], "/notes/plan.md")).toBe(0)
    expect(drawnIn([chat(NOTE), chat(NOTE)], "/notes/plan.md")).toBe(0)
    expect(drawnIn([atFile("notes/plan.md")], "/notes/plan.md")).toBeNull()
  })

  test("with no pane drawing it, nothing is beside", () => {
    expect(besideIn([], "install", 0)).toBeNull()
    expect(besideIn([atFile("house.olai")], "install", 0)).toBeNull()
  })
})
