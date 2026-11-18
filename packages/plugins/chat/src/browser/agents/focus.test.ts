/** WHERE A **Chats** PRESS LANDS — the whole of `./focus.ts`'s `chatTarget`,
 *  as a table over the layout that is open.
 *
 *  A press is a thing a person repeats, so every answer here is about what a
 *  SECOND press does: a conversation is drawn once and a note is opened once,
 *  and a door pressed twice that grew a column each time is the bug this
 *  table stands against. */
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

/** A layout of panes, left to right, with one of them focused. */
const open = (routes: ReadonlyArray<Route>, focus: number): Workspace => ({
  layout: { kind: "split", axis: "row", children: routes.map((route) => ({ layout: { kind: "leaf", route } })) },
  focus,
})

/** What a target opens, as the list of panes and the one with the caret. */
const landed = (here: Workspace, over: Partial<Row> = {}): { routes: ReadonlyArray<Route>; focus: number } => {
  const target = chatTarget(row(over), here)
  if (target.kind !== "layout") throw new Error("this press opened a page rather than a layout")
  return { routes: panesOf(target.workspace).map((pane) => pane.route), focus: target.workspace.focus }
}

describe("a Chats press on a note whose chat opens beside", () => {
  // THE SECOND PRESS. The note and its chat are both on screen, which is the
  // whole of what this press is for, so there is nothing left to open.
  test("with the note and its chat already open, nothing opens and the chat is focused", () => {
    expect(landed(open([PLAN, CHAT], 1))).toEqual({ routes: [PLAN, CHAT], focus: 1 })
    expect(landed(open([PLAN, CHAT], 0))).toEqual({ routes: [PLAN, CHAT], focus: 1 })
    // ...wherever in the layout the pair happens to be.
    expect(landed(open([HOUSE, PLAN, CHAT], 0))).toEqual({ routes: [HOUSE, PLAN, CHAT], focus: 2 })
  })

  // A NOTE ALREADY OPEN IS THE PANE THE CHAT GOES BESIDE, rather than a
  // second copy of it somewhere else: the conversation is a new column to the
  // RIGHT of the note that is there, and no page anybody arranged is lost.
  test("with the note open and no chat, the conversation opens beside that pane", () => {
    expect(landed(open([HOUSE, PLAN, INSTALL], 0)))
      .toEqual({ routes: [HOUSE, PLAN, CHAT, INSTALL], focus: 2 })
  })

  // NOTHING ABOUT THIS NOTE IS OPEN: the pane the press lands in becomes the
  // note and the chat opens to its right, taking no neighbour's column.
  test("with neither open, the pane pressed in becomes the note and the chat opens beside it", () => {
    expect(landed(open([HOUSE, INSTALL], 1)))
      .toEqual({ routes: [HOUSE, PLAN, CHAT], focus: 2 })
  })

  // THE CHAT ALONE IS ALREADY DRAWN: the press puts the note under the caret
  // and goes to the conversation, which is the pair this switch asks for.
  test("with the chat open and the note nowhere, the pressed pane becomes the note", () => {
    expect(landed(open([HOUSE, CHAT], 0)))
      .toEqual({ routes: [PLAN, CHAT], focus: 1 })
  })

  test("a chat that opens alone is a page, whatever is on screen", () => {
    expect(chatTarget(row({ beside: false }), open([PLAN, CHAT], 0))).toEqual({ kind: "page", route: CHAT })
  })
})
