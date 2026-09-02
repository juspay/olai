import { expect, test } from "bun:test"

import type { Route } from "./routes.ts"
import { atElement, atFile, atNode, HOME_ROUTE, hrefOf, routeOf } from "./routes.ts"
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
  panesOf,
  reorder,
  resizeTo,
  splitOf,
  workspaceOf,
  WORKSPACE_PREFIX,
} from "./workspace.ts"

const house: Route = atFile("house.org")
const kitchen: Route = atNode("kitchen")
const garden: Route = atFile("garden.org")
const agenda: Route = { kind: "agenda" }
const today: Route = { kind: "today" }
const doc: Route = atElement("notes/finishes.md", "beds")
const filtered: Route = { ...atFile("house.org"), filter: "is:done" }

test("a lone page is exactly the address it always was", () => {
  expect(hrefOfWorkspace(lone(house))).toBe("/house.org")
  expect(hrefOfWorkspace(lone(filtered))).toBe("/house.org?q=is%3Adone")
  expect(hrefOfWorkspace(lone(doc))).toBe("/notes/finishes.md#beds")
  expect(hrefOfWorkspace(lone(agenda))).toBe("/agenda")
  expect(workspaceOf("/house.org")).toEqual(lone(house))
  expect(workspaceOf("/house.org?q=is%3Adone")).toEqual(lone(filtered))
  expect(workspaceOf("/notes/finishes.md#beds")).toEqual(lone(doc))
})

