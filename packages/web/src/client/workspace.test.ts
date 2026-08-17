import { expect, test } from "bun:test"

import type { Route } from "./routes.ts"
import { hrefOf, routeOf } from "./routes.ts"
import {
  closeAt,
  closeFocused,
  collapseAt,
  expandAt,
  flexOf,
  focusAt,
  focusBy,
  focusedRoute,
  hrefOfWorkspace,
  isCollapsed,
  isLone,
  lone,
  navigateIn,
  openRight,
  reorder,
  resizeTo,
  workspaceOf,
  WORKSPACE_PREFIX,
} from "./workspace.ts"

const house: Route = { kind: "outline", file: "house.olai" }
const kitchen: Route = { kind: "node", id: "kitchen" }
const garden: Route = { kind: "outline", file: "garden.olai" }
const agenda: Route = { kind: "agenda" }
const today: Route = { kind: "today" }
const doc: Route = { kind: "document", file: "notes/finishes.md", at: "beds" }
const filtered: Route = { kind: "outline", file: "house.olai", filter: "is:done" }

test("a lone page is exactly the address it always was", () => {
  expect(hrefOfWorkspace(lone(house))).toBe("/o/house.olai")
  expect(hrefOfWorkspace(lone(filtered))).toBe("/o/house.olai?q=is%3Adone")
  expect(hrefOfWorkspace(lone(doc))).toBe("/doc/notes/finishes.md#beds")
  expect(hrefOfWorkspace(lone(agenda))).toBe("/agenda")
  expect(workspaceOf("/o/house.olai")).toEqual(lone(house))
  expect(workspaceOf("/o/house.olai?q=is%3Adone")).toEqual(lone(filtered))
  expect(workspaceOf("/doc/notes/finishes.md#beds")).toEqual(lone(doc))
})

test("every existing page address is a workspace of one", () => {
  const addresses = [
    "/",
    "/o/house.olai",
    "/n/kitchen",
    "/doc/finishes.md",
    "/d/2026-08-10",
    "/today",
    "/agenda",
    "/trash",
    "/o/house.olai?q=%23home",
    "/n/kitchen?q=is:done",
  ]
  for (const address of addresses) {
    const ws = workspaceOf(address)
    expect(isLone(ws)).toBe(true)
    expect(hrefOfWorkspace(ws)).toBe(hrefOf(routeOf(address)))
  }
})

test("two panes encode as /s/ segments and read back", () => {
  const ws = openRight(lone(house), 0, kitchen)
  expect(isLone(ws)).toBe(false)
  expect(ws.panes.map((pane) => pane.route)).toEqual([house, kitchen])
  expect(ws.focus).toBe(1)
  const href = hrefOfWorkspace(ws)
  expect(href.startsWith(WORKSPACE_PREFIX)).toBe(true)
  expect(workspaceOf(href).panes.map((pane) => pane.route)).toEqual([
    house,
    kitchen,
  ])
  expect(workspaceOf(href).focus).toBe(1)
})

test("a pane's own filter and a document fragment survive the split", () => {
  const ws = openRight(lone(filtered), 0, doc)
  const href = hrefOfWorkspace(ws)
  const back = workspaceOf(href)
  expect(back.panes[0]!.route).toEqual(filtered)
  expect(back.panes[1]!.route).toEqual(doc)
})

test("three panes, a width split and a collapsed rail round-trip", () => {
  let ws = openRight(lone(house), 0, kitchen)
  ws = openRight(ws, 1, agenda, true)
  ws = resizeTo(ws, [0.5, 0.5, 0])
  ws = focusAt(ws, 2)
  const href = hrefOfWorkspace(ws)
  const back = workspaceOf(href)
  expect(back.panes.map((pane) => pane.route)).toEqual([house, kitchen, agenda])
  expect(back.focus).toBe(2)
  expect(isCollapsed(back.panes[2]!)).toBe(true)
  expect(back.panes[0]!.width).toBeCloseTo(0.5, 5)
  expect(back.panes[1]!.width).toBeCloseTo(0.5, 5)
})

test("Alt+click reuses the pane to the right, and never the leftmost", () => {
  const two = openRight(lone(house), 0, kitchen)
  const reused = openRight(two, 0, garden)
  expect(reused.panes.length).toBe(2)
  expect(reused.panes[0]!.route).toEqual(house)
  expect(reused.panes[1]!.route).toEqual(garden)
  expect(reused.focus).toBe(1)
})

test("Alt+click from the rightmost pane creates a new one", () => {
  const two = openRight(lone(house), 0, kitchen)
  const three = openRight(two, 1, garden)
  expect(three.panes.map((pane) => pane.route)).toEqual([house, kitchen, garden])
  expect(three.focus).toBe(2)
})

test("Alt+Shift+click forces a new pane even when a right neighbour exists", () => {
  const two = openRight(lone(house), 0, kitchen)
  const forced = openRight(two, 0, garden, true)
  expect(forced.panes.map((pane) => pane.route)).toEqual([
    house,
    garden,
    kitchen,
  ])
  expect(forced.focus).toBe(1)
})

