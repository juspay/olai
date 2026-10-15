import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import type { AttentionRow } from "olai-plugin-chat/attention"
import { NO_PAGES, routingOver } from "olai-plugin-navigation/routes"
import { marksOver } from "./attention.ts"
import type { Dots, Tab } from "./contract.ts"

const chatOver = (rows: () => readonly AttentionRow[]) =>
  ({ agents: { rows, at: (id: string) => rows().find(row => row.id === id) }, folding: { unfolded: () => true } })

/** The mark a reading is, by its own name — the two are told apart by what they
 *  are CALLED and by their rank, never by their paint. */
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
    setRows([{ id: "node", file: "house.olai", standing: "needs-you", unread: false }])
    expect([...needing.ids()]).toEqual(["a"])
    // ONE PARSE PER TAB, whoever is reading: the two marks share the walk, so
    // the second is not a second `workspaceOf` per tab.
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
  // The two readings differ in two things only — which rows they are over and
  // how the mark looks — so what is asserted here is that the second one reads
  // `unread` rather than the standing beside it, and that it is the QUIETER of
  // the two (`./contract.ts`'s rank), which is what makes a tab that is both
  // waiting and unread wear the asking mark.
  const routes = routingOver(() => undefined, () => NO_PAGES)
  const [rows, setRows] = createSignal<readonly AttentionRow[]>([])
  const tabs = () => [
    { id: "a", href: "/house.olai", title: "House" }, { id: "b", href: "/garden.olai", title: "Garden" },
  ] as const
  const view = createRoot(dispose => ({ dispose, marks: marksOver(chatOver(rows), routes, tabs) }))
  try {
    const unread = mark(view.marks, "Unread")
    const needing = mark(view.marks, "Needs you")
    // A conversation that is standing idle — the sidebar's dot, not this mark.
    setRows([{ id: "node", file: "house.olai", standing: "idle", unread: false }])
    expect(unread.ids().size).toBe(0)
    setRows([{ id: "node", file: "house.olai", standing: "idle", unread: true }])
    expect([...unread.ids()]).toEqual(["a"])
    expect(unread.rank).toBeLessThan(needing.rank)
    // The rows are disjoint by construction — an idle conversation is nobody's
    // question — so the two marks are two readings of one roster.
    expect([...needing.ids()]).toEqual([])
    setRows([])
    expect(unread.ids().size).toBe(0)
  } finally { view.dispose() }
})
