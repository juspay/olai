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

test("recovery changes only the failed entry URL and retains the recovered module", async () => {
  const { retryableModule } = await import("./loading.ts")
  let initial = 0
  const urls: string[] = []
  const module = { identity: {} }
  const load = retryableModule(async () => { initial++; throw new Error("cached import failure") },
    () => "https://olai.example/_olai/assets/browser-hash.js", async (url) => {
      urls.push(url)
      if (urls.length === 1) throw new Error("still unavailable")
      return module
    })
  await expect(load()).rejects.toThrow("cached import failure")
  await expect(load()).rejects.toThrow("still unavailable")
  expect(await load()).toBe(module)
  expect(await load()).toBe(module)
  expect(initial).toBe(1)
  expect(urls).toEqual([
    "https://olai.example/_olai/assets/browser-hash.js?olai-import-attempt=1",
    "https://olai.example/_olai/assets/browser-hash.js?olai-import-attempt=2",
  ])
})
