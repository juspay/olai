import { expect, test } from "bun:test"
import { itemRows, type LocationItem } from "./where.ts"

const node = (id: string, path: string[] = []): LocationItem =>
  ({ key: id, kind: "node", title: id, file: "work.olai", path })
const note = (path: string): LocationItem =>
  ({ key: `/${path}`, kind: "note", title: path.slice(path.lastIndexOf("/") + 1, -3), file: path, path: [] })
const base = { here: null, recent: [], items: [], typed: "" }

test("Here leads, then Recent; the searched sections only once something is typed", () => {
  const rows = itemRows({ ...base, here: "here", recent: ["agent"], items: [node("here"), node("agent"), node("home")] })
  expect(rows.map(row => [row.section, row.item.key])).toEqual([["Here", "here"], ["Recent", "agent"]])
})

// NOTHING IS OFFERED BY DEFAULT: a chat is about a thing the person picked,
// and with nothing typed, nowhere to stand and no chats behind them there is
// no row to press.
test("with nowhere to stand and nothing typed there is no row at all", () => {
  expect(itemRows({ ...base, items: [node("home")] })).toEqual([])
})

test("Here takes the focused pane's note", () => {
  const rows = itemRows({ ...base, here: "/notes/plan.md", items: [note("notes/plan.md")] })
  expect(rows.map(row => [row.section, row.item.key])).toEqual([["Here", "/notes/plan.md"]])
})

test("Recent stops at five", () => {
  const items = Array.from({ length: 10 }, (_, i) => node(`chat${i}`))
  const rows = itemRows({ ...base, items, recent: items.map(one => one.key) })
  expect(rows.map(row => row.item.key)).toEqual(["chat0", "chat1", "chat2", "chat3", "chat4"])
})

test("typing filters every section by title and trail, and caps each kind at twenty", () => {
  const items = [
    node("here"),
    ...Array.from({ length: 40 }, (_, i) => node(`garden${i}`, ["Plans"])),
    ...Array.from({ length: 40 }, (_, i) => note(`plans/garden${i}.md`)),
  ]
  const rows = itemRows({ ...base, here: "here", items, typed: "plans" })
  expect(rows.some(row => row.section === "Here")).toBe(false)
  expect(rows.filter(row => row.section === "Nodes")).toHaveLength(20)
  expect(rows.filter(row => row.section === "Notes")).toHaveLength(20)
})

test("an item is listed once, under the first section that names it", () => {
  const rows = itemRows({ ...base, here: "home", recent: ["/notes/home.md"],
    items: [node("home"), note("notes/home.md")], typed: "ho" })
  expect(rows.map(row => [row.section, row.item.key]))
    .toEqual([["Here", "home"], ["Recent", "/notes/home.md"]])
})

test("the searched nodes come before the searched notes", () => {
  const rows = itemRows({ ...base, items: [note("plans/garden.md"), node("garden")], typed: "garden" })
  expect(rows.map(row => [row.section, row.item.key]))
    .toEqual([["Nodes", "garden"], ["Notes", "/plans/garden.md"]])
})
