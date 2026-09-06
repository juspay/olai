import { expect, test } from "bun:test"
import { loadRows, retryableModule, ModuleReloadRequired } from "./loading.ts"

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
  expect(await loadRows(rows)).toEqual({ loaded: ["recovered"], failed: new Map(), reloadRequired: new Set() })
})

test("recovery changes only the failed entry URL and retains the recovered module", async () => {
  let initial = 0
  const urls: string[] = []
  const module = { identity: {} }
  const load = retryableModule(async () => { initial++; throw new Error("cached import failure") },
    () => "https://olai.example/_olai/assets/browser-hash.js", async (url) => {
      urls.push(url)
      return module
    })
  await expect(load()).rejects.toThrow("cached import failure")
  expect(await load()).toBe(module)
  expect(await load()).toBe(module)
  expect(initial).toBe(1)
  expect(urls).toEqual([
    "https://olai.example/_olai/assets/browser-hash.js?olai-import-attempt=1",
  ])
})


test("a failed retry requires reload without repeatedly importing its cached dependency graph", async () => {
  const dependency = new Error("dependency fetch failed")
  let retries = 0
  const load = retryableModule(async () => { throw dependency }, () => "/entry.js", async () => {
    retries++
    throw dependency
  })
  await expect(load()).rejects.toBe(dependency)
  await expect(load()).rejects.toBeInstanceOf(ModuleReloadRequired)
  const result = await loadRows([{ id: "optional", load }, { id: "survivor", load: async () => "kept" }])
  expect(result.loaded).toEqual(["kept"])
  expect(result.reloadRequired).toEqual(new Set(["optional"]))
  expect(result.failed.get("optional")).toContain("Reload the page")
  expect(retries).toBe(1)
})
