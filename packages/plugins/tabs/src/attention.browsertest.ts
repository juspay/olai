import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import type { AttentionRow } from "olai-plugin-chat/attention"
import { NO_PAGES, routingOver } from "olai-plugin-navigation/routes"
import { needingYou } from "./attention.ts"
import type { Tab } from "./contract.ts"

test("tab attention parses no addresses until a conversation waits, and reparses only the changed address", () => {
  let parsed = 0
  const base = routingOver(() => undefined, () => NO_PAGES)
  const routes = { ...base, routeOf: (...args: Parameters<typeof base.routeOf>) => { parsed++; return base.routeOf(...args) } }
  const [rows, setRows] = createSignal<readonly AttentionRow[]>([])
  const [tabs, setTabs] = createSignal<readonly Tab[]>([
    { id: "a", href: "/house.olai", title: "House" }, { id: "b", href: "/garden.olai", title: "Garden" },
  ])
  const view = createRoot(dispose => ({ dispose, dots: needingYou({ agents: { rows, at: id => rows().find(row => row.id === id) }, folding: { unfolded: () => true } }, routes, tabs) }))
  try {
    expect(view.dots.ids().size).toBe(0)
    expect(parsed).toBe(0)
    setTabs(all => all.map(tab => ({ ...tab, title: "renamed" })))
    expect(parsed).toBe(0)
    setRows([{ id: "node", file: "house.olai", standing: "needs-you" }])
    expect([...view.dots.ids()]).toEqual(["a"])
    expect(parsed).toBe(2)
    setTabs(all => all.map(tab => tab.id === "b" ? { ...tab, href: "/other.olai" } : tab))
    expect(parsed).toBe(3)
    setRows([])
    setTabs(all => all.map(tab => ({ ...tab, href: "/elsewhere.olai" })))
    expect(view.dots.ids().size).toBe(0)
    expect(parsed).toBe(3)
  } finally { view.dispose() }
})
