import { expect, test } from "bun:test"
import { whereRows } from "./where.ts"

const node = (id: string, parent: string | null = null, path: string[] = []) => ({ id, title: id, file: "work.olai", path, parent })
const base = { here: null, recent: [], nodes: [], typed: "" }

test("Here leads, then Recent; Nodes only once something is typed", () => {
  const rows = whereRows({ ...base, here: "here", recent: ["agent"], nodes: [node("here"), node("agent", "home"), node("home")] })
  expect(rows.map(row => [row.section, row.node.id])).toEqual([["Here", "here"], ["Recent", "home"]])
})

// NOTHING IS OFFERED BY DEFAULT: a new chat is minted under a node the person
// picked, and with nothing typed and nowhere to stand there is no row to press.
test("with nowhere to stand and nothing typed there is no row at all", () => {
  expect(whereRows({ ...base, nodes: [node("home")] })).toEqual([])
})

test("Recent deduplicates parents and stops at five", () => {
  const parents = Array.from({ length: 10 }, (_, i) => node(`parent${i}`))
  const children = parents.map(one => node(`child-${one.id}`, one.id))
  const rows = whereRows({ ...base,
    nodes: [...parents, ...children, node("duplicate", "parent0")],
    recent: ["duplicate", ...children.map(one => one.id)] })
  expect(rows.map(row => row.node.id)).toEqual(["parent0", "parent1", "parent2", "parent3", "parent4"])
})

test("typing filters every section by title and trail, and caps Nodes at twenty", () => {
  const nodes = [node("here"), ...Array.from({ length: 40 }, (_, i) => node(`garden${i}`, null, ["Plans"]))]
  const rows = whereRows({ ...base, here: "here", nodes, typed: "plans" })
  expect(rows.some(row => row.section === "Here")).toBe(false)
  expect(rows.filter(row => row.section === "Nodes")).toHaveLength(20)
})

test("a node is listed once, under the first section that names it", () => {
  const rows = whereRows({ ...base, here: "home", recent: ["agent"], nodes: [node("home"), node("agent", "home")], typed: "o" })
  expect(rows.filter(row => row.node.id === "home").map(row => row.section)).toEqual(["Here"])
  expect(new Set(rows.map(row => row.node.id)).size).toBe(rows.length)
})
