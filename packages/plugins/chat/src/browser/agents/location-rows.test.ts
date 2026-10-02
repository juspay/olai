import { expect, test } from "bun:test"
import { locationRows } from "./location-rows.ts"

const node = (id: string, parent: string | null = null) => ({ id, title: id, file: "work.olai", path: [], parent })
test("Recent deduplicates parents, skips the actual default and stops at five", () => {
  const parents = Array.from({ length: 10 }, (_, i) => node(`parent${i}`))
  const children = parents.map(one => node(`child-${one.id}`, one.id))
  const rows = locationRows({ nodes: [node("chats-2"), node("default-child", "chats-2"), ...parents, ...children, node("duplicate", "parent0")],
    here: null, suggested: [], recent: ["default-child", "duplicate", ...children.map(one => one.id)], defaultParent: "chats-2", filter: "" })
  expect(rows.map(row => row.node?.id)).toEqual([undefined, "parent0", "parent1", "parent2", "parent3", "parent4"])
  expect(rows.some(row => row.section === "All nodes")).toBe(false)
})
test("Suggested and typed All nodes have separate caps and deduplicate Here", () => {
  const nodes = Array.from({ length: 100 }, (_, i) => node(`node${i}`))
  const rows = locationRows({ nodes, here: "node0", suggested: nodes.map(one => one.id), recent: [], defaultParent: null, filter: "node" })
  expect(rows.filter(row => row.section === "Suggested")).toHaveLength(5)
  expect(rows.filter(row => row.section === "All nodes")).toHaveLength(20)
  expect(new Set(rows.map(row => row.node?.id)).size).toBe(rows.length)
})
