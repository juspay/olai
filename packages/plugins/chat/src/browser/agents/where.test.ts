import { expect, test } from "bun:test"
import { whereRows } from "./where.ts"

const node = (id: string, parent: string | null = null, path: string[] = []) => ({ id, title: id, file: "work.olai", path, parent })
const base = { defaultOffered: true, defaultParent: null, here: null, recent: [], nodes: [], typed: "" }

test("Default leads, then Here, then Recent; Nodes only once something is typed", () => {
  const rows = whereRows({ ...base, here: "here", recent: ["agent"], nodes: [node("here"), node("agent", "home"), node("home")] })
  expect(rows.map(row => [row.section, row.node?.id])).toEqual([["Default", undefined], ["Here", "here"], ["Recent", "home"]])
})

test("Recent deduplicates parents, skips the default container and stops at five", () => {
  const parents = Array.from({ length: 10 }, (_, i) => node(`parent${i}`))
  const children = parents.map(one => node(`child-${one.id}`, one.id))
  const rows = whereRows({ ...base, defaultParent: "chats-2",
    nodes: [node("chats-2"), node("default-child", "chats-2"), ...parents, ...children, node("duplicate", "parent0")],
    recent: ["default-child", "duplicate", ...children.map(one => one.id)] })
  expect(rows.map(row => row.node?.id)).toEqual([undefined, "parent0", "parent1", "parent2", "parent3", "parent4"])
})

test("no Inbox entry, no Default row — the rest still offered", () => {
  const rows = whereRows({ ...base, defaultOffered: false, here: "here", nodes: [node("here")] })
  expect(rows.map(row => row.section)).toEqual(["Here"])
})

test("typing filters every section by title and trail, and caps Nodes at twenty", () => {
  const nodes = [node("here"), ...Array.from({ length: 40 }, (_, i) => node(`garden${i}`, null, ["Plans"]))]
  const rows = whereRows({ ...base, here: "here", nodes, typed: "plans" })
  expect(rows.some(row => row.section === "Default" || row.section === "Here")).toBe(false)
  expect(rows.filter(row => row.section === "Nodes")).toHaveLength(20)
  expect(whereRows({ ...base, typed: "inbox" }).map(row => row.section)).toEqual(["Default"])
})

test("a node is listed once, under the first section that names it", () => {
  const rows = whereRows({ ...base, here: "home", recent: ["agent"], nodes: [node("home"), node("agent", "home")], typed: "o" })
  expect(rows.filter(row => row.node?.id === "home").map(row => row.section)).toEqual(["Here"])
  expect(new Set(rows.map(row => row.node?.id)).size).toBe(rows.length)
})

test("the default container is never offered again under another heading", () => {
  const rows = whereRows({ ...base, defaultParent: "chats", here: "chats", nodes: [node("chats")], typed: "" })
  expect(rows.map(row => row.section)).toEqual(["Default"])
})
