import { expect, test } from "bun:test"
import { heldToWord, loadRows, retryableModule, ModuleReloadRequired } from "./loading.ts"

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

test("a vault chunk that declares another word is not mounted, and its row says both words", async () => {
  const named = (name: string) => ({ default: { name } })
  const result = await loadRows([
    { id: "reader", load: heldToWord("reader", async () => named("tabs")) },
    { id: "swatch", load: heldToWord("swatch", async () => named("swatch")) },
  ])
  expect(result.loaded).toEqual([named("swatch")])
  expect([...result.failed.keys()]).toEqual(["reader"])
  const said = result.failed.get("reader") ?? ""
  expect(said).toContain(`"reader"`)
  expect(said).toContain(`"tabs"`)
  expect(result.reloadRequired.size).toBe(0)
})

test("a vault chunk that exports no plugin is refused by the same check", async () => {
  const result = await loadRows([{ id: "reader", load: heldToWord("reader", async () => ({})) }])
  expect(result.loaded).toEqual([])
  expect(result.failed.get("reader")).toContain(`"reader"`)
})

test("the word is read once: the half handed on is stamped with the roster's word", async () => {
  // A name that answers the roster's word when it is checked and another word
  // after: the mount must not get to read it a second time.
  let reads = 0
  const shifting = { default: { get name() { reads += 1; return reads === 1 ? "reader" : "tabs" } } }
  const result = await loadRows([{ id: "reader", load: heldToWord("reader", async () => shifting) }])
  const [half] = result.loaded as ReadonlyArray<{ readonly default: { readonly name: string } }>
  expect(half?.default.name).toBe("reader")
  expect(half?.default.name).toBe("reader")
})