test("closing the second-to-last pane returns a plain page address", () => {
  const two = openRight(lone(house), 0, kitchen)
  const one = closeFocused(two)
  expect(isLone(one)).toBe(true)
  expect(one.panes[0]!.route).toEqual(house)
  expect(hrefOfWorkspace(one)).toBe("/o/house.olai")
})

test("closing a middle pane keeps the others and moves focus right", () => {
  let ws = openRight(lone(house), 0, kitchen)
  ws = openRight(ws, 1, garden)
  ws = focusAt(ws, 1)
  const after = closeFocused(ws)
  expect(after.panes.map((pane) => pane.route)).toEqual([house, garden])
  expect(after.focus).toBe(1)
})

test("closing the last remaining pane is a no-op", () => {
  const one = lone(house)
  expect(closeAt(one, 0)).toEqual(one)
  expect(closeFocused(one)).toEqual(one)
})

test("navigateIn writes the pane you named, and focuses it", () => {
  const two = openRight(lone(house), 0, kitchen)
  const next = navigateIn(two, 0, today)
  expect(next.panes[0]!.route).toEqual(today)
  expect(next.panes[1]!.route).toEqual(kitchen)
  expect(next.focus).toBe(0)
})

test("focus walks with wrap, and a lone pane does not move", () => {
  const two = openRight(lone(house), 0, kitchen)
  expect(focusBy(two, -1).focus).toBe(0)
  expect(focusBy(focusAt(two, 0), -1).focus).toBe(1)
  expect(focusBy(lone(house), 1)).toEqual(lone(house))
  expect(focusedRoute(focusAt(two, 0))).toEqual(house)
})

test("collapse and expand are different verbs from close", () => {
  const two = openRight(lone(house), 0, kitchen)
  const rail = collapseAt(two, 1)
  expect(rail.panes.length).toBe(2)
  expect(isCollapsed(rail.panes[1]!)).toBe(true)
  expect(isCollapsed(rail.panes[0]!)).toBe(false)
  const open = expandAt(rail, 1)
  expect(isCollapsed(open.panes[1]!)).toBe(false)
  expect(open.panes.length).toBe(2)
  expect(closeAt(two, 1).panes.length).toBe(1)
})

test("a lone pane refuses to collapse", () => {
  expect(collapseAt(lone(house), 0)).toEqual(lone(house))
})

test("reopening a reused right pane uncollapses it", () => {
  const two = collapseAt(openRight(lone(house), 0, kitchen), 1)
  expect(isCollapsed(two.panes[1]!)).toBe(true)
  const reused = openRight(two, 0, garden)
  expect(isCollapsed(reused.panes[1]!)).toBe(false)
  expect(reused.panes[1]!.route).toEqual(garden)
  // Not merely "width is not 0" — a cleared width next to a stored 1
  // made flexOf give the reused pane nothing, so it stayed a rail.
  expect(flexOf(reused.panes)[1]!).toBeGreaterThan(0)
})

test("an expanded sliver does not print as a collapsed rail", () => {
  let ws = openRight(lone(house), 0, kitchen)
  ws = resizeTo(ws, [0.996, 0.004])
  expect(isCollapsed(ws.panes[1]!)).toBe(false)
  const back = workspaceOf(hrefOfWorkspace(ws))
  expect(isCollapsed(back.panes[1]!)).toBe(false)
  expect(flexOf(back.panes)[1]!).toBeGreaterThan(0)
})

test("pathological w= is a kindness, not a throw", () => {
  const two = "/s/o%2Fhouse.olai/n%2Fkitchen"
  // Both zeros: nothing expanded to be a fraction of. Equal shares.
  const allRails = workspaceOf(`${two}?w=0,0`)
  expect(allRails.panes.length).toBe(2)
  expect(allRails.panes.every((pane) => pane.width === undefined)).toBe(true)
  // Junk beside a number: the junk is no share, the number is.
  const junk = workspaceOf(`${two}?w=abc,50`)
  expect(junk.panes[0]!.width).toBeUndefined()
  expect(junk.panes[1]!.width).toBe(1)
  // A negative is a rail, not a throw.
  const neg = workspaceOf(`${two}?w=-10,50`)
  expect(isCollapsed(neg.panes[0]!)).toBe(true)
  expect(neg.panes[1]!.width).toBe(1)
})

test("reorder follows the moved pane when it was focused", () => {
  let ws = openRight(lone(house), 0, kitchen)
  ws = openRight(ws, 1, garden)
  ws = focusAt(ws, 0)
  const moved = reorder(ws, 0, 2)
  expect(moved.panes.map((pane) => pane.route)).toEqual([kitchen, garden, house])
  expect(moved.focus).toBe(2)
})

test("flexOf gives collapsed panes nothing and shares the rest", () => {
  const two = collapseAt(openRight(lone(house), 0, kitchen), 1)
  const flex = flexOf(two.panes)
  expect(flex[1]).toBe(0)
  expect(flex[0]).toBeGreaterThan(0)
})

test("an empty /s/ is the default outline, not a throw", () => {
  expect(workspaceOf("/s/")).toEqual(lone({ kind: "outline", file: null }))
  expect(workspaceOf("/s")).toEqual(lone(routeOf("/s")))
})
