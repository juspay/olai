import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import type { AttentionRow } from "olai-plugin-chat/attention"
import { fileNamed, NO_PAGES, type Route, routingOver } from "olai-plugin-navigation/routes"
import { marksOver } from "./attention.ts"
import type { Dots, Tab } from "./contract.ts"

const chatOver = (rows: () => readonly AttentionRow[]) =>
  ({
    agents: { rows, at: (id: string) => rows().find(row => row.id === id) },
    folding: { unfolded: () => true },
    isCurrent: (route: Route, row: AttentionRow) => fileNamed(route) === row.file,
  })

const mark = (marks: ReadonlyArray<Dots>, label: string): Dots => {
  const found = marks.find(one => one.label === label)
  if (found === undefined) throw new Error(`no mark called ${label}; there are ${marks.map(one => one.label).join(", ")}`)
  return found
}

test("tab attention parses no addresses until a conversation needs one, and reparses only the changed address", () => {
  let parsed = 0
  const base = routingOver(() => undefined, () => NO_PAGES)
  const routes = { ...base, routeOf: (...args: Parameters<typeof base.routeOf>) => { parsed++; return base.routeOf(...args) } }
  const [rows, setRows] = createSignal<readonly AttentionRow[]>([])
  const [tabs, setTabs] = createSignal<readonly Tab[]>([
    { id: "a", href: "/house.olai", title: "House" }, { id: "b", href: "/garden.olai", title: "Garden" },
  ])
  const view = createRoot(dispose => ({ dispose, marks: marksOver(chatOver(rows), routes, tabs) }))
  try {
    const needing = mark(view.marks, "Needs you")
    expect(needing.ids().size).toBe(0)
    expect(parsed).toBe(0)
    setTabs(all => all.map(tab => ({ ...tab, title: "renamed" })))
    expect(parsed).toBe(0)
    setRows([{ id: "node", file: "house.olai", kind: "node", standing: "idle", unread: false }])
    expect(parsed).toBe(0)
    setRows([{ id: "node", file: "house.olai", kind: "node", standing: "needs-you", unread: false }])
    expect([...needing.ids()]).toEqual(["a"])
    expect(parsed).toBe(2)
    setTabs(all => all.map(tab => tab.id === "b" ? { ...tab, href: "/other.olai" } : tab))
    expect(parsed).toBe(3)
    setRows([])
    setTabs(all => all.map(tab => ({ ...tab, href: "/elsewhere.olai" })))
    expect(needing.ids().size).toBe(0)
    expect(parsed).toBe(3)
  } finally { view.dispose() }
})

test("the unread mark reads chat's own fact, and ranks below the question", () => {
  const routes = routingOver(() => undefined, () => NO_PAGES)
  const [rows, setRows] = createSignal<readonly AttentionRow[]>([])
  const tabs = () => [
    { id: "a", href: "/house.olai", title: "House" }, { id: "b", href: "/garden.olai", title: "Garden" },
  ] as const
  const view = createRoot(dispose => ({ dispose, marks: marksOver(chatOver(rows), routes, tabs) }))
  try {
    const unread = mark(view.marks, "Unread")
    const needing = mark(view.marks, "Needs you")
    setRows([{ id: "node", file: "house.olai", kind: "node", standing: "idle", unread: false }])
    expect(unread.ids().size).toBe(0)
    setRows([{ id: "node", file: "house.olai", kind: "node", standing: "idle", unread: true }])
    expect([...unread.ids()]).toEqual(["a"])
    expect(unread.rank).toBeLessThan(needing.rank)
    expect([...needing.ids()]).toEqual([])
    setRows([])
    expect(unread.ids().size).toBe(0)
  } finally { view.dispose() }
})
