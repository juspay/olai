import { expect, test } from "bun:test"
import { loadRows } from "./loading.ts"

test("optional module failures leave independent shell modules available in roster order", async () => {
  const result = await loadRows([
    { id: "optional", load: async () => { throw new Error("chunk unavailable") } },
    { id: "renderer", load: async () => "renderer" },
    { id: "sync-failure", load: () => { throw new Error("bad loader") } },
    { id: "shell", load: async () => "shell" },
  ])
  expect(result.loaded).toEqual(["renderer", "shell"])
  expect([...result.failed]).toEqual([["optional", "Error: chunk unavailable"], ["sync-failure", "Error: bad loader"]])
})

test("a later acquisition retries failed rows and clears their fault", async () => {
  let unavailable = true
  const rows = [{ id: "optional", load: async () => {
    if (unavailable) throw new Error("unavailable")
    return "recovered"
  } }]
  expect((await loadRows(rows)).failed.has("optional")).toBe(true)
  unavailable = false
  expect(await loadRows(rows)).toEqual({ loaded: ["recovered"], failed: new Map() })
})
