import { describe, expect, test } from "bun:test"
import { atFile, zoomNode, type Route } from "olai-plugin-navigation/routes"
import { panesOf, type Workspace } from "olai-plugin-navigation/workspace"

import { chatTarget } from "./focus.ts"
import { chatRouteOf } from "./route.ts"
import type { Row } from "./roster.ts"

const NOTE = { kind: "note", path: "notes/plan.md" } as const
const CHAT = chatRouteOf(NOTE)
const PLAN = atFile("notes/plan.md")
const HOUSE = atFile("house.olai")
const INSTALL = zoomNode("install")

const row = (over: Partial<Row> = {}): Row => ({
  id: "/notes/plan.md", kind: "note", beside: true, file: "notes/plan.md", title: "plan",
  engine: "one", session: "s1", memory: 0, waiting: 0, standing: "idle",
  said: null, seen: null, unread: false, sleeps: false, sleep: null, ...over,
})

const open = (routes: ReadonlyArray<Route>, focus: number): Workspace => ({
  layout: { kind: "split", axis: "row", children: routes.map((route) => ({ layout: { kind: "leaf", route } })) },
  focus,
})

const landed = (here: Workspace, over: Partial<Row> = {}): { routes: ReadonlyArray<Route>; focus: number } => {
  const target = chatTarget(row(over), here)
  if (target.kind !== "layout") throw new Error("this press opened a page rather than a layout")
  return { routes: panesOf(target.workspace).map((pane) => pane.route), focus: target.workspace.focus }
}

describe("a Chats press on a note whose chat opens beside", () => {
  test("with the note and its chat already open, nothing opens and the chat is focused", () => {
    expect(landed(open([PLAN, CHAT], 1))).toEqual({ routes: [PLAN, CHAT], focus: 1 })
    expect(landed(open([PLAN, CHAT], 0))).toEqual({ routes: [PLAN, CHAT], focus: 1 })
    expect(landed(open([HOUSE, PLAN, CHAT], 0))).toEqual({ routes: [HOUSE, PLAN, CHAT], focus: 2 })
  })

  test("with the note open and no chat, the conversation opens beside that pane", () => {
    expect(landed(open([HOUSE, PLAN, INSTALL], 0)))
      .toEqual({ routes: [HOUSE, PLAN, CHAT, INSTALL], focus: 2 })
  })

  test("with neither open, the pane pressed in becomes the note and the chat opens beside it", () => {
    expect(landed(open([HOUSE, INSTALL], 1)))
      .toEqual({ routes: [HOUSE, PLAN, CHAT], focus: 2 })
  })

  test("with the chat open and the note nowhere, the pressed pane becomes the note", () => {
    expect(landed(open([HOUSE, CHAT], 0)))
      .toEqual({ routes: [PLAN, CHAT], focus: 1 })
  })

  test("a chat that opens alone is a page, whatever is on screen", () => {
    expect(chatTarget(row({ beside: false }), open([PLAN, CHAT], 0))).toEqual({ kind: "page", route: CHAT })
  })
})
