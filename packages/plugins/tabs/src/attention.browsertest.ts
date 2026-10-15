import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import type { AttentionRow } from "olai-plugin-chat/attention"
import { NO_PAGES, routingOver } from "olai-plugin-navigation/routes"
import { needingYou, unreadIn } from "./attention.ts"
import type { Tab } from "./contract.ts"

const chatOver = (rows: () => readonly AttentionRow[]) =>
  ({ agents: { rows, at: (id: string) => rows().find(row => row.id === id) }, folding: { unfolded: () => true } })

test("tab attention parses no addresses until a conversation waits, and reparses only the changed address", () => {
  let parsed = 0
  const base = routingOver(() => undefined, () => NO_PAGES)
  const routes = { ...base, routeOf: (...args: Parameters<typeof base.routeOf>) => { parsed++; return base.routeOf(...args) } }
  const [rows, setRows] = createSignal<readonly AttentionRow[]>([])
  const [tabs, setTabs] = createSignal<readonly Tab[]>([
    { id: "a", href: "/house.olai", title: "House" }, { id: "b", href: "/garden.olai", title: "Garden" },
  ])
  const view = createRoot(dispose => ({ dispose, dots: needingYou(chatOver(rows), routes, tabs) }))
  try {
    expect(view.dots.ids().size).toBe(0)
    expect(parsed).toBe(0)
    setTabs(all => all.map(tab => ({ ...tab, title: "renamed" })))
    expect(parsed).toBe(0)
    setRows([{ id: "node", file: "house.olai", standing: "needs-you", unread: false }])
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

test("the unread reading marks the tabs holding a conversation nobody has read, and its own marks", () => {
  // The two readings differ in two things only — which rows they are over and
  // how the mark looks — so what is asserted here is that the second one reads
  // chat's `unread` fact and not the standing beside it, and that it is the
  // QUIETER of the two (`./contract.ts`'s rank), which is what makes a tab that
  // is both waiting and unread wear the asking mark.
  const routes = routingOver(() => undefined, () => NO_PAGES)
  const [rows, setRows] = createSignal<readonly AttentionRow[]>([])
  const chat = chatOver(rows)
  const tabs = () => [
    { id: "a", href: "/house.olai", title: "House" }, { id: "b", href: "/garden.olai", title: "Garden" },
  ] as const
  const view = createRoot(dispose => ({
    dispose, unread: unreadIn(chat, routes, tabs), needed: needingYou(chat, routes, tabs),
  }))
  try {
    // A conversation that is standing idle — the sidebar's dot, not this mark.
    setRows([{ id: "node", file: "house.olai", standing: "idle", unread: false }])
    expect(view.unread.ids().size).toBe(0)
    setRows([{ id: "node", file: "house.olai", standing: "idle", unread: true }])
    expect([...view.unread.ids()]).toEqual(["a"])
    expect(view.unread.label).toBe("Unread")
    expect(view.unread.rank).toBeLessThan(view.needed.rank)
    // The rows are disjoint by construction — an idle conversation is nobody's
    // question — so the two marks are two readings of one roster.
    expect([...view.needed.ids()]).toEqual([])
    setRows([])
    expect(view.unread.ids().size).toBe(0)
  } finally { view.dispose() }
})