test("every existing page address is a workspace of one", () => {
  const addresses = [
    "/",
    "/house.org",
    "/#kitchen",
    "/finishes.md",
    "/d/2026-08-10",
    "/today",
    "/agenda",
    "/trash",
    "/house.org?q=%23home",
    "/?q=is:done#kitchen",
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
  expect(panesOf(ws).map((pane) => pane.route)).toEqual([house, kitchen])
  expect(ws.focus).toBe(1)
  const href = hrefOfWorkspace(ws)
  expect(href.startsWith(WORKSPACE_PREFIX)).toBe(true)
  expect(panesOf(workspaceOf(href)).map((pane) => pane.route)).toEqual([
    house,
    kitchen,
  ])
  expect(workspaceOf(href).focus).toBe(1)
})

test("a pane's own filter and a document fragment survive the split", () => {
  const ws = openRight(lone(filtered), 0, doc)
  const href = hrefOfWorkspace(ws)
  const back = workspaceOf(href)
  expect(panesOf(back)[0]!.route).toEqual(filtered)
  expect(panesOf(back)[1]!.route).toEqual(doc)
})

test("three panes, a width split and a collapsed rail round-trip", () => {
  let ws = openRight(lone(house), 0, kitchen)
  ws = openRight(ws, 1, agenda, true)
  ws = resizeTo(ws, [0.5, 0.5, 0])
  ws = focusAt(ws, 2)
  const href = hrefOfWorkspace(ws)
  const back = workspaceOf(href)
  expect(panesOf(back).map((pane) => pane.route)).toEqual([house, kitchen, agenda])
  expect(back.focus).toBe(2)
  expect(isCollapsed(panesOf(back)[2]!)).toBe(true)
  expect(panesOf(back)[0]!.width).toBeCloseTo(0.5, 5)
  expect(panesOf(back)[1]!.width).toBeCloseTo(0.5, 5)
})

test("Alt+click reuses the pane to the right, and never the leftmost", () => {
  const two = openRight(lone(house), 0, kitchen)
  const reused = openRight(two, 0, garden)
  expect(panesOf(reused).length).toBe(2)
  expect(panesOf(reused)[0]!.route).toEqual(house)
  expect(panesOf(reused)[1]!.route).toEqual(garden)
  expect(reused.focus).toBe(1)
})

test("Alt+click from the rightmost pane creates a new one", () => {
  const two = openRight(lone(house), 0, kitchen)
  const three = openRight(two, 1, garden)
  expect(panesOf(three).map((pane) => pane.route)).toEqual([house, kitchen, garden])
  expect(three.focus).toBe(2)
})

test("Alt+Shift+click forces a new pane even when a right neighbour exists", () => {
  const two = openRight(lone(house), 0, kitchen)
  const forced = openRight(two, 0, garden, true)
  expect(panesOf(forced).map((pane) => pane.route)).toEqual([
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
  expect(panesOf(one)[0]!.route).toEqual(house)
  expect(hrefOfWorkspace(one)).toBe("/house.org")
})

test("closing a middle pane keeps the others and moves focus right", () => {
  let ws = openRight(lone(house), 0, kitchen)
  ws = openRight(ws, 1, garden)
  ws = focusAt(ws, 1)
  const after = closeFocused(ws)
  expect(panesOf(after).map((pane) => pane.route)).toEqual([house, garden])
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
  expect(panesOf(next)[0]!.route).toEqual(today)
  expect(panesOf(next)[1]!.route).toEqual(kitchen)
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
  expect(panesOf(rail).length).toBe(2)
  expect(isCollapsed(panesOf(rail)[1]!)).toBe(true)
  expect(isCollapsed(panesOf(rail)[0]!)).toBe(false)
  const open = expandAt(rail, 1)
  expect(isCollapsed(panesOf(open)[1]!)).toBe(false)
  expect(panesOf(open).length).toBe(2)
  expect(panesOf(closeAt(two, 1)).length).toBe(1)
})

test("a lone pane refuses to collapse", () => {
  expect(collapseAt(lone(house), 0)).toEqual(lone(house))
})

test("reopening a reused right pane uncollapses it", () => {
  const two = collapseAt(openRight(lone(house), 0, kitchen), 1)
  expect(isCollapsed(panesOf(two)[1]!)).toBe(true)
  const reused = openRight(two, 0, garden)
  expect(isCollapsed(panesOf(reused)[1]!)).toBe(false)
  expect(panesOf(reused)[1]!.route).toEqual(garden)
  // Not merely "width is not 0" — a cleared width next to a stored 1
  // made flexOf give the reused pane nothing, so it stayed a rail.
  expect(flexOf(panesOf(reused))[1]!).toBeGreaterThan(0)
})

test("an expanded sliver does not print as a collapsed rail", () => {
  let ws = openRight(lone(house), 0, kitchen)
  ws = resizeTo(ws, [0.996, 0.004])
  expect(isCollapsed(panesOf(ws)[1]!)).toBe(false)
  const back = workspaceOf(hrefOfWorkspace(ws))
  expect(isCollapsed(panesOf(back)[1]!)).toBe(false)
  expect(flexOf(panesOf(back))[1]!).toBeGreaterThan(0)
})

test("pathological w= is a kindness, not a throw", () => {
  const two = "/s/house.org/%23kitchen"
  // Both zeros: nothing expanded to be a fraction of. Equal shares.
  const allRails = workspaceOf(`${two}?w=0,0`)
  expect(panesOf(allRails).length).toBe(2)
  expect(panesOf(allRails).every((pane) => pane.width === undefined)).toBe(true)
  // Junk beside a number: the junk is no share, the number is.
  const junk = workspaceOf(`${two}?w=abc,50`)
  expect(panesOf(junk)[0]!.width).toBeUndefined()
  expect(panesOf(junk)[1]!.width).toBe(1)
  // A negative is a rail, not a throw.
  const neg = workspaceOf(`${two}?w=-10,50`)
  expect(isCollapsed(panesOf(neg)[0]!)).toBe(true)
  expect(panesOf(neg)[1]!.width).toBe(1)
})

test("reorder follows the moved pane when it was focused", () => {
  let ws = openRight(lone(house), 0, kitchen)
  ws = openRight(ws, 1, garden)
  ws = focusAt(ws, 0)
  const moved = reorder(ws, 0, 2)
  expect(panesOf(moved).map((pane) => pane.route)).toEqual([kitchen, garden, house])
  expect(moved.focus).toBe(2)
})

test("flexOf gives collapsed panes nothing and shares the rest", () => {
  const two = collapseAt(openRight(lone(house), 0, kitchen), 1)
  const flex = flexOf(panesOf(two))
  expect(flex[1]).toBe(0)
  expect(flex[0]).toBeGreaterThan(0)
})

test("an empty /s/ is the default outline, not a throw", () => {
  expect(workspaceOf("/s/")).toEqual(lone(HOME_ROUTE))
  expect(workspaceOf("/s")).toEqual(lone(routeOf("/s")))
})

test("a one-level row writes the flat `/s/` URL, byte for byte", () => {
  const ws = openRight(lone(house), 0, kitchen)
  expect(hrefOfWorkspace(ws)).toBe("/s/house.org/%23kitchen?w=50%2C50&f=1")
  expect(hrefOfWorkspace(ws).includes("a=")).toBe(false)
  expect(hrefOfWorkspace(ws).includes("t=")).toBe(false)
})

test("an absent or unknown axis is a row", () => {
  const flat = workspaceOf("/s/house.org/%23kitchen")
  expect(flat.layout.kind).toBe("split")
  if (flat.layout.kind === "split") expect(flat.layout.axis).toBe("row")
  const unknown = workspaceOf("/s/house.org/%23kitchen?a=diagonal")
  expect(unknown.layout.kind).toBe("split")
  if (unknown.layout.kind === "split") expect(unknown.layout.axis).toBe("row")
})

test("a nested value round-trips through the address", () => {
  const nested = splitOf(
    "col",
    [
      { layout: { kind: "leaf", route: house }, fraction: 0.4 },
      {
        layout: splitOf("row", [
          { layout: { kind: "leaf", route: kitchen }, fraction: 0.5 },
          { layout: { kind: "leaf", route: garden }, fraction: 0.5 },
        ]).layout,
        fraction: 0.6,
      },
    ],
    2,
  )
  const href = hrefOfWorkspace(nested)
  expect(href.includes("t=")).toBe(true)
  expect(href.includes("col")).toBe(true)
  const back = workspaceOf(href)
  expect(back.layout).toEqual(nested.layout)
  expect(back.focus).toBe(2)
  expect(hrefOfWorkspace(back)).toBe(href)
})

test("a one-level column is a=col, not a tree", () => {
  const col = splitOf("col", [
    { layout: { kind: "leaf", route: house }, fraction: 0.5 },
    { layout: { kind: "leaf", route: kitchen }, fraction: 0.5 },
  ])
  const href = hrefOfWorkspace(col)
  expect(href.includes("a=col")).toBe(true)
  expect(href.includes("t=")).toBe(false)
  const back = workspaceOf(href)
  expect(back.layout.kind).toBe("split")
  if (back.layout.kind === "split") expect(back.layout.axis).toBe("col")
})
